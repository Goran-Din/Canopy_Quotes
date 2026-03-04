import apiClient from './client';
import type {
  QuoteListResult,
  QuoteStats,
  QuoteDetail,
  QuoteFilters,
} from '../types';

export const quotesApi = {
  // ── Dashboard ─────────────────────────────────────────────────────────────

  list: async (filters: QuoteFilters = {}): Promise<QuoteListResult> => {
    const response = await apiClient.get('/quotes', { params: filters });
    return response.data;
  },

  stats: async (month?: string): Promise<QuoteStats> => {
    const response = await apiClient.get('/quotes/stats', { params: { month } });
    return response.data;
  },

  getDetail: async (id: string): Promise<QuoteDetail> => {
    const response = await apiClient.get(`/quotes/${id}`);
    return response.data;
  },

  // ── Status management ─────────────────────────────────────────────────────

  changeStatus: async (id: string, status: 'approved' | 'rejected'): Promise<void> => {
    await apiClient.put(`/quotes/${id}/status`, { status });
  },

  duplicate: async (id: string): Promise<{ quote_id: string; quote_number: string }> => {
    const response = await apiClient.post(`/quotes/${id}/duplicate`);
    return response.data;
  },

  deleteDraft: async (id: string): Promise<void> => {
    await apiClient.delete(`/quotes/${id}`);
  },

  // ── PDF ───────────────────────────────────────────────────────────────────

  generatePdf: async (id: string): Promise<{ job_id: string; poll_url: string }> => {
    const response = await apiClient.post(`/quotes/${id}/generate-pdf`);
    return response.data;
  },

  getPdfStatus: async (
    id: string,
    jobId: string
  ): Promise<
    | { status: 'pending' }
    | { status: 'done'; proposal_id: string; signed_url: string }
    | { status: 'failed'; error: string }
  > => {
    const response = await apiClient.get(`/quotes/${id}/pdf-status/${jobId}`);
    return response.data;
  },

  getPdfUrl: async (
    id: string
  ): Promise<{ proposal_id: string; version: number; signed_url: string; expires_at: string }> => {
    const response = await apiClient.get(`/quotes/${id}/pdf-url`);
    return response.data;
  },

  // ── Email ─────────────────────────────────────────────────────────────────

  send: async (id: string): Promise<{ message_id: string; sent_at: string }> => {
    const response = await apiClient.post(`/quotes/${id}/send`);
    return response.data;
  },

  resend: async (id: string, recipientEmail?: string): Promise<{ message_id: string; sent_at: string }> => {
    const response = await apiClient.post(`/quotes/${id}/resend`, {
      recipient_email: recipientEmail,
    });
    return response.data;
  },
};
