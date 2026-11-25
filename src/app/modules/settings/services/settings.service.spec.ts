import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { SettingsService } from './settings.service';

describe('SettingsService logo', () => {
  let service: SettingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the theme and fallback option when retrieving a private logo', async () => {
    const result = service.getLogo('token', 'tenant', 'DARK', false);
    const request = http.expectOne((req) => req.url === `${environment.apiUrl}/tenant/logo`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant');
    expect(request.request.params.get('theme')).toBe('DARK');
    expect(request.request.params.get('fallback')).toBe('false');
    const image = new Blob(['logo'], { type: 'image/png' });
    request.flush(image);
    await expect(result).resolves.toBe(image);
  });

  it('uploads the selected logo without replacing the other theme', async () => {
    const file = new File(['logo'], 'dark.png', { type: 'image/png' });
    const result = service.uploadLogo('token', 'tenant', file, 'DARK');
    const request = http.expectOne((req) => req.url === `${environment.apiUrl}/tenant/logo`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.params.get('theme')).toBe('DARK');
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush({ updated: true });
    await result;
  });
});
