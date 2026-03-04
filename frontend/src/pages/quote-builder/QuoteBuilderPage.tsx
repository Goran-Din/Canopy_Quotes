// ============================================================
// Canopy Quotes – Quote Builder Page (5-step wizard orchestrator)
// ============================================================

import React, { useEffect } from 'react';
import { useQuoteWizardStore } from '../../store/quoteWizardStore';
import { api } from '../../lib/api';
import type { WizardLineItem } from './types';
import { WizardShell } from './WizardShell';
import Step1Customer from './Step1Customer';
import Step2Property from './Step2Property';
import Step3Services from './Step3Services';
import Step4Pricing from './Step4Pricing';
import Step5Review from './Step5Review';

export default function QuoteBuilderPage() {
  const {
    currentStep,
    customer,
    property,
    serviceType,
    billingType,
    selectedServices,
    lineItems,
    discountPct,
    quoteId,
    setQuoteId,
    nextStep,
    prevStep,
    goToStep,
    setAutoSaveStatus,
    reset,
  } = useQuoteWizardStore();

  // Reset wizard on mount
  useEffect(() => {
    reset();
  }, []);

  // ─── Step validation ────────────────────────────────────
  function canAdvance(): boolean {
    switch (currentStep) {
      case 1: return !!customer;
      case 2: return !!property;
      case 3: return !!serviceType && !!billingType && selectedServices.length > 0;
      case 4: return lineItems.length > 0 && lineItems.every((item) => item.quantity > 0 || item.line_total > 0);
      case 5: return true;
      default: return false;
    }
  }

  function getValidationMessage(): string {
    switch (currentStep) {
      case 1: return 'Please select or create a customer to continue.';
      case 2: return 'Please select or add a property to continue.';
      case 3: return selectedServices.length === 0
        ? 'Select at least one service to continue.'
        : !billingType ? 'Please select a billing type.' : '';
      case 4: return 'Enter measurements or a price for all services before continuing.';
      default: return '';
    }
  }

  // ─── Save quote draft (Step 3 → 4) ─────────────────────
  async function createQuoteDraft(): Promise<boolean> {
    if (quoteId) return true; // already created
    setAutoSaveStatus('saving');
    try {
      const payload = {
        customer_id: customer!.id,
        property_id: property!.id,
        service_type: serviceType!,
        billing_type: billingType!,
        season_year: useQuoteWizardStore.getState().seasonYear ?? undefined,
        line_items: selectedServices.map((svc, idx) => ({
          service_catalog_id: svc.id,
          service_name: svc.name,
          description: svc.description_template ?? '',
          quantity: 0,
          unit: svc.billing_unit,
          unit_price: 0,
          line_total: 0,
          sort_order: idx + 1,
        })),
      };
      const result = await api.post('/quotes', payload);
      setQuoteId(result.id, result.quote_number);

      // Build initial line items from the response so they include DB IDs.
      // This populates the store BEFORE Step 4 renders, preventing
      // Step4's useEffect from re-initializing items without IDs.
      if (result.line_items) {
        const svcLookup = new Map(
          selectedServices.map((s) => [s.id, s])
        );
        const items: WizardLineItem[] = result.line_items.map((li: any) => {
          const svc = svcLookup.get(li.service_catalog_id);
          return {
            id: li.id,
            service_catalog_id: li.service_catalog_id,
            service_name: li.service_name,
            billing_unit: li.unit,
            description: li.description ?? svc?.description_template ?? '',
            frequency: li.frequency ?? '',
            quantity: li.quantity ?? 0,
            unit_price: li.unit_price ?? 0,
            line_total: li.line_total ?? 0,
            suggested_total: 0,
            min_price_applied: false,
            formula_type: '',
            sort_order: li.sort_order,
          };
        });
        useQuoteWizardStore.getState().setLineItems(items);
      }

      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
      return true;
    } catch (e) {
      setAutoSaveStatus('error');
      return false;
    }
  }

  // ─── Save line items (Step 4 → 5) ──────────────────────
  async function saveLineItems(): Promise<boolean> {
    if (!quoteId) return false;
    setAutoSaveStatus('saving');
    try {
      await api.put(`/quotes/${quoteId}/line-items`, {
        discount_pct: discountPct,
        line_items: lineItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unit: item.billing_unit,
          unit_price: item.unit_price,
          line_total: item.line_total,
          description: item.description || undefined,
          frequency: item.frequency || undefined,
          sort_order: item.sort_order,
        })),
      });
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
      return true;
    } catch (err: any) {
      console.error('[saveLineItems] PUT failed:', err?.response?.status, err?.response?.data ?? err?.message);
      console.error('[saveLineItems] Payload sent:', JSON.stringify(lineItems.map((item) => ({ id: item.id, quantity: item.quantity, unit: item.billing_unit })), null, 2));
      setAutoSaveStatus('error');
      return false;
    }
  }

  // ─── Continue button handler ────────────────────────────
  const [continueLoading, setContinueLoading] = React.useState(false);
  const [validationError, setValidationError] = React.useState('');

  async function handleContinue() {
    if (!canAdvance()) {
      setValidationError(getValidationMessage());
      return;
    }
    setValidationError('');
    setContinueLoading(true);

    try {
      if (currentStep === 3) {
        // Create draft in DB
        const ok = await createQuoteDraft();
        if (!ok) { setContinueLoading(false); return; }
      }
      if (currentStep === 4) {
        // Save line items
        const ok = await saveLineItems();
        if (!ok) { setContinueLoading(false); return; }
      }
      nextStep();
    } finally {
      setContinueLoading(false);
    }
  }

  // ─── Render step content ────────────────────────────────
  function renderStep() {
    switch (currentStep) {
      case 1: return <Step1Customer />;
      case 2: return <Step2Property />;
      case 3: return <Step3Services />;
      case 4: return <Step4Pricing />;
      case 5: return <Step5Review onEditStep={goToStep} />;
      default: return null;
    }
  }

  // Step 5 has its own send button — hide wizard continue button
  const isFinalStep = currentStep === 5;

  return (
    <WizardShell
      onBack={prevStep}
      onContinue={handleContinue}
      continueLabel={isFinalStep ? undefined : 'Continue →'}
      continueDisabled={isFinalStep || !canAdvance()}
      continueLoading={continueLoading}
      showBack={currentStep > 1}
    >
      {renderStep()}

      {/* Validation error */}
      {validationError && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <span>⚠</span>
          {validationError}
        </div>
      )}
    </WizardShell>
  );
}
