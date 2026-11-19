import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, TenantMembership } from '../auth/auth.service';

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
    if (!this.selectedTenantId()) return;
    this.feedback.set(
      'Igreja selecionada. A área de gestão da igreja será disponibilizada na próxima etapa.',
    );
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
    } catch {
      this.feedback.set('Não foi possível carregar suas igrejas. Tente novamente.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
