import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { PlatformComponent } from './platform.component';
import { PlatformService } from '../../services/platform.service';

describe('PlatformComponent', () => {
  const authService = {
    getAccessToken: vi.fn(),
    getVerifiedTotpFactors: vi.fn(),
    enrollTotp: vi.fn(),
    verifyTotp: vi.fn(),
    signOut: vi.fn(),
  };
  const platformService = {
    listTenants: vi.fn(),
    createTenant: vi.fn(),
    issueAdminInvitation: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    authService.getAccessToken.mockResolvedValue('access-token');
    platformService.listTenants.mockResolvedValue({
      items: [],
      meta: { count: 0 },
    });

    await TestBed.configureTestingModule({
      imports: [PlatformComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: PlatformService, useValue: platformService },
      ],
    }).compileComponents();
  });

  it('should render a platform tenant list', async () => {
    platformService.listTenants.mockResolvedValue({
      items: [
        {
          id: 'tenant-1',
          slug: 'igreja-central',
          name: 'Igreja Central',
          status: 'TRIAL',
          timezone: 'America/Sao_Paulo',
          trialEndsAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: { activeUsers: 2, activeMembers: 30, storageBytes: 1024 },
          hasActiveTenantAdmin: true,
          pendingAdminInvitationExpiresAt: null,
        },
      ],
      meta: { count: 1 },
    });

    const fixture = TestBed.createComponent(PlatformComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(platformService.listTenants).toHaveBeenCalled());
    await vi.waitFor(() => expect(fixture.nativeElement.textContent).toContain('Igreja Central'));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Igreja Central');
    expect(element.textContent).toContain('igreja-central');
    expect(element.textContent).toContain('Ativo');
  });

  it('should deny platform access when the API rejects the account', async () => {
    platformService.listTenants.mockRejectedValue(
      new HttpErrorResponse({ status: 403, error: { code: 'FORBIDDEN' } }),
    );

    const fixture = TestBed.createComponent(PlatformComponent);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain(
        'Sua conta não tem permissão para administrar a plataforma.',
      ),
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Sua conta não tem permissão para administrar a plataforma.',
    );
  });

  it('should show the one-time invitation link after creating a church', async () => {
    platformService.createTenant.mockResolvedValue({
      tenant: {
        id: 'tenant-2',
        slug: 'nova-igreja',
        name: 'Nova Igreja',
        status: 'TRIAL',
        timezone: 'America/Sao_Paulo',
      },
      invite: {
        token: 'single-use-token',
        expiresAt: '2026-11-20T00:00:00.000Z',
        email: 'admin@example.com',
        roles: ['TENANT_ADMIN'],
      },
    });

    const fixture = TestBed.createComponent(PlatformComponent);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Igrejas cadastradas'),
    );
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.platform-toolbar .platform-primary-button')!.click();
    fixture.detectChanges();

    const values: Record<string, string> = {
      'church-name': 'Nova Igreja',
      'church-slug': 'nova-igreja',
      'admin-name': 'Ana Administradora',
      'admin-email': 'admin@example.com',
    };
    for (const [id, value] of Object.entries(values)) {
      const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();

    element
      .querySelector<HTMLFormElement>('.create-tenant-panel form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(platformService.createTenant).toHaveBeenCalled());
    await vi.waitFor(() => expect(element.textContent).toContain('Nova Igreja'));
    fixture.detectChanges();

    expect(platformService.createTenant).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({
        slug: 'nova-igreja',
        adminEmail: 'admin@example.com',
      }),
    );
    expect(element.textContent).toContain('token não poderá ser recuperado');
    expect(
      element.querySelector<HTMLInputElement>('[aria-label="Link de convite"]')?.value,
    ).toContain('single-use-token');
  });

  it('should issue a new one-time link for a church without an active admin', async () => {
    platformService.listTenants.mockResolvedValue({
      items: [
        {
          id: 'tenant-pending',
          slug: 'igreja-pendente',
          name: 'Igreja Pendente',
          status: 'TRIAL',
          timezone: 'America/Sao_Paulo',
          trialEndsAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          metrics: { activeUsers: 0, activeMembers: 0, storageBytes: 0 },
          hasActiveTenantAdmin: false,
          pendingAdminInvitationExpiresAt: '2026-11-20T00:00:00.000Z',
        },
      ],
      meta: { count: 1 },
    });
    platformService.issueAdminInvitation.mockResolvedValue({
      tenantId: 'tenant-pending',
      invitation: {
        id: 'invitation-id',
        token: 'replacement-token',
        expiresAt: '2026-11-20T00:00:00.000Z',
        email: 'admin@example.com',
        roles: ['TENANT_ADMIN'],
      },
    });

    const fixture = TestBed.createComponent(PlatformComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.nativeElement.textContent).toContain('Igreja Pendente'));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.tenant-action-button')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('O link anterior será revogado');

    const name = element.querySelector<HTMLInputElement>('#reissue-name')!;
    name.value = 'Ana Administradora';
    name.dispatchEvent(new Event('input'));
    const email = element.querySelector<HTMLInputElement>('#reissue-email')!;
    email.value = 'admin@example.com';
    email.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    element
      .querySelector<HTMLFormElement>('.reissue-panel form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(platformService.issueAdminInvitation).toHaveBeenCalledWith(
        'access-token',
        'tenant-pending',
        { name: 'Ana Administradora', email: 'admin@example.com' },
      ),
    );
    await vi.waitFor(() =>
      expect(
        element.querySelector<HTMLInputElement>('[aria-label="Link de convite"]')?.value,
      ).toContain('replacement-token'),
    );
    expect(element.textContent).toContain('Convite para Igreja Pendente');
    expect(element.textContent).toContain('admin@example.com');
  });
});
