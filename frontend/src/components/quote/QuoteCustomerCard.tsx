import { Link } from 'react-router-dom';
import { MapPin, User, ExternalLink } from 'lucide-react';
import type { QuoteDetail } from '../../types';
import { formatAddress } from '../../utils';

interface Props {
  quote: QuoteDetail;
}

export default function QuoteCustomerCard({ quote }: Props) {
  const address = formatAddress(quote.property_address);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Customer & Property
      </h2>

      <div className="space-y-3">
        {/* Customer */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{quote.customer_name}</p>
            {quote.customer_email && (
              <p className="text-xs text-gray-500 mt-0.5">{quote.customer_email}</p>
            )}
            <Link
              to={`/customers/${quote.customer_id}`}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
            >
              View customer <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Property */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{quote.property_name}</p>
            {address && (
              <p className="text-xs text-gray-500 mt-0.5">{address}</p>
            )}
          </div>
        </div>

        {/* Salesperson */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Created by <span className="font-medium text-gray-700">{quote.salesperson_name}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
