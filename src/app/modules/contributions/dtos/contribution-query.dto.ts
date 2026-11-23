export interface ContributionQuery {
  q?: string;
  memberId?: string;
  typeId?: string;
  methodId?: string;
  from?: string;
  to?: string;
  status?: 'ACTIVE' | 'ALL';
  page: number;
  pageSize: number;
}
