import { Injectable, signal } from '@angular/core';
import { TenantContext } from '../dtos/tenant-context.dto';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  readonly current = signal<TenantContext | null>(null);
  readonly displayName = signal('');
  readonly status = signal<'loading' | 'ready' | 'denied' | 'error'>('loading');
  private validationRequest = 0;

  beginValidation(): number {
    this.validationRequest++;
    this.status.set('loading');
    return this.validationRequest;
  }

  isCurrentValidation(request: number): boolean {
    return request === this.validationRequest;
  }
}
