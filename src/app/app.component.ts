import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { GlobalLoadingService } from './core/ui/global-loading.service';
import { ToastService } from './core/ui/toast.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly loading = inject(GlobalLoadingService);
  protected readonly toast = inject(ToastService);
  protected readonly title = signal('@ibg/app');
  private readonly loadingDialog = viewChild<ElementRef<HTMLDialogElement>>('loadingDialog');

  constructor() {
    effect(() => {
      const shouldLoad = this.loading.isLoading();
      const dialog = this.loadingDialog()?.nativeElement;
      if (!dialog) return;

      if (shouldLoad && !dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
      } else if (!shouldLoad && dialog.open) {
        dialog.close();
      }
    });
  }
}
