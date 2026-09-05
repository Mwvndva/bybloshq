// A creator earning held for self-dealing review (see server
// creator.service.js#_detectPostHocSelfDealing). Never shown to the creator
// or buyer — this queue exists purely for admin review.
export interface FlaggedEarning {
  id: number;
  earning_type: 'sales' | 'referral';
  creator_id: number;
  creator_name: string;
  order_id: number;
  order_number: string;
  buyer_id: number | null;
  amount: string;
  status: string;
  created_at: string;
  metadata: {
    flagged_for_review?: boolean;
    flag_reason?: string;
    flagged_at?: string;
    review_resolution?: 'released' | 'reversed';
    reviewed_by?: number;
    reviewed_at?: string;
    review_notes?: string | null;
    [key: string]: unknown;
  };
}

export type FlaggedEarningAction = 'release' | 'reverse';
