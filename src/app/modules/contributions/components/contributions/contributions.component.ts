import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomConfirmComponent } from '../../../../shared/components/custom-confirm/custom-confirm.component';
import { MemberSelectComponent } from '../../../../shared/components/member-select/member-select.component';
import { MemberLookup } from '../../../../shared/dtos/member-lookup.dto';
import { ContributionFormComponent } from '../contribution-form/contribution-form.component';
import { Contribution } from '../../dtos/contribution.dto';
import { ContributionList } from '../../dtos/contribution-list.dto';
import { ContributionQuery } from '../../dtos/contribution-query.dto';
import { ContributionType } from '../../dtos/contribution-type.dto';
import { PaymentMethod } from '../../dtos/payment-method.dto';
import { ContributionsService } from '../../services/contributions.service';
import { isStaleContribution, mutationError } from '../../services/contribution-errors';
import { ToastService } from '../../../../core/ui/toast.service';
import { DataPaginationComponent } from '../../../../shared/components/data-pagination/data-pagination.component';

interface CalendarDay {
  date: string;
  day: number;
}

@Component({
  selector: 'app-contributions',
  imports: [ReactiveFormsModule, CustomConfirmComponent, ContributionFormComponent, MemberSelectComponent, DataPaginationComponent],
  templateUrl: './contributions.component.html',
})
export class ContributionsComponent implements OnInit {
  readonly accessToken = input.required<string>();
  readonly tenantId = input.required<string>();
  readonly openOnLoad = input(false);
  private readonly contributionForm = viewChild.required(ContributionFormComponent);
  private readonly memberFilter = viewChild.required<MemberSelectComponent>('memberFilter');
  @ViewChild(CustomConfirmComponent) private confirmDialog?: CustomConfirmComponent;

  private readonly service = inject(ContributionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private listRequest = 0;
  private membersRequest: Promise<MemberLookup[]> | null = null;
  protected readonly loadMembers = (): Promise<MemberLookup[]> => {
    if (!this.membersRequest) {
      this.membersRequest = this.service.listAllMembers(this.accessToken(), this.tenantId())
        .catch((error: unknown) => {
          this.membersRequest = null;
          throw error;
        });
    }
    return this.membersRequest;
  };
  protected readonly selectedFilterMember = signal<MemberLookup | null>(null);
  protected readonly pageSizes = [10, 20, 50, 100];
  protected appliedFilters: ContributionQuery = { page: 1, pageSize: 20, status: 'ACTIVE' };
  protected pendingPage = 1;

  protected readonly list = signal<ContributionList | null>(null);
  protected readonly listLoading = signal(false);
  protected readonly listError = signal('');
  protected readonly filterError = signal('');
  protected readonly reportError = signal('');
  protected readonly reportLoading = signal(false);
  protected readonly catalogError = signal('');
  protected readonly catalogLoading = signal(false);
  protected readonly types = signal<ContributionType[]>([]);
  protected readonly methods = signal<PaymentMethod[]>([]);
  protected readonly deleting = signal<Contribution | null>(null);
  protected readonly deletingBusy = signal(false);
  protected readonly deleteError = signal('');
  protected readonly stale = signal(false);
  protected readonly voidReason = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(2000),
  });
  protected readonly notice = signal('');
  protected readonly pages = computed(() => {
    const meta = this.list()?.meta;
    return meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  });
  protected readonly pageRange = computed(() => {
    const result = this.list();
    if (!result || !result.data.length) return { start: 0, end: 0 };
    const start = (result.meta.page - 1) * result.meta.pageSize + 1;
    return { start, end: Math.min(start + result.data.length - 1, result.meta.total) };
  });
  protected readonly calendarMonth = signal(this.firstOfMonth(new Date()));

  protected readonly filters = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    typeId: new FormControl('', { nonNullable: true }),
    methodId: new FormControl('', { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    void this.loadList(1);
    void this.loadCatalogs();
  }

  protected async loadList(page: number): Promise<void> {
    const request = ++this.listRequest;
    this.pendingPage = page;
    this.listLoading.set(true);
    this.listError.set('');
    this.list.set(null);
    try {
      const result = await this.service.list(this.accessToken(), this.tenantId(), {
        ...this.appliedFilters,
        page,
      });
      if (request === this.listRequest && !this.destroyRef.destroyed) this.list.set(result);
    } catch {
      if (request === this.listRequest && !this.destroyRef.destroyed) {
        this.listError.set('Não foi possível carregar as contribuições. Tente novamente.');
        this.toast.error(this.listError());
      }
    } finally {
      if (request === this.listRequest && !this.destroyRef.destroyed) this.listLoading.set(false);
    }
  }

  protected changePageSize(value: string): void {
    const pageSize = Number(value);
    if (!this.pageSizes.includes(pageSize)) {
      this.toast.warning('Selecione uma quantidade válida de contribuições por página.');
      return;
    }
    this.appliedFilters = { ...this.appliedFilters, page: 1, pageSize };
    void this.loadList(1);
  }

  protected applyFilters(dateRange: HTMLDetailsElement): void {
    const values = this.filters.getRawValue();
    if (values.from && values.to && values.from > values.to) {
      this.toast.warning('A data inicial deve ser anterior ou igual à data final.');
      dateRange.open = true;
      return;
    }
    dateRange.open = false;
    this.filterError.set('');
    const member = this.selectedFilterMember();
    this.appliedFilters = {
      ...(member ? { memberId: member.id } : { q: values.q.trim() }),
      typeId: values.typeId,
      methodId: values.methodId,
      from: values.from,
      to: values.to,
      status: 'ACTIVE',
      page: 1,
      pageSize: this.appliedFilters.pageSize,
    };
    void this.loadList(1);
  }

  protected clearFilters(dateRange: HTMLDetailsElement): void {
    this.memberFilter().clear();
    this.filters.reset();
    this.reportError.set('');
    this.applyFilters(dateRange);
  }

  protected async generateReport(dateRange: HTMLDetailsElement): Promise<void> {
    if (this.reportLoading()) return;
    this.reportError.set('');
    const { from: start, to: end } = this.filters.getRawValue();
    const startTime = Date.parse(`${start}T00:00:00Z`);
    const endTime = Date.parse(`${end}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      new Date(startTime).toISOString().slice(0, 10) !== start ||
      new Date(endTime).toISOString().slice(0, 10) !== end
    ) {
      this.toast.warning('Selecione as datas inicial e final para gerar o relatório.');
      dateRange.open = true;
      return;
    }
    if (startTime > endTime) {
      this.toast.warning('A data inicial deve ser anterior ou igual à data final.');
      dateRange.open = true;
      return;
    }
    if (endTime - startTime > 365 * 86_400_000) {
      this.toast.warning('O período do relatório não pode ultrapassar 366 dias.');
      dateRange.open = true;
      return;
    }

    this.reportLoading.set(true);
    try {
      const pdf = await this.service.report(this.accessToken(), this.tenantId(), {
        from: start,
        to: end,
      });
      if (this.destroyRef.destroyed) return;
      if (!pdf.size || !pdf.type.toLowerCase().startsWith('application/pdf')) {
        throw new Error('Resposta do relatório não é um PDF válido.');
      }
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      try {
        link.href = url;
        link.download = `contribuicoes-${start}-a-${end}.pdf`;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      if (error instanceof HttpErrorResponse && error.status === 403) {
        this.toast.error('Sem permissão para gerar o relatório ou autenticação em duas etapas necessária.');
      } else if (error instanceof HttpErrorResponse && error.status === 401) {
        this.toast.error('Sua sessão expirou. Entre novamente para gerar o relatório.');
      } else {
        this.toast.error('Não foi possível gerar o relatório. Confira o período e tente novamente.');
      }
    } finally {
      if (!this.destroyRef.destroyed) this.reportLoading.set(false);
    }
  }

  protected syncCalendarMonth(dateRange: HTMLDetailsElement): void {
    if (!dateRange.open) return;
    const start = this.filters.controls.from.value;
    if (start) this.calendarMonth.set(this.firstOfMonth(this.parseDate(start)));
  }

  protected changeCalendarMonth(offset: number): void {
    const month = this.calendarMonth();
    this.calendarMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  protected calendarMonthLabel(offset: number): string {
    const month = this.calendarMonth();
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
      new Date(month.getFullYear(), month.getMonth() + offset, 1),
    );
  }

  protected calendarDays(offset: number): Array<CalendarDay | null> {
    const month = this.calendarMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth() + offset;
    const first = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const days: Array<CalendarDay | null> = Array(first.getDay()).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthIndex, day);
      days.push({ date: this.toDateInputValue(date), day });
    }
    return days;
  }

  protected isDateInRange(date: string): boolean {
    const { from, to } = this.filters.getRawValue();
    return !!from && !!to && date >= from && date <= to;
  }

  protected isSelectedDate(date: string): boolean {
    const { from, to } = this.filters.getRawValue();
    return date === from || (!!to && date === to);
  }

  protected selectCalendarDate(date: string): void {
    const { from, to } = this.filters.getRawValue();
    if (!from || to) {
      this.filters.patchValue({ from: date, to: '' });
    } else if (date < from) {
      this.filters.patchValue({ from: date, to: from });
    } else {
      this.filters.controls.to.setValue(date);
    }
    this.reportError.set('');
  }

  protected closeDateRange(dateRange: HTMLDetailsElement): void {
    dateRange.open = false;
    dateRange.querySelector('summary')?.focus();
  }

  protected dateRangeLabel(): string {
    const { from: start, to: end } = this.filters.getRawValue();
    if (start && end) return `${this.formatDate(start)} – ${this.formatDate(end)}`;
    if (start) return `A partir de ${this.formatDate(start)}`;
    if (end) return `Até ${this.formatDate(end)}`;
    return 'Todas as datas';
  }

  protected async loadCatalogs(): Promise<void> {
    this.catalogLoading.set(true);
    this.catalogError.set('');
    try {
      const [types, methods] = await Promise.all([
        this.service.listTypes(this.accessToken(), this.tenantId()),
        this.service.listMethods(this.accessToken(), this.tenantId()),
      ]);
      this.types.set(types);
      this.methods.set(methods);
      if (this.openOnLoad() && types.length && methods.length) this.openDialog();
    } catch {
      this.toast.error('Não foi possível carregar tipos e meios de pagamento.');
    } finally {
      this.catalogLoading.set(false);
    }
  }

  protected openDialog(item: Contribution | null = null): void {
    this.contributionForm().open(item);
  }

  protected onMutationDialogClosed(): void {
    if (this.stale()) {
      this.stale.set(false);
      void this.loadList(1);
    }
  }

  protected openDelete(item: Contribution): void {
    this.deleting.set(item);
    this.stale.set(false);
    this.voidReason.reset();
    this.deleteError.set('');
    this.notice.set('');
    this.confirmDialog?.open();
  }

  protected async deleteContribution(): Promise<void> {
    const item = this.deleting();
    if (!item || this.deletingBusy() || this.stale()) return;
    this.voidReason.markAsTouched();
    if (this.voidReason.invalid) {
      this.toast.warning('O motivo deve ter no máximo 2000 caracteres.');
      return;
    }
    this.deleteError.set('');
    this.deletingBusy.set(true);
    try {
      const reason = this.voidReason.value.trim();
      await this.service.void(this.accessToken(), this.tenantId(), item.id, {
        version: item.version,
        ...(reason ? { voidReason: reason } : {}),
      });
      if (this.destroyRef.destroyed) return;
      this.confirmDialog?.close();
      this.toast.success('Contribuição anulada com sucesso.');
      await this.loadList(1);
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      this.stale.set(isStaleContribution(error));
      this.toast.error(mutationError(error, 'anular'));
    } finally {
      if (!this.destroyRef.destroyed) this.deletingBusy.set(false);
    }
  }

  protected formatCurrency(amount: string): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      Number(amount),
    );
  }

  protected formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, month - 1, day)),
    );
  }

  private firstOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

}
