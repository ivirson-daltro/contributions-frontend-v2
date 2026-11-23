import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GlobalLoadingService {
  private readonly pendingRequests = signal<ReadonlySet<number>>(new Set());
  private nextRequestId = 1;
  readonly isLoading = computed(() => this.pendingRequests().size > 0);

  show(): number {
    const requestId = this.nextRequestId++;
    this.pendingRequests.update((requests) => new Set(requests).add(requestId));
    return requestId;
  }

  hide(requestId?: number): void {
    if (requestId === undefined) {
      this.pendingRequests.set(new Set());
      return;
    }
    this.pendingRequests.update((requests) => {
      const remaining = new Set(requests);
      remaining.delete(requestId);
      return remaining;
    });
  }

  async track<T>(operation: () => Promise<T>): Promise<T> {
    const requestId = this.show();
    try {
      return await operation();
    } finally {
      this.hide(requestId);
    }
  }
}
