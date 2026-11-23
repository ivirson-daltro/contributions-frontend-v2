import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Contribution } from '../dtos/contribution.dto';
import { ContributionList } from '../dtos/contribution-list.dto';
import { ContributionQuery } from '../dtos/contribution-query.dto';
import { ContributionReportPeriod } from '../dtos/contribution-report-period.dto';
import { ContributionType } from '../dtos/contribution-type.dto';
import { CreateContribution } from '../dtos/create-contribution.dto';
import { MemberLookup } from '../dtos/member-lookup.dto';
import { PagedOptions } from '../dtos/paged-options.dto';
import { PaymentMethod } from '../dtos/payment-method.dto';
import { UpdateContribution } from '../dtos/update-contribution.dto';
import { VoidContribution, VoidedContribution } from '../dtos/void-contribution.dto';

@Injectable({ providedIn: 'root' })
export class ContributionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  list(accessToken: string, tenantId: string, query: ContributionQuery): Promise<ContributionList> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return firstValueFrom(
      this.http.get<ContributionList>(`${this.baseUrl}/contributions`, {
        headers: this.headers(accessToken, tenantId),
        params,
      }),
    );
  }

  report(accessToken: string, tenantId: string, period: ContributionReportPeriod): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl}/contributions/report`, {
        headers: this.headers(accessToken, tenantId),
        params: new HttpParams().set('from', period.from).set('to', period.to),
        responseType: 'blob',
      }),
    );
  }

  async listTypes(accessToken: string, tenantId: string): Promise<ContributionType[]> {
    return this.listOptions<ContributionType>('contribution-types', accessToken, tenantId);
  }

  async listMethods(accessToken: string, tenantId: string): Promise<PaymentMethod[]> {
    return this.listOptions<PaymentMethod>('payment-methods', accessToken, tenantId);
  }

  listAllMembers(accessToken: string, tenantId: string): Promise<MemberLookup[]> {
    return firstValueFrom(
      this.http.get<MemberLookup[]>(`${this.baseUrl}/members/all`, {
        headers: this.headers(accessToken, tenantId),
      }),
    );
  }

  create(
    accessToken: string,
    tenantId: string,
    payload: CreateContribution,
    idempotencyKey: string,
  ): Promise<Contribution> {
    return firstValueFrom(
      this.http.post<Contribution>(`${this.baseUrl}/contributions`, payload, {
        headers: this.headers(accessToken, tenantId).set('Idempotency-Key', idempotencyKey),
      }),
    );
  }

  update(
    accessToken: string,
    tenantId: string,
    id: string,
    payload: UpdateContribution,
  ): Promise<Contribution> {
    return firstValueFrom(
      this.http.put<Contribution>(`${this.baseUrl}/contributions/${encodeURIComponent(id)}`, payload, {
        headers: this.headers(accessToken, tenantId),
      }),
    );
  }

  void(
    accessToken: string,
    tenantId: string,
    id: string,
    payload: VoidContribution,
  ): Promise<VoidedContribution> {
    return firstValueFrom(
      this.http.delete<VoidedContribution>(`${this.baseUrl}/contributions/${encodeURIComponent(id)}`, {
        headers: this.headers(accessToken, tenantId),
        body: payload,
      }),
    );
  }

  private async listOptions<T>(
    resource: string,
    accessToken: string,
    tenantId: string,
  ): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    let total: number;
    do {
      const response = await firstValueFrom(
        this.http.get<PagedOptions<T>>(`${this.baseUrl}/catalogs/${resource}`, {
          headers: this.headers(accessToken, tenantId),
          params: new HttpParams().set('page', page).set('pageSize', 100),
        }),
      );
      if (!response.data.length && items.length < response.meta.total) {
        throw new Error('Paginação de catálogo incompleta.');
      }
      items.push(...response.data);
      total = response.meta.total;
      page++;
    } while (items.length < total);
    return items;
  }

  private headers(accessToken: string, tenantId: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      'X-Tenant-Id': tenantId,
    });
  }
}
