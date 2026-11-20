import { DashboardMoney } from '../models/dashboard-money';

export interface DashboardPayable {
  id: string;
  payableId: string;
  description: string | null;
  dueDate: string;
  expectedAmount: DashboardMoney | null;
}
