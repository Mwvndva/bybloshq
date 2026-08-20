export interface RefundRequest {
  id: number;
  buyer_id: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_current_refunds: string;
  amount: string;
  status: string;
  payment_method: string;
  payment_details: Record<string, unknown>;
  notes: string;
  admin_notes: string;
  requested_at: string;
  processed_at: string;
}
