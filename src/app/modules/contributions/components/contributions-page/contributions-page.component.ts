import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TenantContextService } from '../../../../core/tenant/services/tenant-context.service';
import { ContributionsComponent } from '../contributions/contributions.component';

@Component({
  selector: 'app-contributions-page',
  imports: [ContributionsComponent],
  template: `
    @for (tenant of tenants(); track tenant) {
      <app-contributions
        [accessToken]="tenant.accessToken"
        [tenantId]="tenant.membership.tenantId"
        [openOnLoad]="openOnLoad"
      />
    }
  `,
})
export class ContributionsPageComponent {
  private readonly context = inject(TenantContextService);
  // A new validated context must recreate the list and form when the route is reused.
  protected readonly tenants = computed(() => {
    const tenant = this.context.current();
    return tenant ? [tenant] : [];
  });
  protected readonly openOnLoad = inject(ActivatedRoute).snapshot.queryParamMap.get('new') === '1';
}
