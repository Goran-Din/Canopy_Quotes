import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '../api/quotes';
import type { QuoteFilters } from '../types';

// ── Query keys (stable cache keys) ───────────────────────────────────────────
export const quoteKeys = {
  all: ['quotes'] as const,
  lists: () => [...quoteKeys.all, 'list'] as const,
  list: (filters: QuoteFilters) => [...quoteKeys.lists(), filters] as const,
  stats: (month?: string) => [...quoteKeys.all, 'stats', month] as const,
  detail: (id: string) => [...quoteKeys.all, 'detail', id] as const,
};

// ── Quote list ────────────────────────────────────────────────────────────────
export function useQuoteList(filters: QuoteFilters = {}) {
  return useQuery({
    queryKey: quoteKeys.list(filters),
    queryFn: () => quotesApi.list(filters),
    staleTime: 30_000, // 30 seconds
  });
}

// ── Stats panel ───────────────────────────────────────────────────────────────
export function useQuoteStats(month?: string) {
  return useQuery({
    queryKey: quoteKeys.stats(month),
    queryFn: () => quotesApi.stats(month),
    staleTime: 60_000, // 1 minute
  });
}

// ── Quote detail ──────────────────────────────────────────────────────────────
export function useQuoteDetail(id: string) {
  return useQuery({
    queryKey: quoteKeys.detail(id),
    queryFn: () => quotesApi.getDetail(id),
    enabled: !!id,
  });
}

// ── Status change ─────────────────────────────────────────────────────────────
export function useChangeQuoteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      quotesApi.changeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}

// ── Duplicate ─────────────────────────────────────────────────────────────────
export function useDuplicateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotesApi.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

// ── Delete draft ──────────────────────────────────────────────────────────────
export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotesApi.deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}
