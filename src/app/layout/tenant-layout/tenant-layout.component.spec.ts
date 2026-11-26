import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/auth/services/auth.service';
import { ContributionsService } from '../../modules/contributions/services/contributions.service';
import { TenantDashboardService } from '../../modules/dashboard/services/tenant-dashboard.service';
import { MembersService } from '../../modules/members/services/members.service';
import { SettingsService } from '../../modules/settings/services/settings.service';
import { TenantContextService } from '../../core/tenant/services/tenant-context.service';

describe('Tenant routes', () => {
  const membership = {
    tenantId: 'tenant-id',
    slug: 'igreja-central',
    name: 'Igreja Central',
    status: 'ACTIVE',
    roles: ['TENANT_ADMIN'],
  };
  const auth = {
    getAccessToken: vi.fn(),
    getCurrentUser: vi.fn(),
    getTotpFactorStatus: vi.fn(),
    signOut: vi.fn(),
  };
  const dashboard = { getSummary: vi.fn(), getSeries: vi.fn() };
  const members = { list: vi.fn(), listTypes: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const settings = { getLogo: vi.fn() };
  const contributions = {
    list: vi.fn(),
    listTypes: vi.fn(),
    listMethods: vi.fn(),
    listAllMembers: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  };

  beforeEach(() => {
    window.localStorage.removeItem('ibg.dashboard.theme');
    auth.getAccessToken.mockReset().mockResolvedValue('token');
    auth.getCurrentUser.mockReset().mockResolvedValue({
      user: { id: 'user-id', displayName: 'Admin', email: 'admin@example.com' },
      memberships: [membership],
    });
    auth.getTotpFactorStatus.mockReset().mockResolvedValue({
      factors: [],
      currentLevel: 'aal2',
      nextLevel: 'aal2',
    });
    auth.signOut.mockReset().mockResolvedValue(undefined);
    dashboard.getSummary.mockReset().mockResolvedValue({
      period: { year: 2026, month: 11 },
      income: { month: '325.50', monthCount: 8 },
      expense: { month: '120.00', monthCount: 2 },
      balance: { month: '205.50', accumulated: null },
      members: { active: 248, contributorsMonth: 86 },
      constructionOffering: { total: '2150.00' },
      customCard: { contributionTypeId: null, contributionTypeName: null, total: null, contributionTypes: [] },
      payables: { overdueCount: 0, next7DaysCount: 0, overdue: [], next7Days: [] },
    });
    dashboard.getSeries.mockReset().mockResolvedValue({
      year: 2026,
      income: { current: Array(12).fill('0'), previous: Array(12).fill('0') },
      expense: { current: Array(12).fill('0'), previous: Array(12).fill('0') },
    });
    contributions.list.mockReset().mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totals: { amount: '0.00', count: 0 } },
    });
    contributions.listTypes
      .mockReset()
      .mockResolvedValue([
        { id: 'type', description: 'Dízimo', category: 'TITHE', requiresMember: true },
      ]);
    contributions.listMethods
      .mockReset()
      .mockResolvedValue([{ id: 'method', description: 'Pix', kind: 'PIX' }]);
    members.list.mockReset().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 8, total: 0 } });
    members.listTypes.mockReset().mockResolvedValue([{ id: 'type', description: 'Membro' }]);
    settings.getLogo.mockReset().mockRejectedValue(new HttpErrorResponse({ status: 404 }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        { provide: AuthService, useValue: auth },
        { provide: TenantDashboardService, useValue: dashboard },
        { provide: ContributionsService, useValue: contributions },
        { provide: MembersService, useValue: members },
        { provide: SettingsService, useValue: settings },
      ],
    });
  });

  it('keeps the layout while loading each page and opens the contribution shortcut', async () => {
    const showModal = vi.fn();
    const original = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = showModal;
    try {
      const harness = await RouterTestingHarness.create('/tenant/igreja-central');
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(harness.routeNativeElement?.querySelector('.overview-card')).not.toBeNull();
        expect(dashboard.getSummary).toHaveBeenCalledWith('token', 'tenant-id');
      });
      const layout = harness.routeNativeElement!.querySelector('.tenant-dashboard');
      expect(layout?.querySelector('.tenant-user-info')?.textContent).toContain('Admin');
      expect(layout?.querySelector('.tenant-user-info')?.textContent).toContain(
        'Administrador da igreja',
      );
      expect(layout?.querySelector('.navigation-item.active')?.textContent).toContain(
        'Visão geral',
      );
      expect(layout?.querySelector('.theme-toggle use')?.getAttribute('href')).toBe('icons/moon.svg#moon');
      window.localStorage.setItem('ibg.dashboard.theme', 'dark');
      layout?.querySelector<HTMLButtonElement>('.theme-toggle')?.click();
      harness.detectChanges();
      expect(layout?.classList.contains('dark-theme')).toBe(true);
      expect(layout?.querySelector('.theme-toggle use')?.getAttribute('href')).toBe('icons/sun.svg#sun');

      const shortcut = harness.routeNativeElement!.querySelector<HTMLAnchorElement>(
        '.primary-dashboard-action',
      )!;
      shortcut.click();
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(showModal).toHaveBeenCalled();
      });
      expect(TestBed.inject(Router).url).toBe('/tenant/igreja-central/contributions?new=1');
      expect(harness.routeNativeElement!.querySelector('.tenant-dashboard')).toBe(layout);
      expect(
        harness.routeNativeElement!.querySelector('.tenant-breadcrumb')?.textContent,
      ).toContain('Contribuições');
      expect(
        harness.routeNativeElement!.querySelector('.navigation-item.active')?.textContent,
      ).toContain('Contribuições');
      expect(contributions.list).toHaveBeenCalledWith(
        'token',
        'tenant-id',
        expect.objectContaining({ page: 1 }),
      );
      expect(auth.getCurrentUser).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem('ibg.dashboard.theme')).toBe('dark');
    } finally {
      HTMLDialogElement.prototype.showModal = original;
    }
  });

  it('opens contributions directly without fetching dashboard data and restores the theme', async () => {
    window.localStorage.setItem('ibg.dashboard.theme', 'dark');
    const harness = await RouterTestingHarness.create('/tenant/igreja-central/contributions');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(contributions.list).toHaveBeenCalled();
    });

    expect(dashboard.getSummary).not.toHaveBeenCalled();
    expect(
      harness.routeNativeElement?.querySelector('.tenant-dashboard.dark-theme'),
    ).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('.tenant-breadcrumb')?.textContent).toContain(
      'Contribuições',
    );
    const layout = harness.routeNativeElement?.querySelector('.tenant-dashboard');
    await harness.navigateByUrl('/tenant/igreja-central');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(dashboard.getSummary).toHaveBeenCalledWith('token', 'tenant-id');
    });
    expect(harness.routeNativeElement?.querySelector('.tenant-dashboard')).toBe(layout);
    expect(
      harness.routeNativeElement?.querySelector('.tenant-dashboard.dark-theme'),
    ).not.toBeNull();
    expect(auth.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('discards an old church logo and revokes the current blob URL on destruction', async () => {
    let resolveOld!: (value: Blob) => void;
    let resolveNew!: (value: Blob) => void;
    settings.getLogo.mockReset()
      .mockReturnValueOnce(new Promise<Blob>((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise<Blob>((resolve) => { resolveNew = resolve; }));
    const create = vi.fn().mockReturnValue('blob:logo');
    const revoke = vi.fn();
    const oldCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const oldRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    try {
      const harness = await RouterTestingHarness.create('/tenant/igreja-central');
      await vi.waitFor(() => expect(settings.getLogo).toHaveBeenCalledTimes(1));
      const context = TestBed.inject(TenantContextService);
      const current = context.current()!;
      context.current.set({ ...current, membership: { ...current.membership, tenantId: 'other-tenant' } });
      resolveOld(new Blob(['old']));
      await Promise.resolve();
      harness.detectChanges();
      await vi.waitFor(() => expect(settings.getLogo).toHaveBeenCalledTimes(2));
      expect(create).not.toHaveBeenCalled();
      resolveNew(new Blob(['new']));
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(harness.routeNativeElement?.querySelector('.tenant-brand img')?.getAttribute('src')).toBe('blob:logo');
      });
      expect(settings.getLogo).toHaveBeenCalledTimes(2);
      harness.fixture.destroy();
      expect(revoke).toHaveBeenCalledWith('blob:logo');
    } finally {
      if (oldCreate) Object.defineProperty(URL, 'createObjectURL', oldCreate);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (oldRevoke) Object.defineProperty(URL, 'revokeObjectURL', oldRevoke);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('loads the matching logo when changing theme and discards a late response', async () => {
    let resolveLight!: (value: Blob) => void;
    settings.getLogo.mockImplementation((_token, _tenant, theme) => theme === 'LIGHT'
      ? new Promise<Blob>((resolve) => { resolveLight = resolve; })
      : Promise.resolve(new Blob(['dark'])));
    const create = vi.fn().mockReturnValue('blob:dark');
    const oldCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const oldRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    try {
      const harness = await RouterTestingHarness.create('/tenant/igreja-central');
      await vi.waitFor(() => expect(resolveLight).toBeDefined());
      harness.routeNativeElement!.querySelector<HTMLButtonElement>('.theme-toggle')!.click();
      resolveLight(new Blob(['old-light']));
      await Promise.resolve();
      harness.detectChanges();
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(harness.routeNativeElement?.querySelector('.tenant-brand img')?.getAttribute('src')).toBe('blob:dark');
      });
      expect(settings.getLogo).toHaveBeenCalledWith('token', 'tenant-id', 'DARK');
      expect(create).toHaveBeenCalledTimes(1);
      harness.fixture.destroy();
    } finally {
      if (oldCreate) Object.defineProperty(URL, 'createObjectURL', oldCreate);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (oldRevoke) Object.defineProperty(URL, 'revokeObjectURL', oldRevoke);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('keeps the selected theme when signing out to the login page', async () => {
    const harness = await RouterTestingHarness.create('/tenant/igreja-central');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.querySelector('.tenant-user-info')).not.toBeNull();
    });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.theme-toggle')!.click();
    harness.detectChanges();
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
    const buttons = harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('.tenant-user > button');
    buttons[buttons.length - 1].click();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login'));
    expect(window.localStorage.getItem('ibg.dashboard.theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
  });

  it('does not instantiate a page for a non-admin membership', async () => {
    auth.getCurrentUser.mockResolvedValue({
      user: { displayName: 'Member' },
      memberships: [{ ...membership, roles: ['TREASURER'] }],
    });

    const harness = await RouterTestingHarness.create('/tenant/igreja-central/contributions');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain(
        'exclusiva para administradores ativos',
      );
    });
    expect(contributions.list).not.toHaveBeenCalled();
    expect(dashboard.getSummary).not.toHaveBeenCalled();
  });

    it.each(['TREASURER', 'SECRETARY', 'TENANT_ADMIN'])('opens members directly for %s', async (role) => {
      auth.getCurrentUser.mockResolvedValue({
        user: { id: 'user-id', displayName: 'User' },
        memberships: [{ ...membership, roles: [role] }],
      });
      const harness = await RouterTestingHarness.create('/tenant/igreja-central/members');
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(members.list).toHaveBeenCalledWith('token', 'tenant-id', expect.objectContaining({ page: 1 }));
      });
      expect(harness.routeNativeElement?.textContent).toContain('Nenhum membro encontrado');
      if (role !== 'TENANT_ADMIN') {
        expect(harness.routeNativeElement?.textContent).not.toContain('Contribuições');
      }
      expect(dashboard.getSummary).not.toHaveBeenCalled();
    });

    it('denies access to members for an unauthorized role', async () => {
      auth.getCurrentUser.mockResolvedValue({
        user: { id: 'user-id', displayName: 'User' },
        memberships: [{ ...membership, roles: ['FISCAL'] }],
      });
      const harness = await RouterTestingHarness.create('/tenant/igreja-central/members');
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(harness.routeNativeElement?.textContent).toContain('perfis autorizados');
      });
      expect(members.list).not.toHaveBeenCalled();
    });

    it('retries member access with the member-specific permissions', async () => {
      auth.getCurrentUser.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue({
        user: { id: 'user-id', displayName: 'Treasurer' },
        memberships: [{ ...membership, roles: ['TREASURER'] }],
      });
      const harness = await RouterTestingHarness.create('/tenant/igreja-central/members');
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(harness.routeNativeElement?.textContent).toContain('Não foi possível validar seu acesso');
      });
      harness.routeNativeElement!.querySelector<HTMLButtonElement>('.dashboard-state button')!.click();
      await vi.waitFor(() => {
        harness.detectChanges();
        expect(members.list).toHaveBeenCalledWith('token', 'tenant-id', expect.anything());
      });
    });

  it('redirects an unauthenticated visitor without loading a tenant page', async () => {
    auth.getAccessToken.mockResolvedValue(null);
    await RouterTestingHarness.create('/tenant/igreja-central/contributions');
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login'));
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
    expect(contributions.list).not.toHaveBeenCalled();
  });

  it('switches between the admin pages and members without losing access', async () => {
    const harness = await RouterTestingHarness.create('/tenant/igreja-central');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(dashboard.getSummary).toHaveBeenCalled();
    });
    await harness.navigateByUrl('/tenant/igreja-central/members');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(members.list).toHaveBeenCalledWith('token', 'tenant-id', expect.anything());
    });
    await harness.navigateByUrl('/tenant/igreja-central/contributions');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(contributions.list).toHaveBeenCalledWith('token', 'tenant-id', expect.anything());
    });
  });

  it('validates the new church before loading its members', async () => {
    auth.getCurrentUser.mockResolvedValue({
      user: { id: 'user-id', displayName: 'Secretary' },
      memberships: [
        { ...membership, roles: ['SECRETARY'] },
        { ...membership, tenantId: 'tenant-two', slug: 'outra-igreja', name: 'Outra Igreja', roles: ['SECRETARY'] },
      ],
    });
    const harness = await RouterTestingHarness.create('/tenant/igreja-central/members');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(members.list).toHaveBeenCalledWith('token', 'tenant-id', expect.anything());
    });
    await harness.navigateByUrl('/tenant/outra-igreja/members');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(members.list).toHaveBeenCalledWith('token', 'tenant-two', expect.anything());
    });
    expect(harness.routeNativeElement?.textContent).toContain('Outra Igreja');
  });

  it('ignores a retry response from a previously selected church', async () => {
    let resolveRetry!: (value: unknown) => void;
    const second = { ...membership, tenantId: 'tenant-two', slug: 'outra-igreja', name: 'Outra Igreja', roles: ['SECRETARY'] };
    auth.getCurrentUser
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRetry = resolve; }))
      .mockResolvedValue({ user: { id: 'user-id', displayName: 'Secretary' }, memberships: [second] });
    const harness = await RouterTestingHarness.create('/tenant/igreja-central/members');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain('Não foi possível validar seu acesso');
    });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.dashboard-state button')!.click();
    await vi.waitFor(() => expect(auth.getCurrentUser).toHaveBeenCalledTimes(2));
    await harness.navigateByUrl('/tenant/outra-igreja/members');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(members.list).toHaveBeenCalledWith('token', 'tenant-two', expect.anything());
    });
    resolveRetry({ user: { id: 'user-id', displayName: 'Secretary' }, memberships: [{ ...membership, roles: ['SECRETARY'] }] });
    await Promise.resolve();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Outra Igreja');
    expect(members.list).not.toHaveBeenCalledWith('token', 'tenant-id', expect.anything());
  });

  it('validates a different church before loading its contribution data', async () => {
    const second = {
      ...membership,
      tenantId: 'tenant-two',
      slug: 'outra-igreja',
      name: 'Outra Igreja',
    };
    auth.getCurrentUser.mockResolvedValue({
      user: { displayName: 'Admin' },
      memberships: [membership, second],
    });
    const harness = await RouterTestingHarness.create('/tenant/igreja-central/contributions');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(contributions.list).toHaveBeenCalledWith('token', 'tenant-id', expect.anything());
    });
    await harness.navigateByUrl('/tenant/outra-igreja/contributions');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(contributions.list).toHaveBeenCalledWith('token', 'tenant-two', expect.anything());
    });
    expect(harness.routeNativeElement?.textContent).toContain('Outra Igreja');
  });

  it('ignores a stale access check after navigating to another church', async () => {
    let resolveFirst!: (value: unknown) => void;
    auth.getCurrentUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const second = {
      ...membership,
      tenantId: 'tenant-two',
      slug: 'outra-igreja',
      name: 'Outra Igreja',
    };
    auth.getCurrentUser.mockResolvedValue({
      user: { displayName: 'Admin' },
      memberships: [second],
    });
    const harness = await RouterTestingHarness.create('/tenant/igreja-central/contributions');
    await vi.waitFor(() => expect(auth.getCurrentUser).toHaveBeenCalledTimes(1));
    harness.detectChanges();
    expect(contributions.list).not.toHaveBeenCalled();

    await harness.navigateByUrl('/tenant/outra-igreja/contributions');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(contributions.list).toHaveBeenCalledWith('token', 'tenant-two', expect.anything());
    });
    resolveFirst({ user: { displayName: 'Admin' }, memberships: [membership] });
    await Promise.resolve();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Outra Igreja');
    expect(contributions.list).not.toHaveBeenCalledWith('token', 'tenant-id', expect.anything());
  });

  it('shows access errors and retries without loading an unvalidated page', async () => {
    auth.getCurrentUser.mockRejectedValueOnce(new Error('Unavailable'));
    const harness = await RouterTestingHarness.create('/tenant/igreja-central/contributions');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain(
        'Não foi possível validar seu acesso',
      );
    });
    expect(contributions.list).not.toHaveBeenCalled();
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>('.dashboard-state button')!
      .click();
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(contributions.list).toHaveBeenCalledWith('token', 'tenant-id', expect.anything());
    });
  });
});
