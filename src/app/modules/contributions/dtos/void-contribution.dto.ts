export interface VoidContribution {
  version: number;
  voidReason?: string;
}

export interface VoidedContribution {
  id: string;
  status: 'VOIDED';
  voidReason: string | null;
}
