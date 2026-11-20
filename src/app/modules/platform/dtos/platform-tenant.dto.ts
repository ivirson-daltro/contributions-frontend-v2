export interface PlatformTenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  timezone: string;
  trialEndsAt: string | null;
  createdAt: string;
  metrics: {
    activeUsers: number;
    activeMembers: number;
    storageBytes: number;
  };
  hasActiveTenantAdmin: boolean;
  pendingAdminInvitationExpiresAt: string | null;
}
