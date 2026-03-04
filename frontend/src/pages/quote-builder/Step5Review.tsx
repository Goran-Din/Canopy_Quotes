// ============================================================
// Canopy Quotes – Step 5: Review & Send
// ============================================================

import React, { useState } from 'react';
import {
  FileText, Mail, Check, Loader2, AlertCircle,
  ExternalLink, RefreshCw, Edit2, Download, Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuoteWizardStore } from '../../store/quoteWizardStore';
import { api } from '../../lib/api';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function Step5Review({
  onEditStep,
}: {
  onEditStep: (step: number) => void;
}) {
  const navigate = useNavigate();
  const {
    customer, property, selectedServices,
    lineItems, discountPct,
    quoteId, quoteNumber,
    notesInternal, notesClient, sendToEmail,
    setNotesInternal, setNotesClient, setSendToEmail,
  } = useQuoteWizardStore();

  const [pdfStatus, setPdfStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [pdfUrl, setPdfUrl] = useState('');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sendError, setSendError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showEmailOverride, setShowEmailOverride] = useState(false);
  const [emailOverride, setEmailOverride] = useState('');

  const reset = useQuoteWizardStore((s) => s.reset);

  // Totals
  const subtotal = lineItems.reduce((s, item) => s + item.line_total, 0);
  const discountAmount = subtotal * (discountPct / 100);
  const total = subtotal - discountAmount;

  // Valid until = today + 30 days
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const recipientEmail = emailOverride || sendToEmail || customer?.billing_email || '';
  const canSend = pdfStatus === 'ready' && !!recipientEmail;

  // ─── Generate PDF ────────────────────────────────────────
  async function handleGeneratePdf() {
    if (!quoteId) return;
    setPdfStatus('generating');
    try {
      const result = await api.post(`/quotes/${quoteId}/generate-pdf`, {});
      // Poll for completion
      const jobId = result.job_id ?? result.jobId;
      if (jobId) {
        await pollPdfStatus(quoteId, jobId);
      } else if (result.signed_url ?? result.url) {
        setPdfUrl(result.signed_url ?? result.url);
        setPdfStatus('ready');
      } else {
        setPdfStatus('ready');
      }
    } catch {
      setPdfStatus('error');
    }
  }

  async function pollPdfStatus(qId: string, jobId: string) {
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const status = await api.get(`/quotes/${qId}/pdf-status/${jobId}`);
        if (status.status === 'done' || status.status === 'complete') {
          setPdfUrl(status.signed_url ?? status.url ?? '');
          setPdfStatus('ready');
          return;
        }
        if (status.status === 'failed') {
          setPdfStatus('error');
          return;
        }
      } catch { break; }
      attempts++;
    }
    setPdfStatus('error');
  }

  // ─── Send via Email ──────────────────────────────────────
  async function handleSendEmail() {
    if (!quoteId || !canSend) return;
    setSendStatus('sending');
    setSendError('');
    try {
      // Save notes first
      await api.put(`/quotes/${quoteId}`, {
        notes_internal: notesInternal || undefined,
        notes_client: notesClient || undefined,
      });
      // Send email
      await api.post(`/quotes/${quoteId}/send`, {
        recipient_email: recipientEmail,
      });
      setSendStatus('sent');
      setTimeout(() => {
        reset();
        navigate(`/quotes/${quoteId}`);
      }, 2000);
    } catch (e: any) {
      setSendError(e?.response?.data?.message ?? e?.message ?? 'Failed to send proposal. Please try again.');
      setSendStatus('error');
    }
  }

  // ─── Download PDF ──────────────────────────────────────
  function handleDownloadPdf() {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    }
  }

  // ─── Save & Complete (mark sent without email) ─────────
  async function handleSaveComplete() {
    if (!quoteId) return;
    setSaveStatus('saving');
    setSendError('');
    try {
      // Save notes
      await api.put(`/quotes/${quoteId}`, {
        notes_internal: notesInternal || undefined,
        notes_client: notesClient || undefined,
      });
      // Mark as sent (skip email)
      await api.post(`/quotes/${quoteId}/send`, {
        skip_email: true,
      });
      setSaveStatus('saved');
      setTimeout(() => {
        reset();
        navigate(`/quotes/${quoteId}`);
      }, 2000);
    } catch (e: any) {
      setSendError(e?.response?.data?.message ?? e?.message ?? 'Failed to save quote.');
      setSaveStatus('error');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Review & Send</h2>
        <p className="mt-1 text-sm text-gray-500">Confirm the quote details, generate the PDF, and send to client.</p>
      </div>

      {/* Quote number banner */}
      <div className="rounded-xl bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-green-400" />
          <div>
            <p className="font-bold text-lg">{quoteNumber}</p>
            <p className="text-xs text-gray-400">Draft Quote</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-2xl font-bold text-green-400">{fmt(total)}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="space-y-3">
        {/* Customer */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Customer</p>
            <p className="font-medium text-gray-900">{customer?.name}</p>
            {customer?.billing_email && <p className="text-xs text-gray-400">{customer.billing_email}</p>}
          </div>
          <button onClick={() => onEditStep(1)} className="text-xs text-green-600 hover:underline flex items-center gap-1">
            <Edit2 size={12} /> Edit
          </button>
        </div>

        {/* Property */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Property</p>
            <p className="font-medium text-gray-900">{property?.name}</p>
            <p className="text-xs text-gray-400">
              {property?.address?.street && `${property.address.street}, `}{property?.address?.city}, {property?.address?.state}
            </p>
          </div>
          <button onClick={() => onEditStep(2)} className="text-xs text-green-600 hover:underline flex items-center gap-1">
            <Edit2 size={12} /> Edit
          </button>
        </div>

        {/* Services */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Services</p>
            <p className="font-medium text-gray-900">{selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400">{selectedServices.map((s) => s.name).join(' · ')}</p>
          </div>
          <button onClick={() => onEditStep(3)} className="text-xs text-green-600 hover:underline flex items-center gap-1">
            <Edit2 size={12} /> Edit
          </button>
        </div>

        {/* Pricing summary */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Pricing</p>
          {lineItems.map((item) => (
            <div key={item.service_catalog_id} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
              <span className="text-gray-700">{item.service_name}</span>
              <span className="font-medium text-gray-900">{fmt(item.line_total)}</span>
            </div>
          ))}
          {discountPct > 0 && (
            <div className="flex justify-between text-sm py-1 text-red-500">
              <span>Discount ({discountPct}%)</span>
              <span>− {fmt(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 mt-1">
            <span>Total</span>
            <span className="text-green-600">{fmt(total)}</span>
          </div>
        </div>

        {/* Valid until */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Valid Until</p>
          <p className="font-medium text-gray-900">{fmtDate(validUntil.toISOString())}</p>
          <p className="text-xs text-gray-400">30 days from today</p>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Internal Notes
            <span className="ml-1 text-xs font-normal text-gray-400">(not shown on proposal)</span>
          </label>
          <textarea
            value={notesInternal}
            onChange={(e) => setNotesInternal(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Client prefers email only. Do not call."
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Client Notes
            <span className="ml-1 text-xs font-normal text-gray-400">(printed at bottom of proposal)</span>
          </label>
          <textarea
            value={notesClient}
            onChange={(e) => setNotesClient(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Thank you for choosing Sunset Services!"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* PDF Generation */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Proposal PDF</p>

        {pdfStatus === 'idle' && (
          <button
            onClick={handleGeneratePdf}
            className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-900"
          >
            <FileText size={16} />
            Generate PDF
          </button>
        )}

        {pdfStatus === 'generating' && (
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Loader2 size={18} className="animate-spin text-green-600" />
            <span>Generating PDF…</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {pdfStatus === 'ready' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
              <Check size={16} className="text-green-600" />
              PDF Ready
            </div>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink size={14} />
                Preview PDF
              </a>
            )}
          </div>
        )}

        {pdfStatus === 'error' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={16} />
              Could not generate PDF. Please try again.
            </div>
            <button
              onClick={() => { setPdfStatus('idle'); handleGeneratePdf(); }}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}
      </div>

      {/* Send to */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Send Proposal To</p>

        {!showEmailOverride ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Mail size={16} className="text-gray-400" />
              {recipientEmail || (
                <span className="text-amber-600">⚠ No email on file — add one to send</span>
              )}
            </div>
            <button
              onClick={() => { setShowEmailOverride(true); setEmailOverride(recipientEmail); }}
              className="text-xs text-green-600 hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              value={emailOverride}
              onChange={(e) => setEmailOverride(e.target.value)}
              placeholder="Enter email address"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={() => { setSendToEmail(emailOverride); setShowEmailOverride(false); }}
              className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
            >
              Set
            </button>
          </div>
        )}

        {/* Send errors */}
        {sendError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            <AlertCircle size={14} />
            {sendError}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {sendStatus === 'sent' || saveStatus === 'saved' ? (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <Check size={24} className="mx-auto text-green-600 mb-1" />
          <p className="font-semibold text-green-700">
            {sendStatus === 'sent' ? 'Proposal sent!' : 'Quote saved & completed!'}
          </p>
          <p className="text-sm text-green-600">Redirecting to quote detail…</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-3">
            {/* Send via Email — primary */}
            <button
              onClick={handleSendEmail}
              disabled={!canSend || sendStatus === 'sending'}
              title={pdfStatus !== 'ready' ? 'Generate the PDF first' : !recipientEmail ? 'No email address' : ''}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {sendStatus === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Send via Email
            </button>

            {/* Download PDF — secondary */}
            <button
              onClick={handleDownloadPdf}
              disabled={pdfStatus !== 'ready'}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Download PDF
            </button>
          </div>

          {/* Save & Complete — full width, gray */}
          <button
            onClick={handleSaveComplete}
            disabled={pdfStatus !== 'ready' || saveStatus === 'saving'}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save & Complete
            <span className="text-xs text-gray-400">(skip email — mark as sent)</span>
          </button>
        </div>
      )}

      {pdfStatus !== 'ready' && pdfStatus !== 'generating' && (
        <p className="text-center text-xs text-gray-400">
          Generate the PDF first to enable actions
        </p>
      )}
    </div>
  );
}
