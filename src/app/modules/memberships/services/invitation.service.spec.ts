import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  let service: InvitationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InvitationService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvitationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should fetch a public invitation preview', async () => {
    const preview = {
      tenant: { name: 'Igreja Central', slug: 'igreja-central' },
      email: 'admin@example.com',
      roles: ['TENANT_ADMIN'],
      status: 'PENDING',
      expiresAt: '2026-11-20T00:00:00.000Z',
      accountExists: false,
    };
    const result = service.getPreview('invite-token');
    const request = http.expectOne('http://localhost:3000/v1/public/invitations/invite-token');

    expect(request.request.method).toBe('GET');
    request.flush(preview);

    await expect(result).resolves.toEqual(preview);
  });

  it('should accept a new account without an authorization header', async () => {
    const result = service.accept('invite-token', {
      displayName: 'Ana Martins',
      password: 'securepass123',
    });
    const request = http.expectOne(
      'http://localhost:3000/v1/public/invitations/invite-token/accept',
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      displayName: 'Ana Martins',
      password: 'securepass123',
    });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ tenantId: 'tenant-id', membershipId: 'membership-id' });

    await expect(result).resolves.toEqual({
      tenantId: 'tenant-id',
      membershipId: 'membership-id',
    });
  });

  it('should accept an existing account with its bearer token', async () => {
    const result = service.accept('invite-token', {}, 'session-token');
    const request = http.expectOne(
      'http://localhost:3000/v1/public/invitations/invite-token/accept',
    );

    expect(request.request.body).toEqual({});
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    request.flush({ tenantId: 'tenant-id', membershipId: 'membership-id' });

    await expect(result).resolves.toEqual({
      tenantId: 'tenant-id',
      membershipId: 'membership-id',
    });
  });
});
