import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, Send, RefreshCw, Download,
  Copy, Trash2, Loader2, FileText,
} from 'lucide-react';
import type { QuoteDetail } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useChangeQuoteStatus, useDuplicateQuote, useDeleteQuote } from '../../hooks/useQuotes';
import { usePdfGeneration } from '../../hooks/usePdfGeneration';
import { quotesApi } from '../../api/quotes';
import { canApproveReject } from '../../utils';

interface Props {
  quote: QuoteDetail;
}

export default function QuoteActionBar({ quote }: Props) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'salesperson';

  const changeStatus = useChangeQuoteStatus();
  const duplicate = useDuplicateQuote();
  const deleteQuote = useDeleteQuote();
  const { state: pdfState, generate: generatePdf } = usePdfGeneration(quote.id);

  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const canManage = canApproveReject(role);
  const isCoordinator = role === 'coordinator';
  const status = quote.status;
  const hasPdf = !!quote.current_proposal_id;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!confirm(`Approve quote ${quote.quote_number}?`)) return;
    await changeStatus.mutateAsync({ id: quote.id, status: 'approved' });
  };

  const handleReject = async () => {
    if (!confirm(`Mark ${quote.quote_number} as rejected?`)) return;
    await changeStatus.mutateAsync({ id: quote.id, status: 'rejected' });
  };

  const handleSend = async () => {
    setSendError(null);
    setSending(true);
    try {
      await quotesApi.send(quote.id);
      navigate(0); // reload page to reflect sent status
    } catch (err: any) {
      setSendError(err?.response?.data?.message ?? 'Failed to send proposal');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    setSendError(null);
    setResending(true);
    try {
      await quotesApi.resend(quote.id);
      navigate(0);
    } catch (err: any) {
      setSendError(err?.response?.data?.message ?? 'Failed to resend proposal');
    } finally {
      setResending(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { signed_url } = await quotesApi.getPdfUrl(quote.id);
      window.open(signed_url, '_blank');
    } catch {
      alert('Could not retrieve PDF. Try generating it first.');
    }
  };

  const handleDuplicate = async () => {
    const result = await duplicate.mutateAsync(quote.id);
    navigate(`/quotes/${result.quote_id}`);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete draft ${quote.quote_number}? This cannot be undone.`)) return;
    await deleteQuote.mutateAsync(quote.id);
    navigate('/');
  };

  if (isCoordinator) {
    // Coordinators: read-only — only download PDF
    return (
      <div className="flex flex-wrap gap-2">
        {hasPdf && (
          <ActionButton icon={Download} label="Download PDF" onClick={handleDownloadPdf} variant="secondary" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sendError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {sendError}
        </div>
      )}

      <div className="flex flex-wrap gap-2">

        {/* DRAFT actions */}
        {status === 'draft' && (
          <>
            {/* Generate PDF → then Send */}
            {!hasPdf ? (
              <ActionButton
                icon={pdfState.phase === 'generating' ? Loader2 : FileText}
                label={pdfState.phase === 'generating' ? 'Generating PDF…' : 'Generate PDF'}
                onClick={generatePdf}
                disabled={pdfState.phase === 'generating'}
                variant="primary"
                spin={pdfState.phase === 'generating'}
              />
            ) : (
              <ActionButton
                icon={sending ? Loader2 : Send}
                label={sending ? 'Sending…' : 'Send Proposal'}
                onClick={handleSend}
                disabled={sending}
                variant="primary"
                spin={sending}
              />
            )}
            {hasPdf && (
              <ActionButton icon={Download} label="Download PDF" onClick={handleDownloadPdf} variant="secondary" />
            )}
          </>
        )}

        {/* SENT actions */}
        {status === 'sent' && (
          <>
            {canManage && (
              <>
                <ActionButton icon={CheckCircle} label="Approve" onClick={handleApprove} variant="success" />
                <ActionButton icon={XCircle} label="Reject" onClick={handleReject} variant="danger" />
              </>
            )}
            <ActionButton
              icon={resending ? Loader2 : RefreshCw}
              label={resending ? 'Resending…' : 'Resend Proposal'}
              onClick={handleResend}
              disabled={resending}
              variant="secondary"
              spin={resending}
            />
            <ActionButton icon={Download} label="Download PDF" onClick={handleDownloadPdf} variant="secondary" />
          </>
        )}

        {/* APPROVED actions */}
        {status === 'approved' && (
          <>
            <ActionButton icon={Download} label="Download PDF" onClick={handleDownloadPdf} variant="secondary" />
            <ActionButton
              icon={resending ? Loader2 : RefreshCw}
              label={resending ? 'Resending…' : 'Resend Proposal'}
              onClick={handleResend}
              disabled={resending}
              variant="secondary"
              spin={resending}
            />
          </>
        )}

        {/* EXPIRED actions */}
        {status === 'expired' && (
          <>
            <ActionButton
              icon={resending ? Loader2 : RefreshCw}
              label={resending ? 'Resending…' : 'Resend Proposal'}
              onClick={handleResend}
              disabled={resending}
              variant="primary"
              spin={resending}
            />
            {hasPdf && (
              <ActionButton icon={Download} label="Download PDF" onClick={handleDownloadPdf} variant="secondary" />
            )}
          </>
        )}

        {/* REJECTED / CONVERTED — just download + duplicate */}
        {(status === 'rejected' || status === 'converted') && hasPdf && (
          <ActionButton icon={Download} label="Download PDF" onClick={handleDownloadPdf} variant="secondary" />
        )}

        {/* Duplicate — always available */}
        <ActionButton
          icon={duplicate.isPending ? Loader2 : Copy}
          label={duplicate.isPending ? 'Duplicating…' : 'Duplicate'}
          onClick={handleDuplicate}
          disabled={duplicate.isPending}
          variant="ghost"
          spin={duplicate.isPending}
        />

        {/* Delete draft — only own draft */}
        {status === 'draft' && (
          <ActionButton
            icon={deleteQuote.isPending ? Loader2 : Trash2}
            label="Delete Draft"
            onClick={handleDelete}
            disabled={deleteQuote.isPending}
            variant="danger-ghost"
            spin={deleteQuote.isPending}
          />
        )}
      </div>

      {/* PDF generation success */}
      {pdfState.phase === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-green-700">PDF generated successfully!</span>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(pdfState.signedUrl, '_blank')}
              className="text-xs font-medium text-green-700 underline"
            >
              Preview
            </button>
            <ActionButton
              icon={sending ? Loader2 : Send}
              label={sending ? 'Sending…' : 'Send Now'}
              onClick={handleSend}
              disabled={sending}
              variant="primary"
              spin={sending}
            />
          </div>
        </div>
      )}

      {pdfState.phase === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {pdfState.message}
        </div>
      )}
    </div>
  );
}

// ── Small reusable button ─────────────────────────────────────────────────────
type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'danger-ghost';

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant?: Variant;
  disabled?: boolean;
  spin?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:      'bg-blue-700 hover:bg-blue-800 text-white disabled:bg-blue-400',
  secondary:    'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 disabled:opacity-50',
  success:      'bg-green-600 hover:bg-green-700 text-white disabled:bg-green-400',
  danger:       'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-400',
  ghost:        'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50',
  'danger-ghost': 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 disabled:opacity-50',
};

function ActionButton({ icon: Icon, label, onClick, variant = 'secondary', disabled, spin }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]}`}
    >
      <Icon className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`} />
      {label}
    </button>
  );
}
