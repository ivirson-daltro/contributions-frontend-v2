import { Component, DestroyRef, OnInit, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '../../core/auth/services/auth.service';
import { TenantContextService } from '../../core/tenant/services/tenant-context.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/ui/toast.service';
import { canManageMembers } from '../../core/tenant/tenant-access';

type TenantView = 'loading' | 'ready' | 'error' | 'denied';

@Component({
  selector: 'app-tenant-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './tenant-layout.component.html',
})
export class TenantLayoutComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly context = inject(TenantContextService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);

  protected readonly view = signal<TenantView>('loading');
  protected readonly feedback = signal('');
  protected readonly tenant = this.context.current;
  protected readonly displayName = this.context.displayName;
  protected readonly isDarkTheme = this.theme.isDarkTheme;
  protected tenantSlug = '';
  private readonly syncContextEffect = effect(() => {
    this.context.status();
    this.context.current();
    this.syncContext();
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tenantSlug = params.get('slug') ?? '';
      this.syncContext();
    });
  }

  protected async retryAccess(): Promise<void> {
    const validationRequest = this.context.beginValidation();
    const slug = this.tenantSlug;
    this.view.set('loading');
    this.feedback.set('');
    try {
      const accessToken = await this.authService.getAccessToken();
      if (!this.context.isCurrentValidation(validationRequest) || this.destroyRef.destroyed) return;
      if (!accessToken) {
        await this.router.navigate(['/login']);
        return;
      }
      const profile = await this.authService.getCurrentUser(accessToken);
      if (!this.context.isCurrentValidation(validationRequest) || this.destroyRef.destroyed) return;
      const membership = profile.memberships.find(
        (item) => item.slug === slug && item.status === 'ACTIVE',
      );
      const allowed = membership && (this.route.snapshot.data['memberAccess']
        ? canManageMembers(membership.roles)
        : membership.roles.includes('TENANT_ADMIN'));
      if (!membership || !allowed) {
        this.context.current.set(null);
        this.context.displayName.set('');
        this.context.status.set('denied');
        this.syncContext();
        return;
      }
      this.context.current.set({ accessToken, userId: profile.user.id, membership });
      this.context.displayName.set(profile.user.displayName || profile.user.email || 'Administrador');
      this.context.status.set('ready');
      this.syncContext();
    } catch {
      if (!this.context.isCurrentValidation(validationRequest) || this.destroyRef.destroyed) return;
      this.context.status.set('error');
      this.syncContext();
    }
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected async signOut(): Promise<void> {
    try {
      await this.authService.signOut();
      await this.router.navigate(['/login']);
    } catch {
      this.toast.error('Não foi possível encerrar a sessão. Tente novamente.');
    }
  }

  private syncContext(): void {
    const slug = this.tenantSlug;
    const tenant = this.context.current();
    if (this.context.status() === 'denied') {
      this.view.set('denied');
      this.feedback.set('');
      return;
    }
    if (this.context.status() === 'error') {
      this.view.set('error');
      this.feedback.set('Não foi possível validar seu acesso ao painel. Tente novamente.');
      return;
    }
    if (this.context.status() === 'loading') {
      this.view.set('loading');
      return;
    }
    if (!slug || !tenant || tenant.membership.slug !== slug) {
      this.view.set('error');
      this.feedback.set('Não foi possível validar o contexto da igreja.');
      return;
    }
    this.feedback.set('');
    this.view.set('ready');
  }
}
