export interface UpdateContribution {
  contributionTypeId?: string;
  paymentMethodId?: string;
  memberId?: string | null;
  amount?: string;
  occurredOn?: string;
  observation?: string | null;
  version: number;
}
