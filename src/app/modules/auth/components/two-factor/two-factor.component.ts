import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';

type TwoFactorView = 'loading' | 'setup' | 'verify' | 'error';

@Component({
  host: { style: 'display: contents' },
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-two-factor',
  templateUrl: './two-factor.component.html',
})
export class TwoFactorComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly view = signal<TwoFactorView>('loading');
  protected readonly qrCode = signal('');
  protected readonly secret = signal('');
  protected readonly feedback = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly secretCopied = signal(false);

  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });

  private factorId = '';
  private returnUrl = '/select-church';

  ngOnInit(): void {
    const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (requestedUrl === '/platform' || requestedUrl === '/select-church') {
      this.returnUrl = requestedUrl;
    }
    void this.loadStatus();
  }

  protected async verify(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.factorId || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.feedback.set('');
    try {
      await this.authService.verifyTotp(this.factorId, this.form.controls.code.value);
      await this.router.navigateByUrl(this.returnUrl);
    } catch {
      this.feedback.set('Código inválido ou expirado. Confira o aplicativo autenticador.');
      this.form.controls.code.setValue('');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected updateCode(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    const value = event.target.value.replace(/\D/g, '').slice(0, 6);
    this.form.controls.code.setValue(value);
    this.secretCopied.set(false);
  }

  protected async copySecret(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.secret());
      this.secretCopied.set(true);
    } catch {
      this.feedback.set('Não foi possível copiar. Selecione a chave e copie manualmente.');
    }
  }

  protected async backToLogin(): Promise<void> {
    try {
      await this.authService.signOut();
    } catch {
      this.feedback.set('Não foi possível encerrar a sessão. Tente novamente.');
      this.view.set('error');
      return;
    }
    await this.router.navigate(['/login']);
  }

  protected async loadStatus(): Promise<void> {
    this.view.set('loading');
    this.feedback.set('');
    try {
      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        await this.router.navigate(['/login']);
        return;
      }

      const status = await this.authService.getTotpFactorStatus();
      if (status.currentLevel === 'aal2') {
        await this.router.navigateByUrl(this.returnUrl);
        return;
      }

      const verifiedFactor = status.factors.find((factor) => factor.status === 'verified');
      if (verifiedFactor) {
        this.factorId = verifiedFactor.id;
        this.view.set('verify');
        return;
      }

      const enrollment = await this.authService.enrollTotp();
      this.factorId = enrollment.id;
      this.qrCode.set(enrollment.qrCode);
      this.secret.set(enrollment.secret);
      this.view.set('setup');
    } catch {
      this.view.set('error');
      this.feedback.set('Não foi possível carregar a verificação de segurança. Tente novamente.');
    }
  }
}
