import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { PlatformService } from '../../../platform/services/platform.service';
import { ToastService } from '../../../../core/ui/toast.service';
import { RememberedEmailService } from '../../services/remembered-email.service';

@Component({
  host: { style: 'display: contents' },
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly platformService = inject(PlatformService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly rememberedEmail = inject(RememberedEmailService);

  protected readonly passwordVisible = signal(false);
  protected readonly isSubmitting = signal(false);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    rememberEmail: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    try {
      const email = this.rememberedEmail.get();
      if (email) this.form.patchValue({ email, rememberEmail: true });
    } catch {
      this.toast.warning('Não foi possível carregar o e-mail salvo neste navegador.');
    }
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    try {
      const email = this.form.controls.email.value.trim();
      const error = await this.authService.signIn(email, this.form.controls.password.value);

      if (error) {
        this.toast.error('E-mail ou senha inválidos.');
        return;
      }

      this.persistEmailPreference(email);

      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        this.toast.error('Não foi possível iniciar sua sessão. Tente novamente.');
        return;
      }

      const destination = await this.resolveDestination(accessToken);
      if (!destination) return;

      const factorStatus = await this.authService.getTotpFactorStatus();
      if (factorStatus.currentLevel !== 'aal2') {
        await this.router.navigate(['/two-factor'], { queryParams: { returnUrl: destination } });
        return;
      }

      await this.router.navigate([destination]);
    } catch {
      this.toast.error(
        'Não foi possível concluir o acesso. Verifique sua conexão e tente novamente.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected onRememberEmailChange(checked: boolean): void {
    if (!checked) this.clearRememberedEmail();
  }

  private persistEmailPreference(email: string): void {
    if (!this.form.controls.rememberEmail.value) return;

    try {
      this.rememberedEmail.save(email);
    } catch {
      this.toast.warning('Não foi possível salvar o e-mail neste navegador.');
    }
  }

  private clearRememberedEmail(): void {
    try {
      this.rememberedEmail.clear();
    } catch {
      this.toast.warning('Não foi possível remover o e-mail salvo neste navegador.');
    }
  }

  private async resolveDestination(
    accessToken: string,
  ): Promise<'/select-church' | '/platform' | null> {
    const profile = await this.authService.getCurrentUser(accessToken);
    if (profile.memberships.some((membership) => membership.status === 'ACTIVE')) {
      return '/select-church';
    }

    try {
      await this.platformService.listTenants(accessToken);
      return '/platform';
    } catch (platformError) {
      if (this.getErrorCode(platformError) === 'MFA_REQUIRED') {
        return '/platform';
      }

      if (this.getErrorCode(platformError) === 'FORBIDDEN') {
        this.toast.warning(
          'Sua conta ainda não tem acesso a uma igreja. Peça um convite ao administrador da sua igreja.',
        );
        return null;
      }

      throw platformError;
    }
  }

  private getErrorCode(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const body: unknown = error.error;
    if (typeof body !== 'object' || body === null || !('code' in body)) {
      return null;
    }
    return typeof body.code === 'string' ? body.code : null;
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }
}
