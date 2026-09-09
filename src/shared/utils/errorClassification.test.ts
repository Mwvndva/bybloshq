import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { classifyApiError } from './errorClassification';

function makeAxiosError(status: number, data: Record<string, unknown>): AxiosError {
  const error = new AxiosError('Request failed');
  error.response = {
    status,
    data,
    statusText: '',
    headers: {},
    // @ts-expect-error - minimal config stub, not exercised by classifyApiError
    config: {},
  };
  return error;
}

describe('classifyApiError', () => {
  it('extracts the app error code from the production response shape (error field)', () => {
    // This is the actual shape server/src/shared/utils/errorHandler.js sends in
    // production for an AppError: {status, message, requestId, error: code}.
    // There is no top-level `code` field — reading only responseData?.code
    // meant classified.code was always the numeric status string, so every
    // caller gating on a specific app code (e.g. VerifyEmailModal triggering on
    // EMAIL_NOT_VERIFIED) never matched regardless of what the backend sent.
    const error = makeAxiosError(403, {
      status: 'fail',
      message: 'Please verify your email before logging in. Check your inbox or request a new verification link.',
      requestId: 'abc-123',
      error: 'EMAIL_NOT_VERIFIED',
    });

    const classified = classifyApiError(error);

    expect(classified.code).toBe('EMAIL_NOT_VERIFIED');
    expect(classified.statusCode).toBe(403);
    expect(classified.message).toBe(
      'Please verify your email before logging in. Check your inbox or request a new verification link.'
    );
  });

  it('extracts the app error code from the seller/buyer local-classification shape (code field)', () => {
    // seller.auth.controller.js / buyer.controller.js bypass the global error
    // handler and build their own response with a top-level `code` field
    // instead of `error`. Both shapes must resolve to the correct code.
    const error = makeAxiosError(403, {
      status: 'error',
      message: 'Please verify your email before logging in. Check your inbox or request a new verification link.',
      code: 'EMAIL_NOT_VERIFIED',
      email: 'seller@example.com',
      userType: 'seller',
    });

    const classified = classifyApiError(error);

    expect(classified.code).toBe('EMAIL_NOT_VERIFIED');
    expect(classified.email).toBe('seller@example.com');
  });

  it('falls back to the numeric status string when no app code is present', () => {
    const error = makeAxiosError(401, {
      status: 'fail',
      message: 'Invalid email or password',
    });

    const classified = classifyApiError(error);

    expect(classified.code).toBe('401');
  });

  it('classifies a genuine network failure distinctly from an HTTP error', () => {
    const error = new AxiosError('Network Error');
    error.code = 'ERR_NETWORK';

    const classified = classifyApiError(error);

    expect(classified.category).toBe('network');
    expect(classified.code).toBe('ERR_NETWORK');
  });

  it('classifies a timeout distinctly from an HTTP error', () => {
    const error = new AxiosError('timeout of 30000ms exceeded');
    error.code = 'ECONNABORTED';

    const classified = classifyApiError(error);

    expect(classified.category).toBe('timeout');
  });
});
