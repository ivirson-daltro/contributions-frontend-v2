import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { TenantContextService } from '../../../../core/tenant/services/tenant-context.service';
import { canManageAllMemberFields } from '../../../../core/tenant/tenant-access';
import { canManageMembers } from '../../../../core/tenant/tenant-access';
import { ToastService } from '../../../../core/ui/toast.service';
import { ContributorList, Member, MemberList, MemberPayload, MemberStatus, MemberStatusFilter, MemberSummary, MemberType } from '../../dtos/member.dto';
import { MembersService } from '../../services/members.service';
import { MemberFormComponent, MemberFormSubmission } from '../member-form/member-form.component';
import { MemberSelectComponent } from '../../../../shared/components/member-select/member-select.component';
import { MemberLookup } from '../../../../shared/dtos/member-lookup.dto';
import { formatPhoneMask } from '../../../../shared/utils/phone-mask';
import { DataPaginationComponent } from '../../../../shared/components/data-pagination/data-pagination.component';

type MembersView = 'list' | 'detail' | 'create' | 'edit';
type MembersTab = 'members' | 'contributors';

@Component({
  selector: 'app-members-page',
  imports: [DatePipe, ReactiveFormsModule, MemberFormComponent, MemberSelectComponent, DataPaginationComponent],
  templateUrl: './members-page.component.html',
  styleUrl: './members-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPageComponent implements OnInit {
  private readonly memberForm = viewChild.required(MemberFormComponent);
  private readonly detailDialog = viewChild<ElementRef<HTMLDialogElement>>('memberDetailDialog');
  private readonly context = inject(TenantContextService);
  private readonly service = inject(MembersService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private listRequest = 0;
  private pendingCreate: MemberPayload | null = null;
  private membersRequest: Promise<MemberLookup[]> | null = null;
  protected readonly loadMembers = (): Promise<MemberLookup[]> => {
    const tenant = this.tenant();
    if (!tenant) return Promise.resolve([]);
    if (!this.membersRequest) {
      this.membersRequest = this.service.listAll(
        tenant.accessToken,
        tenant.membership.tenantId,
      ).catch((error: unknown) => {
        this.membersRequest = null;
        throw error;
      });
    }
    return this.membersRequest;
  };

  protected readonly tenant = this.context.current;
  protected readonly fullAccess = computed(() => canManageAllMemberFields(this.tenant()?.membership.roles ?? []));
  protected readonly view = signal<MembersView>('list');
  protected readonly tab = signal<MembersTab>('members');
  protected readonly contributorList = signal<ContributorList | null>(null);
  protected readonly contributorLoading = signal(false);
  protected readonly contributorError = signal(false);
  protected readonly contributorReportLoading = signal(false);
  protected readonly contributorYear = signal(new Date().getFullYear());
  protected readonly contributorPage = signal(1);
  protected readonly contributorPageSize = signal(20);
  protected readonly contributorPageCount = computed(() => Math.max(1, Math.ceil((this.contributorList()?.meta.total ?? 0) / this.contributorPageSize())));
  protected readonly contributorSearch = new FormControl('', { nonNullable: true });
  protected readonly monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  protected readonly list = signal<MemberList | null>(null);
  protected readonly types = signal<MemberType[]>([]);
  protected readonly selected = signal<Member | null>(null);
  protected readonly loading = signal(false);
  protected readonly catalogsLoading = signal(false);
  protected readonly catalogError = signal(false);
  protected readonly listError = signal(false);
  protected readonly opening = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly duplicates = signal<readonly string[] | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(8);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil((this.list()?.meta.total ?? 0) / this.pageSize())));
  protected readonly firstItem = computed(() => (this.list()?.meta.total ?? 0) === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1);
  protected readonly lastItem = computed(() => Math.min(this.page() * this.pageSize(), this.list()?.meta.total ?? 0));
  protected readonly canEditSelected = computed(() => {
    const member = this.selected();
    const tenant = this.tenant();
    return !!member && !!tenant && (this.fullAccess() || member.createdBy === tenant.userId);
  });
  protected readonly statusLabels: Record<MemberStatus, string> = {
    ACTIVE: 'Ativo', INACTIVE: 'Inativo', TRANSFERRED: 'Transferido', DECEASED: 'Falecido',
  };
  protected readonly formatPhone = formatPhoneMask;
  protected readonly filters = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    memberTypeId: new FormControl('', { nonNullable: true }),
    status: new FormControl<MemberStatusFilter>('ACTIVE', { nonNullable: true }),
  });
  private readonly tenantEffect = effect(() => {
    const tenant = this.tenant();
    if (!tenant) return;
    untracked(() => {
      this.listRequest++;
      this.list.set(null);
      this.types.set([]);
      this.selected.set(null);
      this.view.set('list');
      this.page.set(1);
      this.opening.set(false);
      this.saving.set(false);
      this.confirmingDelete.set(false);
      this.pendingCreate = null;
      this.duplicates.set(null);
      this.membersRequest = null;
      this.tab.set('members');
      this.contributorList.set(null);
      this.contributorSearch.setValue('', { emitEvent: false });
      this.contributorYear.set(new Date().getFullYear());
      this.contributorPage.set(1);
      this.filters.reset({ q: '', memberTypeId: '', status: 'ACTIVE' }, { emitEvent: false });
      void this.loadTypes();
      void this.loadList();
    });
  });

  ngOnInit(): void {
    this.filters.valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.page.set(1);
      void this.loadList();
    });
  }

  protected changeTab(tab: MembersTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    if (tab === 'contributors') void this.loadContributors();
  }

  protected applyContributorFilters(): void {
    this.contributorPage.set(1);
    void this.loadContributors();
  }

  protected clearContributorFilters(): void {
    this.contributorSearch.setValue('');
    this.contributorYear.set(new Date().getFullYear());
    this.contributorPage.set(1);
    void this.loadContributors();
  }

  protected async loadContributors(): Promise<void> {
    const tenant = this.tenant();
    if (!tenant) return;
    this.contributorLoading.set(true);
    this.contributorError.set(false);
    try {
      const result = await this.service.contributors(tenant.accessToken, tenant.membership.tenantId, {
        year: this.contributorYear(),
        q: this.contributorSearch.value.trim(),
        page: this.contributorPage(),
        pageSize: this.contributorPageSize(),
        sort: 'name',
        order: 'asc',
      });
      if (this.tenant() !== tenant) return;
      this.contributorList.set(result);
    } catch {
      if (this.tenant() !== tenant) return;
      this.contributorList.set(null);
      this.contributorError.set(true);
      this.toast.error('Não foi possível carregar os contribuintes.');
    } finally {
      if (this.tenant() === tenant) this.contributorLoading.set(false);
    }
  }

  protected changeContributorYear(year: string): void {
    const parsed = Number(year);
    if (!/^\d{4}$/.test(year) || parsed < 1 || parsed > 9998) return;
    this.contributorYear.set(parsed);
    this.contributorPage.set(1);
  }

  protected changeContributorPageSize(value: number): void {
    if (![8, 20, 50].includes(value)) return;
    this.contributorPageSize.set(value);
    this.contributorPage.set(1);
    void this.loadContributors();
  }

  protected changeContributorPage(page: number): void {
    if (page < 1 || page > this.contributorPageCount() || this.contributorLoading()) return;
    this.contributorPage.set(page);
    void this.loadContributors();
  }

  protected async downloadContributorReport(): Promise<void> {
    const tenant = this.tenant();
    if (!tenant || this.contributorReportLoading()) return;
    this.contributorReportLoading.set(true);
    try {
      const pdf = await this.service.contributorsReport(tenant.accessToken, tenant.membership.tenantId, {
        year: this.contributorYear(),
        q: this.contributorSearch.value.trim(),
        sort: 'name',
        order: 'asc',
      });
      if (this.tenant() !== tenant) return;
      if (!pdf.size || !pdf.type.toLowerCase().startsWith('application/pdf')) {
        throw new Error('Resposta do relatório não é um PDF válido.');
      }
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      try {
        link.href = url;
        link.download = `contribuintes-${this.contributorYear()}.pdf`;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      this.toast.success('Relatório gerado.');
    } catch {
      if (this.tenant() === tenant) this.toast.error('Não foi possível gerar o relatório anual.');
    } finally {
      if (this.tenant() === tenant) this.contributorReportLoading.set(false);
    }
  }

  protected async loadTypes(): Promise<void> {
    const tenant = this.tenant();
    if (!tenant) return;
    this.catalogsLoading.set(true);
    this.catalogError.set(false);
    try {
      const types = await this.service.listTypes(tenant.accessToken, tenant.membership.tenantId);
      if (this.tenant() !== tenant) return;
      this.types.set(types);
    } catch {
      if (this.tenant() !== tenant) return;
      this.catalogError.set(true);
      this.toast.error('Não foi possível carregar os tipos de membro.');
    } finally {
      if (this.tenant() === tenant) this.catalogsLoading.set(false);
    }
  }

  protected async loadList(): Promise<void> {
    const tenant = this.tenant();
    if (!tenant) return;
    const request = ++this.listRequest;
    this.loading.set(true);
    this.listError.set(false);
    const filters = this.filters.getRawValue();
    try {
      const result = await this.service.list(tenant.accessToken, tenant.membership.tenantId, {
        q: filters.q.trim(), memberTypeId: filters.memberTypeId, status: filters.status,
        page: this.page(), pageSize: this.pageSize(), sort: 'name', order: 'asc',
      });
      if (request !== this.listRequest || this.tenant() !== tenant) return;
      if (result.data.length === 0 && result.meta.total > 0 && this.page() > 1) {
        this.page.set(Math.ceil(result.meta.total / this.pageSize()));
        await this.loadList();
        return;
      }
      this.list.set(result);
    } catch {
      if (request !== this.listRequest || this.tenant() !== tenant) return;
      this.list.set(null);
      this.listError.set(true);
      this.toast.error('Não foi possível carregar os membros. Tente novamente.');
    } finally {
      if (request === this.listRequest && this.tenant() === tenant) this.loading.set(false);
    }
  }

  protected changePage(page: number): void {
    if (page < 1 || page > this.pageCount() || this.loading()) return;
    this.page.set(page);
    void this.loadList();
  }

  protected changePageSize(value: string): void {
    const size = Number(value);
    if (![8, 20, 50].includes(size)) return;
    this.pageSize.set(size);
    this.page.set(1);
    void this.loadList();
  }

  protected async openMember(item: MemberSummary): Promise<void> {
    const tenant = this.tenant();
    if (!tenant || this.opening()) return;
    this.opening.set(true);
    try {
      const member = await this.service.get(tenant.accessToken, tenant.membership.tenantId, item.id);
      if (this.tenant() !== tenant) return;
      this.selected.set(member);
      this.confirmingDelete.set(false);
      queueMicrotask(() => this.openDetailDialog());
    } catch (error) {
      if (this.tenant() !== tenant) return;
      this.toast.error(this.errorMessage(error, 'consultar'));
    } finally {
      if (this.tenant() === tenant) this.opening.set(false);
    }
  }

  protected openCreate(): void {
    if (this.catalogsLoading() || this.catalogError() || this.types().length === 0) return;
    this.selected.set(null);
    this.memberForm().open(null);
  }

  protected canEditSummary(member: MemberSummary): boolean {
    void member;
    return canManageMembers(this.tenant()?.membership.roles ?? []);
  }

  protected openEdit(): void {
    if (!this.canEditSelected() || this.catalogsLoading() || this.catalogError()) return;
    this.closeDetailDialog();
    this.memberForm().open(this.selected());
  }

  protected async openEditFromList(item: MemberSummary): Promise<void> {
    const tenant = this.tenant();
    if (!tenant) return;
    try {
      const member = await this.service.get(tenant.accessToken, tenant.membership.tenantId, item.id);
      this.selected.set(member);
      if (this.canEditSelected()) this.memberForm().open(member);
    } catch (error) {
      this.toast.error(this.errorMessage(error, 'consultar'));
    }
  }

  protected async deleteFromList(item: MemberSummary): Promise<void> {
    await this.openMember(item);
    if (this.canEditSelected()) this.confirmingDelete.set(true);
  }

  private openDetailDialog(): void {
    const dialog = this.detailDialog()?.nativeElement;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  protected closeDetailDialog(): void {
    const dialog = this.detailDialog()?.nativeElement;
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    dialog.removeAttribute('open');
    this.confirmingDelete.set(false);
    this.view.set('list');
  }

  protected closeForm(): void {
    this.pendingCreate = null;
    this.duplicates.set(null);
    this.view.set('list');
  }

  protected async saveMember(submission: MemberFormSubmission): Promise<void> {
    const tenant = this.tenant();
    if (!tenant || this.saving()) return;
    const member = this.selected();
    if (this.view() === 'edit' && (!member || !this.canEditSelected())) return;
    if (member && Object.keys(submission.changes).length === 0) {
      this.toast.warning('Nenhuma alteração para salvar.');
      return;
    }
    this.saving.set(true);
    try {
      const result = member
        ? await this.service.update(tenant.accessToken, tenant.membership.tenantId, member.id, submission.changes)
        : await this.service.create(tenant.accessToken, tenant.membership.tenantId, submission.payload);
      if (this.tenant() !== tenant) return;
      this.finishSave(result, member ? 'Membro atualizado.' : 'Membro cadastrado.');
    } catch (error) {
      if (this.tenant() !== tenant) return;
      if (!member && this.errorCode(error) === 'POSSIBLE_DUPLICATE') {
        this.pendingCreate = submission.payload;
        this.duplicates.set(this.duplicateNames(error));
      } else {
        this.toast.error(this.errorMessage(error, member ? 'atualizar' : 'cadastrar'));
      }
    } finally {
      if (this.tenant() === tenant) this.saving.set(false);
    }
  }

  protected async confirmDuplicate(): Promise<void> {
    const tenant = this.tenant();
    const payload = this.pendingCreate;
    if (!tenant || !payload || this.saving()) return;
    this.saving.set(true);
    try {
      const member = await this.service.create(tenant.accessToken, tenant.membership.tenantId, payload, true);
      if (this.tenant() !== tenant) return;
      this.finishSave(member, 'Membro cadastrado.');
    } catch (error) {
      if (this.tenant() !== tenant) return;
      this.toast.error(this.errorMessage(error, 'cadastrar'));
    } finally {
      if (this.tenant() === tenant) this.saving.set(false);
    }
  }

  protected reviewDuplicate(): void {
    this.pendingCreate = null;
    this.duplicates.set(null);
  }

  protected async deleteMember(): Promise<void> {
    const tenant = this.tenant();
    const member = this.selected();
    if (!tenant || !member || !this.canEditSelected() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.service.delete(tenant.accessToken, tenant.membership.tenantId, member.id);
      if (this.tenant() !== tenant) return;
      this.refreshMemberLookup();
      this.toast.success('Membro excluído.');
      this.selected.set(null);
      this.confirmingDelete.set(false);
      this.closeDetailDialog();
      this.view.set('list');
      await this.loadList();
    } catch (error) {
      if (this.tenant() !== tenant) return;
      this.toast.error(this.errorMessage(error, 'excluir'));
    } finally {
      if (this.tenant() === tenant) this.saving.set(false);
    }
  }

  private finishSave(member: Member, message: string): void {
    this.pendingCreate = null;
    this.duplicates.set(null);
    this.refreshMemberLookup();
    this.selected.set(member);
    this.memberForm().close();
    this.view.set('list');
    this.toast.success(message);
    void this.loadList();
  }

  private refreshMemberLookup(): void {
    const tenant = this.tenant();
    if (!tenant) {
      this.membersRequest = null;
      return;
    }
    this.membersRequest = this.service.listAll(
      tenant.accessToken,
      tenant.membership.tenantId,
    ).catch(() => {
      this.membersRequest = null;
      return [];
    });
  }

  private errorCode(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const body: unknown = error.error;
    if (typeof body !== 'object' || body === null || !('code' in body)) return null;
    return typeof body.code === 'string' ? body.code : null;
  }

  private duplicateNames(error: unknown): string[] {
    if (!(error instanceof HttpErrorResponse)) return [];
    const body: unknown = error.error;
    if (typeof body !== 'object' || body === null || !('errors' in body) || !Array.isArray(body.errors)) return [];
    return body.errors.flatMap((item: unknown) =>
      typeof item === 'object' && item !== null && 'name' in item && typeof item.name === 'string' ? [item.name] : [],
    );
  }

  private errorMessage(error: unknown, action: string): string {
    const code = this.errorCode(error);
    if (code === 'MEMBER_HAS_ACCESS') return 'Este membro possui acesso ativo e não pode ser excluído.';
    if (code === 'MEMBER_NOT_FOUND') return 'Este membro não está mais disponível. Atualize a lista.';
    if (code === 'INVALID_REFERENCE') return 'O tipo de membro é inválido ou está inativo. Atualize os tipos.';
    if (error instanceof HttpErrorResponse && error.status === 401) return 'Sua sessão expirou. Entre novamente.';
    if (error instanceof HttpErrorResponse && error.status === 403) return 'Você não tem permissão para esta ação.';
    if (error instanceof HttpErrorResponse && error.status === 423) return 'Esta igreja não permite alterações no momento.';
    return `Não foi possível ${action} o membro. Confira os dados e tente novamente.`;
  }
}
