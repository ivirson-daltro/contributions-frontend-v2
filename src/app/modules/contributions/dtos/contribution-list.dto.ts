import { Contribution } from './contribution.dto';

export interface ContributionList {
  data: Contribution[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totals: { amount: string; count: number };
  };
}
