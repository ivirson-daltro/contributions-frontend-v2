import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { AcceptInviteComponent } from './accept-invite.component';
import { InvitationService } from './invitation.service';

describe('AcceptInviteComponent', () => {
  const authService = {
    signIn: vi.fn(),
    getAccessToken: vi.fn(),
    getCurrentUserEmail: vi.fn(),
    signOut: vi.fn(),
  };
  const invitationService = {
    getPreview: vi.fn(),
    accept: vi.fn(),
  };

  const pendingInvite = {
    tenant: { name: 'Igreja Batista da Graça', slug: 'igreja-batista' },
    email: 'beatriz.santos@example.com',
    name: 'Beatriz Santos',
    roles: ['SECRETARY'],
    status: 'PENDING',
    expiresAt: '2026-11-19T23:59:59.000Z',
    accountExists: false,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    authService.signIn.mockResolvedValue(null);
    authService.getAccessToken.mockResolvedValue('session-token');
    authService.getCurrentUserEmail.mockResolvedValue('beatriz.santos@example.com');
    authService.signOut.mockResolvedValue(undefined);
    invitationService.getPreview.mockResolvedValue(pendingInvite);
    invitationService.accept.mockResolvedValue({
      tenantId: 'tenant-id',
      membershipId: 'membership-id',
    });

    await TestBed.configureTestingModule({
      imports: [AcceptInviteComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ token: 'invitation-token' }),
            },
          },
        },
        { provide: AuthService, useValue: authService },
        { provide: InvitationService, useValue: invitationService },
      ],
    }).compileComponents();
  });

  it('should load and display the invitation details', async () => {
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Igreja Batista da Graça'),
    );

    const element = fixture.nativeElement as HTMLElement;
    expect(invitationService.getPreview).toHaveBeenCalledWith('invitation-token');
    expect(element.textContent).toContain('beatriz.santos@example.com');
    expect(element.textContent).toContain('Secretário(a)');
    expect(element.querySelector<HTMLInputElement>('#display-name')?.value).toBe('Beatriz Santos');
  });

  it('should create an account and accept a new-user invitation', async () => {
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Igreja Batista da Graça'),
    );

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('#invite-password')!.value = 'securepass123';
    element.querySelector<HTMLInputElement>('#invite-password')!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(invitationService.accept).toHaveBeenCalledWith('invitation-token', {
        displayName: 'Beatriz Santos',
        password: 'securepass123',
      }),
    );
    await vi.waitFor(() => expect(fixture.nativeElement.textContent).toContain('Convite aceito!'));
    expect(authService.signIn).not.toHaveBeenCalled();
  });

  it('should authenticate an existing account before accepting the invite', async () => {
    invitationService.getPreview.mockResolvedValue({
      ...pendingInvite,
      accountExists: true,
    });
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Este e-mail já possui uma conta'),
    );

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('#invite-password')!.value = 'existingpass123';
    element.querySelector<HTMLInputElement>('#invite-password')!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(invitationService.accept).toHaveBeenCalledWith(
        'invitation-token',
        {},
        'session-token',
      ),
    );
    expect(authService.signIn).toHaveBeenCalledWith(
      'beatriz.santos@example.com',
      'existingpass123',
    );
    await vi.waitFor(() => expect(fixture.nativeElement.textContent).toContain('Convite aceito!'));
  });

  it('should not accept the invite when the authenticated email differs', async () => {
    invitationService.getPreview.mockResolvedValue({
      ...pendingInvite,
      accountExists: true,
    });
    authService.getCurrentUserEmail.mockResolvedValue('other@example.com');
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Este e-mail já possui uma conta'),
    );

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('#invite-password')!.value = 'existingpass123';
    element.querySelector<HTMLInputElement>('#invite-password')!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(element.textContent).toContain(
        'A conta autenticada não corresponde ao e-mail deste convite.',
      ),
    );
    expect(invitationService.accept).not.toHaveBeenCalled();
    expect(authService.signOut).toHaveBeenCalled();
  });

  it('should show an unavailable state for expired invitations', async () => {
    invitationService.getPreview.mockRejectedValue(
      new HttpErrorResponse({ status: 410, error: { code: 'INVITATION_EXPIRED' } }),
    );
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain(
        'Este convite expirou, foi revogado ou já foi utilizado.',
      ),
    );
  });

  it('should offer retry when the API cannot be reached', async () => {
    invitationService.getPreview.mockRejectedValue(new HttpErrorResponse({ status: 0 }));
    const fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();

    await vi.waitFor(() =>
      expect(fixture.nativeElement.textContent).toContain('Não foi possível conectar à API.'),
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.invite-retry-button'),
    ).toBeTruthy();
  });
});
