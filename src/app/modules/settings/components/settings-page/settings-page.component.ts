import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantContextService } from '../../../../core/tenant/services/tenant-context.service';
import { ToastService } from '../../../../core/ui/toast.service';
import { CatalogItem, CatalogKind, CatalogPayload, ChurchSettings, FeeRule, LogoTheme, Preferences, SettingsService } from '../../services/settings.service';
import { cnpjDigits, formatCnpj } from '../../../../shared/utils/cnpj-mask';

type Tab = 'church' | 'preferences' | 'catalogs' | 'fees';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent {
  private readonly context = inject(TenantContextService);
  private readonly service = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    this.destroyRef.onDestroy(() => this.clearLogoPreview());
  }
  private request = 0;
  protected readonly tenant = this.context.current;
  protected readonly tab = signal<Tab>('church');
  protected readonly formatCnpj = formatCnpj;
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly cancellationFormOpen = signal(false);
  protected cancellationReason = '';
  protected readonly lightLogoPreview = signal<string | null>(null);
  protected readonly darkLogoPreview = signal<string | null>(null);
  protected readonly logoStates = signal<Record<LogoTheme, 'loading' | 'missing' | 'ready' | 'error'>>({
    LIGHT: 'loading', DARK: 'loading',
  });
  private readonly logoRequests: Record<LogoTheme, number> = { LIGHT: 0, DARK: 0 };
  protected readonly catalogKind = signal<CatalogKind>('member-types');
  protected readonly catalogs = signal<Record<CatalogKind, CatalogItem[]>>({
    'member-types': [], 'contribution-types': [], 'payment-methods': [], 'expense-categories': [],
  });
  protected readonly showInactive = signal(false);
  protected readonly editing = signal<CatalogItem | null>(null);
  protected readonly catalogFormOpen = signal(false);
  protected catalogDraft: CatalogPayload = { description: '', active: true };
  protected church: ChurchSettings = { name: '', document: null, timezone: '' };
  protected preferences: Preferences = {
    weekStartsOn: 0, allowFutureDates: false, payableWindowDays: 0, payableAlertDays: 0,
    attachmentMaxMb: 1, attachmentMaxFiles: 1, requireMfaRoles: [], cascadeReopen: false,
  };
  protected fees: FeeRule[] = [];
  protected readonly kinds: { value: CatalogKind; label: string }[] = [
    { value: 'member-types', label: 'Tipos de membro' },
    { value: 'contribution-types', label: 'Tipos de contribuição' },
    { value: 'payment-methods', label: 'Meios de pagamento' },
    { value: 'expense-categories', label: 'Categorias de despesa' },
  ];
  protected readonly categories = [
    { value: 'TITHE', label: 'Dízimo' }, { value: 'OFFERING', label: 'Oferta' },
    { value: 'CONSTRUCTION_OFFERING', label: 'Oferta de construção' },
    { value: 'MISSIONS', label: 'Missões' }, { value: 'INCOME', label: 'Rendimento' },
    { value: 'OTHER', label: 'Outro' },
  ];
  protected readonly paymentKinds = [
    { value: 'CASH', label: 'Espécie' }, { value: 'PIX', label: 'Pix' },
    { value: 'CARD', label: 'Cartão' }, { value: 'TRANSFER', label: 'Transferência' },
    { value: 'CHECK', label: 'Cheque' }, { value: 'OTHER', label: 'Outro' },
  ];

  private readonly tenantEffect = effect(() => {
    const tenant = this.tenant();
    untracked(() => {
      this.request++;
      this.failed.set(false);
      this.saving.set(false);
      this.catalogFormOpen.set(false);
      this.church = { name: '', document: null, timezone: '' };
      this.fees = [];
      this.catalogs.set({ 'member-types': [], 'contribution-types': [], 'payment-methods': [], 'expense-categories': [] });
      this.clearLogoPreview();
      if (tenant) {
        void this.load();
        void this.loadLogo();
      }
    });
  });

  private lightLogoObjectUrl: string | null = null;
  private darkLogoObjectUrl: string | null = null;

  protected async load(): Promise<void> {
    const tenant = this.tenant();
    if (!tenant) return;
    const request = ++this.request;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [church, preferences, fees, ...catalogs] = await Promise.all([
        this.service.getChurch(tenant.accessToken, tenant.membership.tenantId),
        this.service.getPreferences(tenant.accessToken, tenant.membership.tenantId),
        this.service.getFees(tenant.accessToken, tenant.membership.tenantId),
        ...this.kinds.map(({ value }) => this.service.listCatalog(tenant.accessToken, tenant.membership.tenantId, value)),
      ]);
      if (!this.isCurrent(tenant, request)) return;
      this.church = { ...church, document: formatCnpj(church.document) };
      this.preferences = preferences;
      this.fees = fees;
      this.catalogs.set({
        'member-types': catalogs[0], 'contribution-types': catalogs[1],
        'payment-methods': catalogs[2], 'expense-categories': catalogs[3],
      });
    } catch {
      if (this.isCurrent(tenant, request)) this.failed.set(true);
    } finally {
      if (this.isCurrent(tenant, request)) this.loading.set(false);
    }
  }

  protected async saveChurch(): Promise<void> {
    await this.perform('Dados da igreja atualizados.', async (token, tenantId, current) => {
      const result = await this.service.saveChurch(token, tenantId, {
        name: this.church.name, document: cnpjDigits(this.church.document),
      });
      if (current()) this.church = result;
    });
  }

  protected async savePreferences(): Promise<void> {
    await this.perform('Preferências atualizadas.', async (token, tenantId, current) => {
      const result = await this.service.savePreferences(token, tenantId, this.preferences);
      if (current()) this.preferences = result;
    });
  }

  protected hasMfaRole(role: string): boolean {
    return this.preferences.requireMfaRoles.includes(role);
  }

  protected setMfaRole(role: string, checked: boolean): void {
    this.preferences.requireMfaRoles = checked
      ? [...this.preferences.requireMfaRoles.filter((value) => value !== role), role]
      : this.preferences.requireMfaRoles.filter((value) => value !== role);
  }

  protected async uploadLogo(event: Event, theme: LogoTheme): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_097_152 || !file.size) {
      this.toast.error('Selecione uma imagem PNG, JPEG ou WebP de até 2 MB.');
      return;
    }
    await this.perform('Logo atualizada.', async (token, tenantId, current) => {
      await this.service.uploadLogo(token, tenantId, file, theme);
      if (current()) {
        this.context.invalidateLogo(tenantId, theme);
        this.context.cacheLogo(tenantId, theme, file);
        this.logoRequests[theme]++;
        if (typeof URL.createObjectURL === 'function') this.setLogoPreview(URL.createObjectURL(file), theme);
        this.logoStates.update((states) => ({ ...states, [theme]: 'ready' }));
        this.context.logoVersion.update((version) => version + 1);
      }
    });
  }

  protected changeCatalog(kind: CatalogKind): void {
    this.catalogKind.set(kind);
    this.catalogFormOpen.set(false);
  }

  protected editCatalog(item?: CatalogItem): void {
    this.editing.set(item ?? null);
    const kind = this.catalogKind();
    this.catalogDraft = kind === 'contribution-types'
      ? { description: item?.description ?? '', active: item?.active ?? true, category: item?.category ?? 'TITHE',
          requiresMember: item?.requiresMember ?? true, countsForFees: item?.countsForFees ?? false,
          countsAsContributor: item?.countsAsContributor ?? false }
      : kind === 'payment-methods'
        ? { description: item?.description ?? '', active: item?.active ?? true, kind: item?.kind ?? 'CASH' }
        : { description: item?.description ?? '', active: item?.active ?? true };
    this.catalogFormOpen.set(true);
  }

  protected async saveCatalog(): Promise<void> {
    const item = this.editing();
    const kind = this.catalogKind();
    const draft = { ...this.catalogDraft, description: this.catalogDraft.description.trim() };
    if (!draft.description) {
      this.toast.error('Informe a descrição do item.');
      return;
    }
    const changed = item && item.usageCount > 0 &&
      (['category', 'kind', 'requiresMember', 'countsForFees', 'countsAsContributor'] as const)
        .some((key) => draft[key] !== undefined && draft[key] !== item[key]);
    if (changed && !window.confirm('Esta classificação já foi utilizada e pode alterar cálculos históricos. Confirmar?')) return;
    await this.perform('Catálogo atualizado.', async (token, tenantId, current) => {
      const result = item
        ? await this.service.updateCatalog(token, tenantId, kind, item.id, draft, !!changed)
        : await this.service.createCatalog(token, tenantId, kind, draft);
      if (!current()) return;
      this.catalogs.update((all) => ({ ...all, [kind]: item
        ? all[kind].map((current) => current.id === item.id ? result : current)
        : [...all[kind], result] }));
      this.catalogFormOpen.set(false);
    });
  }

  protected async deleteCatalog(item: CatalogItem): Promise<void> {
    if (!window.confirm(`Excluir "${item.description}"?`)) return;
    const kind = this.catalogKind();
    await this.perform('Item excluído.', async (token, tenantId, current) => {
      await this.service.deleteCatalog(token, tenantId, kind, item.id);
      if (current()) {
        this.catalogs.update((all) => ({ ...all, [kind]: all[kind].filter((current) => current.id !== item.id) }));
      }
    });
  }

  protected addFee(): void {
    this.fees = [...this.fees, { name: '', percent: '0', rounding: 'HALF_UP_2', active: true, sortOrder: this.fees.length }];
  }

  protected removeFee(index: number): void {
    if (window.confirm('Remover esta regra de taxa? A alteração será aplicada ao salvar.')) {
      this.fees = this.fees.filter((_, position) => position !== index);
    }
  }

  protected async saveFees(): Promise<void> {
    const rules = this.fees.map((rule) => ({ ...rule, name: rule.name.trim(), percent: String(rule.percent) }));
    if (rules.some((rule) => !rule.name || !/^\d{1,3}(\.\d{1,2})?$/.test(rule.percent)) ||
        new Set(rules.map((rule) => rule.name)).size !== rules.length) {
      this.toast.error('Confira os nomes e percentuais das regras.');
      return;
    }
    await this.perform('Regras de taxas atualizadas.', async (token, tenantId, current) => {
      const result = await this.service.saveFees(token, tenantId, rules);
      if (current()) this.fees = result;
    });
  }

  protected async requestCancellation(): Promise<void> {
    const reason = this.cancellationReason.trim();
    if (reason.length < 5) {
      this.toast.error('Informe o motivo com pelo menos 5 caracteres.');
      return;
    }
    await this.perform('Solicitação de cancelamento registrada.', async (token, tenantId, current) => {
      await this.service.requestCancellation(token, tenantId, reason);
      if (current()) {
        this.cancellationReason = '';
        this.cancellationFormOpen.set(false);
      }
    });
  }

  private isCurrent(tenant: NonNullable<ReturnType<typeof this.tenant>>, request: number): boolean {
    return !this.destroyRef.destroyed && this.tenant() === tenant && this.request === request;
  }

  protected async loadLogo(): Promise<void> {
    const tenant = this.tenant();
    if (!tenant) return;
    await Promise.all((['LIGHT', 'DARK'] as const).map(async (theme) => {
      const request = ++this.logoRequests[theme];
      this.logoStates.update((states) => ({ ...states, [theme]: 'loading' }));
      const cached = this.context.getCachedLogo(tenant.membership.tenantId, theme);
      if (cached) {
        if (typeof URL.createObjectURL === 'function') {
          this.setLogoPreview(URL.createObjectURL(cached), theme);
        }
        this.logoStates.update((states) => ({ ...states, [theme]: 'ready' }));
        return;
      }
      if (theme === 'DARK') {
        const light = this.context.getCachedLogo(tenant.membership.tenantId, 'LIGHT');
        if (light) {
          if (typeof URL.createObjectURL === 'function') {
            this.setLogoPreview(URL.createObjectURL(light), 'DARK');
          }
          this.logoStates.update((states) => ({ ...states, [theme]: 'missing' }));
          return;
        }
      }
      try {
        const logo = await this.service.getLogo(tenant.accessToken, tenant.membership.tenantId, theme, false);
        if (this.destroyRef.destroyed || this.tenant() !== tenant || request !== this.logoRequests[theme]) return;
        if (typeof URL.createObjectURL === 'function') {
          this.setLogoPreview(URL.createObjectURL(logo), theme);
        }
        this.logoStates.update((states) => ({ ...states, [theme]: 'ready' }));
      } catch (error) {
        if (this.destroyRef.destroyed || this.tenant() !== tenant || request !== this.logoRequests[theme]) return;
        const missing = error instanceof HttpErrorResponse && error.status === 404;
        this.logoStates.update((states) => ({ ...states, [theme]: missing ? 'missing' : 'error' }));
        if (!missing) this.toast.error(`Não foi possível carregar a logo do modo ${theme === 'LIGHT' ? 'claro' : 'escuro'}.`);
      }
    }));
  }

  private setLogoPreview(url: string, theme: LogoTheme): void {
    if (theme === 'LIGHT') {
      if (this.lightLogoObjectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(this.lightLogoObjectUrl);
      this.lightLogoObjectUrl = url;
      this.lightLogoPreview.set(url);
    } else {
      if (this.darkLogoObjectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(this.darkLogoObjectUrl);
      this.darkLogoObjectUrl = url;
      this.darkLogoPreview.set(url);
    }
  }

  private clearLogoPreview(): void {
    this.logoRequests.LIGHT++;
    this.logoRequests.DARK++;
    if (this.lightLogoObjectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(this.lightLogoObjectUrl);
    if (this.darkLogoObjectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(this.darkLogoObjectUrl);
    this.lightLogoObjectUrl = null;
    this.darkLogoObjectUrl = null;
    this.lightLogoPreview.set(null);
    this.darkLogoPreview.set(null);
    this.logoStates.set({ LIGHT: 'loading', DARK: 'loading' });
  }

  private async perform(message: string, action: (token: string, tenantId: string, current: () => boolean) => Promise<void>): Promise<void> {
    const tenant = this.tenant();
    if (!tenant || this.saving()) return;
    this.saving.set(true);
    try {
      await action(tenant.accessToken, tenant.membership.tenantId, () => !this.destroyRef.destroyed && this.tenant() === tenant);
      if (!this.destroyRef.destroyed && this.tenant() === tenant) this.toast.success(message);
    } catch (error) {
      if (!this.destroyRef.destroyed && this.tenant() === tenant) {
        const detail = error instanceof HttpErrorResponse && typeof error.error?.detail === 'string'
          ? error.error.detail : 'Não foi possível salvar. Tente novamente.';
        this.toast.error(detail);
      }
    } finally {
      if (!this.destroyRef.destroyed && this.tenant() === tenant) this.saving.set(false);
    }
  }
}
