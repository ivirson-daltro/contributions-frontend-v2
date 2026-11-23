import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../../../core/tenant/services/tenant-context.service';
import { DashboardSeriesResponse } from '../../dtos/dashboard-series-response.dto';
import { DashboardSummaryResponse } from '../../dtos/dashboard-summary-response.dto';
import { TenantDashboardService } from '../../services/tenant-dashboard.service';
import { ToastService } from '../../../../core/ui/toast.service';

type DashboardView = 'loading' | 'ready' | 'error';
type ChartMetric = 'overview' | 'income' | 'expense';

@Component({
  imports: [RouterLink],
  selector: 'app-tenant-dashboard',
  templateUrl: './tenant-dashboard.component.html',
})
export class TenantDashboardComponent {
  private readonly dashboardService = inject(TenantDashboardService);
  private readonly context = inject(TenantContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  protected readonly view = signal<DashboardView>('loading');
  protected readonly feedback = signal('');
  protected readonly summary = signal<DashboardSummaryResponse | null>(null);
  protected readonly series = signal<DashboardSeriesResponse | null>(null);
  protected readonly lastUpdated = signal<number | null>(null);
  protected readonly membership = computed(() => this.context.current()?.membership ?? null);
  protected readonly chartMetric = signal<ChartMetric>('overview');
  protected readonly payableItems = computed(() => {
    const payables = this.summary()?.payables;
    if (!payables || !Array.isArray(payables.overdue) || !Array.isArray(payables.next7Days)) {
      return null;
    }

    return [
      ...payables.overdue.map((item) => ({ ...item, overdue: true })),
      ...payables.next7Days.map((item) => ({ ...item, overdue: false })),
    ];
  });
  protected readonly chartComparison = computed(() => {
    const series = this.series();
    if (!series) return null;

    const metric = this.chartMetric();
    if (metric === 'overview') {
      return {
        first: { label: `Entradas · ${series.year}`, amounts: series.income.current },
        second: { label: `Saídas · ${series.year}`, amounts: series.expense.current },
      };
    }

    const selectedSeries = metric === 'income' ? series.income : series.expense;
    const label = metric === 'income' ? 'Entradas' : 'Saídas';
    return {
      first: { label: `${label} · ${series.year}`, amounts: selectedSeries.current },
      second: { label: `${label} · ${series.year - 1}`, amounts: selectedSeries.previous },
    };
  });
  protected readonly chartMaxAmount = computed(() => {
    const comparison = this.chartComparison();
    if (!comparison) return 0;
    return Math.max(
      0,
      ...comparison.first.amounts.map(Number),
      ...comparison.second.amounts.map(Number),
    );
  });
  protected readonly chartBars = computed(() => {
    const series = this.series();
    const comparison = this.chartComparison();
    if (!series || !comparison) return [];

    const first = comparison.first.amounts.map(Number);
    const second = comparison.second.amounts.map(Number);
    const maxAmount = this.chartMaxAmount();

    return first.map((firstAmount, index) => {
      const secondAmount = second[index];
      return {
        month: this.monthLabel(series.year, index),
        firstAmount,
        secondAmount,
        firstHeight:
          maxAmount === 0 || firstAmount === 0 ? 0 : Math.max(4, (firstAmount / maxAmount) * 100),
        secondHeight:
          maxAmount === 0 || secondAmount === 0 ? 0 : Math.max(4, (secondAmount / maxAmount) * 100),
      };
    });
  });
  protected readonly chartScaleLabels = computed(() => {
    const maxAmount = this.chartMaxAmount();
    return [maxAmount, maxAmount * (2 / 3), maxAmount / 3, 0];
  });

  protected accessToken = '';
  protected tenantSlug = '';
  private tenantId = '';
  private request = 0;

  constructor() {
    effect(() => {
      const tenant = this.context.current();
      this.request++;
      this.summary.set(null);
      this.series.set(null);
      this.lastUpdated.set(null);
      this.accessToken = tenant?.accessToken ?? '';
      this.tenantId = tenant?.membership.tenantId ?? '';
      this.tenantSlug = tenant?.membership.slug ?? '';
      if (tenant) void this.loadDashboard();
    });
  }

  protected async loadDashboard(): Promise<void> {
    if (!this.accessToken || !this.tenantId) return;

    const request = ++this.request;
    this.view.set('loading');
    this.feedback.set('');
    try {
      const [summary, series] = await Promise.all([
        this.dashboardService.getSummary(this.accessToken, this.tenantId),
        this.dashboardService.getSeries(this.accessToken, this.tenantId),
      ]);
      if (request !== this.request || this.destroyRef.destroyed) return;
      this.summary.set(summary);
      this.series.set(series);
      this.lastUpdated.set(Date.now());
      this.view.set('ready');
    } catch {
      if (request !== this.request || this.destroyRef.destroyed) return;
      this.view.set('error');
      this.feedback.set('Não foi possível carregar os dados do painel. Tente novamente.');
      this.toast.error(this.feedback());
    }
  }

  protected formatCurrency(amount: string): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(amount));
  }

  protected formatNullableCurrency(amount: string | null): string {
    return amount === null ? 'Não informado' : this.formatCurrency(amount);
  }

  protected formatAxisCurrency(amount: number): string {
    if (amount === 0) return '0';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  protected formatLastUpdated(timestamp: number): string {
    const updatedAt = new Date(timestamp);
    const date =
      updatedAt.toDateString() === new Date(Date.now()).toDateString()
        ? 'hoje'
        : `em ${new Intl.DateTimeFormat('pt-BR').format(updatedAt)}`;
    const time = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(updatedAt);
    return `Atualizado ${date}, às ${time}`;
  }

  protected formatMonth(period: DashboardSummaryResponse['period']): string {
    const month = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(period.year, period.month - 1, 1)));
    return `${month.charAt(0).toLocaleUpperCase('pt-BR')}${month.slice(1)} de ${period.year}`;
  }

  protected setChartMetric(metric: ChartMetric): void {
    this.chartMetric.set(metric);
  }

  protected formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
  }

  private monthLabel(year: number, month: number): string {
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'short',
      timeZone: 'UTC',
    })
      .format(new Date(Date.UTC(year, month, 1)))
      .replace('.', '');
  }
}
