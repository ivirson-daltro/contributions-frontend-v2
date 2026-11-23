import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyInputComponent } from './currency-input.component';

@Component({
  imports: [ReactiveFormsModule, CurrencyInputComponent],
  template: `
    <label>
      Valor
      <app-currency-input [formControl]="amount" [required]="true" />
    </label>
  `,
})
class TestHostComponent {
  readonly amount = new FormControl('', { nonNullable: true, validators: Validators.required });
}

describe('CurrencyInputComponent', () => {
  async function createHost() {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    return { fixture, input: fixture.nativeElement.querySelector('input') as HTMLInputElement };
  }

  it('formats each typed digit and emits a decimal value without losing precision', async () => {
    const { fixture, input } = await createHost();
    const expected = ['0,02', '0,20', '2,00', '20,05', '200,55'];
    for (const [index, digit] of Array.from('20055').entries()) {
      input.value += digit;
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: digit }),
      );
      fixture.detectChanges();
      expect(input.value).toBe(expected[index]);
    }
    expect(fixture.componentInstance.amount.value).toBe('200.55');

    input.value = '99999999999999999';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    fixture.detectChanges();
    expect(input.value).toBe('999.999.999.999.999,99');
    expect(fixture.componentInstance.amount.value).toBe('999999999999999.99');
  });

  it('handles pasted values, deletion across separators and clearing zero', async () => {
    const { fixture, input } = await createHost();
    input.value = 'R$ 1.234,56';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    fixture.detectChanges();
    expect(input.value).toBe('1.234,56');
    expect(fixture.componentInstance.amount.value).toBe('1234.56');

    input.setSelectionRange(6, 6);
    input.dispatchEvent(
      new InputEvent('beforeinput', { bubbles: true, inputType: 'deleteContentBackward' }),
    );
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(6);
    input.setRangeText('', input.selectionStart!, input.selectionEnd!, 'start');
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }),
    );
    fixture.detectChanges();
    expect(input.value).toBe('123,56');
    expect(fixture.componentInstance.amount.value).toBe('123.56');

    fixture.componentInstance.amount.setValue('0.00');
    fixture.detectChanges();
    input.value = '0,0';
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }),
    );
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(fixture.componentInstance.amount.value).toBe('');
    expect(fixture.componentInstance.amount.invalid).toBe(true);
  });

  it('supports programmatic values, reset, touched and disabled states', async () => {
    const { fixture, input } = await createHost();
    const control = fixture.componentInstance.amount;
    control.setValue('1000.5');
    fixture.detectChanges();
    expect(input.value).toBe('1.000,50');
    input.dispatchEvent(new Event('blur'));
    expect(control.touched).toBe(true);
    control.disable();
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
    control.enable();
    control.reset();
    fixture.detectChanges();
    expect(input.disabled).toBe(false);
    expect(input.required).toBe(true);
    expect(input.value).toBe('');
  });

  it('does not turn a pasted negative amount or an invalid model value into a positive amount', async () => {
    const { fixture, input } = await createHost();
    const control = fixture.componentInstance.amount;
    input.value = '-200,55';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    fixture.detectChanges();
    expect(input.value).toBe('-200,55');
    expect(control.value).toBe('-200,55');
    expect(control.hasError('currency')).toBe(true);

    input.value = '(200,55)';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    fixture.detectChanges();
    expect(control.value).toBe('(200,55)');
    expect(control.hasError('currency')).toBe(true);

    control.setValue('200.555');
    fixture.detectChanges();
    expect(input.value).toBe('200.555');
    expect(control.hasError('currency')).toBe(true);
  });
});
