import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/services/auth.service';
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
