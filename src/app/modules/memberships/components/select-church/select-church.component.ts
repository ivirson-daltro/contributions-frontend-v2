import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { TenantMembership } from '../../../../core/auth/dtos/tenant-membership.dto';

@Component({
  imports: [RouterLink],
  selector: 'app-select-church',
  templateUrl: './select-church.component.html',
})
export class SelectChurchComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

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

    if (!membership.roles.includes('TENANT_ADMIN')) {
      this.feedback.set('A área de gestão está disponível apenas para administradores da igreja.');
      return;
    }

    void this.router.navigate(['/tenant', membership.slug]);
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

      if (memberships.length === 1 && memberships[0].roles.includes('TENANT_ADMIN')) {
        await this.router.navigate(['/tenant', memberships[0].slug]);
      }
    } catch {
      this.feedback.set('Não foi possível carregar suas igrejas. Tente novamente.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
