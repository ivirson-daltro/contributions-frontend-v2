import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContributionsService } from './contributions.service';

describe('ContributionsService', () => {
  let service: ContributionsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContributionsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContributionsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends filters and tenant authentication to the list endpoint', async () => {
    const result = service.list('token', 'tenant', {
      q: 'Ana',
      from: '2026-11-01',
      to: '2026-11-30',
      status: 'ALL',
      page: 2,
      pageSize: 20,
    });
    const request = http.expectOne((req) => req.url.endsWith('/contributions'));
    expect(request.request.params.get('q')).toBe('Ana');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('status')).toBe('ALL');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant');
    const response = {
      data: [],
      meta: { page: 2, pageSize: 20, total: 25, totals: { amount: '123.00', count: 25 } },
    };
    request.flush(response);
    await expect(result).resolves.toEqual(response);
  });

  it('loads all pages of catalog options', async () => {
    const result = service.listTypes('token', 'tenant');
    const first = http.expectOne(
      (req) => req.url.endsWith('/catalogs/contribution-types') && req.params.get('page') === '1',
    );
    const option = { id: '1', description: 'Dízimo', category: 'TITHE', requiresMember: true };
    first.flush({ data: Array(100).fill(option), meta: { page: 1, pageSize: 100, total: 101 } });
    await Promise.resolve();
    const second = http.expectOne(
      (req) => req.url.endsWith('/catalogs/contribution-types') && req.params.get('page') === '2',
    );
    second.flush({ data: [{ ...option, id: '2' }], meta: { page: 2, pageSize: 100, total: 101 } });
    expect(await result).toHaveLength(101);
  });

  it('requests a PDF report using only the required period and tenant credentials', async () => {
    const result = service.report('token', 'tenant', { from: '2024-01-01', to: '2024-12-31' });
    const request = http.expectOne((req) => req.url.endsWith('/contributions/report'));
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.params.keys().sort()).toEqual(['from', 'to']);
    expect(request.request.params.get('from')).toBe('2024-01-01');
    expect(request.request.params.get('to')).toBe('2024-12-31');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant');
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    request.flush(pdf);
    await expect(result).resolves.toBe(pdf);
  });

  it('sends the idempotency key with the creation request', async () => {
    const payload = {
      contributionTypeId: 'type',
      paymentMethodId: 'method',
      memberId: null,
      amount: '10.50',
      occurredOn: '2026-11-20',
      observation: null,
      attachmentIds: [] as [],
    };
    const result = service.create('token', 'tenant', payload, 'request-key');
    const request = http.expectOne((req) => req.url.endsWith('/contributions'));
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('request-key');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant');
    expect(request.request.body).toEqual(payload);
    request.flush({ id: 'created' });
    await expect(result).resolves.toEqual({ id: 'created' });
  });

  it('sends the version and editable fields in an authenticated PUT request', async () => {
    const payload = { version: 3, amount: '20.00', memberId: null };
    const result = service.update('token', 'tenant', 'contribution-id', payload);
    const request = http.expectOne((req) => req.url.endsWith('/contributions/contribution-id'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant');
    expect(request.request.body).toEqual(payload);
    request.flush({ id: 'contribution-id', version: 4 });
    await expect(result).resolves.toMatchObject({ version: 4 });
  });

  it('sends the version and reason in the DELETE body', async () => {
    const payload = { version: 3, voidReason: 'Lançamento duplicado' };
    const result = service.void('token', 'tenant', 'contribution-id', payload);
    const request = http.expectOne((req) => req.url.endsWith('/contributions/contribution-id'));
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant');
    expect(request.request.body).toEqual(payload);
    request.flush({ id: 'contribution-id', status: 'VOIDED', voidReason: payload.voidReason });
    await expect(result).resolves.toMatchObject({ status: 'VOIDED' });
  });
});
