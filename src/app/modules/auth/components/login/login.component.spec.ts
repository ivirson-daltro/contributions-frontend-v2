import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { PlatformService } from '../../../platform/services/platform.service';
import { LoginComponent } from './login.component';
import { ToastService } from '../../../../core/ui/toast.service';
import { RememberedEmailService } from '../../services/remembered-email.service';

describe('Login', () => {
  const rememberedEmailKey = 'ibg.auth.rememberedEmail';
  const authService = {
    signIn: vi.fn(),
    getAccessToken: vi.fn(),
    getCurrentUser: vi.fn(),
    getTotpFactorStatus: vi.fn(),
  };
  const platformService = {
    listTenants: vi.fn(),
  };

  beforeEach(async () => {
    window.localStorage.removeItem(rememberedEmailKey);
    authService.signIn.mockReset();
    authService.signIn.mockResolvedValue(null);
    authService.getAccessToken.mockReset();
    authService.getAccessToken.mockResolvedValue('access-token');
    authService.getCurrentUser.mockReset();
    authService.getCurrentUser.mockResolvedValue({
      user: { id: 'user-id', email: 'user@example.com', displayName: 'User' },
      memberships: [
        {
          tenantId: 'tenant-id',
          slug: 'igreja-central',
          name: 'Igreja Central',
          status: 'ACTIVE',
          roles: ['TENANT_ADMIN'],
        },
      ],
    });
    authService.getTotpFactorStatus.mockResolvedValue({
      factors: [{ id: 'factor-id', status: 'verified' }],
      currentLevel: 'aal2',
      nextLevel: 'aal2',
    });
    platformService.listTenants.mockReset();
    platformService.listTenants.mockResolvedValue({ items: [], meta: { count: 0 } });

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: PlatformService, useValue: platformService },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem(rememberedEmailKey);
  });

  it('should render the login form', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('#login-title')?.textContent).toContain('Bem-vindo de volta');
    expect(element.querySelector('input[type="email"]')).toBeTruthy();
    expect(element.querySelector('input[type="password"]')).toBeTruthy();
    expect(element.querySelector<HTMLAnchorElement>('.forgot-link')?.getAttribute('href')).toBe('/forgot-password');
  });

  it('should toggle password visibility', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.visibility-button')?.click();
    await fixture.whenStable();

    expect(element.querySelector('input[type="text"]')).toBeTruthy();
  });

  it('remembers only the email after a successful login when selected', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const email = element.querySelector<HTMLInputElement>('#email')!;
    const password = element.querySelector<HTMLInputElement>('#password')!;
    const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(false);
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'password123';
    password.dispatchEvent(new Event('input'));
    checkbox.click();
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(window.localStorage.getItem(rememberedEmailKey)).toBe('user@example.com');

    fixture.destroy();
    const next = TestBed.createComponent(LoginComponent);
    await next.whenStable();
    const nextElement = next.nativeElement as HTMLElement;
    expect(nextElement.querySelector<HTMLInputElement>('#email')!.value).toBe('user@example.com');
    expect(nextElement.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(nextElement.querySelector<HTMLInputElement>('#password')!.value).toBe('');
  });

  it('does not save an email when the option is unchecked or authentication fails', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const email = element.querySelector<HTMLInputElement>('#email')!;
    const password = element.querySelector<HTMLInputElement>('#password')!;
    const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'password123';
    password.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(window.localStorage.getItem(rememberedEmailKey)).toBeNull();

    checkbox.click();
    authService.signIn.mockResolvedValue({ message: 'invalid login credentials' });
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(window.localStorage.getItem(rememberedEmailKey)).toBeNull();
  });

  it('removes the saved email immediately when the option is unchecked', async () => {
    window.localStorage.setItem(rememberedEmailKey, 'user@example.com');
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();
    const checkbox = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    checkbox.click();
    await fixture.whenStable();
    expect(window.localStorage.getItem(rememberedEmailKey)).toBeNull();
  });

  it('keeps the previous saved email when a different login fails', async () => {
    window.localStorage.setItem(rememberedEmailKey, 'saved@example.com');
    authService.signIn.mockResolvedValue({ message: 'invalid login credentials' });
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const email = element.querySelector<HTMLInputElement>('#email')!;
    const password = element.querySelector<HTMLInputElement>('#password')!;
    email.value = 'other@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'password123';
    password.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(window.localStorage.getItem(rememberedEmailKey)).toBe('saved@example.com');
  });

  it('warns when the saved email cannot be removed', async () => {
    window.localStorage.setItem(rememberedEmailKey, 'user@example.com');
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();
    vi.spyOn(TestBed.inject(RememberedEmailService), 'clear').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(ToastService).toasts().some((toast) =>
      toast.message.includes('Não foi possível remover o e-mail'),
    )).toBe(true);
    expect(window.localStorage.getItem(rememberedEmailKey)).toBe('user@example.com');
  });

  it('continues login and warns when the browser cannot save the preference', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const element = fixture.nativeElement as HTMLElement;
    const email = element.querySelector<HTMLInputElement>('#email')!;
    const password = element.querySelector<HTMLInputElement>('#password')!;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'password123';
    password.dispatchEvent(new Event('input'));
    element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/select-church']);
    expect(TestBed.inject(ToastService).toasts().some((toast) =>
      toast.message.includes('Não foi possível salvar o e-mail'),
    )).toBe(true);
  });

  it('should route an active church member to church selection after authentication', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('#email')!.value = 'user@example.com';
    element.querySelector<HTMLInputElement>('#email')!.dispatchEvent(new Event('input'));
    element.querySelector<HTMLInputElement>('#password')!.value = 'password123';
    element.querySelector<HTMLInputElement>('#password')!.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(authService.signIn).toHaveBeenCalledWith('user@example.com', 'password123');
    expect(authService.getCurrentUser).toHaveBeenCalledWith('access-token');
    expect(navigate).toHaveBeenCalledWith(['/select-church']);
    expect(platformService.listTenants).not.toHaveBeenCalled();
    expect(element.querySelector('[role="status"]')?.textContent).toBeFalsy();
  });

  it('should route a platform admin to the platform console', async () => {
    authService.getCurrentUser.mockResolvedValue({
      user: { id: 'admin-id', email: 'admin@example.com', displayName: 'Admin' },
      memberships: [],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('#email')!.value = 'admin@example.com';
    element.querySelector<HTMLInputElement>('#email')!.dispatchEvent(new Event('input'));
    element.querySelector<HTMLInputElement>('#password')!.value = 'password123';
    element.querySelector<HTMLInputElement>('#password')!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(platformService.listTenants).toHaveBeenCalledWith('access-token');
    expect(navigate).toHaveBeenCalledWith(['/platform']);
  });

  it('should route an unverified user through the two-factor flow', async () => {
    authService.getTotpFactorStatus.mockResolvedValue({
      factors: [{ id: 'factor-id', status: 'verified' }],
      currentLevel: 'aal1',
      nextLevel: 'aal2',
    });
    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('#email')!.value = 'user@example.com';
    element.querySelector<HTMLInputElement>('#email')!.dispatchEvent(new Event('input'));
    element.querySelector<HTMLInputElement>('#password')!.value = 'password123';
    element.querySelector<HTMLInputElement>('#password')!.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/two-factor'], {
      queryParams: { returnUrl: '/select-church' },
    });
  });

  it('should not route a user without membership to the platform console', async () => {
    authService.getCurrentUser.mockResolvedValue({
      user: { id: 'user-id', email: 'user@example.com', displayName: 'User' },
      memberships: [],
    });
    platformService.listTenants.mockRejectedValue(
      new HttpErrorResponse({ status: 403, error: { code: 'FORBIDDEN' } }),
    );
    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('#email')!.value = 'user@example.com';
    element.querySelector<HTMLInputElement>('#email')!.dispatchEvent(new Event('input'));
    element.querySelector<HTMLInputElement>('#password')!.value = 'password123';
    element.querySelector<HTMLInputElement>('#password')!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(ToastService).toasts().map((toast) => toast.message).join(' '))
      .toContain('Peça um convite ao administrador');
  });

  it('should use a generic message for invalid credentials', async () => {
    authService.signIn.mockResolvedValue({ message: 'invalid login credentials' });
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('#email')!.value = 'user@example.com';
    element.querySelector<HTMLInputElement>('#email')!.dispatchEvent(new Event('input'));
    element.querySelector<HTMLInputElement>('#password')!.value = 'wrong-password';
    element.querySelector<HTMLInputElement>('#password')!.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(TestBed.inject(ToastService).toasts().map((toast) => toast.message).join(' '))
      .toContain('E-mail ou senha inválidos.');
  });
});
