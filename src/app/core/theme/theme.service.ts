import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from '../ui/toast.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly toast = inject(ToastService);
  private readonly preferenceKey = 'ibg.dashboard.theme';
  private readonly darkTheme = signal(false);
  readonly isDarkTheme = this.darkTheme.asReadonly();
  readonly feedback = signal('');

  constructor() {
    try {
      this.applyTheme(window.localStorage.getItem(this.preferenceKey) === 'dark');
    } catch {
      this.applyTheme(false);
      this.feedback.set('Não foi possível carregar sua preferência de tema; o tema claro foi aplicado.');
      this.toast.warning(this.feedback());
    }
  }

  toggle(): void {
    const dark = !this.darkTheme();
    this.applyTheme(dark);
    this.feedback.set('');
    try {
      window.localStorage.setItem(this.preferenceKey, dark ? 'dark' : 'light');
    } catch {
      this.feedback.set('Tema aplicado nesta sessão, mas não foi possível salvar sua preferência.');
      this.toast.warning(this.feedback());
    }
  }

  private applyTheme(dark: boolean): void {
    this.darkTheme.set(dark);
    this.document.documentElement.classList.toggle('dark-theme', dark);
  }
}
