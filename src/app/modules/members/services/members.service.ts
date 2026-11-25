import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Member, MemberList, MemberPayload, MemberQuery, MemberType } from '../dtos/member.dto';
import { MemberLookup } from '../../../shared/dtos/member-lookup.dto';

@Injectable({ providedIn: 'root' })
export class MembersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  list(accessToken: string, tenantId: string, query: MemberQuery): Promise<MemberList> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return firstValueFrom(this.http.get<MemberList>(`${this.baseUrl}/members`, {
      headers: this.headers(accessToken, tenantId), params,
    }));
  }

  listTypes(accessToken: string, tenantId: string): Promise<MemberType[]> {
    return firstValueFrom(this.http.get<MemberType[]>(`${this.baseUrl}/catalogs/member-types`, {
      headers: this.headers(accessToken, tenantId),
    }));
  }

  listAll(accessToken: string, tenantId: string): Promise<MemberLookup[]> {
    return firstValueFrom(this.http.get<MemberLookup[]>(`${this.baseUrl}/members/all`, {
      headers: this.headers(accessToken, tenantId),
    }));
  }

  get(accessToken: string, tenantId: string, id: string): Promise<Member> {
    return firstValueFrom(this.http.get<Member>(`${this.baseUrl}/members/${encodeURIComponent(id)}`, {
      headers: this.headers(accessToken, tenantId),
    }));
  }

  create(accessToken: string, tenantId: string, payload: MemberPayload, force = false): Promise<Member> {
    const params = force ? new HttpParams().set('force', 'true') : undefined;
    return firstValueFrom(this.http.post<Member>(`${this.baseUrl}/members`, payload, {
      headers: this.headers(accessToken, tenantId), params,
    }));
  }

  update(accessToken: string, tenantId: string, id: string, payload: Partial<MemberPayload>): Promise<Member> {
    return firstValueFrom(this.http.put<Member>(`${this.baseUrl}/members/${encodeURIComponent(id)}`, payload, {
      headers: this.headers(accessToken, tenantId),
    }));
  }

  delete(accessToken: string, tenantId: string, id: string): Promise<{ id: string }> {
    return firstValueFrom(this.http.delete<{ id: string }>(`${this.baseUrl}/members/${encodeURIComponent(id)}`, {
      headers: this.headers(accessToken, tenantId),
    }));
  }

  private headers(accessToken: string, tenantId: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${accessToken}`, 'X-Tenant-Id': tenantId });
  }
}
