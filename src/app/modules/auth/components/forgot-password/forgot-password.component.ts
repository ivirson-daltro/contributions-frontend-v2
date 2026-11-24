import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { isAuthError } from '@supabase/supabase-js';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { GlobalLoadingService } from '../../../../core/ui/global-loading.service';
import { ToastService } from '../../../../core/ui/toast.service';

@Component({
  selector: 'app-forgot-password',
  host: { style: 'display: contents' },
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly loading = inject(GlobalLoadingService);
  private readonly toast = inject(ToastService);

  protected readonly isSubmitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    try {
      await this.loading.track(() => this.auth.requestPasswordReset(this.form.controls.email.value.trim()));
      this.sent.set(true);
      this.toast.success('Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.');
    } catch (error) {
      if (isAuthError(error) && error.status === 429) {
        this.toast.warning('Muitas solicitações de recuperação. Aguarde e tente novamente mais tarde.');
      } else {
        this.toast.error('Não foi possível solicitar a recuperação. Tente novamente.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
