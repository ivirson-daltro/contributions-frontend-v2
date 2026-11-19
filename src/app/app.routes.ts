import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./auth-layout/auth-layout.component').then((module) => module.AuthLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () =>
          import('./login/login.component').then((module) => module.LoginComponent),
        title: 'Entrar | IBG Gestão',
      },
      {
        path: 'accept-invite',
        loadComponent: () =>
          import('./invitation/accept-invite.component').then(
            (module) => module.AcceptInviteComponent,
          ),
        title: 'Aceitar convite | IBG Gestão',
      },
    ],
  },
  {
    path: 'platform',
    loadComponent: () =>
      import('./platform/platform.component').then((module) => module.PlatformComponent),
    title: 'Igrejas | IBG Gestão',
  },
  {
    path: 'select-church',
    loadComponent: () =>
      import('./select-church/select-church.component').then(
        (module) => module.SelectChurchComponent,
      ),
    title: 'Selecionar igreja | IBG Gestão',
  },
];
