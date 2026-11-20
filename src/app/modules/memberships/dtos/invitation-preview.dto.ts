export interface InvitationPreview {
  tenant: {
    name: string;
    slug: string;
  };
  email: string;
  name?: string;
  roles: string[];
  status: string;
  expiresAt: string;
  accountExists: boolean;
}
