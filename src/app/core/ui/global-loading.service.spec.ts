import { TestBed } from '@angular/core/testing';
import { GlobalLoadingService } from './global-loading.service';

describe('GlobalLoadingService', () => {
  it('remains loading until every independent operation is completed', () => {
    const loading = TestBed.inject(GlobalLoadingService);

    const first = loading.show();
    const second = loading.show();
    expect(loading.isLoading()).toBe(true);

    loading.hide(first);
    expect(loading.isLoading()).toBe(true);

    loading.hide(second);
    expect(loading.isLoading()).toBe(false);
  });

  it('can reset stale operations explicitly', () => {
    const loading = TestBed.inject(GlobalLoadingService);
    loading.show();
    loading.show();

    loading.hide();

    expect(loading.isLoading()).toBe(false);
  });
});
