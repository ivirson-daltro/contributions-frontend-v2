import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
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

  it('should list active church memberships and confirm selection', async () => {
    const fixture = TestBed.createComponent(SelectChurchComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(authService.getCurrentUser).toHaveBeenCalledWith('access-token'));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Igreja Central');

    element.querySelector<HTMLInputElement>('input[type="radio"]')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Igreja selecionada');
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
