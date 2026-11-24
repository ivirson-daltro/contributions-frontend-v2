import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthApiError } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ToastService } from '../../../../core/ui/toast.service';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  const auth = { requestPasswordReset: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.requestPasswordReset.mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  it('validates the email and displays a generic confirmation', async () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const form = element.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(element.querySelector('#recovery-email-error')).toBeTruthy();
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();

    const input = element.querySelector<HTMLInputElement>('#recovery-email')!;
    input.value = 'user@example.com';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('user@example.com');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Se o e-mail estiver cadastrado');
  });

  it('reports service failures without showing a success message', async () => {
    auth.requestPasswordReset.mockRejectedValue(new Error('network'));
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#recovery-email')!;
    input.value = 'user@example.com';
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(TestBed.inject(ToastService).toasts().some((toast) => toast.type === 'error')).toBe(true);
  });

  it('explains rate limiting without showing a success message', async () => {
    auth.requestPasswordReset.mockRejectedValue(
      new AuthApiError('email rate limit exceeded', 429, 'over_email_send_rate_limit'),
    );
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#recovery-email')!;
    input.value = 'user@example.com';
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(TestBed.inject(ToastService).toasts()).toEqual(
      expect.arrayContaining([expect.objectContaining({
        type: 'warning',
        message: 'Muitas solicitações de recuperação. Aguarde e tente novamente mais tarde.',
      })]),
    );
  });
});
