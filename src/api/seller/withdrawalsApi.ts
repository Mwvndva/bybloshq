import apiClient from '@/lib/apiClient';
import type { WithdrawalRequest } from './types';

const sellerApiInstance = apiClient;

export const sellerWithdrawalsApi = {
  async requestWithdrawal(data: {
    amount: number;
    mpesaNumber: string;
    mpesaName: string;
    idempotencyKey: string;
  }): Promise<WithdrawalRequest> {
    if (data.amount < 50 || data.amount > 250_000) {
      throw new Error('Invalid withdrawal amount. Must be between KSh 50 and KSh 250,000.');
    }

    if (!data.idempotencyKey) {
      throw new Error('Withdrawal idempotency key is required.');
    }

    const { idempotencyKey, ...payload } = data;

    const response = await sellerApiInstance.post<{ data: WithdrawalRequest }>(
      '/sellers/withdrawal-request',
      payload,
      {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      }
    );
    return response.data.data;
  },

  async getWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    const response = await sellerApiInstance.get<{ data: WithdrawalRequest[] }>('/sellers/withdrawal-requests');
    return response.data.data;
  }
};

export const withdrawalService = {
  createRequest: async (data: { amount: string; mpesaNumber: string; mpesaName: string; idempotencyKey: string }) => {
    const amount = parseFloat(data.amount);

    if (isNaN(amount) || amount <= 0 || amount > 1_000_000) {
      throw new Error('Invalid withdrawal amount');
    }

    if (!data.idempotencyKey) {
      throw new Error('Withdrawal idempotency key is required.');
    }

    const response = await sellerApiInstance.post('/sellers/withdrawal-request',
      { mpesaNumber: data.mpesaNumber, mpesaName: data.mpesaName, amount },
      {
        headers: {
          'Idempotency-Key': data.idempotencyKey
        }
      }
    );
    return response.data;
  },

  getRequests: async () => {
    const response = await sellerApiInstance.get('/sellers/withdrawal-requests');
    return response.data;
  }
};
