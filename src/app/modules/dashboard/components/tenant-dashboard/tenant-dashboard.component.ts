import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantContextService } from '../../../../core/tenant/services/tenant-context.service';
import { DashboardSeriesResponse } from '../../dtos/dashboard-series-response.dto';
import { DashboardSummaryResponse } from '../../dtos/dashboard-summary-response.dto';
import { TenantDashboardService } from '../../services/tenant-dashboard.service';

type DashboardView = 'loading' | 'ready' | 'error';
type ChartMetric = 'income' | 'expense';

@Component({
  imports: [RouterLink],
  selector: 'app-tenant-dashboard',
  templateUrl: './tenant-dashboard.component.html',
})
export class TenantDashboardComponent {
  private readonly dashboardService = inject(TenantDashboardService);
  private readonly context = inject(TenantContextService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly view = signal<DashboardView>('loading');
  protected readonly feedback = signal('');
  protected readonly summary = signal<DashboardSummaryResponse | null>(null);
  protected readonly series = signal<DashboardSeriesResponse | null>(null);
  protected readonly lastUpdated = signal<number | null>(null);
  protected readonly membership = computed(() => this.context.current()?.membership ?? null);
  protected readonly chartMetric = signal<ChartMetric>('income');
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
  protected readonly chartBars = computed(() => {
    const series = this.series();
    if (!series) return [];

    const selectedSeries = this.chartMetric() === 'income' ? series.income : series.expense;
    const current = selectedSeries.current.map(Number);
    const previous = selectedSeries.previous.map(Number);
    const maxAmount = Math.max(0, ...current, ...previous);

    return selectedSeries.current.map((_amount, index) => {
      const currentAmount = current[index];
      const previousAmount = previous[index];
      return {
        month: this.monthLabel(series.year, index),
        currentAmount,
        previousAmount,
        currentHeight: maxAmount === 0 ? 0 : Math.max(4, (currentAmount / maxAmount) * 100),
        previousHeight: maxAmount === 0 ? 0 : Math.max(4, (previousAmount / maxAmount) * 100),
      };
    });
  });
  protected readonly chartScaleLabels = computed(() => {
    const series = this.series();
    if (!series) return [0, 0, 0, 0];

    const selectedSeries = this.chartMetric() === 'income' ? series.income : series.expense;
    const maxAmount = Math.max(
      0,
      ...selectedSeries.current.map(Number),
      ...selectedSeries.previous.map(Number),
    );
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
