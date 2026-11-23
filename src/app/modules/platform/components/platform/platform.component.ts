import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { IssueAdminInvitationResponse } from '../../dtos/issue-admin-invitation-response.dto';
import { PlatformTenant } from '../../dtos/platform-tenant.dto';
import { PlatformService } from '../../services/platform.service';
import { ToastService } from '../../../../core/ui/toast.service';

type PlatformView = 'loading' | 'ready' | 'enroll' | 'verify' | 'denied';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-platform',
  templateUrl: './platform.component.html',
})
export class PlatformComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly platformService = inject(PlatformService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly view = signal<PlatformView>('loading');
  protected readonly tenants = signal<PlatformTenant[]>([]);
  protected readonly feedback = signal('');
  protected readonly isSaving = signal(false);
  protected readonly showCreateForm = signal(false);
  protected readonly invitation = signal<{
    tenantName: string;
    email: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  protected readonly tenantForReissue = signal<PlatformTenant | null>(null);
  protected readonly invitationLink = computed(() => {
    const token = this.invitation()?.token;
    return token
      ? `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`
      : '';
  });
  protected readonly totpQrCode = signal('');
  protected readonly totpSecret = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('ALL');
  protected readonly filteredTenants = computed(() => {
    const normalizedSearch = this.search().trim().toLocaleLowerCase('pt-BR');
    return this.tenants().filter((tenant) => {
      const matchesSearch =
        !normalizedSearch ||
        tenant.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
        tenant.slug.toLocaleLowerCase('pt-BR').includes(normalizedSearch);
      const matchesStatus = this.statusFilter() === 'ALL' || tenant.status === this.statusFilter();
      return matchesSearch && matchesStatus;
    });
  });

  protected readonly createForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(40),
        Validators.pattern(/^[a-z0-9][a-z0-9-]+$/),
      ],
    }),
    document: new FormControl('', { nonNullable: true }),
    timezone: new FormControl('America/Sao_Paulo', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    adminName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    adminEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  protected readonly mfaForm = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });

  protected readonly reissueForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  private accessToken: string | null = null;
  private factorId = '';

  ngOnInit(): void {
    void this.loadTenants();
  }

  protected async loadTenants(): Promise<void> {
    this.view.set('loading');

    try {
      this.accessToken = await this.authService.getAccessToken();
      if (!this.accessToken) {
        await this.router.navigate(['/login']);
        return;
      }

      const response = await this.platformService.listTenants(this.accessToken);
      this.tenants.set(response.items);
      this.view.set('ready');
    } catch (error) {
      await this.handlePlatformError(error);
    } finally {
    }
  }

  protected async startTotpEnrollment(): Promise<void> {
    this.feedback.set('');
    try {
      const enrollment = await this.authService.enrollTotp();
      this.factorId = enrollment.id;
      this.totpQrCode.set(enrollment.qrCode);
      this.totpSecret.set(enrollment.secret);
      this.view.set('verify');
    } catch {
      this.toast.error('Não foi possível iniciar o cadastro de MFA. Tente novamente.');
    }
  }

  protected async verifyTotp(): Promise<void> {
    this.mfaForm.markAllAsTouched();
    if (this.mfaForm.invalid || !this.factorId) return;

    this.isSaving.set(true);
    this.feedback.set('');
    try {
      await this.authService.verifyTotp(this.factorId, this.mfaForm.controls.code.value);
      this.mfaForm.reset();
      this.totpQrCode.set('');
      this.totpSecret.set('');
      await this.loadTenants();
    } catch {
      this.toast.error('Código de verificação inválido ou expirado.');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async createTenant(): Promise<void> {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || !this.accessToken || this.isSaving()) return;

    this.feedback.set('');
    this.isSaving.set(true);
    const values = this.createForm.getRawValue();

    try {
      const result = await this.platformService.createTenant(this.accessToken, {
        ...values,
        document: values.document.trim() || null,
        name: values.name.trim(),
        slug: values.slug.trim(),
        adminName: values.adminName.trim(),
        adminEmail: values.adminEmail.trim(),
      });
      this.invitation.set({
        tenantName: result.tenant.name,
        email: result.invite.email,
        token: result.invite.token,
        expiresAt: result.invite.expiresAt,
      });
      this.showCreateForm.set(false);
      this.createForm.reset({
        name: '',
        slug: '',
        document: '',
        timezone: 'America/Sao_Paulo',
        adminName: '',
        adminEmail: '',
      });
      await this.refreshTenantList();
      this.toast.success('Igreja criada com sucesso.');
    } catch (error) {
      if (this.getErrorCode(error) === 'SLUG_TAKEN') {
        this.toast.warning('Este identificador já está em uso. Escolha outro.');
      } else {
        this.toast.error(this.getRequestErrorMessage(error));
      }
    } finally {
      this.isSaving.set(false);
    }
  }

  protected startAdminInvitationReissue(tenant: PlatformTenant): void {
    this.feedback.set('');
    this.tenantForReissue.set(tenant);
    this.reissueForm.reset({ name: '', email: '' });
  }

  protected cancelAdminInvitationReissue(): void {
    this.tenantForReissue.set(null);
    this.reissueForm.reset({ name: '', email: '' });
  }

  protected async reissueAdminInvitation(): Promise<void> {
    this.reissueForm.markAllAsTouched();
    const tenant = this.tenantForReissue();
    if (this.reissueForm.invalid || !this.accessToken || !tenant || this.isSaving()) {
      return;
    }

    this.feedback.set('');
    this.isSaving.set(true);
    const { email, name } = this.reissueForm.getRawValue();
    try {
      const result: IssueAdminInvitationResponse = await this.platformService.issueAdminInvitation(
        this.accessToken,
        tenant.id,
        { email: email.trim(), name: name.trim() },
      );
      this.invitation.set({
        tenantName: tenant.name,
        email: result.invitation.email,
        token: result.invitation.token,
        expiresAt: result.invitation.expiresAt,
      });
      this.tenantForReissue.set(null);
      this.reissueForm.reset({ name: '', email: '' });
      await this.refreshTenantList();
      this.toast.success('Novo convite do administrador preparado.');
    } catch (error) {
      const code = this.getErrorCode(error);
      this.toast.warning(
        code === 'TENANT_HAS_ADMIN'
          ? 'Esta igreja já tem um TENANT_ADMIN ativo. Peça a ele para convidar os demais usuários.'
          : this.getRequestErrorMessage(error),
      );
      if (code === 'TENANT_HAS_ADMIN') await this.refreshTenantList();
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async copyInvitationLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.invitationLink());
      this.toast.success('Link copiado. Guarde-o: ele não será exibido novamente.');
    } catch {
      this.toast.error(
        'Não foi possível copiar automaticamente. Selecione e copie o link exibido.',
      );
    }
  }

  protected dismissInvitation(): void {
    this.invitation.set(null);
    this.feedback.set('');
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
  }

  protected updateSearchFromEvent(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.search.set(event.target.value);
    }
  }

  protected updateStatusFilterFromEvent(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.statusFilter.set(event.target.value);
    }
  }

  protected async signOut(): Promise<void> {
    try {
      await this.authService.signOut();
      await this.router.navigate(['/login']);
    } catch {
      this.toast.error('Não foi possível encerrar a sessão. Tente novamente.');
    }
  }

  protected formatDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
  }

  protected formatStorage(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = -1;
    do {
      value /= 1024;
      unitIndex += 1;
    } while (value >= 1024 && unitIndex < units.length - 1);
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      ACTIVE: 'Ativa',
      CANCELLED: 'Cancelada',
      PAST_DUE: 'Em atraso',
      SUSPENDED: 'Suspensa',
      TRIAL: 'Período de teste',
    };
    return labels[status] ?? status;
  }

  private async refreshTenantList(): Promise<void> {
    if (!this.accessToken) return;
    try {
      const response = await this.platformService.listTenants(this.accessToken);
      this.tenants.set(response.items);
    } catch {
      this.toast.warning('Igreja criada, mas a lista não pôde ser atualizada. Atualize a página.');
    }
  }

  private async handlePlatformError(error: unknown): Promise<void> {
    if (this.getErrorCode(error) === 'MFA_REQUIRED') {
      await this.router.navigate(['/two-factor'], { queryParams: { returnUrl: '/platform' } });
      return;
    }

    if (error instanceof HttpErrorResponse && error.status === 401) {
      try {
        await this.authService.signOut();
      } catch {
        this.toast.error('Sessão expirada; não foi possível encerrá-la automaticamente.');
      }
      await this.router.navigate(['/login']);
      return;
    }

    this.view.set('denied');
    const message =
      this.getErrorCode(error) === 'FORBIDDEN'
        ? 'Sua conta não tem permissão para administrar a plataforma.'
        : this.getRequestErrorMessage(error);
    this.toast.error(message);
  }

  private getErrorCode(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const body: unknown = error.error;
    if (typeof body !== 'object' || body === null || !('code' in body)) {
      return null;
    }
    return typeof body.code === 'string' ? body.code : null;
  }

  private getRequestErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Não foi possível conectar à API. Verifique se o backend está em execução.';
    }
    return 'Não foi possível concluir a operação. Tente novamente.';
  }
}
