import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Member, MemberPayload, MemberStatus, MemberType } from '../../dtos/member.dto';

export interface MemberFormSubmission {
  payload: MemberPayload;
  changes: Partial<MemberPayload>;
}

@Component({
  selector: 'app-member-form',
  imports: [ReactiveFormsModule],
  templateUrl: './member-form.component.html',
  styleUrl: './member-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberFormComponent implements OnInit {
  readonly member = input<Member | null>(null);
  readonly types = input.required<MemberType[]>();
  readonly fullAccess = input.required<boolean>();
  readonly saving = input(false);
  readonly save = output<MemberFormSubmission>();
  readonly cancel = output<void>();

  protected readonly step = signal(1);
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
        phone: member.phone ?? '', email: member.email ?? '', gender: member.gender ?? '',
        birthDate: member.birthDate ?? '', entryDate: member.entryDate ?? '', baptismDate: member.baptismDate ?? '',
        zipCode: member.zipCode ?? '', street: member.street ?? '', number: member.number ?? '',
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

    const member = this.member();
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
