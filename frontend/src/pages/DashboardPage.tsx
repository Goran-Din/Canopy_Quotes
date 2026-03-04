import { useState } from 'react';
import TopNav from '../components/shared/TopNav';
import StatsRow from '../components/dashboard/StatsRow';
import FilterBar from '../components/dashboard/FilterBar';
import QuoteList from '../components/dashboard/QuoteList';
import type { QuoteFilters, QuoteStatus } from '../types';

export default function DashboardPage() {
  const [filters, setFilters] = useState<QuoteFilters>({
    page: 1,
    sort: 'updated_at',
    order: 'desc',
  });

  const handleFilterChange = (newFilters: QuoteFilters) => {
    setFilters({ ...newFilters, page: 1 });
  };

  const handleStatsFilterChange = (status?: QuoteStatus) => {
    setFilters({ page: 1, sort: 'updated_at', order: 'desc', status });
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quote Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and track your quoting pipeline</p>
        </div>

        {/* Zone 1 — Stats */}
        <StatsRow onFilterChange={handleStatsFilterChange} />

        {/* Zone 2 — Filter bar */}
        <FilterBar filters={filters} onChange={handleFilterChange} />

        {/* Zone 3 — Quote list */}
        <QuoteList filters={filters} onPageChange={handlePageChange} />
      </main>
    </div>
  );
}
