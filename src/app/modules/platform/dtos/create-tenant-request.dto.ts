export interface CreateTenantRequest {
  name: string;
  slug: string;
  document: string | null;
  timezone: string;
  adminName: string;
  adminEmail: string;
}
