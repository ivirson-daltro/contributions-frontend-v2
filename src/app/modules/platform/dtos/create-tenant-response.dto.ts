import { PlatformTenant } from './platform-tenant.dto';

export interface CreateTenantResponse {
  tenant: Pick<PlatformTenant, 'id' | 'slug' | 'name' | 'status' | 'timezone'> & {
    trial_ends_at?: string | null;
  };
  invite: {
    token: string;
    expiresAt: string;
    email: string;
    roles: string[];
  };
}
