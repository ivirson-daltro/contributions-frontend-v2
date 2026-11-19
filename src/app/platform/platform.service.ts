import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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

export interface CreateTenantRequest {
  name: string;
  slug: string;
  document: string | null;
  timezone: string;
  adminName: string;
  adminEmail: string;
}

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

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly tenantsUrl = `${environment.apiUrl}/platform/tenants`;

  listTenants(accessToken: string): Promise<{ items: PlatformTenant[]; meta: { count: number } }> {
    return firstValueFrom(
      this.http.get<{ items: PlatformTenant[]; meta: { count: number } }>(this.tenantsUrl, {
        headers: this.authorization(accessToken),
      }),
    );
  }

  createTenant(accessToken: string, payload: CreateTenantRequest): Promise<CreateTenantResponse> {
    return firstValueFrom(
      this.http.post<CreateTenantResponse>(this.tenantsUrl, payload, {
        headers: this.authorization(accessToken),
      }),
    );
  }

  issueAdminInvitation(
    accessToken: string,
    tenantId: string,
    payload: { email: string; name: string },
  ): Promise<IssueAdminInvitationResponse> {
    return firstValueFrom(
      this.http.post<IssueAdminInvitationResponse>(
        `${this.tenantsUrl}/${encodeURIComponent(tenantId)}/admin-invitations`,
        payload,
        { headers: this.authorization(accessToken) },
      ),
    );
  }

  private authorization(accessToken: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
  }
}
