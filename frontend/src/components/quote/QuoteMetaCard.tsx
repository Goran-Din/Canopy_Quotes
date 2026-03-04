import { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { QuoteDetail } from '../../types';
import { formatDate, isExpiringSoon } from '../../utils';
import { useAuthStore } from '../../store/authStore';

interface Props {
  quote: QuoteDetail;
}

export default function QuoteMetaCard({ quote }: Props) {
  const [notesOpen, setNotesOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'salesperson';

  const canSeeInternalNotes =
    role === 'owner' ||
    role === 'division_manager' ||
    role === 'n37_super_admin' ||
    (role === 'salesperson' && quote.salesperson_id === user?.id);

  const expiring = isExpiringSoon(quote.valid_until);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</h2>

      <div className="space-y-2.5">
        {quote.sent_at && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Sent
            </span>
            <span className="font-medium text-gray-900">{formatDate(quote.sent_at)}</span>
          </div>
        )}

        {quote.valid_until && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Valid Until
            </span>
            <span className={`font-medium flex items-center gap-1 ${expiring ? 'text-red-600' : 'text-gray-900'}`}>
              {expiring && <AlertTriangle className="w-3.5 h-3.5" />}
              {formatDate(quote.valid_until)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Created</span>
          <span className="font-medium text-gray-900">{formatDate(quote.created_at)}</span>
        </div>

        {quote.season_year && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Season</span>
            <span className="font-medium text-gray-900">{quote.season_year}</span>
          </div>
        )}
      </div>

      {/* Client-facing notes */}
      {quote.notes_client && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Client Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes_client}</p>
        </div>
      )}

      {/* Internal notes — collapsible, role-gated */}
      {canSeeInternalNotes && quote.notes_internal && (
        <div className="pt-3 border-t border-gray-100">
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700"
          >
            Internal Notes
            {notesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {notesOpen && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              {quote.notes_internal}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
