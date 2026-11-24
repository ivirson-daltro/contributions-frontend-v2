import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TenantContextService } from '../../../../core/tenant/services/tenant-context.service';
import { ToastService } from '../../../../core/ui/toast.service';
import { Member } from '../../dtos/member.dto';
import { MembersService } from '../../services/members.service';
import { MembersPageComponent } from './members-page.component';

describe('MembersPageComponent', () => {
  const member: Member = {
    id: 'member', name: 'Ana', memberType: { id: 'type', description: 'Membro' },
    status: 'ACTIVE', phone: null, email: null, gender: null, birthDate: null,
    entryDate: null, baptismDate: null, zipCode: null, street: null, number: null,
    complement: null, neighborhood: null, city: null, state: null, consentAt: null,
    createdBy: 'other-user', createdAt: '', updatedAt: '',
  };
  const service = { list: vi.fn(), listTypes: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const toast = { error: vi.fn(), warning: vi.fn(), success: vi.fn() };
  let fixture: ComponentFixture<MembersPageComponent>;
  let element: HTMLElement;

  async function setup(roles: string[]): Promise<void> {
    const context = TestBed.inject(TenantContextService);
    context.current.set({
      accessToken: 'token', userId: 'user-id',
      membership: { tenantId: 'tenant', slug: 'igreja', name: 'Igreja', status: 'ACTIVE', roles },
    });
    fixture = TestBed.createComponent(MembersPageComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function click(text: string): void {
    const button = [...element.querySelectorAll('button')].find((item) => item.textContent?.trim().includes(text));
    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
  }

  function setValue(name: string, value: string): void {
    const control = element.querySelector<HTMLInputElement | HTMLSelectElement>(`[formControlName="${name}"]`)!;
    control.value = value;
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    fixture.detectChanges();
  }

  async function openMember(): Promise<void> {
    element.querySelector<HTMLButtonElement>('[aria-label="Ver detalhes de Ana"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    service.list.mockReset().mockResolvedValue({ data: [member], meta: { page: 1, pageSize: 8, total: 9 } });
    service.listTypes.mockReset().mockResolvedValue([{ id: 'type', description: 'Membro' }]);
    service.get.mockReset().mockResolvedValue(member);
    service.create.mockReset();
    service.delete.mockReset();
    TestBed.configureTestingModule({
      imports: [MembersPageComponent],
      providers: [{ provide: MembersService, useValue: service }, { provide: ToastService, useValue: toast }],
    });
  });

  it('loads the list, paginates and applies a debounced name filter', async () => {
    await setup(['TENANT_ADMIN']);
    expect(element.textContent).toContain('Ana');
    element.querySelector<HTMLButtonElement>('[aria-label="Próxima página"]')!.click();
    await fixture.whenStable();
    expect(service.list).toHaveBeenLastCalledWith('token', 'tenant', expect.objectContaining({ page: 2 }));
    setValue('q', ' Maria ');
    await vi.waitFor(() => expect(service.list).toHaveBeenLastCalledWith(
      'token', 'tenant', expect.objectContaining({ q: 'Maria', page: 1 }),
    ));
  });

  it('permits a treasurer to change only records they created', async () => {
    await setup(['TREASURER']);
    await openMember();
    expect(element.textContent).toContain('apenas os membros que cadastrou');
    expect([...element.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Editar')).toBe(false);
    click('Voltar');
    service.get.mockResolvedValue({ ...member, createdBy: 'user-id' });
    await openMember();
    expect(element.textContent).toContain('Editar');
    expect(element.textContent).toContain('Excluir');
  });

  it('discards an old member response when changing churches', async () => {
    let resolveMember!: (value: Member) => void;
    service.get.mockReturnValue(new Promise<Member>((resolve) => { resolveMember = resolve; }));
    await setup(['SECRETARY']);
    element.querySelector<HTMLButtonElement>('[aria-label="Ver detalhes de Ana"]')!.click();
    const context = TestBed.inject(TenantContextService);
    const current = context.current()!;
    context.current.set({ ...current, membership: { ...current.membership, tenantId: 'other-tenant', slug: 'outra' } });
    fixture.detectChanges();
    await fixture.whenStable();
    resolveMember(member);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.list).toHaveBeenLastCalledWith('token', 'other-tenant', expect.anything());
    expect(element.textContent).toContain('Todos os membros');
    expect(element.textContent).not.toContain('Dados e vínculo com a igreja');
  });

  it('gives full access when a treasurer also has the secretary role and reports delete conflicts', async () => {
    service.delete.mockRejectedValue(new HttpErrorResponse({ status: 409, error: { code: 'MEMBER_HAS_ACCESS' } }));
    await setup(['TREASURER', 'SECRETARY']);
    await openMember();
    click('Excluir');
    expect(service.delete).not.toHaveBeenCalled();
    click('Confirmar exclusão');
    await fixture.whenStable();
    expect(service.delete).toHaveBeenCalledWith('token', 'tenant', 'member');
    expect(toast.error).toHaveBeenCalledWith('Este membro possui acesso ativo e não pode ser excluído.');
  });

  it('refreshes the list after confirmed deletion', async () => {
    service.delete.mockResolvedValue({ id: 'member' });
    await setup(['TENANT_ADMIN']);
    await openMember();
    click('Excluir');
    click('Confirmar exclusão');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('Membro excluído.');
    expect(element.textContent).toContain('Todos os membros');
  });

  it('requires explicit confirmation before forcing a duplicate create', async () => {
    service.create.mockRejectedValueOnce(new HttpErrorResponse({
      status: 409, error: { code: 'POSSIBLE_DUPLICATE', errors: [{ id: 'other', name: 'Ana existente' }] },
    })).mockResolvedValueOnce(member);
    await setup(['SECRETARY']);
    click('Novo membro');
    setValue('name', 'Ana');
    setValue('memberTypeId', 'type');
    setValue('email', 'ana@example.com');
    click('Continuar para endereço');
    click('Continuar para igreja');
    click('Salvar membro');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Ana existente');
    expect(element.querySelector<HTMLFieldSetElement>('fieldset.form-layout')?.disabled).toBe(true);
    click('Cadastrar mesmo assim');
    await fixture.whenStable();
    expect(service.create).toHaveBeenCalledTimes(2);
    expect(service.create).toHaveBeenLastCalledWith('token', 'tenant', expect.objectContaining({ name: 'Ana' }), true);
  });
});
