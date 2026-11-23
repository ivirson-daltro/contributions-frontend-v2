export interface Contribution {
  id: string;
  occurredOn: string;
  amount: string;
  member: { id: string; name: string } | null;
  type: { id: string; description: string; category: string };
  method: { id: string; description: string; kind: string };
  observation: string | null;
  status: 'ACTIVE' | 'VOIDED';
  attachmentsCount: number;
  version: number;
}
