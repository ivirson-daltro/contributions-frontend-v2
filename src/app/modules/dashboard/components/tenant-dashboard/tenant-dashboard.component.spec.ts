import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { TenantContextService } from '../../../../core/tenant/services/tenant-context.service';
import { TenantDashboardComponent } from './tenant-dashboard.component';
import { DashboardSeriesResponse } from '../../dtos/dashboard-series-response.dto';
import { DashboardSummaryResponse } from '../../dtos/dashboard-summary-response.dto';
import { TenantDashboardService } from '../../services/tenant-dashboard.service';
import { ToastService } from '../../../../core/ui/toast.service';

describe('TenantDashboardComponent', () => {
  async function waitForSummary(fixture: ComponentFixture<TenantDashboardComponent>) {
    await vi.waitFor(() => expect(fixture.componentInstance['summary']()).not.toBeNull());
    fixture.detectChanges();
  }

  const dashboardService = {
    getSummary: vi.fn(),
    getSeries: vi.fn(),
  };
  const summary: DashboardSummaryResponse = {
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
      month: '325.50',
      weekCount: 0,
      previousWeekCount: 0,
      monthCount: 8,
    },
    expense: {
      week: '0.00',
      month: '120.00',
      year: '120.00',
      weekCount: 0,
      monthCount: 2,
      yearCount: 2,
    },
    balance: {
      month: '205.50',
      opening: null,
      openingDefined: false,
      cashOnHand: null,
      final: null,
      accumulated: null,
    },
    byKind: { week: {}, previousWeek: {}, month: {} },
    members: { active: 248, contributorsMonth: 86 },
    constructionOffering: { total: '2150.00', count: 12 },
    payables: {
      overdueCount: 1,
      next7DaysCount: 1,
      next7DaysAmount: '450.00',
      overdue: [
        {
          id: 'overdue-1',
          payableId: 'payable-1',
          description: 'Energia elétrica',
          dueDate: '2026-11-10',
          expectedAmount: '1240.00',
        },
      ],
      next7Days: [
        {
          id: 'upcoming-1',
          payableId: 'payable-2',
          description: 'Internet',
          dueDate: '2026-11-20',
          expectedAmount: '450.00',
        },
      ],
    },
  };
  const series: DashboardSeriesResponse = {
    year: 2026,
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

  beforeEach(async () => {
    dashboardService.getSummary.mockReset().mockResolvedValue(summary);
    dashboardService.getSeries.mockReset().mockResolvedValue(series);

    await TestBed.configureTestingModule({
      imports: [TenantDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: TenantContextService, useValue: {
          current: signal({
            accessToken: 'access-token',
            membership: {
              tenantId: 'tenant-id', slug: 'igreja-central', name: 'Igreja Central',
              status: 'ACTIVE', roles: ['TENANT_ADMIN'],
            },
          }),
        } },
        { provide: TenantDashboardService, useValue: dashboardService },
      ],
    }).compileComponents();
  });

  it('should load summary and series for the selected tenant admin', async () => {
    const fixture = TestBed.createComponent(TenantDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(dashboardService.getSummary).toHaveBeenCalledWith('access-token', 'tenant-id');
      expect(dashboardService.getSeries).toHaveBeenCalledWith('access-token', 'tenant-id');
    });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('248');
    expect(text).toContain('Igreja Central');
    expect(text).toContain('R$ 325,50');
    expect(text).toContain('Não informado');
    expect(text).toContain('2');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.overview-card')).toHaveLength(4);
    expect(text).toContain('Evolução financeira');
    expect(text).toContain('O que você precisa fazer?');
  });

  it('shows decorative icons on the dashboard actions while keeping fee calculation disabled', async () => {
    const fixture = TestBed.createComponent(TenantDashboardComponent);
    fixture.detectChanges();
    await waitForSummary(fixture);

    const buttons = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.dashboard-status-actions button');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[0].textContent).toContain('Calcular taxas');
    expect(buttons[0].querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(buttons[0].querySelector('use')?.getAttribute('href')).toBe('icons/calculator.svg#calculator');
    expect(buttons[1].disabled).toBe(false);
    expect(buttons[1].textContent).toContain('Atualizar');
    expect(buttons[1].querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(buttons[1].querySelector('use')?.getAttribute('href')).toBe('icons/refresh.svg#refresh');
  });

  it('should show the last successful refresh time and retain it after a failed refresh', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 10, 20, 9, 41).getTime());
    try {
      const fixture = TestBed.createComponent(TenantDashboardComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      await waitForSummary(fixture);

      const row = (fixture.nativeElement as HTMLElement).querySelector('.dashboard-status-row')!;
      expect(row.textContent).toContain('Atualizado hoje, às 09:41');

      now.mockReturnValue(new Date(2026, 10, 20, 10, 15).getTime());
      dashboardService.getSummary.mockRejectedValueOnce(new Error('Unavailable'));
      row.querySelectorAll<HTMLButtonElement>('button')[1].click();
      await vi.waitFor(() => expect(fixture.componentInstance['view']()).toBe('error'));
      fixture.detectChanges();
      expect(row.textContent).toContain('Atualizado hoje, às 09:41');

      row.querySelectorAll<HTMLButtonElement>('button')[1].click();
      await vi.waitFor(() => expect(fixture.componentInstance['view']()).toBe('ready'));
      fixture.detectChanges();
      expect(row.textContent).toContain('Atualizado hoje, às 10:15');

      now.mockReturnValue(new Date(2026, 10, 21, 8, 0).getTime());
      expect(fixture.componentInstance['formatLastUpdated'](new Date(2026, 10, 20, 10, 15).getTime()))
        .toBe('Atualizado em 20/11/2026, às 10:15');
    } finally {
      now.mockRestore();
    }
  });

  it('should show overdue and upcoming payable details from the summary', async () => {
    const fixture = TestBed.createComponent(TenantDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForSummary(fixture);

    const card = (fixture.nativeElement as HTMLElement).querySelector('.due-card')!;
    expect(card.textContent).toContain('1 em atraso');
    expect(card.textContent).toContain('1 a vencer em 7 dias');
    expect(card.textContent).toContain('Energia elétrica');
    expect(card.textContent).toContain('Venceu em 10/11/2026');
    expect(card.textContent).toContain('R$ 1.240,00');
    expect(card.textContent).toContain('Internet');
    expect(card.textContent).toContain('Vence em 20/11/2026');
    expect(card.textContent).toContain('R$ 450,00');
    expect(card.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
  });

  it('should distinguish unavailable payable details from an empty list', async () => {
    dashboardService.getSummary.mockResolvedValue({
      ...summary,
      payables: { ...summary.payables, overdue: null, next7Days: null },
    });
    const fixture = TestBed.createComponent(TenantDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForSummary(fixture);

    const card = (fixture.nativeElement as HTMLElement).querySelector('.due-card')!;
    expect(card.textContent).toContain('Os detalhes das contas não estão disponíveis para esta conta.');
    expect(card.querySelector('.due-list')).toBeNull();
  });

  it('should show an empty state when there are no payable occurrences', async () => {
    dashboardService.getSummary.mockResolvedValue({
      ...summary,
      payables: {
        overdueCount: 0,
        next7DaysCount: 0,
        next7DaysAmount: '0.00',
        overdue: [],
        next7Days: [],
      },
    });
    const fixture = TestBed.createComponent(TenantDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForSummary(fixture);

    const card = (fixture.nativeElement as HTMLElement).querySelector('.due-card')!;
    expect(card.textContent).toContain('Não há contas vencidas ou a vencer');
  });

  it('should identify a payable without a description or amount', async () => {
    dashboardService.getSummary.mockResolvedValue({
      ...summary,
      payables: {
        ...summary.payables,
        overdue: [{ ...summary.payables.overdue![0], description: null, expectedAmount: null }],
        next7Days: [],
      },
    });
    const fixture = TestBed.createComponent(TenantDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForSummary(fixture);

    const item = (fixture.nativeElement as HTMLElement).querySelector('.due-item')!;
    expect(item.textContent).toContain('Conta sem descrição');
    expect(item.textContent).toContain('Não informado');
  });

  it('shows current income and expenses by default and compares each metric with the previous year', async () => {
    dashboardService.getSeries.mockResolvedValue({
      ...series,
      income: {
        ...series.income,
        current: ['325.50', ...Array<string>(11).fill('0.00')],
        previous: ['80.00', ...Array<string>(11).fill('0.00')],
      },
      expense: {
        ...series.expense,
        current: ['120.00', ...Array<string>(11).fill('0.00')],
        previous: ['600.00', ...Array<string>(11).fill('0.00')],
      },
    });
    const fixture = TestBed.createComponent(TenantDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await waitForSummary(fixture);

    const element = fixture.nativeElement as HTMLElement;
    const bars = element.querySelectorAll<HTMLElement>('.chart-bar');
    const buttons = element.querySelectorAll<HTMLButtonElement>('.chart-tabs button');
    const legend = element.querySelector('.chart-legend')!;
    const chart = element.querySelector('.chart-card')!;
    expect(bars).toHaveLength(24);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(chart.classList.contains('chart-income-comparison')).toBe(false);
    expect(chart.classList.contains('chart-expense-comparison')).toBe(false);
    expect(legend.textContent).toContain('Entradas · 2026');
    expect(legend.textContent).toContain('Saídas · 2026');
    expect(bars[0].getAttribute('aria-label')).toContain('Entradas · 2026: R$ 325,50');
    expect(bars[0].querySelector('.chart-tooltip')?.textContent).toContain('R$ 325,50');
    expect(bars[1].getAttribute('aria-label')).toContain('Saídas · 2026: R$ 120,00');
    expect(bars[0].style.height).toBe('100%');
    expect(bars[2].style.height).toBe('0%');
    expect(element.querySelector('.chart-y-labels')?.textContent).toContain('R$ 325,5');

    buttons[1].click();
    fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(chart.classList.contains('chart-income-comparison')).toBe(true);
    expect(legend.textContent).toContain('Entradas · 2025');
    expect(bars[0].getAttribute('aria-label')).toContain('Entradas · 2026: R$ 325,50');
    expect(bars[1].getAttribute('aria-label')).toContain('Entradas · 2025: R$ 80,00');

    buttons[2].click();
    fixture.detectChanges();
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    expect(chart.classList.contains('chart-income-comparison')).toBe(false);
    expect(chart.classList.contains('chart-expense-comparison')).toBe(true);
    expect(legend.textContent).toContain('Saídas · 2025');
    expect(bars[0].getAttribute('aria-label')).toContain('Saídas · 2026: R$ 120,00');
    expect(bars[1].getAttribute('aria-label')).toContain('Saídas · 2025: R$ 600,00');
    expect(bars[1].style.height).toBe('100%');
    expect(element.querySelector('.chart-y-labels')?.textContent).toContain('R$ 600');

    buttons[0].click();
    fixture.detectChanges();
    expect(chart.classList.contains('chart-expense-comparison')).toBe(false);
    expect(bars[1].getAttribute('aria-label')).toContain('Saídas · 2026: R$ 120,00');
    expect(dashboardService.getSeries).toHaveBeenCalledTimes(1);
  });

  it('should show an explicit error if either dashboard endpoint fails', async () => {
    dashboardService.getSummary.mockRejectedValue(
      new HttpErrorResponse({ status: 404, error: { code: 'NOT_FOUND' } }),
    );
    const fixture = TestBed.createComponent(TenantDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(dashboardService.getSummary).toHaveBeenCalled());
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(TestBed.inject(ToastService).toasts().map((toast) => toast.message).join(' '))
      .toContain('Não foi possível carregar os dados do painel');
    expect(element.textContent).not.toContain('R$ 325,50');
  });
});
