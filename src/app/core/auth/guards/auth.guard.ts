import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authenticatedGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const accessToken = await authService.getAccessToken();
  return accessToken
    ? true
    : router.createUrlTree(['/login']);
};

export const mfaGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const accessToken = await authService.getAccessToken();
  if (!accessToken) {
    return router.createUrlTree(['/login']);
  }

  try {
    const status = await authService.getTotpFactorStatus();
    return status.currentLevel === 'aal2'
      ? true
      : router.createUrlTree(['/two-factor'], { queryParams: { returnUrl: state.url } });
  } catch {
    return router.createUrlTree(['/login']);
  }
};
