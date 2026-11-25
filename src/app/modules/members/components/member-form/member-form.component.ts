import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Member, MemberPayload, MemberStatus, MemberType } from '../../dtos/member.dto';
import { formatPhoneMask } from '../../../../shared/utils/phone-mask';

export interface MemberFormSubmission {
  payload: MemberPayload;
  changes: Partial<MemberPayload>;
}

interface ViaCepAddress {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

@Component({
  selector: 'app-member-form',
  imports: [ReactiveFormsModule],
  templateUrl: './member-form.component.html',
  styleUrl: './member-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberFormComponent implements OnInit {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('memberDialog');
  private readonly http = inject(HttpClient);
  private zipLookupRequest = 0;
  readonly member = input<Member | null>(null);
  readonly types = input.required<MemberType[]>();
  readonly fullAccess = input.required<boolean>();
  readonly saving = input(false);
  readonly duplicates = input<readonly string[] | null>(null);
  readonly save = output<MemberFormSubmission>();
  readonly cancel = output<void>();
  readonly duplicateConfirmed = output<void>();
  readonly duplicateReviewed = output<void>();

  protected readonly step = signal(1);
  protected readonly editing = signal<Member | null>(null);
  protected readonly zipLoading = signal(false);
  protected readonly zipError = signal('');
  protected readonly hasCurrentType = computed(() => {
    const current = this.member()?.memberType;
    return !!current && !this.types().some((type) => type.id === current.id);
  });
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)] }),
    memberTypeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    status: new FormControl<MemberStatus>('ACTIVE', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(254)] }),
    gender: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    birthDate: new FormControl('', { nonNullable: true }),
    entryDate: new FormControl('', { nonNullable: true }),
    baptismDate: new FormControl('', { nonNullable: true }),
    zipCode: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    street: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    number: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
    complement: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    neighborhood: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    city: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    state: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    consent: new FormControl(false, { nonNullable: true }),
  });

  ngOnInit(): void {
    const member = this.member();
    if (member) {
      this.form.patchValue({
        name: member.name, memberTypeId: member.memberType.id, status: member.status,
        phone: this.formatPhone(member.phone ?? ''), email: member.email ?? '', gender: member.gender ?? '',
        birthDate: member.birthDate ?? '', entryDate: member.entryDate ?? '', baptismDate: member.baptismDate ?? '',
        zipCode: this.formatZipCode(member.zipCode ?? ''), street: member.street ?? '', number: member.number ?? '',
        complement: member.complement ?? '', neighborhood: member.neighborhood ?? '',
        city: member.city ?? '', state: member.state ?? '', consent: !!member.consentAt,
      });
    }
    if (!this.fullAccess()) {
      for (const [key, control] of Object.entries(this.form.controls)) {
        if (key !== 'name' && key !== 'memberTypeId') control.disable({ emitEvent: false });
      }
    }
  }

  open(member: Member | null = null): void {
    this.editing.set(member);
    this.step.set(1);
    this.zipError.set('');
    this.zipLoading.set(false);
    this.form.reset({
      name: '', memberTypeId: '', status: 'ACTIVE', phone: '', email: '', gender: '',
      birthDate: '', entryDate: '', baptismDate: '', zipCode: '', street: '', number: '',
      complement: '', neighborhood: '', city: '', state: '', consent: false,
    });
    if (member) {
      this.form.patchValue({
        name: member.name, memberTypeId: member.memberType.id, status: member.status,
        phone: this.formatPhone(member.phone ?? ''), email: member.email ?? '', gender: member.gender ?? '',
        birthDate: member.birthDate ?? '', entryDate: member.entryDate ?? '', baptismDate: member.baptismDate ?? '',
        zipCode: this.formatZipCode(member.zipCode ?? ''), street: member.street ?? '', number: member.number ?? '',
        complement: member.complement ?? '', neighborhood: member.neighborhood ?? '',
        city: member.city ?? '', state: member.state ?? '', consent: !!member.consentAt,
      });
    }
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  protected closeDialog(): void {
    if (!this.saving()) {
      const dialog = this.dialog().nativeElement;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      this.cancel.emit();
    }
  }

  close(): void {
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  protected preventCloseWhileSaving(event: Event): void {
    if (this.saving()) event.preventDefault();
  }

  protected next(): void {
    if (this.step() === 1) {
      this.form.controls.name.markAsTouched();
      this.form.controls.memberTypeId.markAsTouched();
      this.form.controls.email.markAsTouched();
      if (this.form.controls.name.invalid || this.form.controls.memberTypeId.invalid ||
          (this.fullAccess() && this.form.controls.email.invalid)) return;
    }
    this.step.update((step) => Math.min(step + 1, 3));
  }

  protected onPhoneInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const formatted = this.formatPhone(input.value);
    this.form.controls.phone.setValue(formatted);
    input.value = formatted;
  }

  protected onZipCodeInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const formatted = this.formatZipCode(input.value);
    this.form.controls.zipCode.setValue(formatted);
    input.value = formatted;
    void this.lookupZipCode(formatted);
  }

  private async lookupZipCode(zipCode: string): Promise<void> {
    const request = ++this.zipLookupRequest;
    const digits = zipCode.replace(/\D/g, '');
    if (digits.length !== 8) {
      this.zipLoading.set(false);
      this.zipError.set('');
      return;
    }

    this.zipLoading.set(true);
    this.zipError.set('');
    try {
      const address = await firstValueFrom(
        this.http.get<ViaCepAddress>(`https://viacep.com.br/ws/${digits}/json/`),
      );
      if (request !== this.zipLookupRequest) return;
      if (address.erro) {
        this.zipError.set('CEP não encontrado.');
        return;
      }
      this.form.patchValue({
        street: address.logradouro ?? '',
        neighborhood: address.bairro ?? '',
        city: address.localidade ?? '',
        state: address.uf ?? '',
      });
    } catch {
      if (request === this.zipLookupRequest) {
        this.zipError.set('Não foi possível consultar o CEP.');
      }
    } finally {
      if (request === this.zipLookupRequest) this.zipLoading.set(false);
    }
  }

  private formatPhone(value: string): string {
    const formatted = formatPhoneMask(value);
    return formatted === '—' ? '' : formatted;
  }

  private formatZipCode(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.fullAccess() && this.step() < 3) {
      this.next();
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      if (this.form.controls.name.invalid || this.form.controls.memberTypeId.invalid || this.form.controls.email.invalid) {
        this.step.set(1);
      } else {
        this.step.set(2);
      }
      return;
    }

    const values = this.form.getRawValue();
    const payload: MemberPayload = {
      name: values.name.trim(),
      memberTypeId: values.memberTypeId,
    };
    if (this.fullAccess()) {
      Object.assign(payload, {
        status: values.status,
        phone: this.nullable(values.phone), email: this.nullable(values.email),
        gender: this.nullable(values.gender), birthDate: this.nullable(values.birthDate),
        entryDate: this.nullable(values.entryDate), baptismDate: this.nullable(values.baptismDate),
        zipCode: this.nullable(values.zipCode), street: this.nullable(values.street),
        number: this.nullable(values.number), complement: this.nullable(values.complement),
        neighborhood: this.nullable(values.neighborhood), city: this.nullable(values.city),
        state: this.nullable(values.state), consent: values.consent,
      });
    }

    const member = this.editing() ?? this.member();
    if (!member) {
      this.save.emit({ payload, changes: {} });
      return;
    }
    const original: MemberPayload = {
      name: member.name, memberTypeId: member.memberType.id, status: member.status,
      phone: member.phone, email: member.email, gender: member.gender, birthDate: member.birthDate,
      entryDate: member.entryDate, baptismDate: member.baptismDate, zipCode: member.zipCode,
      street: member.street, number: member.number, complement: member.complement,
      neighborhood: member.neighborhood, city: member.city, state: member.state, consent: !!member.consentAt,
    };
    const changes = Object.fromEntries(
      Object.entries(payload).filter(([key, value]) =>
        this.form.controls[key as keyof MemberPayload].dirty && original[key as keyof MemberPayload] !== value,
      ),
    ) as Partial<MemberPayload>;
    this.save.emit({ payload, changes });
  }

  private nullable(value: string): string | null {
    return value.trim() || null;
  }
}
