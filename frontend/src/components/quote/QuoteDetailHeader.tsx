import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { QuoteDetail } from '../../types';
import StatusBadge from '../shared/StatusBadge';
import { formatServiceType, formatBillingType } from '../../utils';

interface Props {
  quote: QuoteDetail;
}

export default function QuoteDetailHeader({ quote }: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex items-start gap-4">
      <button
        onClick={() => navigate('/')}
        className="mt-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
        title="Back to dashboard"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{quote.quote_number}</h1>
          <StatusBadge status={quote.status} isOldDraft={quote.is_old_draft} />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {formatServiceType(quote.service_type)}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            {formatBillingType(quote.billing_type)}
          </span>
          {quote.season_year && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
              {quote.season_year} Season
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
