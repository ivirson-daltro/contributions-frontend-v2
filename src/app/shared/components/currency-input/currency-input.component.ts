import { Component, forwardRef, input, signal } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';

@Component({
  selector: 'app-currency-input',
  templateUrl: './currency-input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CurrencyInputComponent),
      multi: true,
    },
  ],
})
export class CurrencyInputComponent implements ControlValueAccessor, Validator {
  readonly required = input(false);
  protected readonly displayValue = signal('');
  protected readonly disabled = signal(false);
  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    if (!value) {
      this.displayValue.set('');
      return;
    }

    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    this.displayValue.set(
      match ? this.formatDigits(match[1] + (match[2] ?? '').padEnd(2, '0')) : value,
    );
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const value: unknown = control.value;
    return value == null ||
      value === '' ||
      (typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value))
      ? null
      : { currency: true };
  }

  protected onBeforeInput(event: InputEvent): void {
    const inputElement = event.target as HTMLInputElement;
    const start = inputElement.selectionStart;
    if (start === null || start !== inputElement.selectionEnd) return;

    if (event.inputType === 'deleteContentBackward' && start > 0) {
      let index = start;
      while (index > 0 && !/\d/.test(inputElement.value[index - 1])) index--;
      if (index < start && index > 0) inputElement.setSelectionRange(index - 1, start);
    } else if (event.inputType === 'deleteContentForward' && start < inputElement.value.length) {
      let index = start;
      while (index < inputElement.value.length && !/\d/.test(inputElement.value[index])) index++;
      if (index > start && index < inputElement.value.length) {
        inputElement.setSelectionRange(start, index + 1);
      }
    }
  }

  protected onInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const raw = inputElement.value;
    if (/[-\u2212()]/.test(raw)) {
      this.displayValue.set(raw);
      this.onChange(raw);
      return;
    }
    const cursor = inputElement.selectionStart ?? raw.length;
    const digitsAfterCursor = raw.slice(cursor).replace(/\D/g, '').length;
    let digits = raw.replace(/\D/g, '');
    if (
      event instanceof InputEvent &&
      event.inputType.startsWith('delete') &&
      this.displayValue() === '0,00' &&
      !/[1-9]/.test(digits)
    ) {
      digits = '';
    }

    const formatted = digits ? this.formatDigits(digits) : '';
    inputElement.value = formatted;
    this.displayValue.set(formatted);

    let position = formatted.length;
    let remaining = digitsAfterCursor;
    while (position > 0 && remaining > 0) {
      position--;
      if (/\d/.test(formatted[position])) remaining--;
    }
    inputElement.setSelectionRange(position, position);

    if (!digits) {
      this.onChange('');
      return;
    }
    const normalized = digits.replace(/^0+/, '').padStart(3, '0');
    this.onChange(`${normalized.slice(0, -2)}.${normalized.slice(-2)}`);
  }

  private formatDigits(value: string): string {
    const digits = value.replace(/^0+/, '').padStart(3, '0');
    const integer = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${integer},${digits.slice(-2)}`;
  }
}
