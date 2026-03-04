// ============================================================
// Canopy Quotes – Property Form Modal (Add Property)
// ============================================================

import React, { useState } from 'react';
import { X, AlertCircle, Info } from 'lucide-react';
import type { NewPropertyForm } from './types';
import { useAddProperty } from './hooks';

interface PropertyFormModalProps {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_FORM: NewPropertyForm = {
  name: '',
  address: '',
  city: '',
  state: 'IL',
  zip: '',
  type: 'commercial',
  lot_size_sqft: '',
  turf_sqft: '',
  bed_sqft: '',
  shrub_count: '',
  notes: '',
  access_notes: '',
};

export default function PropertyFormModal({
  customerId,
  customerName,
  onClose,
  onSuccess,
}: PropertyFormModalProps) {
  const [form, setForm] = useState<NewPropertyForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof NewPropertyForm, string>>>({});

  const mutation = useAddProperty(customerId);

  function update(field: keyof NewPropertyForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Property name is required.';
    if (!form.address.trim()) errs.address = 'Address is required.';
    if (!form.city.trim()) errs.city = 'City is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload = { ...form };
    // Convert numeric strings to numbers, empty to undefined
    const numericFields = ['lot_size_sqft', 'turf_sqft', 'bed_sqft', 'shrub_count'] as const;
    numericFields.forEach((f) => {
      const v = (payload as any)[f];
      (payload as any)[f] = v !== '' ? Number(v) : undefined;
    });
    (Object.keys(payload) as Array<keyof typeof payload>).forEach((k) => {
      if (payload[k] === '') (payload as any)[k] = undefined;
    });

    try {
      await mutation.mutateAsync(payload);
      onSuccess();
    } catch {
      // error shown via mutation.error
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Property</h2>
            <p className="text-sm text-gray-500">For: {customerName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {mutation.error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{(mutation.error as any)?.message ?? 'Failed to add property. Please try again.'}</span>
            </div>
          )}

          {/* Property Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Name / Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Main Office, Warehouse, Residence"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
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

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="423 Oak Street"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.address ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Aurora"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.city ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => update('state', e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="IL"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
              <input
                type="text"
                value={form.zip}
                onChange={(e) => update('zip', e.target.value)}
                maxLength={10}
                placeholder="60505"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Measurements */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Property Measurements</h3>
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-600">
                Used for auto-pricing
              </span>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 p-3 mb-3">
              <Info size={14} className="mt-0.5 text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-500">
                Measurements entered here will auto-fill in quotes for this property.
                You can edit them per-quote if measurements change.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { field: 'turf_sqft', label: 'Turf / Lawn (sq ft)', placeholder: 'e.g. 5000' },
                { field: 'bed_sqft', label: 'Bed Areas (sq ft)', placeholder: 'e.g. 800' },
                { field: 'lot_size_sqft', label: 'Total Lot Size (sq ft)', placeholder: 'e.g. 8000' },
                { field: 'shrub_count', label: 'Shrub Count', placeholder: 'e.g. 12' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="number"
                    min="0"
                    value={(form as any)[field]}
                    onChange={(e) => update(field as any, e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={3}
                placeholder="Any notes about the property..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Notes
                <span className="ml-1 text-xs text-gray-400">(gate codes, dogs, etc.)</span>
              </label>
              <textarea
                value={form.access_notes}
                onChange={(e) => update('access_notes', e.target.value)}
                rows={3}
                placeholder="Gate code: 1234, Dog in backyard..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
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
            onClick={handleSubmit as any}
            disabled={mutation.isLoading}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {mutation.isLoading ? 'Adding…' : 'Add Property'}
          </button>
        </div>
      </div>
    </div>
  );
}
