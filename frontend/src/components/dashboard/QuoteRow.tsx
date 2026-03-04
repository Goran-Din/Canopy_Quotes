import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Copy, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import type { QuoteListItem } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useDuplicateQuote, useDeleteQuote, useChangeQuoteStatus } from '../../hooks/useQuotes';
import { formatCurrency, formatDate, formatServiceType, canApproveReject } from '../../utils';
import StatusBadge from '../shared/StatusBadge';

interface QuoteRowProps {
  quote: QuoteListItem;
}

export default function QuoteRow({ quote }: QuoteRowProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'salesperson';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const duplicate = useDuplicateQuote();
  const deleteQuote = useDeleteQuote();
  const changeStatus = useChangeQuoteStatus();

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleDuplicate = async () => {
    setMenuOpen(false);
    await duplicate.mutateAsync(quote.id);
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (confirm(`Delete draft ${quote.quote_number}? This cannot be undone.`)) {
      await deleteQuote.mutateAsync(quote.id);
    }
  };

  const handleApprove = async () => {
    setMenuOpen(false);
    await changeStatus.mutateAsync({ id: quote.id, status: 'approved' });
  };

  const handleReject = async () => {
    setMenuOpen(false);
    if (confirm(`Mark ${quote.quote_number} as rejected?`)) {
      await changeStatus.mutateAsync({ id: quote.id, status: 'rejected' });
    }
  };

  const canManage = canApproveReject(role);
  const isSent = quote.status === 'sent';
  const isDraft = quote.status === 'draft';

  return (
    <tr
      onClick={() => navigate(`/quotes/${quote.id}`)}
      className="hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
    >
      {/* Quote # */}
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-medium text-blue-700">{quote.quote_number}</span>
      </td>

      {/* Customer */}
      <td className="px-4 py-3">
        <span className="text-sm text-gray-900 font-medium">{quote.customer_name}</span>
      </td>

      {/* Property */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-sm text-gray-600">{quote.property_name}</span>
      </td>

      {/* Service */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
          {formatServiceType(quote.service_type)}
        </span>
      </td>

      {/* Total */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-semibold text-gray-900">
          {formatCurrency(quote.total_amount)}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={quote.status} isOldDraft={quote.is_old_draft} />
      </td>

      {/* Updated */}
      <td className="px-4 py-3 hidden xl:table-cell">
        <span className="text-xs text-gray-400">{formatDate(quote.updated_at)}</span>
      </td>

      {/* Three-dot menu */}
      <td
        className="px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-50 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1">
              {/* View */}
              <button
                onClick={() => navigate(`/quotes/${quote.id}`)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                View Quote
              </button>

              {/* Approve / Reject (sent quotes, owners only) */}
              {canManage && isSent && (
                <>
                  <button
                    onClick={handleApprove}
                    className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={handleReject}
                    className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                </>
              )}

              {/* Duplicate */}
              <button
                onClick={handleDuplicate}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" /> Duplicate
              </button>

              {/* Resend (sent/approved/expired) */}
              {['sent', 'approved', 'expired'].includes(quote.status) && (
                <button
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Resend Proposal
                </button>
              )}

              {/* Delete draft */}
              {isDraft && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Draft
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
