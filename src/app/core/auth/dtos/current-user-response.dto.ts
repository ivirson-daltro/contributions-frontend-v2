import { TenantMembership } from './tenant-membership.dto';

export interface CurrentUserResponse {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
  };
  memberships: TenantMembership[];
}
