import { TenantMembership } from '../../auth/dtos/tenant-membership.dto';

export interface TenantContext {
  accessToken: string;
  membership: TenantMembership;
}
