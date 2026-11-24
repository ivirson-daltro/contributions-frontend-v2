import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { AuthService, RecoverySessionUnavailableError } from '../../../../core/auth/services/auth.service';
import { ToastService } from '../../../../core/ui/toast.service';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  const auth = {
    initializePasswordRecovery: vi.fn(),
    updateRecoveredPassword: vi.fn(),
    signOutRecovery: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.initializePasswordRecovery.mockResolvedValue(true);
    auth.updateRecoveredPassword.mockResolvedValue(undefined);
    auth.signOutRecovery.mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  function setValue(element: HTMLElement, selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(element: HTMLElement): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  async function render() {
    const fixture = TestBed.createComponent(ResetPasswordComponent);
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    return fixture;
  }

  it('does not show the form for an invalid link', async () => {
    auth.initializePasswordRecovery.mockResolvedValue(false);
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('inválido ou expirou');
    expect(element.querySelector('form')).toBeNull();
  });

  it('reports failures while checking the link', async () => {
    auth.initializePasswordRecovery.mockRejectedValue(new Error('network'));
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Verifique sua conexão');
    expect(TestBed.inject(ToastService).toasts().some((toast) => toast.type === 'error')).toBe(true);
  });

  it('enforces password strength and matching confirmation before updating', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    setValue(element, '#new-password', 'short');
    setValue(element, '#confirm-password', 'short');
    submit(element);
    await fixture.whenStable();
    expect(element.querySelector('#new-password-error')).toBeTruthy();

    setValue(element, '#new-password', 'Password1');
    setValue(element, '#confirm-password', 'Password2');
    submit(element);
    await fixture.whenStable();
    expect(element.querySelector('#confirm-password-error')).toBeTruthy();
    expect(auth.updateRecoveredPassword).not.toHaveBeenCalled();

    setValue(element, '#confirm-password', 'Password1');
    await fixture.whenStable();
    expect(element.querySelector('#confirm-password-error')).toBeNull();
    submit(element);
    await fixture.whenStable();
    expect(auth.updateRecoveredPassword).toHaveBeenCalledWith('Password1');
    expect(auth.signOutRecovery).toHaveBeenCalledOnce();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('senha foi redefinida');
  });

  it('updates confirmation errors as either password changes', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const confirmation = element.querySelector<HTMLInputElement>('#confirm-password')!;
    setValue(element, '#new-password', 'Password1');
    confirmation.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(element.querySelector('#confirm-password-error')?.textContent).toContain('Confirme');

    setValue(element, '#confirm-password', 'Password2');
    await fixture.whenStable();
    expect(element.querySelector('#confirm-password-error')?.textContent).toContain('iguais');
    expect(confirmation.getAttribute('aria-invalid')).toBe('true');

    setValue(element, '#confirm-password', 'Password1');
    await fixture.whenStable();
    expect(element.querySelector('#confirm-password-error')).toBeNull();
    expect(confirmation.getAttribute('aria-invalid')).toBe('false');

    setValue(element, '#new-password', 'Password3');
    await fixture.whenStable();
    expect(element.querySelector('#confirm-password-error')?.textContent).toContain('iguais');
    submit(element);
    await fixture.whenStable();
    expect(auth.updateRecoveredPassword).not.toHaveBeenCalled();

    setValue(element, '#new-password', 'Password1');
    await fixture.whenStable();
    expect(element.querySelector('#confirm-password-error')).toBeNull();
  });

  it('toggles visibility of each password independently without submitting', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const password = element.querySelector<HTMLInputElement>('#new-password')!;
    const confirmation = element.querySelector<HTMLInputElement>('#confirm-password')!;
    const [passwordToggle, confirmationToggle] = element.querySelectorAll<HTMLButtonElement>('.visibility-button');

    expect(password.type).toBe('password');
    expect(confirmation.type).toBe('password');
    passwordToggle.click();
    await fixture.whenStable();
    expect(password.type).toBe('text');
    expect(confirmation.type).toBe('password');
    expect(passwordToggle.getAttribute('aria-label')).toBe('Ocultar nova senha');
    expect(passwordToggle.getAttribute('aria-pressed')).toBe('true');

    confirmationToggle.click();
    passwordToggle.click();
    await fixture.whenStable();
    expect(password.type).toBe('password');
    expect(confirmation.type).toBe('text');
    expect(confirmationToggle.getAttribute('aria-label')).toBe('Ocultar confirmação de senha');
    expect(auth.updateRecoveredPassword).not.toHaveBeenCalled();
  });

  it('keeps the form available when the password update fails', async () => {
    auth.updateRecoveredPassword.mockRejectedValue(new Error('update'));
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    setValue(element, '#new-password', 'Password1');
    setValue(element, '#confirm-password', 'Password1');
    submit(element);
    await fixture.whenStable();
    expect(element.querySelector('form')).toBeTruthy();
    expect(auth.signOutRecovery).not.toHaveBeenCalled();
    expect(TestBed.inject(ToastService).toasts().some((toast) => toast.type === 'error')).toBe(true);
  });

  it.each([
    [new AuthApiError('same password', 422, 'same_password'), 'diferente da senha anterior'],
    [new AuthApiError('weak password', 422, 'weak_password'), 'senha mais forte'],
    [new AuthRetryableFetchError('network', 0), 'Verifique sua conexão'],
  ])('shows a useful message for a Supabase failure', async (error, message) => {
    auth.updateRecoveredPassword.mockRejectedValue(error);
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    setValue(element, '#new-password', 'Password1');
    setValue(element, '#confirm-password', 'Password1');
    submit(element);
    await fixture.whenStable();
    expect(TestBed.inject(ToastService).toasts().some((toast) => toast.message.includes(message))).toBe(true);
    expect(element.querySelector('form')).toBeTruthy();
  });

  it.each([
    new RecoverySessionUnavailableError(),
    new AuthApiError('expired', 401, 'session_expired'),
  ])('asks for a new link when the recovery session is no longer available', async (error) => {
    auth.updateRecoveredPassword.mockRejectedValue(error);
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    setValue(element, '#new-password', 'Password1');
    setValue(element, '#confirm-password', 'Password1');
    submit(element);
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Solicite outro link');
    expect(element.querySelector('form')).toBeNull();
  });

  it('preserves success and warns if local sign-out fails', async () => {
    auth.signOutRecovery.mockRejectedValue(new Error('sign out'));
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    setValue(element, '#new-password', 'Password1');
    setValue(element, '#confirm-password', 'Password1');
    submit(element);
    await fixture.whenStable();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('senha foi redefinida');
    expect(TestBed.inject(ToastService).toasts().some((toast) => toast.type === 'warning')).toBe(true);
  });
});
