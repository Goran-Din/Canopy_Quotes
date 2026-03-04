// ============================================================
// Canopy Quotes – Customer Detail Panel (slide-out)
// ============================================================

import { useState } from 'react';
import {
  X,
  MapPin,
  Mail,
  Phone,
  Building2,
  Home,
  Plus,
  FileText,
  Edit2,
  Loader2,
  ChevronRight,
} from 'lucide-react';

import { useCustomer, useCustomerProperties, useCustomerQuotes } from './hooks';
import PropertyFormModal from './PropertyFormModal';
import CustomerFormModal from './CustomerFormModal';

interface CustomerDetailPanelProps {
  customerId: string;
  onClose: () => void;
  onNewQuote?: (customerId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  prospect: 'bg-blue-100 text-blue-700',
  inactive: 'bg-gray-100 text-gray-500',
};

const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  expired: 'bg-amber-100 text-amber-700',
  won: 'bg-emerald-100 text-emerald-700',
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CustomerDetailPanel({
  customerId,
  onClose,
  onNewQuote,
}: CustomerDetailPanelProps) {
  const [tab, setTab] = useState<'properties' | 'quotes'>('properties');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);

  const { data: customer, isLoading, refetch } = useCustomer(customerId);
  const { data: propertiesData, refetch: refetchProps } = useCustomerProperties(customerId);
  const { data: quotesData } = useCustomerQuotes(customerId);

  const properties = propertiesData?.properties ?? [];
  const quotes = quotesData?.quotes ?? [];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Customer Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditCustomer(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Edit2 size={14} />
              Edit
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-green-600" size={32} />
          </div>
        ) : !customer ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Customer not found.
          </div>
        ) : (
          <>
            {/* Customer Info */}
            <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    {customer.type === 'commercial' ? (
                      <Building2 size={18} className="text-blue-500" />
                    ) : (
                      <Home size={18} className="text-green-500" />
                    )}
                    <h3 className="text-xl font-bold text-gray-900">{customer.name}</h3>
                  </div>
                  {customer.contact_name && (
                    <p className="mt-0.5 text-sm text-gray-500">Contact: {customer.contact_name}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                    STATUS_STYLES[customer.status] ?? 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {customer.status}
                </span>
              </div>

              <div className="space-y-1.5">
                {customer.billing_email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={14} className="text-gray-400" />
                    <a href={`mailto:${customer.billing_email}`} className="hover:text-green-600">
                      {customer.billing_email}
                    </a>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={14} className="text-gray-400" />
                    <a href={`tel:${customer.phone}`} className="hover:text-green-600">
                      {customer.phone}
                    </a>
                  </div>
                )}
                {(customer as any).billing_city && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={14} className="text-gray-400" />
                    <span>
                      {(customer as any).billing_address && `${(customer as any).billing_address}, `}
                      {(customer as any).billing_city}, {(customer as any).billing_state} {(customer as any).billing_zip}
                    </span>
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{customer.property_count}</p>
                  <p className="text-xs text-gray-500">Properties</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{customer.quote_count ?? quotes.length}</p>
                  <p className="text-xs text-gray-500">Quotes</p>
                </div>
              </div>

              {/* New Quote button */}
              {onNewQuote && (
                <button
                  onClick={() => onNewQuote(customerId)}
                  className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Plus size={16} />
                  New Quote for This Customer
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 flex-shrink-0">
              {(['properties', 'quotes'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                    tab === t
                      ? 'border-green-600 text-green-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t} ({t === 'properties' ? properties.length : quotes.length})
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">

              {/* Properties Tab */}
              {tab === 'properties' && (
                <div className="p-4 space-y-3">
                  <button
                    onClick={() => setShowAddProperty(true)}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 hover:border-green-400 hover:text-green-600 w-full justify-center"
                  >
                    <Plus size={16} />
                    Add Property
                  </button>

                  {properties.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <MapPin size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No properties on file yet.</p>
                    </div>
                  ) : (
                    properties.map((prop) => (
                      <div
                        key={prop.id}
                        className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-gray-900 text-sm">{prop.name}</p>
                          <span className="text-xs text-gray-400 capitalize">{prop.type}</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {prop.address}, {prop.city}, {prop.state} {prop.zip}
                        </p>
                        {(prop.turf_sqft || prop.bed_sqft || prop.shrub_count) && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {prop.turf_sqft && (
                              <span className="rounded bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
                                Turf: {prop.turf_sqft.toLocaleString()} sqft
                              </span>
                            )}
                            {prop.bed_sqft && (
                              <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                                Beds: {prop.bed_sqft.toLocaleString()} sqft
                              </span>
                            )}
                            {prop.shrub_count && (
                              <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">
                                Shrubs: {prop.shrub_count}
                              </span>
                            )}
                          </div>
                        )}
                        {prop.access_notes && (
                          <p className="mt-2 text-xs text-gray-400">🔑 {prop.access_notes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Quotes Tab */}
              {tab === 'quotes' && (
                <div className="p-4 space-y-2">
                  {quotes.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <FileText size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No quotes for this customer yet.</p>
                    </div>
                  ) : (
                    quotes.map((q: any) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:border-gray-300 cursor-pointer group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {q.quote_number}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                QUOTE_STATUS_STYLES[q.status] ?? 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {q.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(q.created_at)} · {formatCurrency(q.total_cents ?? 0)}
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-gray-300 group-hover:text-gray-500"
                        />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Property Modal */}
      {showAddProperty && customer && (
        <PropertyFormModal
          customerId={customerId}
          customerName={customer.name}
          onClose={() => setShowAddProperty(false)}
          onSuccess={() => {
            setShowAddProperty(false);
            refetchProps();
            refetch();
          }}
        />
      )}

      {/* Edit Customer Modal */}
      {showEditCustomer && customer && (
        <CustomerFormModal
          customer={customer}
          onClose={() => setShowEditCustomer(false)}
          onSuccess={() => {
            setShowEditCustomer(false);
            refetch();
          }}
        />
      )}
    </>
  );
}
