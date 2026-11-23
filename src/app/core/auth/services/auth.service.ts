import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { createClient, isAuthImplicitGrantRedirectError, type AuthError } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import { CurrentUserResponse } from '../dtos/current-user-response.dto';
import { TotpFactorStatus } from '../models/totp-factor-status';

export const SUPABASE_CLIENT = new InjectionToken('Supabase client', {
  factory: () => createClient(environment.supabase.url, environment.supabase.anonKey),
});

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly recoveryCallback = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly meUrl = `${environment.apiUrl}/me`;
  private recoveryReady = false;
  private resolveRecovery: (() => void) | null = null;
  private readonly recoveryEvent = new Promise<void>((resolve) => {
    this.resolveRecovery = resolve;
  });

  constructor() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session && this.recoveryCallback) {
        this.recoveryReady = true;
        this.resolveRecovery?.();
        this.resolveRecovery = null;
      } else if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        this.recoveryReady = false;
      }
    });
  }

  async signIn(email: string, password: string): Promise<AuthError | null> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    return error;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const redirectTo = new URL('/reset-password', window.location.origin).toString();
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async initializePasswordRecovery(): Promise<boolean> {
    if (!this.recoveryCallback) return false;
    const { error } = await this.supabase.auth.initialize();
    if (error) {
      if (isAuthImplicitGrantRedirectError(error) || error.status === 400 || error.status === 401 || error.status === 403) {
        return false;
      }
      throw error;
    }
    if (this.recoveryReady) return true;

    return new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 5000);
      void this.recoveryEvent.then(() => {
        window.clearTimeout(timeout);
        resolve(this.recoveryReady);
      });
    });
  }

  async updateRecoveredPassword(password: string): Promise<void> {
    if (!this.recoveryReady) throw new Error('Sessão de recuperação indisponível.');
    const { error } = await this.supabase.auth.updateUser({ password });
    if (error) throw error;
    this.recoveryReady = false;
  }

  async signOutRecovery(): Promise<void> {
    const { error } = await this.supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  async getAccessToken(): Promise<string | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  }

  async getCurrentUser(accessToken: string): Promise<CurrentUserResponse> {
    return firstValueFrom(
      this.http.get<CurrentUserResponse>(this.meUrl, {
        headers: new HttpHeaders({ Authorization: 'Bearer ' + accessToken }),
      }),
    );
  }

  async getCurrentUserEmail(): Promise<string | null> {
    const { data, error } = await this.supabase.auth.getUser();
    if (error) throw error;
    return data.user.email ?? null;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getVerifiedTotpFactors() {
    const { data, error } = await this.supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data.totp.filter((factor) => factor.status === 'verified');
  }

  async getTotpFactorStatus(): Promise<TotpFactorStatus> {
    const [{ data: factors, error: factorsError }, { data: assurance, error: assuranceError }] =
      await Promise.all([
        this.supabase.auth.mfa.listFactors(),
        this.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

    if (factorsError) throw factorsError;
    if (assuranceError) throw assuranceError;

    return {
      factors: factors.totp,
      currentLevel: assurance.currentLevel,
      nextLevel: assurance.nextLevel,
    };
  }

  async enrollTotp(): Promise<{
    id: string;
    qrCode: string;
    secret: string;
  }> {
    const { data, error } = await this.supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'IBG Gestão',
    });
    if (error) throw error;

    return {
      id: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  }

  async verifyTotp(factorId: string, code: string): Promise<void> {
    const { data: challenge, error: challengeError } = await this.supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) throw challengeError;

    const { error } = await this.supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) throw error;
  }
}
