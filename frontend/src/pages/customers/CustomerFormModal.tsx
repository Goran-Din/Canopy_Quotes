// ============================================================
// Canopy Quotes – Customer Form Modal (Add / Edit)
// ============================================================

import React, { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { Customer, NewCustomerForm } from './types';
import { useCreateCustomer, useUpdateCustomer } from './hooks';

interface CustomerFormModalProps {
  customer?: Customer | null; // null = create, Customer = edit
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
}

const EMPTY_FORM: NewCustomerForm = {
  name: '',
  type: 'commercial',
  contact_name: '',
  billing_email: '',
  phone: '',
  billing_address: '',
  billing_city: '',
  billing_state: 'IL',
  billing_zip: '',
  notes: '',
};

export default function CustomerFormModal({
  customer,
  onClose,
  onSuccess,
}: CustomerFormModalProps) {
  const isEdit = !!customer;
  const [form, setForm] = useState<NewCustomerForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof NewCustomerForm, string>>>({});

  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer(customer?.id ?? '');
  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const apiError = createMutation.error || updateMutation.error;

  // Pre-fill form when editing
  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || '',
        type: customer.type || 'commercial',
        contact_name: customer.contact_name || '',
        billing_email: customer.billing_email || '',
        phone: customer.phone || '',
        billing_address: (customer as any).billing_address || '',
        billing_city: (customer as any).billing_city || '',
        billing_state: (customer as any).billing_state || 'IL',
        billing_zip: (customer as any).billing_zip || '',
        notes: (customer as any).notes || '',
      });
    }
  }, [customer]);

  function update(field: keyof NewCustomerForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters.';
    }
    if (form.billing_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.billing_email)) {
      errs.billing_email = 'Enter a valid email address.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Build the API payload — nest billing address fields into an object
    const { billing_address, billing_city, billing_state, billing_zip, ...rest } = form;
    const payload: Record<string, unknown> = { ...rest };

    // Convert empty strings to undefined for optional fields
    (Object.keys(payload) as string[]).forEach((k) => {
      if (payload[k] === '') payload[k] = undefined;
    });

    // Nest address fields into billing_address object if any are filled
    if (billing_address || billing_city || billing_state || billing_zip) {
      payload.billing_address = {
        street: billing_address || undefined,
        city: billing_city || undefined,
        state: billing_state || undefined,
        zip: billing_zip || undefined,
      };
    }

    try {
      let result: Customer;
      if (isEdit) {
        result = await updateMutation.mutateAsync(payload);
      } else {
        result = await createMutation.mutateAsync(payload);
      }
      onSuccess(result);
    } catch {
      // error shown via apiError
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* API Error */}
          {apiError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{(apiError as any)?.message ?? 'Something went wrong. Please try again.'}</span>
            </div>
          )}

          {/* Customer Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Type <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden w-fit">
              {(['commercial', 'residential'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update('type', t)}
                  className={`px-5 py-2 text-sm font-medium capitalize transition-colors ${
                    form.type === t
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={form.type === 'commercial' ? 'e.g. Smith Commercial Properties' : 'e.g. Johnson, Robert'}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Contact Name (commercial only) */}
          {form.type === 'commercial' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person Name
              </label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => update('contact_name', e.target.value)}
                placeholder="e.g. Robert Smith"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing Email
              </label>
              <input
                type="email"
                value={form.billing_email}
                onChange={(e) => update('billing_email', e.target.value)}
                placeholder="email@example.com"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.billing_email ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {!form.billing_email && (
                <p className="mt-1 text-xs text-amber-600">⚠ Email required to send proposals</p>
              )}
              {errors.billing_email && (
                <p className="mt-1 text-xs text-red-600">{errors.billing_email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="630-555-0100"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Billing Address
            </label>
            <input
              type="text"
              value={form.billing_address}
              onChange={(e) => update('billing_address', e.target.value)}
              placeholder="123 Main Street"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={form.billing_city}
                onChange={(e) => update('billing_city', e.target.value)}
                placeholder="Aurora"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={form.billing_state}
                onChange={(e) => update('billing_state', e.target.value)}
                maxLength={2}
                placeholder="IL"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
              <input
                type="text"
                value={form.billing_zip}
                onChange={(e) => update('billing_zip', e.target.value)}
                maxLength={10}
                placeholder="60505"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              placeholder="Any notes about this customer (not shown on proposals)..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit as any}
            disabled={isLoading}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
