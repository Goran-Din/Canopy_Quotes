// ============================================================
// Canopy Quotes – Step 1: Customer Selection
// ============================================================

import React, { useState } from 'react';
import { Search, Check, Building2, Home, Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { useQuoteWizardStore } from '../../store/quoteWizardStore';
import { useCustomerSearch } from '../customers/hooks';
import { api } from '../../lib/api';
import type { WizardCustomer } from './types';

// ─── Inline New Customer Form ──────────────────────────────
function NewCustomerForm({ onCreated }: { onCreated: (c: WizardCustomer) => void }) {
  const [form, setForm] = useState({
    name: '',
    type: 'commercial' as 'commercial' | 'residential',
    contact_name: '',
    billing_email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');

  async function handleSave() {
    if (!form.name.trim() || form.name.trim().length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    if (form.billing_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.billing_email)) {
      setNameError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.post('/customers', {
        name: form.name.trim(),
        type: form.type,
        contact_name: form.contact_name || undefined,
        billing_email: form.billing_email || undefined,
        phone: form.phone || undefined,
      });
      onCreated(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create customer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border-2 border-green-200 bg-green-50 p-5 space-y-4">
      <p className="text-sm font-semibold text-green-800">+ Create New Customer</p>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Type toggle */}
      <div className="flex rounded-lg border border-gray-300 overflow-hidden w-fit bg-white">
        {(['commercial', 'residential'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setForm((f) => ({ ...f, type: t }))}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              form.type === t ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Customer Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setNameError(''); }}
          placeholder="e.g. Smith Commercial Properties"
          className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 ${nameError ? 'border-red-400' : 'border-gray-300'}`}
        />
        {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Contact Name</label>
          <input
            type="text"
            value={form.contact_name}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            placeholder="John Smith"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="630-555-0100"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
        <input
          type="email"
          value={form.billing_email}
          onChange={(e) => setForm((f) => ({ ...f, billing_email: e.target.value }))}
          placeholder="billing@example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {!form.billing_email && (
          <p className="mt-1 text-xs text-amber-600">⚠ Email needed to send proposals</p>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Save & Select Customer
      </button>
    </div>
  );
}

// ─── Step 1 Main ───────────────────────────────────────────
export default function Step1Customer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const customer = useQuoteWizardStore((s) => s.customer);
  const setCustomer = useQuoteWizardStore((s) => s.setCustomer);

  const { data, isFetching } = useCustomerSearch(searchQuery);
  const results = data?.customers ?? [];

  function handleSelect(c: any) {
    setCustomer({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      billing_email: c.billing_email,
      phone: c.phone,
      property_count: c.property_count,
    });
    setShowNewForm(false);
  }

  function handleCreated(c: WizardCustomer) {
    setCustomer(c);
    setShowNewForm(false);
    setSearchQuery('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Select Customer</h2>
        <p className="mt-1 text-sm text-gray-500">Search for an existing customer or create a new one.</p>
      </div>

      {/* Selected customer card */}
      {customer && (
        <div className="flex items-center justify-between rounded-xl border-2 border-green-500 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
              <Check size={16} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{customer.name}</p>
              <p className="text-xs text-gray-500 capitalize">
                {customer.type} · {customer.status}
                {customer.billing_email && ` · ${customer.billing_email}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setCustomer(null)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-green-100 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search */}
      {!customer && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or phone…"
              className="w-full rounded-xl border border-gray-300 pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
            {isFetching && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
            )}
          </div>

          {/* Results */}
          {searchQuery.length >= 2 && (
            <div className="space-y-2">
              {results.length === 0 && !isFetching && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No customers found for "{searchQuery}".
                </p>
              )}
              {results.length >= 10 && (
                <p className="text-xs text-amber-600 text-center">
                  Showing top 10 results. Refine your search.
                </p>
              )}
              {results.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className="w-full text-left rounded-xl border border-gray-200 p-4 hover:border-green-400 hover:bg-green-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {c.type === 'commercial'
                      ? <Building2 size={14} className="text-blue-400" />
                      : <Home size={14} className="text-green-400" />
                    }
                    <span className="font-semibold text-gray-900 text-sm">{c.name}</span>
                    <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 capitalize">{c.status}</span>
                  </div>
                  {(c.billing_email || c.phone) && (
                    <p className="text-xs text-gray-400 pl-5">
                      {c.billing_email}{c.billing_email && c.phone && ' · '}{c.phone}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Create new */}
          {!showNewForm ? (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 text-sm text-green-600 hover:text-green-800 font-medium"
            >
              <Plus size={16} />
              Can't find the customer? Create new customer
            </button>
          ) : (
            <div>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-2"
              >
                <X size={12} /> Cancel
              </button>
              <NewCustomerForm onCreated={handleCreated} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
