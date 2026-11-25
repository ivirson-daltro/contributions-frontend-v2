export interface CreateTenantRequest {
  name: string;
  slug: string;
  document: string | null;
  adminName: string;
  adminEmail: string;
}
