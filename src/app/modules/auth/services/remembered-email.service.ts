import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RememberedEmailService {
  private readonly storageKey = 'ibg.auth.rememberedEmail';

  get(): string | null {
    return window.localStorage.getItem(this.storageKey);
  }

  save(email: string): void {
    window.localStorage.setItem(this.storageKey, email);
  }

  clear(): void {
    window.localStorage.removeItem(this.storageKey);
  }
}
