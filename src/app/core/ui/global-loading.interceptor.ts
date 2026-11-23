import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { GlobalLoadingService } from './global-loading.service';

export const globalLoadingInterceptor: HttpInterceptorFn = (request, next) => {
  const loading = inject(GlobalLoadingService);
  loading.show();
  return next(request).pipe(finalize(() => loading.hide()));
};
