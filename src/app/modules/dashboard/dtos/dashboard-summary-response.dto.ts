import { DashboardPayable } from './dashboard-payable.dto';
import { DashboardMoney } from '../models/dashboard-money';

export interface DashboardSummaryResponse {
  period: {
    year: number;
    month: number;
    today: string;
    weekStart: string;
    weekStartsOn: number;
  };
  income: {
    week: DashboardMoney;
    previousWeek: DashboardMoney;
    month: DashboardMoney;
    weekCount: number;
    previousWeekCount: number;
    monthCount: number;
  };
  expense: {
    week: DashboardMoney;
    month: DashboardMoney;
    year: DashboardMoney;
    weekCount: number;
    monthCount: number;
    yearCount: number;
  };
  balance: {
    month: DashboardMoney;
    opening: DashboardMoney | null;
    openingDefined: boolean;
    cashOnHand: DashboardMoney | null;
    final: DashboardMoney | null;
    accumulated: DashboardMoney | null;
  };
  byKind: {
    week: Record<string, DashboardMoney>;
    previousWeek: Record<string, DashboardMoney>;
    month: Record<string, DashboardMoney>;
  };
  members: {
    active: number;
    contributorsMonth: number;
  };
  constructionOffering: {
    total: DashboardMoney;
    count: number;
  };
  customCard: {
    contributionTypeId: string | null;
    contributionTypeName: string | null;
    total: DashboardMoney | null;
    contributionTypes: { id: string; description: string }[];
  };
  payables: {
    overdueCount: number;
    next7DaysCount: number;
    next7DaysAmount: DashboardMoney;
    overdue: DashboardPayable[] | null;
    next7Days: DashboardPayable[] | null;
  };
}
