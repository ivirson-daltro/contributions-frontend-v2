import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../../core/ui/toast.service';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { MemberSelectComponent } from '../../../../shared/components/member-select/member-select.component';
import { MemberLookup } from '../../../../shared/dtos/member-lookup.dto';
import { Contribution } from '../../dtos/contribution.dto';
import { ContributionType } from '../../dtos/contribution-type.dto';
import { CreateContribution } from '../../dtos/create-contribution.dto';
import { PaymentMethod } from '../../dtos/payment-method.dto';
import { ContributionsService } from '../../services/contributions.service';
import { isStaleContribution, mutationError } from '../../services/contribution-errors';

@Component({
  selector: 'app-contribution-form',
  imports: [ReactiveFormsModule, CurrencyInputComponent, MemberSelectComponent],
  templateUrl: './contribution-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContributionFormComponent {
  readonly accessToken = input.required<string>();
  readonly tenantId = input.required<string>();
  readonly types = input.required<ContributionType[]>();
  readonly methods = input.required<PaymentMethod[]>();
  readonly membersLoader = input.required<() => Promise<MemberLookup[]>>();
  readonly saved = output<void>();
  readonly refreshRequested = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('contributionDialog');
  private readonly service = inject(ContributionsService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private idempotencyKey = '';
  private submittedPayload: string | null = null;

  protected readonly selectedMember = signal<Contribution['member']>(null);
  protected readonly memberInitialName = signal('');
  protected readonly editing = signal<Contribution | null>(null);
  protected readonly saving = signal(false);
  protected readonly stale = signal(false);
  protected readonly form = new FormGroup({
    contributionTypeId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    paymentMethodId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    occurredOn: new FormControl('', { nonNullable: true, validators: Validators.required }),
    amount: new FormControl('', { nonNullable: true, validators: Validators.required }),
    memberSearch: new FormControl('', { nonNullable: true }),
    observation: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
  });
  open(item: Contribution | null = null): void {
    this.form.reset();
    this.editing.set(item);
    this.stale.set(false);
    this.selectedMember.set(item?.member ?? null);
    this.memberInitialName.set(item?.member?.name ?? '');
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
    this.dialog().nativeElement.showModal();
  }

  protected closeDialog(): void {
    if (!this.saving()) this.dialog().nativeElement.close();
  }

  protected preventCloseWhileSaving(event: Event): void {
    if (this.saving()) event.preventDefault();
  }

  protected onDialogClosed(): void {
    if (this.stale()) {
      this.stale.set(false);
      this.refreshRequested.emit();
    }
  }

  protected selectMember(member: MemberLookup | null): void {
    this.selectedMember.set(member ? { id: member.id, name: member.name } : null);
    this.form.controls.memberSearch.setValue(member?.name ?? '');
  }

  protected requiresMember(): boolean {
    return this.types().find((type) => type.id === this.form.controls.contributionTypeId.value)
      ?.requiresMember ?? false;
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
    const values = this.form.getRawValue();
    const amount = values.amount.trim();
    if (this.form.invalid || !/^\d{1,12}(\.\d{1,2})?$/.test(amount) || !/[1-9]/.test(amount)) {
      this.toast.warning('Preencha os campos obrigatórios e informe um valor positivo com até duas casas decimais.');
      return;
    }
    if (!this.types().some((type) => type.id === values.contributionTypeId) ||
        !this.methods().some((method) => method.id === values.paymentMethodId)) {
      this.toast.warning('Selecione um tipo de contribuição e um meio de pagamento ativos.');
      return;
    }
    if (this.requiresMember() && !this.selectedMember()) {
      this.toast.warning('Selecione um membro para este tipo de contribuição.');
      return;
    }
    if (values.memberSearch.trim() && !this.selectedMember()) {
      this.toast.warning('Selecione um membro da lista ou limpe a busca.');
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
      this.toast.warning('Para alterar os dados após uma tentativa, feche e abra um novo cadastro.');
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
      this.toast.success(item ? 'Contribuição atualizada com sucesso.' : 'Contribuição registrada com sucesso.');
      this.saved.emit();
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      if (error instanceof HttpErrorResponse &&
          ['MONTH_CLOSED', 'MEMBER_REQUIRED', 'FUTURE_DATE_NOT_ALLOWED'].includes(error.error?.code)) {
        this.submittedPayload = null;
      }
      if (item) {
        this.stale.set(isStaleContribution(error));
        this.toast.error(mutationError(error, 'editar'));
      } else {
        this.toast.error(this.errorMessage(error));
      }
    } finally {
      if (!this.destroyRef.destroyed) this.saving.set(false);
    }
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
}
