import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { GlobalLoadingService } from '../../../../core/ui/global-loading.service';
import { ToastService } from '../../../../core/ui/toast.service';

type RecoveryView = 'checking' | 'ready' | 'invalid' | 'error' | 'success';

@Component({
  selector: 'app-reset-password',
  host: { style: 'display: contents' },
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly loading = inject(GlobalLoadingService);
  private readonly toast = inject(ToastService);

  protected readonly view = signal<RecoveryView>('checking');
  protected readonly isSubmitting = signal(false);
  protected readonly passwordsMismatch = signal(false);
  protected readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)],
    }),
    confirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async ngOnInit(): Promise<void> {
    try {
      const valid = await this.loading.track(() => this.auth.initializePasswordRecovery());
      this.view.set(valid ? 'ready' : 'invalid');
    } catch {
      this.view.set('error');
      this.toast.error('Não foi possível validar o link de recuperação. Verifique sua conexão.');
    }
  }

  protected async submit(): Promise<void> {
    if (this.isSubmitting() || this.view() !== 'ready') return;
    this.form.markAllAsTouched();
    const { password, confirmation } = this.form.getRawValue();
    this.passwordsMismatch.set(password !== confirmation);
    if (this.form.invalid || this.passwordsMismatch()) return;

    this.isSubmitting.set(true);
    try {
      await this.loading.track(() => this.auth.updateRecoveredPassword(password));
    } catch {
      this.toast.error('Não foi possível redefinir a senha. Tente novamente ou solicite outro link.');
      this.isSubmitting.set(false);
      return;
    }

    this.form.reset();
    this.view.set('success');
    this.toast.success('Senha redefinida. Entre novamente com a nova senha.');
    try {
      await this.loading.track(() => this.auth.signOutRecovery());
    } catch {
      this.toast.warning('A senha foi alterada, mas não foi possível encerrar a sessão de recuperação.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
