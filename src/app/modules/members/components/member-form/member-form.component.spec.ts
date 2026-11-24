import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Member } from '../../dtos/member.dto';
import { MemberFormComponent } from './member-form.component';

describe('MemberFormComponent', () => {
  const member: Member = {
    id: 'member', name: 'Ana', memberType: { id: 'inactive', description: 'Antigo' },
    status: 'ACTIVE', phone: null, email: 'legacy-invalid', gender: null, birthDate: null,
    entryDate: null, baptismDate: null, zipCode: null, street: null, number: null,
    complement: null, neighborhood: null, city: null, state: null, consentAt: null,
    createdBy: 'user', createdAt: '', updatedAt: '',
  };
  let fixture: ComponentFixture<MemberFormComponent>;
  const save = vi.fn();

  function setup(fullAccess: boolean, existing: Member | null = null): HTMLElement {
    fixture = TestBed.createComponent(MemberFormComponent);
    fixture.componentRef.setInput('types', [{ id: 'type', description: 'Membro' }]);
    fixture.componentRef.setInput('fullAccess', fullAccess);
    fixture.componentRef.setInput('member', existing);
    fixture.componentInstance.save.subscribe(save);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function setValue(element: HTMLElement, name: string, value: string): void {
    const control = element.querySelector<HTMLInputElement | HTMLSelectElement>(`[formControlName="${name}"]`)!;
    control.value = value;
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    fixture.detectChanges();
  }

  function submit(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MemberFormComponent] });
    save.mockReset();
  });

  it('validates required fields and sends only name and type for the treasurer', () => {
    const element = setup(false);
    submit(element);
    expect(element.textContent).toContain('Informe o nome completo');
    expect(save).not.toHaveBeenCalled();
    setValue(element, 'name', '  Ana  ');
    setValue(element, 'memberTypeId', 'type');
    expect(element.querySelector('[formControlName="email"]')).toBeNull();
    submit(element);
    expect(save).toHaveBeenCalledWith({ payload: { name: 'Ana', memberTypeId: 'type' }, changes: {} });
  });

  it('allows basic edits despite invalid hidden data and leaves an inactive type unchanged', () => {
    const element = setup(false, member);
    expect(element.textContent).toContain('Antigo (inativo)');
    setValue(element, 'name', 'Ana Maria');
    submit(element);
    expect(save).toHaveBeenCalledWith({
      payload: { name: 'Ana Maria', memberTypeId: 'inactive' },
      changes: { name: 'Ana Maria' },
    });
  });

  it('advances through all steps before sending complete data and consent', () => {
    const element = setup(true);
    setValue(element, 'name', 'Ana');
    setValue(element, 'memberTypeId', 'type');
    setValue(element, 'email', 'invalid');
    submit(element);
    expect(element.textContent).toContain('Informe um e-mail válido');
    setValue(element, 'email', 'ana@example.com');
    submit(element);
    expect(element.textContent).toContain('Endereço');
    expect(save).not.toHaveBeenCalled();
    setValue(element, 'city', 'Recife');
    submit(element);
    expect(element.textContent).toContain('Vínculo com a igreja');
    const consent = element.querySelector<HTMLInputElement>('[formControlName="consent"]')!;
    consent.checked = true;
    consent.dispatchEvent(new Event('change', { bubbles: true }));
    submit(element);
    expect(save).toHaveBeenCalledWith({
      payload: expect.objectContaining({ name: 'Ana', memberTypeId: 'type', email: 'ana@example.com', city: 'Recife', consent: true }),
      changes: {},
    });
  });

  it('sends only changed fields on a complete edit', () => {
    const element = setup(true, { ...member, email: 'ana@example.com', phone: ' 123 ' });
    setValue(element, 'name', 'Ana Maria');
    submit(element);
    submit(element);
    submit(element);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ changes: { name: 'Ana Maria' } }));
  });
});
