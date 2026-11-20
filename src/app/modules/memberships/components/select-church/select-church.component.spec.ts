import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { SelectChurchComponent } from './select-church.component';

describe('SelectChurchComponent', () => {
  const authService = {
    getAccessToken: vi.fn(),
    getCurrentUser: vi.fn(),
  };

  beforeEach(async () => {
    authService.getAccessToken.mockReset().mockResolvedValue('access-token');
    authService.getCurrentUser.mockReset().mockResolvedValue({
      user: { id: 'user-id', email: 'admin@example.com', displayName: 'Admin' },
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

    await TestBed.configureTestingModule({
      imports: [SelectChurchComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('should list active churches and navigate to the selected tenant dashboard', async () => {
    authService.getCurrentUser.mockResolvedValue({
      user: { id: 'user-id', email: 'admin@example.com', displayName: 'Admin' },
      memberships: [
        {
          tenantId: 'tenant-id',
          slug: 'igreja-central',
          name: 'Igreja Central',
          status: 'ACTIVE',
          roles: ['TENANT_ADMIN'],
        },
        {
          tenantId: 'another-tenant-id',
          slug: 'outra-igreja',
          name: 'Outra Igreja',
          status: 'ACTIVE',
          roles: ['TENANT_ADMIN'],
        },
      ],
    });
    const fixture = TestBed.createComponent(SelectChurchComponent);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(authService.getCurrentUser).toHaveBeenCalledWith('access-token'));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Igreja Central');
    expect(element.textContent).toContain('Outra Igreja');

    element.querySelector<HTMLInputElement>('input[type="radio"]')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('button')!.click();

    expect(navigate).toHaveBeenCalledWith(['/tenant', 'igreja-central']);
  });

  it('should navigate directly when there is only one active tenant-admin church', async () => {
    const fixture = TestBed.createComponent(SelectChurchComponent);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(authService.getCurrentUser).toHaveBeenCalledWith('access-token'));

    expect(navigate).toHaveBeenCalledWith(['/tenant', 'igreja-central']);
  });

  it('should not route a non-admin membership to the tenant dashboard', async () => {
    authService.getCurrentUser.mockResolvedValue({
      user: { id: 'user-id', email: 'member@example.com', displayName: 'Member' },
      memberships: [
        {
          tenantId: 'tenant-id',
          slug: 'igreja-central',
          name: 'Igreja Central',
          status: 'ACTIVE',
          roles: ['TREASURER'],
        },
      ],
    });
    const fixture = TestBed.createComponent(SelectChurchComponent);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(authService.getCurrentUser).toHaveBeenCalledWith('access-token'));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('input[type="radio"]')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'apenas para administradores',
    );
  });

  it('should return to login when there are no active church memberships', async () => {
    authService.getCurrentUser.mockResolvedValue({
      user: { id: 'user-id', email: 'user@example.com', displayName: 'User' },
      memberships: [],
    });
    const fixture = TestBed.createComponent(SelectChurchComponent);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(authService.getCurrentUser).toHaveBeenCalledWith('access-token'));

    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
