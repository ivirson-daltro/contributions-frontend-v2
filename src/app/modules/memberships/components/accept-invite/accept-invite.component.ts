import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { InvitationPreview } from '../../dtos/invitation-preview.dto';
import { InvitationService } from '../../services/invitation.service';
import { ToastService } from '../../../../core/ui/toast.service';

type InvitationView = 'loading' | 'ready' | 'success' | 'unavailable' | 'error' | 'expired';

@Component({
  host: { style: 'display: contents' },
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-accept-invite',
  templateUrl: './accept-invite.component.html',
})
export class AcceptInviteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly invitationService = inject(InvitationService);
  private readonly toast = inject(ToastService);

  protected readonly view = signal<InvitationView>('loading');
  protected readonly invitation = signal<InvitationPreview | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly feedback = signal('');
  protected readonly token = signal('');

  protected readonly form = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/),
      ],
    }),
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
    if (!token) {
      this.view.set('unavailable');
      return;
    }

    this.token.set(token);
    void this.loadPreview(token);
  }

  protected async loadPreview(token = this.token()): Promise<void> {
    this.view.set('loading');
    try {
      const preview = await this.invitationService.getPreview(token);
      this.invitation.set(preview);

      if (preview.status !== 'PENDING') {
        this.view.set('expired');
        return;
      }

      if (preview.name) {
        this.form.controls.displayName.setValue(preview.name);
      }
      this.form.controls.displayName.setValidators(
        preview.accountExists
          ? []
          : [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
      );
      this.form.controls.displayName.updateValueAndValidity();
      this.view.set('ready');
    } catch (error) {
      if (
        this.getErrorCode(error) === 'INVITATION_EXPIRED' ||
        (error instanceof HttpErrorResponse && error.status === 410)
      ) {
        this.view.set('expired');
      } else if (error instanceof HttpErrorResponse && error.status === 404) {
        this.view.set('unavailable');
      } else {
        this.view.set('error');
        this.toast.error(
          error instanceof HttpErrorResponse && error.status === 0
            ? 'Não foi possível conectar à API. Verifique a conexão e tente novamente.'
            : 'Não foi possível consultar o convite. Tente novamente.',
        );
      }
    } finally {
    }
  }

  protected async acceptInvitation(): Promise<void> {
    const preview = this.invitation();
    if (!preview || this.isSubmitting()) return;

    this.form.markAllAsTouched();
    const needsAccountCreation = !preview.accountExists;
    if (
      (needsAccountCreation &&
        (this.form.controls.displayName.invalid || this.form.controls.password.invalid)) ||
      (!needsAccountCreation && this.form.controls.password.invalid)
    ) {
      return;
    }

    this.isSubmitting.set(true);
    this.feedback.set('');

    try {
      if (preview.accountExists) {
        const authError = await this.authService.signIn(
          preview.email,
          this.form.controls.password.value,
        );
        if (authError) {
          this.toast.error(
            'Não foi possível entrar com este convite. Confira sua senha e tente novamente.',
          );
          return;
        }

        const [accessToken, userEmail] = await Promise.all([
          this.authService.getAccessToken(),
          this.authService.getCurrentUserEmail(),
        ]);
        if (
          !accessToken ||
          !userEmail ||
          userEmail.toLocaleLowerCase('en-US') !== preview.email.toLocaleLowerCase('en-US')
        ) {
          await this.authService.signOut();
          this.toast.error('A conta autenticada não corresponde ao e-mail deste convite.');
          return;
        }

        await this.invitationService.accept(this.token(), {}, accessToken);
      } else {
        await this.invitationService.accept(this.token(), {
          displayName: this.form.controls.displayName.value.trim(),
          password: this.form.controls.password.value,
        });
      }

      this.form.disable();
      this.view.set('success');
      this.toast.success('Convite aceito. Seu acesso à igreja foi ativado.');
    } catch (error) {
      this.toast.error(this.acceptanceErrorMessage(error));
      if (this.getErrorCode(error) === 'INVITATION_EXPIRED') {
        this.view.set('expired');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected roleLabel(role: string): string {
    const labels: Record<string, string> = {
      ADMIN: 'Administrador',
      SECRETARY: 'Secretário(a)',
      TREASURER: 'Tesoureiro(a)',
      TENANT_ADMIN: 'Administrador da igreja',
      AUDITOR: 'Fiscal',
      MEMBER: 'Membro',
    };
    return labels[role] ?? role;
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
  }

  private getErrorCode(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const body: unknown = error.error;
    if (typeof body !== 'object' || body === null || !('code' in body)) {
      return null;
    }
    return typeof body.code === 'string' ? body.code : null;
  }

  private acceptanceErrorMessage(error: unknown): string {
    const code = this.getErrorCode(error);
    if (code === 'INVITATION_EMAIL_MISMATCH') {
      return 'A conta autenticada não corresponde ao e-mail deste convite.';
    }
    if (code === 'ACCOUNT_EXISTS_LOGIN_REQUIRED') {
      return 'Este e-mail já possui uma conta. Atualize a página e entre com ela para aceitar o convite.';
    }
    if (code === 'TENANT_SUSPENDED') {
      return 'Esta igreja não pode aceitar convites no momento. Entre em contato com o administrador da plataforma.';
    }
    if (code === 'INVITATION_EXPIRED') {
      return 'Este convite expirou, foi revogado ou já foi utilizado.';
    }
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Não foi possível conectar à API. Tente novamente.';
    }
    return 'Não foi possível aceitar o convite. Tente novamente.';
  }
}
