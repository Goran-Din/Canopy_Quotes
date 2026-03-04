// ============================================================
// Canopy Quotes – Customers Page
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  Search,
  Plus,
  Building2,
  Home,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import type { CustomerFilters, Customer } from './types';
import { useCustomers } from './hooks';
import CustomerDetailPanel from './CustomerDetailPanel';
import CustomerFormModal from './CustomerFormModal';

// ─── Debounce helper ───────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const update = useCallback(
    (v: T) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDebounced(v), delay);
    },
    [delay]
  );
  React.useEffect(() => { update(value); }, [value, update]);
  return debounced;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  prospect: 'bg-blue-100 text-blue-700 border-blue-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
};

// ─── Main Page ─────────────────────────────────────────────
export default function CustomersPage() {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);

  const [filters, setFilters] = useState<CustomerFilters>({
    search: '',
    type: '',
    status: '',
    page: 1,
  });

  // Merge debounced search into filters
  const activeFilters: CustomerFilters = {
    ...filters,
    search: debouncedSearch,
    page: debouncedSearch !== filters.search ? 1 : filters.page,
  };

  const { data, isLoading, isFetching, refetch } = useCustomers(activeFilters);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const customers = data?.customers ?? [];
  const pagination = data?.pagination;

  function setFilter<K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleCustomerAdded(customer: Customer) {
    setShowAddCustomer(false);
    refetch();
    setSelectedCustomerId(customer.id);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            {pagination && (
              <p className="mt-0.5 text-sm text-gray-500">
                {pagination.total.toLocaleString()} customers total
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAddCustomer(true)}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 shadow-sm"
          >
            <Plus size={16} />
            Add Customer
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, phone…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          {isFetching && searchInput.length >= 2 && (
            <Loader2
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
            />
          )}
        </div>

        {/* Filters Row */}
        <div className="mt-3 flex flex-wrap gap-3">
          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value as any)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="prospect">Prospect</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Type Filter */}
          <select
            value={filters.type}
            onChange={(e) => setFilter('type', e.target.value as any)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Types</option>
            <option value="commercial">Commercial</option>
            <option value="residential">Residential</option>
          </select>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Clear filters */}
          {(filters.status || filters.type || searchInput) && (
            <button
              onClick={() => {
                setSearchInput('');
                setFilters({ search: '', type: '', status: '', page: 1 });
              }}
              className="text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-green-600" size={36} />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Users size={48} className="text-gray-200 mb-4" />
            <h3 className="text-lg font-medium text-gray-500">No customers found</h3>
            {(searchInput || filters.status || filters.type) ? (
              <p className="mt-1 text-sm text-gray-400">
                Try adjusting your search or filters.
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-400">
                Add your first customer to get started.
              </p>
            )}
            <button
              onClick={() => setShowAddCustomer(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Plus size={16} />
              Add Customer
            </button>
          </div>
        ) : (
          <>
            {/* Customer Table */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Properties
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((customer, index) => {
                    const rowNum =
                      ((activeFilters.page - 1) * (pagination?.page_size ?? 20)) + index + 1;
                    return (
                      <tr
                        key={customer.id}
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className="hover:bg-green-50 cursor-pointer transition-colors group"
                      >
                        {/* Row # */}
                        <td className="px-4 py-3.5 text-gray-400 text-xs">{rowNum}</td>

                        {/* Name */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {customer.type === 'commercial' ? (
                              <Building2 size={15} className="text-blue-400 flex-shrink-0" />
                            ) : (
                              <Home size={15} className="text-green-400 flex-shrink-0" />
                            )}
                            <span className="font-medium text-gray-900 group-hover:text-green-700">
                              {customer.name}
                            </span>
                          </div>
                          {customer.contact_name && (
                            <p className="mt-0.5 text-xs text-gray-400 pl-5">
                              {customer.contact_name}
                            </p>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3.5">
                          {customer.billing_email && (
                            <p className="text-gray-600 text-xs">{customer.billing_email}</p>
                          )}
                          {customer.phone && (
                            <p className="text-gray-400 text-xs mt-0.5">
                              {customer.phone}
                              {(customer as any).billing_city && ` · ${(customer as any).billing_city}, ${(customer as any).billing_state ?? ''}`}
                            </p>
                          )}
                          {!customer.billing_email && !customer.phone && (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3.5">
                          <span className="capitalize text-xs text-gray-500">
                            {customer.type}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                              STATUS_STYLES[customer.status] ?? 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {customer.status}
                          </span>
                        </td>

                        {/* Properties */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                            {customer.property_count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.total_pages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <p className="text-gray-500">
                  Showing {((activeFilters.page - 1) * pagination.page_size) + 1}–
                  {Math.min(activeFilters.page * pagination.page_size, pagination.total)} of{' '}
                  {pagination.total.toLocaleString()} customers
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    disabled={activeFilters.page <= 1}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <span className="text-gray-400 px-2">
                    Page {activeFilters.page} of {pagination.total_pages}
                  </span>
                  <button
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        page: Math.min(pagination.total_pages, prev.page + 1),
                      }))
                    }
                    disabled={activeFilters.page >= pagination.total_pages}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Customer Detail Panel */}
      {selectedCustomerId && (
        <CustomerDetailPanel
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onNewQuote={(customerId) => {
            setSelectedCustomerId(null);
            // TODO: navigate to New Quote wizard pre-filled with this customer
            window.location.href = `/quotes/new?customerId=${customerId}`;
          }}
        />
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <CustomerFormModal
          customer={null}
          onClose={() => setShowAddCustomer(false)}
          onSuccess={handleCustomerAdded}
        />
      )}
    </div>
  );
}
