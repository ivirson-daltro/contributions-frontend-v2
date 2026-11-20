export interface TotpFactorStatus {
  factors: Array<{ id: string; status: string }>;
  currentLevel: string | null;
  nextLevel: string | null;
}
