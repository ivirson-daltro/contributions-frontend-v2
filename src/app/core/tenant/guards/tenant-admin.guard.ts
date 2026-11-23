import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { TenantContextService } from '../services/tenant-context.service';

export const tenantAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const context = inject(TenantContextService);
  const router = inject(Router);
  const slug = route.paramMap.get('slug');
  const validationRequest = context.beginValidation();

  if (!slug) {
    context.status.set('denied');
    return true;
  }

  void (async () => {
    try {
      const accessToken = await authService.getAccessToken();
      if (!accessToken) {
        await router.navigate(['/login']);
        return;
      }

      const profile = await authService.getCurrentUser(accessToken);
      if (!context.isCurrentValidation(validationRequest)) return;

      const membership = profile.memberships.find(
        (item) => item.slug === slug && item.status === 'ACTIVE',
      );

      if (!membership || !membership.roles.includes('TENANT_ADMIN')) {
        context.current.set(null);
        context.displayName.set('');
        context.status.set('denied');
        return;
      }

      context.current.set({ accessToken, membership });
      context.displayName.set(profile.user.displayName || profile.user.email || 'Administrador');
      context.status.set('ready');
    } catch {
      if (!context.isCurrentValidation(validationRequest)) return;
      context.current.set(null);
      context.displayName.set('');
      context.status.set('error');
    }
  })();

  return true;
};
