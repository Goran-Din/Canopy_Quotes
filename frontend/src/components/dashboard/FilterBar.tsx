import { useState, useEffect, useRef } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { QuoteFilters, QuoteStatus } from '../../types';

const STATUS_TABS: { label: string; value: QuoteStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Expired', value: 'expired' },
  { label: 'Converted', value: 'converted' },
];

const SERVICE_TYPES = [
  { label: 'All Services', value: '' },
  { label: 'Landscaping', value: 'landscaping' },
  { label: 'Snow Removal', value: 'snow' },
  { label: 'Hardscape', value: 'hardscape' },
  { label: 'Project', value: 'project' },
];

interface FilterBarProps {
  filters: QuoteFilters;
  onChange: (filters: QuoteFilters) => void;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isCoordinator = user?.role === 'coordinator';

  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external status changes (from stats card clicks)
  useEffect(() => {
    if (filters.search !== searchInput && !filters.search) {
      setSearchInput('');
    }
  }, [filters.search]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.length === 0 || value.length >= 2) {
        onChange({ ...filters, search: value || undefined, page: 1 });
      }
    }, 500);
  };

  const handleStatusTab = (status: QuoteStatus | undefined) => {
    onChange({ ...filters, status, page: 1 });
  };

  const handleServiceType = (value: string) => {
    onChange({ ...filters, service_type: value || undefined, page: 1 });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Status tabs */}
      <div className="flex items-center gap-0 border-b border-gray-100 px-4 overflow-x-auto">
        {STATUS_TABS.map(({ label, value }) => {
          const active = filters.status === value;
          return (
            <button
              key={label}
              onClick={() => handleStatusTab(value)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Search + filters row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by customer name, quote number…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchInput && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Service type */}
        <select
          value={filters.service_type ?? ''}
          onChange={(e) => handleServiceType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
        >
          {SERVICE_TYPES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* New Quote button */}
        {!isCoordinator && (
          <button
            onClick={() => navigate('/quotes/new')}
            className="ml-auto flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Quote
          </button>
        )}
      </div>
    </div>
  );
}
