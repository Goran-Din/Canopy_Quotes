import apiClient from './client';
import type { AuthUser, AuthTokens } from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens & { user: AuthUser }> => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('access_token');
  },

  me: async (): Promise<AuthUser> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  refresh: async (): Promise<AuthTokens> => {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },
};
