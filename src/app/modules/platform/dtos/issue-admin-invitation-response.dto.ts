export interface IssueAdminInvitationResponse {
  tenantId: string;
  invitation: {
    id: string;
    token: string;
    expiresAt: string;
    email: string;
    roles: string[];
  };
}
