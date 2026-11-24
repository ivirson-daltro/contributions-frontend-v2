import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createClient, type AuthChangeEvent, type Session } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AuthService, SUPABASE_CLIENT } from './auth.service';

const supabase = {
  onAuthStateChange: vi.fn(),
  initialize: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};

describe('AuthService password recovery', () => {
  let notify: (event: AuthChangeEvent, session: Session | null) => void;
  const session = { user: { id: 'user-id' }, access_token: 'recovery-token' } as Session;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/reset-password#type=recovery');
    supabase.onAuthStateChange.mockImplementation((callback) => {
      notify = callback;
    });

    supabase.initialize.mockResolvedValue({ error: null });
    supabase.resetPasswordForEmail.mockResolvedValue({ error: null });
    supabase.updateUser.mockResolvedValue({ error: null });
    supabase.signOut.mockResolvedValue({ error: null });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), { provide: SUPABASE_CLIENT, useValue: { auth: supabase } }],
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.useRealTimers();
  });

  it('sends the recovery email with the current origin as redirect', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.requestPasswordReset('user@example.com');
    expect(supabase.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    const error = new Error('network');
    supabase.resetPasswordForEmail.mockResolvedValue({ error });
    await expect(auth.requestPasswordReset('user@example.com')).rejects.toBe(error);
  });

  it('waits for PASSWORD_RECOVERY after INITIAL_SESSION and updates only once', async () => {
    const auth = TestBed.inject(AuthService);
    const recovery = auth.initializePasswordRecovery();
    notify('INITIAL_SESSION', session);
    await Promise.resolve();
    notify('PASSWORD_RECOVERY', session);

    await expect(recovery).resolves.toBe(true);
    await auth.updateRecoveredPassword('Password1');
    expect(supabase.updateUser).toHaveBeenCalledWith({ password: 'Password1' });
    notify('PASSWORD_RECOVERY', session);
    await expect(auth.updateRecoveredPassword('Password2')).rejects.toThrow();
    await auth.signOutRecovery();
    expect(supabase.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not accept an ordinary session or a recovery event without a recovery callback', async () => {
    window.history.replaceState({}, '', '/reset-password');
    const auth = TestBed.inject(AuthService);
    notify('INITIAL_SESSION', session);
    notify('PASSWORD_RECOVERY', session);
    await expect(auth.initializePasswordRecovery()).resolves.toBe(false);
    await expect(auth.updateRecoveredPassword('Password1')).rejects.toThrow();
  });

  it('rejects invalid callbacks and reports service errors', async () => {
    const auth = TestBed.inject(AuthService);
    supabase.initialize.mockResolvedValueOnce({ error: { status: 401 } });
    await expect(auth.initializePasswordRecovery()).resolves.toBe(false);
    const error = new Error('network');
    supabase.initialize.mockResolvedValueOnce({ error });
    await expect(auth.initializePasswordRecovery()).rejects.toBe(error);
  });

  it('times out when initialization does not emit a recovery event', async () => {
    vi.useFakeTimers();
    const auth = TestBed.inject(AuthService);
    const recovery = auth.initializePasswordRecovery();
    await vi.advanceTimersByTimeAsync(5000);
    await expect(recovery).resolves.toBe(false);
  });

  it('keeps recovery authorization when another tab reports the same session', async () => {
    const auth = TestBed.inject(AuthService);
    notify('PASSWORD_RECOVERY', session);
    await expect(auth.initializePasswordRecovery()).resolves.toBe(true);
    notify('SIGNED_IN', session);
    await auth.updateRecoveredPassword('Password1');
    expect(supabase.updateUser).toHaveBeenCalledWith({ password: 'Password1' });
  });

  it('preserves a refreshed recovery session', async () => {
    const makeSession = (id: string, version: number): Session => ({
      ...session,
      access_token: `header.${btoa(JSON.stringify({ session_id: id, version }))}.signature`,
    });
    const auth = TestBed.inject(AuthService);
    notify('PASSWORD_RECOVERY', makeSession('recovery-session', 1));
    await expect(auth.initializePasswordRecovery()).resolves.toBe(true);
    notify('TOKEN_REFRESHED', makeSession('recovery-session', 2));
    notify('SIGNED_IN', makeSession('recovery-session', 2));
    await auth.updateRecoveredPassword('Password1');
    expect(supabase.updateUser).toHaveBeenCalledWith({ password: 'Password1' });
  });

  it('rejects a different session for the same user', async () => {
    const makeSession = (id: string): Session => ({
      ...session,
      access_token: `header.${btoa(JSON.stringify({ session_id: id }))}.signature`,
    });
    const auth = TestBed.inject(AuthService);
    notify('PASSWORD_RECOVERY', makeSession('recovery-session'));
    notify('SIGNED_IN', makeSession('another-session'));
    await expect(auth.updateRecoveredPassword('Password1')).rejects.toThrow();
    expect(supabase.updateUser).not.toHaveBeenCalled();
  });

  it('revokes recovery authorization on sign-out', async () => {
    const auth = TestBed.inject(AuthService);
    notify('PASSWORD_RECOVERY', session);
    notify('SIGNED_OUT', null);
    await expect(auth.updateRecoveredPassword('Password1')).rejects.toThrow();
  });

  it('surfaces password update and local sign-out errors separately', async () => {
    const auth = TestBed.inject(AuthService);
    notify('PASSWORD_RECOVERY', session);
    const updateError = new Error('update');
    supabase.updateUser.mockResolvedValueOnce({ error: updateError });
    await expect(auth.updateRecoveredPassword('Password1')).rejects.toBe(updateError);
    const signOutError = new Error('sign out');
    supabase.signOut.mockResolvedValueOnce({ error: signOutError });
    await expect(auth.signOutRecovery()).rejects.toBe(signOutError);
  });
});

describe('AuthService with the Supabase client', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('propagates the recovery email rate limit from the SDK without retrying', async () => {
    window.history.replaceState({}, '', '/forgot-password');
    const fetch = vi.fn(async () => new Response(
      JSON.stringify({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
      },
    ));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        {
          provide: SUPABASE_CLIENT,
          useFactory: () => createClient('https://example.test', 'test-key', {
            auth: { autoRefreshToken: false, persistSession: false },
            global: { fetch },
          }),
        },
      ],
    });

    await expect(TestBed.inject(AuthService).requestPasswordReset('user@example.com'))
      .rejects.toMatchObject({ status: 429, code: 'over_email_send_rate_limit' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('accepts a recovery callback processed by the real SDK', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    window.history.replaceState(
      {},
      '',
      `/reset-password#access_token=test-token&refresh_token=test-refresh&expires_in=3600&expires_at=${expiresAt}&token_type=bearer&type=recovery`,
    );
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      id: 'user-id',
      email: 'user@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        {
          provide: SUPABASE_CLIENT,
          useFactory: () => createClient('https://example.test', 'test-key', {
            auth: { autoRefreshToken: false, persistSession: false },
            global: { fetch },
          }),
        },
      ],
    });

    const auth = TestBed.inject(AuthService);
    await expect(auth.initializePasswordRecovery()).resolves.toBe(true);
    expect(window.location.hash).toBe('');
    await auth.updateRecoveredPassword('Password1');
    expect(fetch).toHaveBeenCalledTimes(2);
    const request = fetch.mock.calls[1][1];
    expect(request?.method).toBe('PUT');
    expect(JSON.parse(String(request?.body))).toEqual(expect.objectContaining({ password: 'Password1' }));
  });
});
