// ============================================================
// Canopy Quotes – Step 4: Measurements & Live Pricing
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useQuoteWizardStore } from '../../store/quoteWizardStore';
import { api } from '../../lib/api';
import type { WizardLineItem, PriceCalcResult } from './types';

// ─── Currency helper ───────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ─── Single service pricing row ───────────────────────────
function ServiceRow({
  item,
}: {
  item: WizardLineItem;
}) {
  const updateLineItem = useQuoteWizardStore((s) => s.updateLineItem);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Build unit label
  const unitLabel =
    item.billing_unit === 'sqft' ? 'sq ft'
    : item.billing_unit === 'linear_ft' ? 'linear ft'
    : item.billing_unit === 'visit' ? 'visits'
    : item.billing_unit === 'application' ? 'applications'
    : item.billing_unit;

  const isProjectFixed = item.billing_unit === 'project_fixed';

  async function calculatePrice(qty: number) {
    if (qty <= 0 || isProjectFixed) return;
    setCalcLoading(true);
    setCalcError('');
    try {
      const result: PriceCalcResult = await api.post(
        `/services/${item.service_catalog_id}/calculate-price`,
        { measurement: qty, measurement_unit: item.billing_unit }
      );
      updateLineItem(item.service_catalog_id, {
        unit_price: result.unit_price,
        line_total: result.line_total,
        suggested_total: result.line_total,
        min_price_applied: result.min_price_applied,
        formula_type: result.formula_type,
      });
    } catch (e: any) {
      setCalcError('Could not calculate price. Check your measurement.');
    } finally {
      setCalcLoading(false);
    }
  }

  function handleQuantityChange(val: string) {
    const qty = parseFloat(val) || 0;
    updateLineItem(item.service_catalog_id, { quantity: qty });
    if (qty > 0) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => calculatePrice(qty), 500);
    } else {
      updateLineItem(item.service_catalog_id, { unit_price: 0, line_total: 0, suggested_total: 0 });
    }
  }

  function handleProjectPriceChange(val: string) {
    const amount = parseFloat(val) || 0;
    updateLineItem(item.service_catalog_id, {
      quantity: 1,
      unit_price: amount,
      line_total: amount,
    });
  }

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${item.quantity === 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      {/* Service name */}
      <div className="flex items-start justify-between">
        <p className="font-semibold text-gray-900">{item.service_name}</p>
        {item.line_total > 0 && (
          <span className="text-lg font-bold text-green-600">{fmt(item.line_total)}</span>
        )}
      </div>

      {/* Measurement input */}
      {isProjectFixed ? (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Project Price ($)</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">$</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={item.unit_price || ''}
              onChange={(e) => handleProjectPriceChange(e.target.value)}
              placeholder="0.00"
              className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Measurement ({unitLabel})
            {item.quantity === 0 && (
              <span className="ml-2 text-amber-600">⚠ Enter a measurement to continue</span>
            )}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              value={item.quantity || ''}
              onChange={(e) => handleQuantityChange(e.target.value)}
              placeholder="0"
              className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <span className="text-sm text-gray-400">{unitLabel}</span>
            {calcLoading && <Loader2 size={16} className="animate-spin text-green-500" />}
          </div>

          {/* Suggested price + Final Price override */}
          {item.suggested_total > 0 && !calcLoading && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-400">
                  Suggested: {fmt(item.suggested_total)}
                </span>
                {item.unit_price > 0 && (
                  <span className="text-xs text-gray-400">
                    ({fmt(item.unit_price)}/{unitLabel}
                    {item.formula_type === 'tiered_sqft' && ', tiered'}
                    )
                  </span>
                )}
                {item.min_price_applied && (
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs text-amber-700">
                    minimum charge applied
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Final Price ($)</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.line_total || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      updateLineItem(item.service_catalog_id, { line_total: val });
                    }}
                    className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  {item.line_total !== item.suggested_total && (
                    <button
                      type="button"
                      onClick={() => updateLineItem(item.service_catalog_id, { line_total: item.suggested_total })}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {calcError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle size={12} />
              {calcError}
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description (shown on proposal)</label>
        <textarea
          value={item.description}
          onChange={(e) => updateLineItem(item.service_catalog_id, { description: e.target.value })}
          rows={2}
          maxLength={1000}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Frequency <span className="text-gray-300">(optional)</span>
        </label>
        <input
          type="text"
          value={item.frequency}
          onChange={(e) => updateLineItem(item.service_catalog_id, { frequency: e.target.value })}
          placeholder="e.g. Weekly April–November"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
    </div>
  );
}

// ─── Step 4 Main ───────────────────────────────────────────
export default function Step4Pricing() {
  const lineItems = useQuoteWizardStore((s) => s.lineItems);
  const selectedServices = useQuoteWizardStore((s) => s.selectedServices);
  const discountPct = useQuoteWizardStore((s) => s.discountPct);
  const property = useQuoteWizardStore((s) => s.property);
  const setLineItems = useQuoteWizardStore((s) => s.setLineItems);
  const setDiscountPct = useQuoteWizardStore((s) => s.setDiscountPct);

  // Initialize line items from selected services (if not already set)
  useEffect(() => {
    if (selectedServices.length > 0 && lineItems.length === 0) {
      const items: WizardLineItem[] = selectedServices.map((svc, idx) => ({
        service_catalog_id: svc.id,
        service_name: svc.name,
        billing_unit: svc.billing_unit,
        description: svc.description_template ?? '',
        frequency: '',
        quantity: 0,
        unit_price: 0,
        line_total: 0,
        suggested_total: 0,
        min_price_applied: false,
        formula_type: '',
        sort_order: idx + 1,
      }));
      setLineItems(items);
    }
  }, [selectedServices]);

  // Pre-fill measurements from property
  useEffect(() => {
    if (property && lineItems.length > 0) {
      lineItems.forEach((item) => {
        if (item.quantity === 0) {
          let prefill = 0;
          if (item.billing_unit === 'sqft') prefill = Number(property.lawn_area_sqft) || 0;
          if (prefill > 0) {
            // trigger auto-fill silently
          }
        }
      });
    }
  }, [property, lineItems.length]);

  // Totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
  const discountAmount = subtotal * (discountPct / 100);
  const total = subtotal - discountAmount;
  const discountError = discountPct < 0 || discountPct > 100 ? 'Discount must be between 0 and 100.' : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Measurements & Pricing</h2>
          <p className="mt-1 text-sm text-gray-500">Enter measurements — prices calculate automatically.</p>
        </div>
        {total > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-2xl font-bold text-green-600">{fmt(total)}</p>
          </div>
        )}
      </div>

      {/* Service rows */}
      <div className="space-y-4">
        {lineItems.map((item) => (
          <ServiceRow key={item.service_catalog_id} item={item} />
        ))}
      </div>

      {/* Discount */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Discount</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              value={discountPct || ''}
              onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
              placeholder="0"
              className={`w-20 rounded-lg border px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500 ${discountError ? 'border-red-400' : 'border-gray-300'}`}
            />
            <span className="text-gray-500 text-sm">%</span>
          </div>
          {discountPct > 0 && !discountError && (
            <span className="text-sm text-red-500 font-medium">− {fmt(discountAmount)}</span>
          )}
        </div>
        {discountError && <p className="mt-1 text-xs text-red-600">{discountError}</p>}
      </div>

      {/* Summary */}
      {subtotal > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {discountPct > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>Discount ({discountPct}%)</span>
              <span>− {fmt(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
            <span>Total</span>
            <span className="text-green-600">{fmt(total)}</span>
          </div>
        </div>
      )}

      {/* Zero guard */}
      {lineItems.some((item) => item.quantity === 0 && item.line_total === 0) && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
          <AlertCircle size={16} />
          Enter measurements or a price for all services before continuing.
        </div>
      )}
    </div>
  );
}
