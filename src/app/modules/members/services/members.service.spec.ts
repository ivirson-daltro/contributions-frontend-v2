import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MembersService } from './members.service';
import { environment } from '../../../../environments/environment';

describe('MembersService', () => {
  let service: MembersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MembersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the tenant, credentials and list filters required by the API', async () => {
    const result = service.list('token', 'tenant', {
      q: 'Ana', memberTypeId: 'type', status: 'ACTIVE', page: 2, pageSize: 8, sort: 'name', order: 'asc',
    });
    const request = http.expectOne((req) => req.url === `${environment.apiUrl}/members`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant');
    expect(request.request.params.get('q')).toBe('Ana');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('8');
    expect(request.request.params.get('status')).toBe('ACTIVE');
    request.flush({ data: [], meta: { page: 2, pageSize: 8, total: 0 } });
    await expect(result).resolves.toMatchObject({ data: [], meta: { page: 2 } });
  });

  it('uses the catalog and CRUD routes, including explicit duplicate confirmation', async () => {
    const all = service.listAll('token', 'tenant');
    const allRequest = http.expectOne(`${environment.apiUrl}/members/all`);
    expect(allRequest.request.headers.get('X-Tenant-Id')).toBe('tenant');
    allRequest.flush([{ id: 'member', name: 'Ana', memberType: { id: 'type', description: 'Membro' } }]);
    await expect(all).resolves.toHaveLength(1);

    const types = service.listTypes('token', 'tenant');
    const catalog = http.expectOne(`${environment.apiUrl}/catalogs/member-types`);
    expect(catalog.request.headers.get('X-Tenant-Id')).toBe('tenant');
    catalog.flush([{ id: 'type', description: 'Membro' }]);
    await expect(types).resolves.toHaveLength(1);

    const create = service.create('token', 'tenant', { name: 'Ana', memberTypeId: 'type' }, true);
    const post = http.expectOne((req) => req.url === `${environment.apiUrl}/members`);
    expect(post.request.method).toBe('POST');
    expect(post.request.params.get('force')).toBe('true');
    expect(post.request.body).toEqual({ name: 'Ana', memberTypeId: 'type' });
    post.flush({ id: 'member' });
    await create;

    const get = service.get('token', 'tenant', 'member');
    http.expectOne(`${environment.apiUrl}/members/member`).flush({ id: 'member' });
    await get;
    const update = service.update('token', 'tenant', 'member', { name: 'Novo' });
    const put = http.expectOne(`${environment.apiUrl}/members/member`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ name: 'Novo' });
    put.flush({ id: 'member' });
    await update;
    const remove = service.delete('token', 'tenant', 'member');
    const del = http.expectOne(`${environment.apiUrl}/members/member`);
    expect(del.request.method).toBe('DELETE');
    del.flush({ id: 'member' });
    await remove;
  });
});
