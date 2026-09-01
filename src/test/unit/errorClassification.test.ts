import { describe, it, expect } from 'vitest';
import { classifyApiError } from '@/shared/utils/errorClassification';

describe('API Error Classification Utility', () => {
  it('correctly classifies HTTP 401 Invalid Credentials with backend message', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 401,
        data: {
          status: 'error',
          message: 'Invalid email or password',
        },
      },
    };

    const classified = classifyApiError(error);
    expect(classified.category).toBe('http');
    expect(classified.statusCode).toBe(401);
    expect(classified.message).toBe('Invalid email or password');
  });

  it('correctly classifies HTTP 403 Email Not Verified with code and email metadata', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 403,
        data: {
          status: 'error',
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email before logging in.',
          email: 'courier@byblos.com',
          userType: 'logistics',
        },
      },
    };

    const classified = classifyApiError(error);
    expect(classified.category).toBe('http');
    expect(classified.statusCode).toBe(403);
    expect(classified.code).toBe('EMAIL_NOT_VERIFIED');
    expect(classified.email).toBe('courier@byblos.com');
    expect(classified.userType).toBe('logistics');
    expect(classified.message).toBe('Please verify your email before logging in.');
  });

  it('correctly classifies HTTP 500 Server Error without calling it a connection error', () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 500,
        data: {
          status: 'error',
          message: 'Internal server error',
        },
      },
    };

    const classified = classifyApiError(error);
    expect(classified.category).toBe('http');
    expect(classified.statusCode).toBe(500);
    expect(classified.message).toBe('Internal server error');
  });

  it('correctly classifies genuine network outage (ERR_NETWORK)', () => {
    const error = {
      isAxiosError: true,
      code: 'ERR_NETWORK',
      request: {},
      message: 'Network Error',
    };

    const classified = classifyApiError(error);
    expect(classified.category).toBe('network');
    expect(classified.message).toBe('Network error. Please check your internet connection.');
  });

  it('correctly classifies connection timeouts (ECONNABORTED)', () => {
    const error = {
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 30000ms exceeded',
    };

    const classified = classifyApiError(error);
    expect(classified.category).toBe('timeout');
    expect(classified.message).toBe('Connection timed out. Please check your network and try again.');
  });

  it('correctly classifies client runtime TypeError / Error instances', () => {
    const error = new TypeError('Cannot read properties of undefined');
    const classified = classifyApiError(error);
    expect(classified.category).toBe('client');
    expect(classified.message).toBe('Cannot read properties of undefined');
  });

  it('provides safe fallback for unknown string / empty error types', () => {
    const classified = classifyApiError(null, 'Custom fallback message');
    expect(classified.category).toBe('unknown');
    expect(classified.message).toBe('Custom fallback message');
  });
});
