import { DashboardMoney } from '../models/dashboard-money';

export interface DashboardSeriesResponse {
  year: number;
  income: {
    current: DashboardMoney[];
    previous: DashboardMoney[];
    byKind: Record<string, { current: DashboardMoney[]; previous: DashboardMoney[] }>;
  };
  expense: {
    current: DashboardMoney[];
    previous: DashboardMoney[];
  };
}
