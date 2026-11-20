import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { createClient, type AuthError } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import { CurrentUserResponse } from '../dtos/current-user-response.dto';
import { TotpFactorStatus } from '../models/totp-factor-status';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly supabase = createClient(environment.supabase.url, environment.supabase.anonKey);
  private readonly meUrl = `${environment.apiUrl}/me`;

  async signIn(email: string, password: string): Promise<AuthError | null> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    return error;
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
