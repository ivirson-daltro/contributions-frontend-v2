import { Injectable, signal } from '@angular/core';
import { TenantContext } from '../dtos/tenant-context.dto';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  readonly current = signal<TenantContext | null>(null);
  readonly displayName = signal('');
  readonly logoVersion = signal(0);
  readonly status = signal<'loading' | 'ready' | 'denied' | 'error'>('loading');
  private validationRequest = 0;
  private readonly logoCache = new Map<string, Blob>();

  beginValidation(): number {
    this.validationRequest++;
    this.status.set('loading');
    return this.validationRequest;
  }

  isCurrentValidation(request: number): boolean {
    return request === this.validationRequest;
  }

  getCachedLogo(tenantId: string, theme: 'LIGHT' | 'DARK'): Blob | null {
    return this.logoCache.get(this.logoKey(tenantId, theme)) ?? null;
  }

  cacheLogo(tenantId: string, theme: 'LIGHT' | 'DARK', logo: Blob): void {
    this.logoCache.set(this.logoKey(tenantId, theme), logo);
  }

  invalidateLogo(tenantId: string, theme: 'LIGHT' | 'DARK'): void {
    this.logoCache.delete(this.logoKey(tenantId, theme));
    if (theme === 'LIGHT') this.logoCache.delete(this.logoKey(tenantId, 'DARK'));
  }

  private logoKey(tenantId: string, theme: 'LIGHT' | 'DARK'): string {
    return `${tenantId}:${theme}`;
  }
}
