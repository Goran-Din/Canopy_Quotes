import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { useQuoteList } from '../../hooks/useQuotes';
import type { QuoteFilters } from '../../types';
import QuoteRow from './QuoteRow';

interface QuoteListProps {
  filters: QuoteFilters;
  onPageChange: (page: number) => void;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {[120, 160, 140, 80, 80, 80, 60, 40].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-4 bg-gray-200 rounded`} style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function QuoteList({ filters, onPageChange }: QuoteListProps) {
  const { data, isLoading, isError, refetch } = useQuoteList(filters);

  const page = filters.page ?? 1;
  const totalPages = data?.pagination.total_pages ?? 1;
  const totalCount = data?.pagination.total_count ?? 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Quote #</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Property</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Service</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Total</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Updated</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <>
                {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
              </>
            )}

            {isError && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                    <p className="text-sm text-gray-600">Failed to load quotes.</p>
                    <button
                      onClick={() => refetch()}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Try again
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !isError && data?.quotes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="text-sm text-gray-500">No quotes found.</p>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or create a new quote.</p>
                </td>
              </tr>
            )}

            {!isLoading && !isError && data?.quotes.map((quote) => (
              <QuoteRow key={quote.id} quote={quote} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && !isError && totalCount > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {totalCount} quote{totalCount !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                    pageNum === page
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
