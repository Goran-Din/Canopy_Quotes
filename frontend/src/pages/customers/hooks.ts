// ============================================================
// Canopy Quotes – Customer API Hooks (React Query)
// ============================================================

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type {
  Customer,
  CustomerListResponse,
  CustomerFilters,
  Property,
  NewCustomerForm,
  NewPropertyForm,
} from './types';

// ─── List Customers ────────────────────────────────────────
export function useCustomers(filters: CustomerFilters) {
  const params = new URLSearchParams();
  if (filters.search.length >= 2) params.set('search', filters.search);
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page));

  return useQuery<CustomerListResponse>({
    queryKey: ['customers', filters],
    queryFn: () => apiClient.get(`/customers?${params.toString()}`).then(r => r.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

// ─── Single Customer ───────────────────────────────────────
export function useCustomer(id: string | null) {
  return useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: () => apiClient.get(`/customers/${id}`).then(r => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ─── Customer Properties ───────────────────────────────────
export function useCustomerProperties(customerId: string | null) {
  return useQuery<{ properties: Property[] }>({
    queryKey: ['customer-properties', customerId],
    queryFn: () => apiClient.get(`/customers/${customerId}/properties`).then(r => r.data),
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

// ─── Customer Quotes ───────────────────────────────────────
export function useCustomerQuotes(customerId: string | null) {
  return useQuery<any>({
    queryKey: ['customer-quotes', customerId],
    queryFn: () => apiClient.get(`/customers/${customerId}/quotes`).then(r => r.data),
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

// ─── Create Customer ───────────────────────────────────────
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NewCustomerForm) => apiClient.post('/customers', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// ─── Update Customer ───────────────────────────────────────
export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NewCustomerForm>) =>
      apiClient.put(`/customers/${id}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
  });
}

// ─── Add Property ──────────────────────────────────────────
export function useAddProperty(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NewPropertyForm) =>
      apiClient.post(`/customers/${customerId}/properties`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-properties', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// ─── Search Customers (for Quote Wizard) ───────────────────
export function useCustomerSearch(query: string) {
  const params = new URLSearchParams({ search: query, limit: '10' });
  return useQuery<CustomerListResponse>({
    queryKey: ['customer-search', query],
    queryFn: () => apiClient.get(`/customers?${params.toString()}`).then(r => r.data),
    enabled: query.length >= 2,
    staleTime: 10_000,
  });
}
