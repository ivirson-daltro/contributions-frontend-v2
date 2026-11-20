import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { TwoFactorComponent } from './two-factor.component';

describe('TwoFactorComponent', () => {
  const authService = {
    getAccessToken: vi.fn(),
    getTotpFactorStatus: vi.fn(),
    enrollTotp: vi.fn(),
    verifyTotp: vi.fn(),
    signOut: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    authService.getAccessToken.mockResolvedValue('access-token');
    authService.getTotpFactorStatus.mockResolvedValue({
      factors: [],
      currentLevel: 'aal1',
      nextLevel: 'aal1',
    });
    authService.enrollTotp.mockResolvedValue({
      id: 'new-factor',
      qrCode: 'data:image/png;base64,qr-code',
      secret: 'JBSWY3DPEHPK3PXP',
    });

    await TestBed.configureTestingModule({
      imports: [TwoFactorComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('should render the authenticator enrollment flow without an existing factor', async () => {
    const fixture = TestBed.createComponent(TwoFactorComponent);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Proteja seu acesso'),
    );
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(authService.enrollTotp).toHaveBeenCalled();
    expect(element.querySelector<HTMLImageElement>('img')?.src).toContain('qr-code');
    expect(element.textContent).toContain('JBSWY3DPEHPK3PXP');
  });

  it('should verify a code for an existing factor and continue', async () => {
    authService.getTotpFactorStatus.mockResolvedValue({
      factors: [{ id: 'verified-factor', status: 'verified' }],
      currentLevel: 'aal1',
      nextLevel: 'aal2',
    });
    const fixture = TestBed.createComponent(TwoFactorComponent);
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Verifique seu acesso'),
    );
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#two-factor-code')!;
    input.value = '123456';
    input.dispatchEvent(new Event('input'));
    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(authService.verifyTotp).toHaveBeenCalledWith('verified-factor', '123456'),
    );

    expect(navigateByUrl).toHaveBeenCalledWith('/select-church');
  });

  it('should discard non-numeric characters from the verification code', async () => {
    authService.getTotpFactorStatus.mockResolvedValue({
      factors: [{ id: 'verified-factor', status: 'verified' }],
      currentLevel: 'aal1',
      nextLevel: 'aal2',
    });
    const fixture = TestBed.createComponent(TwoFactorComponent);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Verifique seu acesso'),
    );
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#two-factor-code',
    )!;
    input.value = '12a34-56';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(input.value).toBe('123456');
  });
});
