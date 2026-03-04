// ============================================================
// Canopy Quotes – Quote Wizard Shell (persistent frame)
// ============================================================

import React from 'react';
import { ArrowLeft, Check, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuoteWizardStore } from '../../store/quoteWizardStore';

const STEPS = [
  { num: 1, label: 'Customer' },
  { num: 2, label: 'Property' },
  { num: 3, label: 'Services' },
  { num: 4, label: 'Pricing' },
  { num: 5, label: 'Review' },
];

// ─── Step Indicator ────────────────────────────────────────
export function StepIndicator() {
  const currentStep = useQuoteWizardStore((s) => s.currentStep);
  const goToStep = useQuoteWizardStore((s) => s.goToStep);
  const quoteId = useQuoteWizardStore((s) => s.quoteId);

  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, idx) => {
        const completed = currentStep > step.num;
        const active = currentStep === step.num;
        const canClick = completed || (step.num < currentStep);

        return (
          <React.Fragment key={step.num}>
            {/* Step circle */}
            <button
              onClick={() => canClick && goToStep(step.num)}
              disabled={!canClick}
              className={`flex flex-col items-center gap-1 group ${canClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  completed
                    ? 'bg-green-600 border-green-600 text-white'
                    : active
                    ? 'bg-white border-green-600 text-green-600'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {completed ? <Check size={14} /> : step.num}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  active ? 'text-green-700' : completed ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </button>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 mx-1 mb-5 transition-colors ${
                  currentStep > step.num ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Auto Save Badge ───────────────────────────────────────
export function AutoSaveBadge() {
  const status = useQuoteWizardStore((s) => s.autoSaveStatus);
  if (status === 'idle') return null;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status === 'saving' && (
        <>
          <Loader2 size={12} className="animate-spin text-gray-400" />
          <span className="text-gray-400">Saving…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle2 size={12} className="text-green-500" />
          <span className="text-green-600">Saved</span>
        </>
      )}
      {status === 'error' && (
        <span className="text-red-500">Save failed</span>
      )}
    </div>
  );
}

// ─── Wizard Shell ──────────────────────────────────────────
interface WizardShellProps {
  children: React.ReactNode;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  showBack?: boolean;
}

export function WizardShell({
  children,
  onBack,
  onContinue,
  continueLabel = 'Continue →',
  continueDisabled = false,
  continueLoading = false,
  showBack = true,
}: WizardShellProps) {
  const navigate = useNavigate();
  const quoteNumber = useQuoteWizardStore((s) => s.quoteNumber);
  const currentStep = useQuoteWizardStore((s) => s.currentStep);
  const reset = useQuoteWizardStore((s) => s.reset);

  function handleBackToDashboard() {
    if (confirm('Your draft has been saved. Return to dashboard?')) {
      reset();
      navigate('/');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <button
          onClick={handleBackToDashboard}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <AutoSaveBadge />
          <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
            {quoteNumber ?? 'New Quote'} · DRAFT
          </span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <StepIndicator />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {children}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          {showBack && currentStep > 1 && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              ← Back
            </button>
          )}
        </div>
        <button
          onClick={onContinue}
          disabled={continueDisabled || continueLoading}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {continueLoading && <Loader2 size={15} className="animate-spin" />}
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
