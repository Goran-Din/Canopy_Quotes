import apiClient from './client';
import type { Customer, Property, ServiceCatalogItem, PriceCalculation } from '../types';

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  list: async (search?: string): Promise<{ customers: Customer[] }> => {
    const response = await apiClient.get('/customers', { params: { search } });
    return response.data;
  },

  get: async (id: string): Promise<Customer & { properties: Property[]; quote_count: number }> => {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data;
  },

  create: async (data: Partial<Customer>): Promise<Customer> => {
    const response = await apiClient.post('/customers', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Customer>): Promise<Customer> => {
    const response = await apiClient.put(`/customers/${id}`, data);
    return response.data;
  },

  getQuotes: async (id: string) => {
    const response = await apiClient.get(`/customers/${id}/quotes`);
    return response.data;
  },

  addProperty: async (customerId: string, data: Partial<Property>): Promise<Property> => {
    const response = await apiClient.post(`/customers/${customerId}/properties`, data);
    return response.data;
  },

  updateProperty: async (
    customerId: string,
    propertyId: string,
    data: Partial<Property>
  ): Promise<Property> => {
    const response = await apiClient.put(
      `/customers/${customerId}/properties/${propertyId}`,
      data
    );
    return response.data;
  },
};

// ── Service Catalog ───────────────────────────────────────────────────────────
export const servicesApi = {
  list: async (category?: string): Promise<ServiceCatalogItem[]> => {
    const response = await apiClient.get('/services', { params: { category } });
    return response.data;
  },

  calculatePrice: async (
    serviceId: string,
    measurement: number,
    measurementUnit: string
  ): Promise<PriceCalculation> => {
    const response = await apiClient.post(`/services/${serviceId}/calculate-price`, {
      measurement,
      measurement_unit: measurementUnit,
    });
    return response.data;
  },
};
