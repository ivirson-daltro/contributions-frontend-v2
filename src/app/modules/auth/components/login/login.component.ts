import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { PlatformService } from '../../../platform/services/platform.service';

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

  protected readonly passwordVisible = signal(false);
  protected readonly feedback = signal('');
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
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.feedback.set('');

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    try {
      const error = await this.authService.signIn(
        this.form.controls.email.value.trim(),
        this.form.controls.password.value,
      );

      if (error) {
        this.feedback.set('E-mail ou senha inválidos.');
        return;
      }

      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        this.feedback.set('Não foi possível iniciar sua sessão. Tente novamente.');
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
      this.feedback.set(
        'Não foi possível concluir o acesso. Verifique sua conexão e tente novamente.',
      );
    } finally {
      this.isSubmitting.set(false);
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
        this.feedback.set(
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

  protected requestPasswordReset(): void {
    this.feedback.set('A recuperação de senha será disponibilizada em uma próxima etapa.');
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }
}
