import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ContributionsService } from '../../services/contributions.service';
import { ContributionsComponent } from './contributions.component';

describe('ContributionsComponent', () => {
  const service = {
    list: vi.fn(),
    listTypes: vi.fn(),
    listMethods: vi.fn(),
    lookupMembers: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    void: vi.fn(),
    report: vi.fn(),
  };
  const response = {
    data: [
      {
        id: '1',
        occurredOn: '2026-11-12',
        amount: '850.00',
        member: { id: 'member', name: 'Ana' },
        type: { id: 'type', description: 'Dízimo', category: 'TITHE' },
        method: { id: 'method', description: 'Pix', kind: 'PIX' },
        observation: null,
        status: 'ACTIVE',
        attachmentsCount: 0,
        version: 1,
      },
    ],
    meta: { page: 1, pageSize: 20, total: 25, totals: { amount: '1000.00', count: 25 } },
  };

  beforeEach(async () => {
    service.list.mockReset().mockResolvedValue(response);
    service.listTypes
      .mockReset()
      .mockResolvedValue([
        { id: 'type', description: 'Dízimo', category: 'TITHE', requiresMember: true },
      ]);
    service.listMethods
      .mockReset()
      .mockResolvedValue([{ id: 'method', description: 'Pix', kind: 'PIX' }]);
    service.lookupMembers.mockReset().mockResolvedValue([]);
    service.create.mockReset();
    service.update.mockReset();
    service.void.mockReset();
    service.report.mockReset();
    await TestBed.configureTestingModule({
      imports: [ContributionsComponent],
      providers: [{ provide: ContributionsService, useValue: service }],
    }).compileComponents();
  });

  async function createComponent() {
    const fixture = TestBed.createComponent(ContributionsComponent);
    fixture.componentRef.setInput('accessToken', 'token');
    fixture.componentRef.setInput('tenantId', 'tenant');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows a decorative PDF icon on the report button', async () => {
    const fixture = await createComponent();
    const button = (fixture.nativeElement as HTMLElement).querySelector('.report-button')!;
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('use')?.getAttribute('href')).toBe('icons/pdf.svg#pdf');
    expect(button.textContent).toContain('Gerar relatório');
  });

  it('shows a decorative plus icon on the new contribution button', async () => {
    const fixture = await createComponent();
    const button = (fixture.nativeElement as HTMLElement).querySelector('.new-contribution-button')!;
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('use')?.getAttribute('href')).toBe('icons/plus.svg#plus');
    expect(button.textContent).toContain('Nova contribuição');
  });

  it('shows server totals and applies filters on the server', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.contributions-totals')?.textContent).toContain('25');
    expect(element.querySelector('.contributions-totals')?.textContent).toContain('1.000,00');
    expect(element.querySelector('tbody')?.textContent).toContain('Ana');
    const search = element.querySelector<HTMLInputElement>('input[formControlName="q"]')!;
    search.value = 'Ana';
    search.dispatchEvent(new Event('input'));
    element
      .querySelector<HTMLFormElement>('.contributions-filters')!
      .dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(service.list).toHaveBeenLastCalledWith(
      'token',
      'tenant',
      expect.objectContaining({ q: 'Ana', status: 'ACTIVE', page: 1 }),
    );
  });

  it('shows icon-only actions with accessible names', async () => {
    const fixture = await createComponent();
    const actions = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.contribution-row-actions button');
    expect(actions).toHaveLength(2);
    expect(actions[0].getAttribute('aria-label')).toContain('Editar contribuição');
    expect(actions[1].getAttribute('aria-label')).toContain('Excluir contribuição');
    expect(actions[0].querySelector('use')?.getAttribute('href')).toBe('icons/edit.svg#edit');
    expect(actions[1].querySelector('use')?.getAttribute('href')).toBe('icons/delete.svg#delete');
    for (const button of actions) {
      expect(button.textContent?.trim()).toBe('');
      expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('applies the date range and rejects an inverted range', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const details = element.querySelector<HTMLDetailsElement>('.date-range')!;
    const filters = fixture.componentInstance['filters'];
    filters.patchValue({ from: '2026-11-01', to: '2026-11-30' });
    details.open = true;
    fixture.detectChanges();
    expect(details.querySelector('summary')?.textContent).toContain('01/11/2026 – 30/11/2026');
    element.querySelector<HTMLFormElement>('.contributions-filters')!.dispatchEvent(new Event('submit'));
    expect(service.list).toHaveBeenLastCalledWith(
      'token',
      'tenant',
      expect.objectContaining({ from: '2026-11-01', to: '2026-11-30', page: 1 }),
    );
    expect(details.open).toBe(false);

    const calls = service.list.mock.calls.length;
    filters.patchValue({ from: '2026-12-01', to: '2026-11-30' });
    element.querySelector<HTMLFormElement>('.contributions-filters')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(details.open).toBe(true);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('data inicial');
    expect(service.list).toHaveBeenCalledTimes(calls);
  });

  it('selects and highlights a date range from the calendar', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;
    const details = element.querySelector<HTMLDetailsElement>('.date-range')!;
    component['calendarMonth'].set(new Date(2026, 10, 1));
    details.open = true;
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('[aria-label="10/11/2026"]')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('[aria-label="20/11/2026"]')!.click();
    fixture.detectChanges();

    expect(component['filters'].getRawValue()).toMatchObject({
      from: '2026-11-10',
      to: '2026-11-20',
    });
    expect(element.querySelectorAll('.calendar-day.in-range')).toHaveLength(11);
    expect(element.querySelectorAll('.calendar-day.selected')).toHaveLength(2);
    expect(element.querySelector('#contributions-period-value')?.textContent).toContain(
      '10/11/2026 – 20/11/2026',
    );
  });

  it('clears every filter, closes the range and reloads the first page', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const details = element.querySelector<HTMLDetailsElement>('.date-range')!;
    const filters = fixture.componentInstance['filters'];
    filters.patchValue({
      q: 'Ana', typeId: 'type', methodId: 'method', from: '2026-11-01',
      to: '2026-11-30',
    });
    const form = element.querySelector<HTMLFormElement>('.contributions-filters')!;
    form.dispatchEvent(new Event('submit'));
    void fixture.componentInstance['loadList'](2);
    filters.patchValue({ from: '2026-12-01' });
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('data inicial');
    details.open = true;
    const clear = Array.from(element.querySelectorAll<HTMLButtonElement>('.contributions-filters button'))
      .find((button) => button.textContent?.includes('Limpar filtros'))!;
    clear.click();
    fixture.detectChanges();

    expect(filters.getRawValue()).toEqual({
      q: '', typeId: '', methodId: '', from: '', to: '',
    });
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toContain('Todas as datas');
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(service.list).toHaveBeenLastCalledWith(
      'token',
      'tenant',
      { q: '', typeId: '', methodId: '', from: '', to: '', status: 'ACTIVE', page: 1, pageSize: 20 },
    );
  });

  it('requires an ordered report period of at most 366 inclusive days', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('.report-button')!;
    const details = element.querySelector<HTMLDetailsElement>('.date-range')!;
    const filters = fixture.componentInstance['filters'];
    button.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('datas inicial e final');
    expect(details.open).toBe(true);

    filters.patchValue({ from: '2025-01-01', to: '2024-12-31' });
    button.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('data inicial');
    filters.patchValue({ from: '2024-01-01', to: '2025-01-01' });
    button.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('366 dias');
    expect(service.report).not.toHaveBeenCalled();
  });

  it('downloads the PDF for the selected period and prevents duplicate requests', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const details = (fixture.nativeElement as HTMLElement).querySelector<HTMLDetailsElement>('.date-range')!;
    component['filters'].patchValue({ from: '2024-01-01', to: '2024-12-31', q: 'Ana' });
    let resolveReport!: (pdf: Blob) => void;
    service.report.mockReturnValue(new Promise<Blob>((resolve) => { resolveReport = resolve; }));
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:report');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('contribuicoes-2024-01-01-a-2024-12-31.pdf');
      expect(this.href).toBe('blob:report');
    });
    vi.useFakeTimers();
    try {
      const pending = component['generateReport'](details);
      await component['generateReport'](details);
      expect(service.report).toHaveBeenCalledTimes(1);
      expect(service.report).toHaveBeenCalledWith('token', 'tenant', {
        from: '2024-01-01', to: '2024-12-31',
      });
      expect(component['reportLoading']()).toBe(true);
      resolveReport(new Blob(['%PDF'], { type: 'application/pdf' }));
      await pending;
      expect(click).toHaveBeenCalledOnce();
      expect(component['reportLoading']()).toBe(false);
      vi.advanceTimersByTime(60_000);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
    } finally {
      vi.useRealTimers();
      click.mockRestore();
      if (originalCreate) URL.createObjectURL = originalCreate;
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (originalRevoke) URL.revokeObjectURL = originalRevoke;
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('shows report permission and invalid-response errors without downloading', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const details = (fixture.nativeElement as HTMLElement).querySelector<HTMLDetailsElement>('.date-range')!;
    component['filters'].patchValue({ from: '2026-11-01', to: '2026-11-30' });
    service.report.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
    await component['generateReport'](details);
    expect(component['reportError']()).toContain('permissão');
    expect(component['reportLoading']()).toBe(false);

    service.report.mockResolvedValueOnce(new Blob(['not a PDF'], { type: 'text/plain' }));
    await component['generateReport'](details);
    expect(component['reportError']()).toContain('Não foi possível gerar');
    expect(component['reportLoading']()).toBe(false);
  });

  it('requires a selected member for a type that requires one', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog')!;
    dialog.showModal = vi.fn();
    element.querySelector<HTMLButtonElement>('.new-contribution-button')!.click();
    const controls = fixture.componentInstance['form'].controls;
    controls.contributionTypeId.setValue('type');
    controls.paymentMethodId.setValue('method');
    controls.occurredOn.setValue('2026-11-20');
    controls.amount.setValue('25.50');
    dialog.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(service.create).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain('Selecione um membro');
  });

  it('rejects zero and values exceeding the API amount limit', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    component['form'].patchValue({
      contributionTypeId: 'type',
      paymentMethodId: 'method',
      occurredOn: '2026-11-20',
      amount: '0.00',
    });
    await component['save']();
    expect(component['formError']()).toContain('valor positivo');
    component['form'].controls.amount.setValue('1000000000000.00');
    await component['save']();
    expect(component['formError']()).toContain('valor positivo');
    expect(service.create).not.toHaveBeenCalled();
  });

  it('opens the form after loading catalogs when requested from the dashboard', async () => {
    const fixture = TestBed.createComponent(ContributionsComponent);
    fixture.componentRef.setInput('accessToken', 'token');
    fixture.componentRef.setInput('tenantId', 'tenant');
    fixture.componentRef.setInput('openOnLoad', true);
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    dialog.showModal = vi.fn();
    await fixture.whenStable();
    await vi.waitFor(() => expect(dialog.showModal).toHaveBeenCalled());
  });

  it('searches and selects an active member for the contribution', async () => {
    service.lookupMembers.mockResolvedValue([
      { id: 'member', name: 'Ana', memberType: { id: 'type', description: 'Membro' } },
    ]);
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog')!;
    dialog.showModal = vi.fn();
    element.querySelector<HTMLButtonElement>('.new-contribution-button')!.click();
    fixture.detectChanges();

    const search = dialog.querySelector<HTMLInputElement>('input[formControlName="memberSearch"]')!;
    search.value = 'Ana';
    search.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(dialog.querySelector('.member-results button')).not.toBeNull();
    });
    expect(service.lookupMembers).toHaveBeenCalledWith('token', 'tenant', 'Ana');
    dialog.querySelector<HTMLButtonElement>('.member-results button')!.click();
    expect(fixture.componentInstance['selectedMember']()?.id).toBe('member');
  });

  it('edits an existing contribution using its version without sending attachments', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector<HTMLDialogElement>('.contribution-dialog')!;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    const edit = element.querySelector<HTMLButtonElement>('.contribution-row-actions button')!;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(edit.disabled).toBe(false);
    });
    edit.click();
    fixture.detectChanges();

    expect(dialog.textContent).toContain('Editar contribuição');
    expect(fixture.componentInstance['form'].getRawValue()).toMatchObject({
      amount: '850.00', memberSearch: 'Ana', occurredOn: '2026-11-12',
    });
    fixture.componentInstance['form'].controls.amount.setValue('125.50');
    service.update.mockResolvedValue(response.data[0]);
    await fixture.componentInstance['save']();
    expect(service.update).toHaveBeenCalledWith('token', 'tenant', '1', {
      contributionTypeId: 'type',
      paymentMethodId: 'method',
      memberId: 'member',
      amount: '125.50',
      occurredOn: '2026-11-12',
      observation: null,
      version: 1,
    });
    expect(service.create).not.toHaveBeenCalled();
    expect(dialog.close).toHaveBeenCalled();
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('cancels deletion without calling the endpoint', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector<HTMLDialogElement>('app-custom-confirm dialog')!;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    element.querySelector<HTMLButtonElement>('.contribution-row-actions .delete')!.click();
    dialog.querySelector<HTMLButtonElement>('.cancel')!.click();
    expect(dialog.close).toHaveBeenCalled();
    expect(service.void).not.toHaveBeenCalled();
  });

  it('only deletes after confirmation and prevents duplicate requests', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector<HTMLDialogElement>('app-custom-confirm dialog')!;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    element.querySelector<HTMLButtonElement>('.contribution-row-actions .delete')!.click();
    fixture.detectChanges();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(service.void).not.toHaveBeenCalled();
    const reason = dialog.querySelector<HTMLTextAreaElement>('textarea')!;
    reason.value = ' Duplicada ';
    reason.dispatchEvent(new Event('input'));
    let resolve!: (value: object) => void;
    service.void.mockReturnValue(new Promise((done) => { resolve = done; }));
    dialog.querySelector<HTMLButtonElement>('.confirm')!.click();
    dialog.querySelector<HTMLButtonElement>('.confirm')!.click();
    expect(service.void).toHaveBeenCalledOnce();
    expect(service.void).toHaveBeenCalledWith('token', 'tenant', '1', {
      version: 1, voidReason: 'Duplicada',
    });
    fixture.detectChanges();
    expect(dialog.querySelector<HTMLButtonElement>('.cancel')!.disabled).toBe(true);
    expect(dialog.querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBe(true);
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    resolve({ id: '1', status: 'VOIDED', voidReason: 'Duplicada' });
    await fixture.whenStable();
    expect(dialog.close).toHaveBeenCalled();
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('shows a version conflict and refreshes the list when the dialog is closed', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector<HTMLDialogElement>('app-custom-confirm dialog')!;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn(() => dialog.dispatchEvent(new Event('close')));
    element.querySelector<HTMLButtonElement>('.contribution-row-actions .delete')!.click();
    service.void.mockRejectedValue(new HttpErrorResponse({
      status: 409, error: { code: 'VERSION_MISMATCH' },
    }));
    await fixture.componentInstance['deleteContribution']();
    fixture.detectChanges();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('atualizar a lista');
    expect(dialog.querySelector<HTMLButtonElement>('.confirm')!.disabled).toBe(true);
    dialog.querySelector<HTMLButtonElement>('.cancel')!.click();
    await fixture.whenStable();
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('blocks stale edits and refreshes on close', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector<HTMLDialogElement>('.contribution-dialog')!;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn(() => dialog.dispatchEvent(new Event('close')));
    const edit = element.querySelector<HTMLButtonElement>('.contribution-row-actions button')!;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(edit.disabled).toBe(false);
    });
    edit.click();
    service.update.mockRejectedValue(new HttpErrorResponse({
      status: 409, error: { code: 'VERSION_MISMATCH' },
    }));
    await fixture.componentInstance['save']();
    fixture.detectChanges();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('atualizar a lista');
    expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    fixture.componentInstance['closeDialog']();
    await fixture.whenStable();
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('reuses the idempotency key when retrying the same contribution', async () => {
    const fixture = await createComponent();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog')!;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    element.querySelector<HTMLButtonElement>('.new-contribution-button')!.click();
    const component = fixture.componentInstance;
    component['form'].patchValue({
      contributionTypeId: 'type',
      paymentMethodId: 'method',
      occurredOn: '2026-11-20',
    });
    const amountInput = dialog.querySelector<HTMLInputElement>('app-currency-input input')!;
    for (const digit of '20055') {
      amountInput.value += digit;
      amountInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    }
    expect(amountInput.value).toBe('200,55');
    component['selectMember']({
      id: 'member',
      name: 'Ana',
      memberType: { id: 'member-type', description: 'Membro' },
    });
    service.create
      .mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValueOnce({ id: 'created' });
    await component['save']();
    await component['save']();
    expect(service.create).toHaveBeenCalledTimes(2);
    expect(service.create.mock.calls[0][3]).toBe(service.create.mock.calls[1][3]);
    expect(service.create.mock.calls[0][2]).toMatchObject({
      amount: '200.55',
      memberId: 'member',
      attachmentIds: [],
    });
    expect(dialog.close).toHaveBeenCalled();
  });
});
