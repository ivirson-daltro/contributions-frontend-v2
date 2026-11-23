import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'warning' | 'error';

export interface Toast {
  readonly id: number;
  readonly type: ToastType;
  readonly message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  private nextId = 1;
  readonly toasts = this.toastsSignal.asReadonly();

  show(type: ToastType, message: string, duration = 5000): void {
    const id = this.nextId++;
    this.toastsSignal.update((toasts) => [...toasts, { id, type, message }]);
    window.setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string, duration?: number): void {
    this.show('success', message, duration);
  }

  warning(message: string, duration?: number): void {
    this.show('warning', message, duration);
  }

  error(message: string, duration?: number): void {
    this.show('error', message, duration);
  }

  dismiss(id: number): void {
    this.toastsSignal.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }
}
