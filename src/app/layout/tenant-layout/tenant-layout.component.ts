import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
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

type TenantView = 'loading' | 'ready' | 'error' | 'denied';

@Component({
  selector: 'app-tenant-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  providers: [TenantContextService],
  templateUrl: './tenant-layout.component.html',
})
export class TenantLayoutComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly context = inject(TenantContextService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private request = 0;
  private readonly themePreferenceKey = 'ibg.dashboard.theme';

  protected readonly view = signal<TenantView>('loading');
  protected readonly feedback = signal('');
  protected readonly tenant = this.context.current;
  protected readonly displayName = signal('');
  protected readonly isDarkTheme = signal(false);
  protected readonly themeFeedback = signal('');
  protected tenantSlug = '';

  ngOnInit(): void {
    this.restoreThemePreference();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tenantSlug = params.get('slug') ?? '';
      void this.initialize();
    });
  }

  protected retryAccess(): void {
    void this.initialize();
  }

  protected toggleTheme(): void {
    const darkTheme = !this.isDarkTheme();
    this.isDarkTheme.set(darkTheme);
    this.themeFeedback.set('');
    try {
      window.localStorage.setItem(this.themePreferenceKey, darkTheme ? 'dark' : 'light');
    } catch {
      this.themeFeedback.set(
        'Tema aplicado nesta sessão, mas não foi possível salvar sua preferência.',
      );
    }
  }

  protected async signOut(): Promise<void> {
    try {
      await this.authService.signOut();
      await this.router.navigate(['/login']);
    } catch {
      this.feedback.set('Não foi possível encerrar a sessão. Tente novamente.');
    }
  }

  private async initialize(): Promise<void> {
    const request = ++this.request;
    const slug = this.tenantSlug;
    this.context.current.set(null);
    this.displayName.set('');
    this.feedback.set('');
    this.view.set('loading');

    if (!slug) {
      await this.router.navigate(['/select-church']);
      return;
    }

    try {
      const accessToken = await this.authService.getAccessToken();
      if (request !== this.request || this.destroyRef.destroyed) return;
      if (!accessToken) {
        await this.router.navigate(['/login']);
        return;
      }

      const profile = await this.authService.getCurrentUser(accessToken);
      if (request !== this.request || this.destroyRef.destroyed) return;
      const membership = profile.memberships.find(
        (item) => item.slug === slug && item.status === 'ACTIVE',
      );
      if (!membership || !membership.roles.includes('TENANT_ADMIN')) {
        this.view.set('denied');
        return;
      }
      this.context.current.set({ accessToken, membership });
      this.displayName.set(profile.user.displayName || profile.user.email || 'Administrador');
      this.view.set('ready');
    } catch {
      if (request !== this.request || this.destroyRef.destroyed) return;
      this.view.set('error');
      this.feedback.set('Não foi possível validar seu acesso ao painel. Tente novamente.');
    }
  }

  private restoreThemePreference(): void {
    try {
      this.isDarkTheme.set(window.localStorage.getItem(this.themePreferenceKey) === 'dark');
    } catch {
      this.themeFeedback.set(
        'Não foi possível carregar sua preferência de tema; o tema claro foi aplicado.',
      );
    }
  }
}
