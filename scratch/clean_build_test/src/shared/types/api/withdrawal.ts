export interface ApiWithdrawalRequest {
  id: string;
  amount: number;
  withdrawalFee?: number;
  totalDeducted?: number;
  mpesaNumber: string;
  mpesaName: string;
  status: 'processing' | 'completed' | 'failed' | 'compensation_required';
  createdAt: string;
  updatedAt?: string;
  processedAt?: string;
  processedBy?: string;
  providerReference?: string;
  mpesaReceipt?: string;
  failureReason?: string;
}


