import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DashboardSeriesResponse } from '../dtos/dashboard-series-response.dto';
import { DashboardSummaryResponse } from '../dtos/dashboard-summary-response.dto';
import { TenantDashboardService } from './tenant-dashboard.service';

describe('TenantDashboardService', () => {
  let service: TenantDashboardService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TenantDashboardService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TenantDashboardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should request dashboard summary for the selected tenant', async () => {
    const response: DashboardSummaryResponse = {
      period: {
        year: 2026,
        month: 11,
        today: '2026-11-19',
        weekStart: '2026-11-16',
        weekStartsOn: 1,
      },
      income: {
        week: '0.00',
        previousWeek: '0.00',
        month: '0.00',
        weekCount: 0,
        previousWeekCount: 0,
        monthCount: 0,
      },
      expense: {
        week: '0.00',
        month: '0.00',
        year: '0.00',
        weekCount: 0,
        monthCount: 0,
        yearCount: 0,
      },
      balance: {
        month: '0.00',
        opening: null,
        openingDefined: false,
        cashOnHand: null,
        final: null,
        accumulated: null,
      },
      byKind: { week: {}, previousWeek: {}, month: {} },
      members: { active: 0, contributorsMonth: 0 },
      constructionOffering: { total: '0.00', count: 0 },
      payables: {
        overdueCount: 0,
        next7DaysCount: 0,
        next7DaysAmount: '0.00',
        overdue: [],
        next7Days: [],
      },
    };
    const result = service.getSummary('session-token', 'tenant-id');
    const request = http.expectOne('http://localhost:3000/v1/dashboard/summary');

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant-id');
    request.flush(response);

    await expect(result).resolves.toEqual(response);
  });

  it('should request monthly series with the requested year and tenant context', async () => {
    const response: DashboardSeriesResponse = {
      year: 2025,
      income: {
        current: Array<string>(12).fill('0.00'),
        previous: Array<string>(12).fill('0.00'),
        byKind: {},
      },
      expense: {
        current: Array<string>(12).fill('0.00'),
        previous: Array<string>(12).fill('0.00'),
      },
    };
    const result = service.getSeries('session-token', 'tenant-id', 2025);
    const request = http.expectOne('http://localhost:3000/v1/dashboard/series?year=2025');

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    expect(request.request.headers.get('X-Tenant-Id')).toBe('tenant-id');
    request.flush(response);

    await expect(result).resolves.toEqual(response);
  });
});
