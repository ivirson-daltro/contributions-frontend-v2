import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, Subject, catchError, from, switchMap, timer } from 'rxjs';
import { CustomConfirmComponent } from '../../../../shared/components/custom-confirm/custom-confirm.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { Contribution } from '../../dtos/contribution.dto';
import { ContributionList } from '../../dtos/contribution-list.dto';
import { ContributionQuery } from '../../dtos/contribution-query.dto';
import { ContributionType } from '../../dtos/contribution-type.dto';
import { CreateContribution } from '../../dtos/create-contribution.dto';
import { MemberLookup } from '../../dtos/member-lookup.dto';
import { PaymentMethod } from '../../dtos/payment-method.dto';
import { ContributionsService } from '../../services/contributions.service';

interface CalendarDay {
  date: string;
  day: number;
}

@Component({
  selector: 'app-contributions',
  imports: [ReactiveFormsModule, CurrencyInputComponent, CustomConfirmComponent],
  templateUrl: './contributions.component.html',
})
export class ContributionsComponent implements OnInit {
  readonly accessToken = input.required<string>();
  readonly tenantId = input.required<string>();
  readonly openOnLoad = input(false);
  @ViewChild('contributionDialog') private dialog?: ElementRef<HTMLDialogElement>;
  @ViewChild(CustomConfirmComponent) private confirmDialog?: CustomConfirmComponent;

  private readonly service = inject(ContributionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly memberQueries = new Subject<string | null>();
  private listRequest = 0;
  private idempotencyKey = '';
  private submittedPayload: string | null = null;
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
  protected readonly members = signal<MemberLookup[]>([]);
  protected readonly memberLoading = signal(false);
  protected readonly memberError = signal('');
  protected readonly selectedMember = signal<Contribution['member']>(null);
  protected readonly editing = signal<Contribution | null>(null);
  protected readonly deleting = signal<Contribution | null>(null);
  protected readonly deletingBusy = signal(false);
  protected readonly deleteError = signal('');
  protected readonly stale = signal(false);
  protected readonly voidReason = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(2000),
  });
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected readonly notice = signal('');
  protected readonly pages = computed(() => {
    const meta = this.list()?.meta;
    return meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  });
  protected readonly calendarMonth = signal(this.firstOfMonth(new Date()));

  protected readonly filters = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    typeId: new FormControl('', { nonNullable: true }),
    methodId: new FormControl('', { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
  });

  protected readonly form = new FormGroup({
    contributionTypeId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    paymentMethodId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    occurredOn: new FormControl('', { nonNullable: true, validators: Validators.required }),
    amount: new FormControl('', { nonNullable: true, validators: Validators.required }),
    memberSearch: new FormControl('', { nonNullable: true }),
    observation: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
  });

  ngOnInit(): void {
    this.memberQueries
      .pipe(
        switchMap((query) =>
          query === null
            ? EMPTY
            : timer(300).pipe(
                switchMap(() =>
                  from(this.service.lookupMembers(this.accessToken(), this.tenantId(), query)),
                ),
                catchError(() => {
                  this.memberLoading.set(false);
                  this.memberError.set('Não foi possível buscar membros. Tente novamente.');
                  return EMPTY;
                }),
              ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((members) => {
        this.members.set(members);
        this.memberLoading.set(false);
      });
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
      }
    } finally {
      if (request === this.listRequest && !this.destroyRef.destroyed) this.listLoading.set(false);
    }
  }

  protected applyFilters(dateRange: HTMLDetailsElement): void {
    const values = this.filters.getRawValue();
    if (values.from && values.to && values.from > values.to) {
      this.filterError.set('A data inicial deve ser anterior ou igual à data final.');
      dateRange.open = true;
      return;
    }
    dateRange.open = false;
    this.filterError.set('');
    this.appliedFilters = {
      q: values.q.trim(),
      typeId: values.typeId,
      methodId: values.methodId,
      from: values.from,
      to: values.to,
      status: 'ACTIVE',
      page: 1,
      pageSize: 20,
    };
    void this.loadList(1);
  }

  protected clearFilters(dateRange: HTMLDetailsElement): void {
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
      this.reportError.set('Selecione as datas inicial e final para gerar o relatório.');
      dateRange.open = true;
      return;
    }
    if (startTime > endTime) {
      this.reportError.set('A data inicial deve ser anterior ou igual à data final.');
      dateRange.open = true;
      return;
    }
    if (endTime - startTime > 365 * 86_400_000) {
      this.reportError.set('O período do relatório não pode ultrapassar 366 dias.');
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
        this.reportError.set('Sem permissão para gerar o relatório ou autenticação em duas etapas necessária.');
      } else if (error instanceof HttpErrorResponse && error.status === 401) {
        this.reportError.set('Sua sessão expirou. Entre novamente para gerar o relatório.');
      } else {
        this.reportError.set('Não foi possível gerar o relatório. Confira o período e tente novamente.');
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
      this.catalogError.set('Não foi possível carregar tipos e meios de pagamento.');
    } finally {
      this.catalogLoading.set(false);
    }
  }

  protected openDialog(item: Contribution | null = null): void {
    this.memberQueries.next(null);
    this.form.reset();
    this.editing.set(item);
    this.stale.set(false);
    this.selectedMember.set(item?.member ?? null);
    this.members.set([]);
    this.memberLoading.set(false);
    this.memberError.set('');
    this.formError.set('');
    this.notice.set('');
    this.idempotencyKey = crypto.randomUUID();
    this.submittedPayload = null;
    if (item) {
      this.form.patchValue({
        contributionTypeId: item.type.id,
        paymentMethodId: item.method.id,
        occurredOn: item.occurredOn,
        amount: item.amount,
        memberSearch: item.member?.name ?? '',
        observation: item.observation ?? '',
      });
    }
    this.dialog?.nativeElement.showModal();
  }

  protected closeDialog(): void {
    if (this.saving()) return;
    this.memberQueries.next(null);
    this.dialog?.nativeElement.close();
  }

  protected preventCloseWhileSaving(event: Event): void {
    if (this.saving()) event.preventDefault();
    else this.memberQueries.next(null);
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
      this.deleteError.set('O motivo deve ter no máximo 2000 caracteres.');
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
      this.notice.set('Contribuição anulada com sucesso.');
      await this.loadList(1);
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      this.stale.set(this.isStaleContribution(error));
      this.deleteError.set(this.mutationError(error, 'anular'));
    } finally {
      if (!this.destroyRef.destroyed) this.deletingBusy.set(false);
    }
  }

  protected searchMembers(value: string): void {
    this.selectedMember.set(null);
    this.members.set([]);
    this.memberError.set('');
    const query = value.trim();
    if (!query) {
      this.memberLoading.set(false);
      this.memberQueries.next(null);
      return;
    }
    this.memberLoading.set(true);
    this.memberQueries.next(query);
  }

  protected selectMember(member: MemberLookup): void {
    this.memberQueries.next(null);
    this.selectedMember.set(member);
    this.form.controls.memberSearch.setValue(member.name);
    this.members.set([]);
    this.memberLoading.set(false);
  }

  protected requiresMember(): boolean {
    return (
      this.types().find((type) => type.id === this.form.controls.contributionTypeId.value)
        ?.requiresMember ?? false
    );
  }

  protected typeAvailable(id: string): boolean {
    return this.types().some((type) => type.id === id);
  }

  protected methodAvailable(id: string): boolean {
    return this.methods().some((method) => method.id === id);
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.stale()) return;
    this.form.markAllAsTouched();
    this.formError.set('');
    const values = this.form.getRawValue();
    const amount = values.amount.trim();
    if (this.form.invalid || !/^\d{1,12}(\.\d{1,2})?$/.test(amount) || !/[1-9]/.test(amount)) {
      this.formError.set(
        'Preencha os campos obrigatórios e informe um valor positivo com até duas casas decimais.',
      );
      return;
    }
    if (!this.types().some((type) => type.id === values.contributionTypeId) ||
        !this.methods().some((method) => method.id === values.paymentMethodId)) {
      this.formError.set('Selecione um tipo de contribuição e um meio de pagamento ativos.');
      return;
    }
    if (this.requiresMember() && !this.selectedMember()) {
      this.formError.set('Selecione um membro para este tipo de contribuição.');
      return;
    }
    if (values.memberSearch.trim() && !this.selectedMember()) {
      this.formError.set('Selecione um membro da lista ou limpe a busca.');
      return;
    }
    const payload: CreateContribution = {
      contributionTypeId: values.contributionTypeId,
      paymentMethodId: values.paymentMethodId,
      occurredOn: values.occurredOn,
      amount,
      memberId: this.selectedMember()?.id ?? null,
      observation: values.observation.trim() || null,
      attachmentIds: [],
    };
    const item = this.editing();
    const serialized = JSON.stringify(payload);
    if (!item && this.submittedPayload && this.submittedPayload !== serialized) {
      this.formError.set(
        'Para alterar os dados após uma tentativa, feche e abra um novo cadastro.',
      );
      return;
    }
    if (!item) this.submittedPayload = serialized;
    this.saving.set(true);
    try {
      if (item) {
        const { attachmentIds, ...fields } = payload;
        await this.service.update(this.accessToken(), this.tenantId(), item.id, {
          ...fields,
          version: item.version,
        });
      } else {
        await this.service.create(this.accessToken(), this.tenantId(), payload, this.idempotencyKey);
      }
      if (this.destroyRef.destroyed) return;
      this.saving.set(false);
      this.closeDialog();
      this.notice.set(item ? 'Contribuição atualizada com sucesso.' : 'Contribuição registrada com sucesso.');
      await this.loadList(1);
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      if (
        error instanceof HttpErrorResponse &&
        ['MONTH_CLOSED', 'MEMBER_REQUIRED', 'FUTURE_DATE_NOT_ALLOWED'].includes(error.error?.code)
      ) {
        this.submittedPayload = null;
      }
      if (item) {
        this.stale.set(this.isStaleContribution(error));
        this.formError.set(this.mutationError(error, 'editar'));
      } else {
        this.formError.set(this.errorMessage(error));
      }
    } finally {
      if (!this.destroyRef.destroyed) this.saving.set(false);
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

  private errorMessage(error: unknown): string {
    const code = error instanceof HttpErrorResponse ? error.error?.code : null;
    if (code === 'MONTH_CLOSED') return 'Este mês está fechado e não aceita novos lançamentos.';
    if (code === 'MEMBER_REQUIRED') return 'Selecione um membro para este tipo de contribuição.';
    if (code === 'FUTURE_DATE_NOT_ALLOWED') return 'A data do lançamento não pode ser futura.';
    if (code === 'IDEMPOTENCY_KEY_REUSED')
      return 'Esta tentativa conflita com um cadastro anterior. Confira a listagem antes de iniciar outro cadastro.';
    return 'Não foi possível registrar a contribuição. Confira os dados e tente novamente.';
  }

  private isStaleContribution(error: unknown): boolean {
    return error instanceof HttpErrorResponse &&
      (error.status === 404 ||
        ['VERSION_MISMATCH', 'CONTRIBUTION_VOIDED', 'ALREADY_VOIDED'].includes(error.error?.code));
  }

  private mutationError(error: unknown, action: 'editar' | 'anular'): string {
    if (this.isStaleContribution(error)) {
      return 'Esta contribuição foi alterada ou não está mais disponível. Feche esta janela para atualizar a lista.';
    }
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
      if (error.status === 403) return 'Você não tem permissão para alterar contribuições.';
      if (error.error?.code === 'MONTH_CLOSED') return 'Este mês está fechado e não aceita alterações.';
      if (error.error?.code === 'MEMBER_REQUIRED') return 'Selecione um membro para este tipo de contribuição.';
      if (error.error?.code === 'FUTURE_DATE_NOT_ALLOWED') return 'A data do lançamento não pode ser futura.';
      if (error.error?.code === 'INVALID_REFERENCE') {
        return 'Tipo, meio de pagamento ou membro inválido ou inativo. Confira os dados.';
      }
    }
    return `Não foi possível ${action} a contribuição. Confira os dados e tente novamente.`;
  }
}
