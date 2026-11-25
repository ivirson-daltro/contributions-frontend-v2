import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { TenantContextService } from '../../../../core/tenant/services/tenant-context.service';
import { ToastService } from '../../../../core/ui/toast.service';
import { SettingsService } from '../../services/settings.service';
import { SettingsPageComponent } from './settings-page.component';

describe('SettingsPageComponent', () => {
  const church = { name: 'Igreja Central', document: null, timezone: 'America/Sao_Paulo' };
  const preferences = { weekStartsOn: 0, allowFutureDates: false, payableWindowDays: 7, payableAlertDays: 3,
    attachmentMaxMb: 5, attachmentMaxFiles: 3, requireMfaRoles: [], cascadeReopen: false };
  const service = {
    getChurch: vi.fn(), getPreferences: vi.fn(), getFees: vi.fn(), getLogo: vi.fn(), listCatalog: vi.fn(),
    saveChurch: vi.fn(), savePreferences: vi.fn(), uploadLogo: vi.fn(), updateCatalog: vi.fn(),
    createCatalog: vi.fn(), deleteCatalog: vi.fn(), saveFees: vi.fn(), requestCancellation: vi.fn(),
  };
  const toast = { success: vi.fn(), error: vi.fn() };
  let fixture: ComponentFixture<SettingsPageComponent>;
  let element: HTMLElement;

  function click(text: string): void {
    const button = [...element.querySelectorAll('button')].find((item) => item.textContent?.trim() === text);
    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    service.getChurch.mockReset().mockResolvedValue(church);
    service.getPreferences.mockReset().mockResolvedValue(structuredClone(preferences));
    service.getFees.mockReset().mockResolvedValue([]);
    service.getLogo.mockReset().mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    service.listCatalog.mockReset().mockResolvedValue([]);
    service.saveChurch.mockReset().mockResolvedValue(church);
    service.uploadLogo.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [{ provide: SettingsService, useValue: service }, { provide: ToastService, useValue: toast }],
    });
    TestBed.inject(TenantContextService).current.set({
      accessToken: 'token', userId: 'user',
      membership: { tenantId: 'tenant', slug: 'igreja', name: 'Igreja', status: 'ACTIVE', roles: ['TENANT_ADMIN'] },
    });
    fixture = TestBed.createComponent(SettingsPageComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector('[name="name"]')).not.toBeNull();
    });
  });

  it('loads settings and submits church data with tenant context', async () => {
    expect(service.listCatalog).toHaveBeenCalledTimes(4);
    expect(element.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe(church.name);
    expect(element.querySelector('[name="timezone"]')).toBeNull();
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(service.saveChurch).toHaveBeenCalledWith('token', 'tenant', { name: church.name, document: church.document });
    expect(toast.success).toHaveBeenCalled();
  });

  it('uploads a valid logo and refreshes the layout; rejects invalid files', async () => {
    const input = element.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['bad'], 'bad.txt', { type: 'text/plain' })] });
    input.dispatchEvent(new Event('change'));
    expect(service.uploadLogo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    const file = new File(['image'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(service.uploadLogo).toHaveBeenCalledWith('token', 'tenant', file, 'LIGHT');
    expect(TestBed.inject(TenantContextService).logoVersion()).toBe(1);
  });

  it('distinguishes both logos and does not let an old preview overwrite an upload', async () => {
    let resolveOld!: (value: Blob) => void;
    service.getLogo.mockImplementation((_token, _tenant, theme) => theme === 'LIGHT'
      ? new Promise<Blob>((resolve) => { resolveOld = resolve; })
      : Promise.reject(new HttpErrorResponse({ status: 404 })));
    const oldCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const oldRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const create = vi.fn().mockReturnValueOnce('blob:light').mockReturnValueOnce('blob:dark');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    try {
      const context = TestBed.inject(TenantContextService);
      context.current.set({ ...context.current()! });
      fixture.detectChanges();
      await vi.waitFor(() => expect(resolveOld).toBeDefined());
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(element.textContent).toContain('Sem logo escura: a logo clara será usada.');
      });
      expect(service.getLogo).toHaveBeenCalledWith('token', 'tenant', 'DARK', false);
      const [light, dark] = element.querySelectorAll<HTMLInputElement>('input[type=file]');
      const lightFile = new File(['light'], 'light.png', { type: 'image/png' });
      Object.defineProperty(light, 'files', { configurable: true, value: [lightFile] });
      light.dispatchEvent(new Event('change'));
      await vi.waitFor(() => expect(service.uploadLogo).toHaveBeenCalledWith('token', 'tenant', lightFile, 'LIGHT'));
      await fixture.whenStable();
      resolveOld(new Blob(['old']));
      await Promise.resolve();
      fixture.detectChanges();
      expect(element.querySelector('img[alt="Prévia da logo clara no modo escuro"]')?.getAttribute('src')).toBe('blob:light');
      expect(create).toHaveBeenCalledTimes(1);
      const darkFile = new File(['dark'], 'dark.png', { type: 'image/png' });
      Object.defineProperty(dark, 'files', { configurable: true, value: [darkFile] });
      dark.dispatchEvent(new Event('change'));
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(element.querySelector('img[alt="Prévia da logo no modo escuro"]')?.getAttribute('src')).toBe('blob:dark');
      });
      expect(service.uploadLogo).toHaveBeenCalledWith('token', 'tenant', darkFile, 'DARK');
      expect(element.textContent).not.toContain('Sem logo escura: a logo clara será usada.');
    } finally {
      fixture.destroy();
      if (oldCreate) Object.defineProperty(URL, 'createObjectURL', oldCreate);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (oldRevoke) Object.defineProperty(URL, 'revokeObjectURL', oldRevoke);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('requires confirmation before changing classification of a used catalog item', async () => {
    const item = { id: 'item', description: 'Pix', active: true, kind: 'PIX', usageCount: 2 };
    service.listCatalog.mockImplementation((_token, _tenant, kind) => Promise.resolve(kind === 'payment-methods' ? [item] : []));
    TestBed.inject(TenantContextService).logoVersion.update((version) => version + 1);
    const context = TestBed.inject(TenantContextService);
    context.current.set({ ...context.current()! });
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector('[name="name"]')).not.toBeNull();
    });
    click('Catálogos');
    const select = element.querySelector<HTMLSelectElement>('.catalog-toolbar select')!;
    select.value = 'payment-methods';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    click('Editar');
    await fixture.whenStable();
    fixture.detectChanges();
    const kind = element.querySelector<HTMLSelectElement>('[name="kind"]')!;
    kind.value = 'CASH';
    kind.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    element.querySelector<HTMLFormElement>('.editor')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(confirm).toHaveBeenCalled();
    expect(service.updateCatalog).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('discards an old church response after switching tenants', async () => {
    let resolveOld!: (value: typeof church) => void;
    service.getChurch.mockImplementation((_token, tenant) => tenant === 'old'
      ? new Promise<typeof church>((resolve) => { resolveOld = resolve; })
      : Promise.resolve({ ...church, name: 'Outra igreja' }));
    const context = TestBed.inject(TenantContextService);
    const original = context.current()!;
    context.current.set({ ...original, membership: { ...original.membership, tenantId: 'old' } });
    fixture.detectChanges();
    await vi.waitFor(() => expect(resolveOld).toBeDefined());
    context.current.set({ ...original, membership: { ...original.membership, tenantId: 'new' } });
    fixture.detectChanges();
    resolveOld({ ...church, name: 'Antiga' });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe('Outra igreja');
    });
  });
});
