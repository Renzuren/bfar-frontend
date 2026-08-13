// src/lib/apiMiddleware.js
// API middleware for preprocessing requests and responses
import axios from 'axios';
import { preprocessFormData, preprocessFormAnswers, sanitizeHtml } from './preprocessing';

/**
 * Enhanced axios instance with preprocessing middleware
 */
class ApiClient {
  constructor(baseURL) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
    });

    // Request interceptor for preprocessing
    this.client.interceptors.request.use(
      (config) => this.preprocessRequest(config),
      (error) => Promise.reject(error)
    );

    // Response interceptor for postprocessing
    this.client.interceptors.response.use(
      (response) => this.postprocessResponse(response),
      (error) => this.handleError(error)
    );
  }

  /**
   * Preprocess outgoing requests
   */
  preprocessRequest(config) {
    // Add authorization header if token exists
    const token = localStorage.getItem('token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Preprocess request data based on endpoint
    if (config.data) {
      config.data = this.preprocessRequestData(config.url, config.data);
    }

    return config;
  }

  /**
   * Preprocess request data based on endpoint
   */
  preprocessRequestData(url, data) {
    // Form responses - pass through as-is (data built by the component)
    if (url.includes('/responses')) {
      return data;
    }

    // Form creation/update
    if (url.includes('/forms') && (url.includes('/forms/') || !url.includes('/responses'))) {
      return preprocessFormData(data);
    }

    // Auth requests - basic sanitization
    if (url.includes('/auth/')) {
      if (data.email) {
        data.email = data.email.toLowerCase().trim();
      }
      if (data.first_name) {
        data.first_name = sanitizeHtml(data.first_name);
      }
      if (data.last_name) {
        data.last_name = sanitizeHtml(data.last_name);
      }
    }

    return data;
  }

  /**
   * Postprocess incoming responses
   */
  postprocessResponse(response) {
    // Add any response postprocessing here
    // For now, just return the response as-is
    return response;
  }

  /**
   * Handle API errors with preprocessing
   */
  handleError(error) {
    // Preprocess error messages
    if (error.response?.data?.error) {
      error.response.data.error = sanitizeHtml(error.response.data.error);
    }

    if (error.response?.data?.message) {
      error.response.data.message = sanitizeHtml(error.response.data.message);
    }

    // Handle authentication errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Could trigger logout here
    }

    return Promise.reject(error);
  }

  /**
   * HTTP methods with preprocessing
   */
  get(url, config = {}) {
    return this.client.get(url, config);
  }

  post(url, data, config = {}) {
    return this.client.post(url, data, config);
  }

  put(url, data, config = {}) {
    return this.client.put(url, data, config);
  }

  delete(url, config = {}) {
    return this.client.delete(url, config);
  }
}

// Create and export the API client instance
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

export const apiClient = new ApiClient(API_BASE);

// Export individual methods for convenience
export const api = {
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
  put: (url, data, config) => apiClient.put(url, data, config),
  delete: (url, config) => apiClient.delete(url, config),
};