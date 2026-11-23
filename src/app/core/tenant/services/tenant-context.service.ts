import { Injectable, signal } from '@angular/core';
import { TenantContext } from '../dtos/tenant-context.dto';

@Injectable()
export class TenantContextService {
  readonly current = signal<TenantContext | null>(null);
}
