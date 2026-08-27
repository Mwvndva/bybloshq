import axios from 'axios';

export type ErrorCategory = 'http' | 'network' | 'timeout' | 'client' | 'unknown';

export interface ClassifiedError {
  category: ErrorCategory;
  statusCode?: number;
  message: string;
  code?: string;
  email?: string;
  userType?: string;
  rawError: unknown;
}

/**
 * Robust, standardized API error classifier across all Byblos authentication & HTTP clients.
 * Accurately distinguishes server HTTP status codes (401, 403, 404, 429, 500) from genuine
 * network failures (ERR_NETWORK), timeouts (ECONNABORTED), and client-side exceptions.
 */
export function classifyApiError(error: unknown, fallbackMessage = 'An unexpected error occurred'): ClassifiedError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data as {
      message?: string;
      code?: string;
      error?: string;
      email?: string;
      userType?: string;
    } | undefined;

    const backendMessage = responseData?.message || responseData?.error;

    // Timeout (ECONNABORTED or message contains timeout)
    if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      return {
        category: 'timeout',
        message: 'Connection timed out. Please check your network and try again.',
        code: error.code,
        rawError: error,
      };
    }

    // Genuine network-level failure without HTTP response
    if (error.code === 'ERR_NETWORK' || (!error.response && error.request)) {
      return {
        category: 'network',
        message: 'Network error. Please check your internet connection.',
        code: error.code || 'ERR_NETWORK',
        rawError: error,
      };
    }

    // HTTP response with status code
    if (status) {
      return {
        category: 'http',
        statusCode: status,
        message: backendMessage || error.message || fallbackMessage,
        code: responseData?.code || String(status),
        email: responseData?.email,
        userType: responseData?.userType,
        rawError: error,
      };
    }
  }

  if (error instanceof Error) {
    return {
      category: 'client',
      message: error.message || fallbackMessage,
      rawError: error,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    const resData = (errObj.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    const msg = String(resData?.message || errObj.message || fallbackMessage);
    return {
      category: 'unknown',
      message: msg,
      code: resData?.code ? String(resData.code) : undefined,
      rawError: error,
    };
  }

  return {
    category: 'unknown',
    message: typeof error === 'string' ? error : fallbackMessage,
    rawError: error,
  };
}
