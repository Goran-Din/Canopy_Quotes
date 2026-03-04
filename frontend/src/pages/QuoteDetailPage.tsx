import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import TopNav from '../components/shared/TopNav';
import QuoteDetailHeader from '../components/quote/QuoteDetailHeader';
import QuoteCustomerCard from '../components/quote/QuoteCustomerCard';
import QuoteLineItemsTable from '../components/quote/QuoteLineItemsTable';
import QuoteMetaCard from '../components/quote/QuoteMetaCard';
import QuoteActionBar from '../components/quote/QuoteActionBar';
import { useQuoteDetail } from '../hooks/useQuotes';

function SkeletonDetail() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quote, isLoading, isError, refetch } = useQuoteDetail(id ?? '');

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {isLoading && <SkeletonDetail />}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-gray-600">Failed to load quote.</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && !quote && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-gray-600">Quote not found.</p>
            <button onClick={() => navigate('/')} className="text-sm text-blue-600 hover:underline">
              Back to dashboard
            </button>
          </div>
        )}

        {!isLoading && !isError && quote && (
          <div className="space-y-5">
            {/* Header: back button + quote number + status */}
            <QuoteDetailHeader quote={quote} />

            {/* Action bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Actions</h2>
              <QuoteActionBar quote={quote} />
            </div>

            {/* Main content: 2/3 + 1/3 layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left: line items */}
              <div className="lg:col-span-2">
                <QuoteLineItemsTable quote={quote} />
              </div>

              {/* Right: customer + meta */}
              <div className="space-y-4">
                <QuoteCustomerCard quote={quote} />
                <QuoteMetaCard quote={quote} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
