import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { TenantMembership } from '../../../../core/auth/dtos/tenant-membership.dto';
import { ToastService } from '../../../../core/ui/toast.service';
import { canManageMembers } from '../../../../core/tenant/tenant-access';

@Component({
  imports: [RouterLink],
  selector: 'app-select-church',
  templateUrl: './select-church.component.html',
})
export class SelectChurchComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly memberships = signal<TenantMembership[]>([]);
  protected readonly selectedTenantId = signal('');
  protected readonly isLoading = signal(true);
  protected readonly feedback = signal('');

  ngOnInit(): void {
    void this.loadMemberships();
  }

  protected selectChurch(): void {
    const membership = this.memberships().find((item) => item.tenantId === this.selectedTenantId());
    if (!membership) return;

    if (!canManageMembers(membership.roles)) {
      this.toast.warning('A área de gestão não está disponível para seu perfil.');
      return;
    }

    void this.router.navigate(this.destination(membership));
  }

  private async loadMemberships(): Promise<void> {
    try {
      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        await this.router.navigate(['/login']);
        return;
      }

      const profile = await this.authService.getCurrentUser(accessToken);
      const memberships = profile.memberships.filter(
        (membership) => membership.status === 'ACTIVE',
      );
      if (memberships.length === 0) {
        await this.router.navigate(['/login']);
        return;
      }
      this.memberships.set(memberships);

      if (memberships.length === 1 && canManageMembers(memberships[0].roles)) {
        await this.router.navigate(this.destination(memberships[0]));
      }
    } catch {
      this.toast.error('Não foi possível carregar suas igrejas. Tente novamente.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private destination(membership: TenantMembership): string[] {
    return membership.roles.includes('TENANT_ADMIN')
      ? ['/tenant', membership.slug]
      : ['/tenant', membership.slug, 'members'];
  }
}
