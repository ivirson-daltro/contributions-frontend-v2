import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  imports: [RouterLink, RouterOutlet],
  selector: 'app-auth-layout',
  templateUrl: './auth-layout.component.html',
})
export class AuthLayoutComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isInviteRoute = signal(this.isAcceptInviteUrl(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.isInviteRoute.set(this.isAcceptInviteUrl(this.router.url));
      });
  }

  private isAcceptInviteUrl(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return path === '/accept-invite' || path.startsWith('/accept-invite/');
  }
}
