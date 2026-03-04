// Thin wrapper around the Axios client that returns response.data directly.
// Used by the quote-builder wizard for concise `api.get(…)` / `api.post(…)` calls.

import apiClient from '../api/client';

export const api = {
  get: async <T = any>(url: string): Promise<T> => {
    const res = await apiClient.get<T>(url);
    return res.data;
  },
  post: async <T = any>(url: string, data?: unknown): Promise<T> => {
    const res = await apiClient.post<T>(url, data);
    return res.data;
  },
  put: async <T = any>(url: string, data?: unknown): Promise<T> => {
    const res = await apiClient.put<T>(url, data);
    return res.data;
  },
  delete: async <T = any>(url: string): Promise<T> => {
    const res = await apiClient.delete<T>(url);
    return res.data;
  },
};
