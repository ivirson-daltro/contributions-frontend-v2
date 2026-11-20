import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PlatformTenant } from '../dtos/platform-tenant.dto';
import { CreateTenantRequest } from '../dtos/create-tenant-request.dto';
import { CreateTenantResponse } from '../dtos/create-tenant-response.dto';
import { IssueAdminInvitationResponse } from '../dtos/issue-admin-invitation-response.dto';

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
