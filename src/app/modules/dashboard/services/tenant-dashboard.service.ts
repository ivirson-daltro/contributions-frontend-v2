import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardSummaryResponse } from '../dtos/dashboard-summary-response.dto';
import { DashboardSeriesResponse } from '../dtos/dashboard-series-response.dto';

@Injectable({ providedIn: 'root' })
export class TenantDashboardService {
  private readonly http = inject(HttpClient);
  private readonly dashboardUrl = `${environment.apiUrl}/dashboard`;

  getSummary(accessToken: string, tenantId: string): Promise<DashboardSummaryResponse> {
    return firstValueFrom(
      this.http.get<DashboardSummaryResponse>(`${this.dashboardUrl}/summary`, {
        headers: this.authorization(accessToken, tenantId),
      }),
    );
  }

  updateCard(
    accessToken: string,
    tenantId: string,
    contributionTypeId: string | null,
  ): Promise<{ contributionTypeId: string | null }> {
    return firstValueFrom(
      this.http.put<{ contributionTypeId: string | null }>(`${this.dashboardUrl}/card`, { contributionTypeId }, {
        headers: this.authorization(accessToken, tenantId),
      }),
    );
  }

  getSeries(
    accessToken: string,
    tenantId: string,
    year?: number,
  ): Promise<DashboardSeriesResponse> {
    let params = new HttpParams();
    if (year !== undefined) params = params.set('year', year);

    return firstValueFrom(
      this.http.get<DashboardSeriesResponse>(`${this.dashboardUrl}/series`, {
        headers: this.authorization(accessToken, tenantId),
        params,
      }),
    );
  }

  private authorization(accessToken: string, tenantId: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      'X-Tenant-Id': tenantId,
    });
  }
}
