import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ChurchSettings { name: string; document: string | null; timezone: string }
export type LogoTheme = 'LIGHT' | 'DARK';
export interface Preferences {
  weekStartsOn: number;
  allowFutureDates: boolean;
  payableWindowDays: number;
  payableAlertDays: number;
  attachmentMaxMb: number;
  attachmentMaxFiles: number;
  requireMfaRoles: string[];
  cascadeReopen: boolean;
}
export type CatalogKind = 'member-types' | 'contribution-types' | 'payment-methods' | 'expense-categories';
export interface CatalogItem {
  id: string;
  description: string;
  active: boolean;
  usageCount: number;
  category?: string;
  kind?: string;
  requiresMember?: boolean;
  countsForFees?: boolean;
  countsAsContributor?: boolean;
}
export type CatalogPayload = Omit<CatalogItem, 'id' | 'usageCount'>;
export interface FeeRule {
  id?: string;
  name: string;
  percent: string;
  rounding: 'HALF_UP_2' | 'LEGACY_CENTS_09';
  active: boolean;
  sortOrder: number;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getChurch(token: string, tenantId: string): Promise<ChurchSettings> {
    return firstValueFrom(this.http.get<ChurchSettings>(`${this.base}/tenant`, { headers: this.headers(token, tenantId) }));
  }
  saveChurch(token: string, tenantId: string, value: Pick<ChurchSettings, 'name' | 'document'>): Promise<ChurchSettings> {
    return firstValueFrom(this.http.put<ChurchSettings>(`${this.base}/tenant`, value, { headers: this.headers(token, tenantId) }));
  }
  getPreferences(token: string, tenantId: string): Promise<Preferences> {
    return firstValueFrom(this.http.get<Preferences>(`${this.base}/tenant/settings`, { headers: this.headers(token, tenantId) }));
  }
  savePreferences(token: string, tenantId: string, value: Preferences): Promise<Preferences> {
    return firstValueFrom(this.http.put<Preferences>(`${this.base}/tenant/settings`, value, { headers: this.headers(token, tenantId) }));
  }
  getLogo(token: string, tenantId: string, theme: LogoTheme = 'LIGHT', fallback = true): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.base}/tenant/logo`, {
      headers: this.headers(token, tenantId),
      params: new HttpParams().set('theme', theme).set('fallback', fallback),
      responseType: 'blob',
    }));
  }
  uploadLogo(token: string, tenantId: string, file: File, theme: LogoTheme = 'LIGHT'): Promise<void> {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(this.http.put<void>(`${this.base}/tenant/logo`, body, {
      headers: this.headers(token, tenantId),
      params: new HttpParams().set('theme', theme),
    }));
  }
  listCatalog(token: string, tenantId: string, kind: CatalogKind): Promise<CatalogItem[]> {
    return firstValueFrom(this.http.get<CatalogItem[]>(`${this.base}/settings/catalogs/${kind}`, { headers: this.headers(token, tenantId) }));
  }
  createCatalog(token: string, tenantId: string, kind: CatalogKind, value: CatalogPayload): Promise<CatalogItem> {
    return firstValueFrom(this.http.post<CatalogItem>(`${this.base}/settings/catalogs/${kind}`, value, { headers: this.headers(token, tenantId) }));
  }
  updateCatalog(token: string, tenantId: string, kind: CatalogKind, id: string, value: Partial<CatalogPayload>, confirm = false): Promise<CatalogItem> {
    return firstValueFrom(this.http.put<CatalogItem>(`${this.base}/settings/catalogs/${kind}/${encodeURIComponent(id)}`, value, {
      headers: this.headers(token, tenantId), params: confirm ? { confirm: 'true' } : {},
    }));
  }
  deleteCatalog(token: string, tenantId: string, kind: CatalogKind, id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/settings/catalogs/${kind}/${encodeURIComponent(id)}`, { headers: this.headers(token, tenantId) }));
  }
  getFees(token: string, tenantId: string): Promise<FeeRule[]> {
    return firstValueFrom(this.http.get<FeeRule[]>(`${this.base}/settings/fees`, { headers: this.headers(token, tenantId) }));
  }
  saveFees(token: string, tenantId: string, rules: FeeRule[]): Promise<FeeRule[]> {
    return firstValueFrom(this.http.put<FeeRule[]>(`${this.base}/settings/fees`, { rules }, { headers: this.headers(token, tenantId) }));
  }
  requestCancellation(token: string, tenantId: string, reason: string): Promise<{ requested: boolean }> {
    return firstValueFrom(this.http.post<{ requested: boolean }>(`${this.base}/tenant/cancel-request`, { reason }, {
      headers: this.headers(token, tenantId),
    }));
  }
  private headers(token: string, tenantId: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId });
  }
}
