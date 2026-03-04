import type { QuoteStatus } from '../types';

// ── Currency ──────────────────────────────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// ── Dates ─────────────────────────────────────────────────────────────────────
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function isExpiringSoon(validUntil: string | null, days = 5): boolean {
  if (!validUntil) return false;
  const expiry = new Date(validUntil + 'T00:00:00');
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  return expiry <= threshold && expiry >= new Date();
}

// ── Status badge ──────────────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; className: string }
> = {
  draft:     { label: 'Draft',     className: 'bg-gray-100 text-gray-700 border-gray-300' },
  sent:      { label: 'Sent',      className: 'bg-blue-100 text-blue-700 border-blue-300' },
  approved:  { label: 'Approved',  className: 'bg-green-100 text-green-700 border-green-300' },
  rejected:  { label: 'Rejected',  className: 'bg-red-100 text-red-700 border-red-300' },
  expired:   { label: 'Expired',   className: 'bg-orange-100 text-orange-700 border-orange-300' },
  converted: { label: 'Converted', className: 'bg-purple-100 text-purple-700 border-purple-300' },
};

export function getStatusConfig(status: QuoteStatus) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
}

// ── Address ───────────────────────────────────────────────────────────────────
export function formatAddress(
  address: Record<string, string> | null | undefined
): string {
  if (!address) return '';
  return [address.street, address.city, address.state, address.zip]
    .filter(Boolean)
    .join(', ');
}

// ── Service type labels ───────────────────────────────────────────────────────
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  landscaping: 'Landscaping',
  snow: 'Snow Removal',
  hardscape: 'Hardscape',
  project: 'Project',
};

export function formatServiceType(type: string): string {
  return SERVICE_TYPE_LABELS[type] ?? type;
}

// ── Billing type labels ───────────────────────────────────────────────────────
export const BILLING_TYPE_LABELS: Record<string, string> = {
  per_visit: 'Per Visit',
  monthly: 'Monthly',
  seasonal_flat: 'Seasonal Flat Rate',
  per_push: 'Per Push',
  annual: 'Annual',
  project: 'Project (One-Time)',
};

export function formatBillingType(type: string): string {
  return BILLING_TYPE_LABELS[type] ?? type;
}

// ── Role checks ───────────────────────────────────────────────────────────────
import type { UserRole } from '../types';

export function canApproveReject(role: UserRole): boolean {
  return ['owner', 'division_manager', 'n37_super_admin'].includes(role);
}

export function isOwnerOrAbove(role: UserRole): boolean {
  return ['owner', 'n37_super_admin'].includes(role);
}
