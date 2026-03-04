import { TrendingUp, Clock, CheckCircle, DollarSign, AlertTriangle } from 'lucide-react';
import { useQuoteStats } from '../../hooks/useQuotes';
import { formatCurrency } from '../../utils';
import type { QuoteStatus } from '../../types';

interface StatsRowProps {
  onFilterChange: (status?: QuoteStatus) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-20" />
    </div>
  );
}

export default function StatsRow({ onFilterChange }: StatsRowProps) {
  const { data: stats, isLoading, isError, refetch } = useQuoteStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center gap-2">
            <span className="text-2xl font-bold text-gray-300">—</span>
            <button onClick={() => refetch()} className="text-xs text-blue-600 hover:underline">Retry</button>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Quotes This Month',
      value: stats.total_quotes_this_month.toString(),
      Icon: TrendingUp,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      onClick: () => onFilterChange(undefined),
      extra: null,
    },
    {
      label: 'Pending (Sent)',
      value: stats.pending_count.toString(),
      Icon: Clock,
      iconBg: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      onClick: () => onFilterChange('sent'),
      extra: stats.expiring_soon_count > 0 ? (
        <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 mt-1">
          <AlertTriangle className="w-3 h-3" />
          {stats.expiring_soon_count} expiring soon
        </span>
      ) : null,
    },
    {
      label: 'Approved',
      value: stats.approved_count.toString(),
      Icon: CheckCircle,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      onClick: () => onFilterChange('approved'),
      extra: null,
    },
    {
      label: 'Total Value Sent',
      value: formatCurrency(stats.total_value_sent),
      Icon: DollarSign,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      onClick: () => onFilterChange('sent'),
      extra: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, Icon, iconBg, iconColor, onClick, extra }) => (
        <button
          key={label}
          onClick={onClick}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
            {value}
          </p>
          {extra}
        </button>
      ))}
    </div>
  );
}
