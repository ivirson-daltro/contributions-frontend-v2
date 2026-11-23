import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MemberSelectComponent } from './member-select.component';

describe('MemberSelectComponent', () => {
  it('loads all members once and filters by a name fragment locally', async () => {
    const loader = vi.fn().mockResolvedValue([
      { id: '1', name: 'Ana Paula', memberType: { id: '1', description: 'Congregado' } },
      { id: '2', name: 'João Silva', memberType: { id: '1', description: 'Membro' } },
    ]);

    await TestBed.configureTestingModule({
      imports: [MemberSelectComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(MemberSelectComponent);
    fixture.componentRef.setInput('membersLoader', loader);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loader).toHaveBeenCalledWith();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'paul';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ana Paula');
    expect(fixture.nativeElement.textContent).not.toContain('João Silva');
    expect(fixture.nativeElement.querySelector('[role="option"]')?.textContent).not.toContain('Congregado');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('emits the selected member and clears it using the single clear button', async () => {
    const member = { id: '1', name: 'Ana Paula', memberType: { id: '1', description: 'Membro' } };
    const fixture = TestBed.createComponent(MemberSelectComponent);
    fixture.componentRef.setInput('membersLoader', vi.fn().mockResolvedValue([member]));
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('text');
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[role="option"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(selected).toHaveBeenCalledWith(member);

    (fixture.nativeElement.querySelector('[aria-label="Limpar membro"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(selected).toHaveBeenLastCalledWith(null);
    expect(input.value).toBe('');
  });

  it('applies the typed fragment when members finish loading', async () => {
    let resolveMembers!: (members: { id: string; name: string; memberType: { id: string; description: string } }[]) => void;
    const loader = vi.fn().mockReturnValue(new Promise((resolve) => { resolveMembers = resolve; }));
    const fixture = TestBed.createComponent(MemberSelectComponent);
    fixture.componentRef.setInput('membersLoader', loader);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'silva';
    input.dispatchEvent(new Event('input'));
    resolveMembers([
      { id: '1', name: 'Ana Paula', memberType: { id: '1', description: 'Membro' } },
      { id: '2', name: 'João Silva', memberType: { id: '1', description: 'Membro' } },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('João Silva');
    expect(fixture.nativeElement.textContent).not.toContain('Ana Paula');
  });
});
