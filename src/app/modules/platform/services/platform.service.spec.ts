import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PlatformService } from './platform.service';

describe('PlatformService', () => {
  let service: PlatformService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PlatformService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlatformService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should list churches using the authenticated platform endpoint', async () => {
    const result = service.listTenants('session-token');
    const request = http.expectOne('http://localhost:3000/v1/platform/tenants');

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    request.flush({ items: [], meta: { count: 0 } });

    await expect(result).resolves.toEqual({ items: [], meta: { count: 0 } });
  });

  it('should send the backend create-tenant contract', async () => {
    const payload = {
      name: 'Igreja Central',
      slug: 'igreja-central',
      document: null,
      timezone: 'America/Sao_Paulo',
      adminName: 'Ana Martins',
      adminEmail: 'ana@example.com',
    };
    const result = service.createTenant('session-token', payload);
    const request = http.expectOne('http://localhost:3000/v1/platform/tenants');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    request.flush({
      tenant: {
        id: 'tenant-id',
        slug: payload.slug,
        name: payload.name,
        status: 'TRIAL',
        timezone: payload.timezone,
      },
      invite: {
        token: 'one-time-token',
        expiresAt: '2026-11-20T00:00:00.000Z',
        email: payload.adminEmail,
        roles: ['TENANT_ADMIN'],
      },
    });

    await expect(result).resolves.toMatchObject({
      invite: { token: 'one-time-token', email: 'ana@example.com' },
    });
  });

  it('should reissue a TENANT_ADMIN invitation for a church', async () => {
    const result = service.issueAdminInvitation('session-token', 'tenant-id', {
      name: 'Ana Martins',
      email: 'ana@example.com',
    });
    const request = http.expectOne(
      'http://localhost:3000/v1/platform/tenants/tenant-id/admin-invitations',
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Ana Martins',
      email: 'ana@example.com',
    });
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    request.flush({
      tenantId: 'tenant-id',
      invitation: {
        id: 'invitation-id',
        token: 'replacement-token',
        expiresAt: '2026-11-20T00:00:00.000Z',
        email: 'ana@example.com',
        roles: ['TENANT_ADMIN'],
      },
    });

    await expect(result).resolves.toMatchObject({
      invitation: { token: 'replacement-token', email: 'ana@example.com' },
    });
  });
});
