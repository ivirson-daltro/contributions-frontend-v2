import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const key = 'ibg.dashboard.theme';

  beforeEach(() => {
    window.localStorage.removeItem(key);
    document.documentElement.classList.remove('dark-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem(key);
    document.documentElement.classList.remove('dark-theme');
  });

  it('restores the saved theme and updates the document and storage when toggled', () => {
    window.localStorage.setItem(key, 'dark');
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDarkTheme()).toBe(true);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);

    theme.toggle();
    expect(theme.isDarkTheme()).toBe(false);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
    expect(window.localStorage.getItem(key)).toBe('light');
  });

  it('applies the session theme and reports a storage write failure', () => {
    const theme = TestBed.inject(ThemeService);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    theme.toggle();
    expect(theme.isDarkTheme()).toBe(true);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
    expect(theme.feedback()).toContain('não foi possível salvar');
  });

  it('uses the light theme and reports a storage read failure', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDarkTheme()).toBe(false);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
    expect(theme.feedback()).toContain('Não foi possível carregar');
  });
});
