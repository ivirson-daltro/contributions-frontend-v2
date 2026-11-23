import { Routes } from '@angular/router';
import { authenticatedGuard, mfaGuard } from './core/auth/guards/auth.guard';
import { tenantAdminGuard } from './core/tenant/guards/tenant-admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/auth-layout/auth-layout.component').then(
        (module) => module.AuthLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () =>
          import('./modules/auth/components/login/login.component').then(
            (module) => module.LoginComponent,
          ),
        title: 'Entrar | IBG Gestão',
      },
      {
        path: 'accept-invite',
        loadComponent: () =>
          import('./modules/memberships/components/accept-invite/accept-invite.component').then(
            (module) => module.AcceptInviteComponent,
          ),
        title: 'Aceitar convite | IBG Gestão',
      },
      {
        path: 'two-factor',
        loadComponent: () =>
          import('./modules/auth/components/two-factor/two-factor.component').then(
            (module) => module.TwoFactorComponent,
          ),
        title: 'Verificação de segurança | IBG Gestão',
      },
    ],
  },
  {
    path: 'platform',
    canActivate: [authenticatedGuard, mfaGuard],
    loadComponent: () =>
      import('./modules/platform/components/platform/platform.component').then(
        (module) => module.PlatformComponent,
      ),
    title: 'Igrejas | IBG Gestão',
  },
  {
    path: 'select-church',
    canActivate: [authenticatedGuard, mfaGuard],
    loadComponent: () =>
      import('./modules/memberships/components/select-church/select-church.component').then(
        (module) => module.SelectChurchComponent,
      ),
    title: 'Selecionar igreja | IBG Gestão',
  },
  {
    path: 'tenant/:slug',
    canActivate: [authenticatedGuard, mfaGuard, tenantAdminGuard],
    loadComponent: () =>
      import('./layout/tenant-layout/tenant-layout.component').then(
        (module) => module.TenantLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./modules/dashboard/components/tenant-dashboard/tenant-dashboard.component').then(
            (module) => module.TenantDashboardComponent,
          ),
        data: { breadcrumb: 'Visão geral' },
        title: 'Visão geral | IBG Gestão',
      },
      {
        path: 'contributions',
        loadComponent: () =>
          import('./modules/contributions/components/contributions-page/contributions-page.component').then(
            (module) => module.ContributionsPageComponent,
          ),
        data: { breadcrumb: 'Contribuições' },
        title: 'Contribuições | IBG Gestão',
      },
    ],
  },
];
