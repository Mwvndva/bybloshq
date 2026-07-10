import { describe, it, expect } from 'vitest';
import apiClient, { getFreshCsrfToken } from './apiClient';

describe('apiClient module', () => {
  it('exports a configured axios instance', () => {
    expect(apiClient).toBeDefined();
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(apiClient.defaults.timeout).toBeGreaterThan(0);
  });

  it('exposes getFreshCsrfToken as a function', () => {
    expect(typeof getFreshCsrfToken).toBe('function');
  });
});


