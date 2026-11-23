import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GlobalLoadingService {
  private readonly pendingRequests = signal(0);
  readonly isLoading = computed(() => this.pendingRequests() > 0);

  show(): void {
    this.pendingRequests.update((count) => count + 1);
  }

  hide(): void {
    this.pendingRequests.update((count) => Math.max(0, count - 1));
  }

  async track<T>(operation: () => Promise<T>): Promise<T> {
    this.show();
    try {
      return await operation();
    } finally {
      this.hide();
    }
  }
}
