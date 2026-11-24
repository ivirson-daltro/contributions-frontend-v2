import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { isAuthError, isAuthRetryableFetchError, isAuthSessionMissingError } from '@supabase/supabase-js';
import { AuthService, RecoverySessionUnavailableError } from '../../../../core/auth/services/auth.service';
import { GlobalLoadingService } from '../../../../core/ui/global-loading.service';
import { ToastService } from '../../../../core/ui/toast.service';

type RecoveryView = 'checking' | 'ready' | 'invalid' | 'error' | 'success';

const unavailableSessionCodes = new Set([
  'bad_jwt',
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
]);

const matchingPasswords: ValidatorFn = (control) => {
  const password: unknown = control.get('password')?.value;
  const confirmation: unknown = control.get('confirmation')?.value;
  return typeof confirmation === 'string' && confirmation.length > 0 && confirmation !== password
    ? { passwordMismatch: true }
    : null;
};

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
  protected readonly passwordVisible = signal(false);
  protected readonly confirmationVisible = signal(false);
  protected readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)],
    }),
    confirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  }, { validators: matchingPasswords });

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
    if (this.form.invalid) return;
    const { password } = this.form.getRawValue();

    this.isSubmitting.set(true);
    try {
      await this.loading.track(() => this.auth.updateRecoveredPassword(password));
    } catch (error) {
      if (
        error instanceof RecoverySessionUnavailableError ||
        isAuthSessionMissingError(error) ||
        (isAuthError(error) && error.code !== undefined && unavailableSessionCodes.has(error.code))
      ) {
        this.view.set('invalid');
        this.toast.error('A sessão de recuperação não está mais disponível. Solicite outro link.');
      } else if (isAuthError(error) && error.code === 'same_password') {
        this.toast.error('A nova senha deve ser diferente da senha anterior.');
      } else if (isAuthError(error) && error.code === 'weak_password') {
        this.toast.error('A senha não atende aos requisitos de segurança. Escolha uma senha mais forte.');
      } else if (isAuthRetryableFetchError(error)) {
        this.toast.error('Não foi possível conectar ao serviço de autenticação. Verifique sua conexão.');
      } else {
        this.toast.error('Não foi possível redefinir a senha. Tente novamente ou solicite outro link.');
      }
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
