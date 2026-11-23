import { Component, ElementRef, ViewChild, input, output } from '@angular/core';

@Component({
  selector: 'app-custom-confirm',
  templateUrl: './custom-confirm.component.html',
  styleUrl: './custom-confirm.component.scss',
})
export class CustomConfirmComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirmar');
  readonly busy = input(false);
  readonly confirmDisabled = input(false);
  readonly confirmed = output<void>();
  readonly closed = output<void>();
  @ViewChild('dialog') private dialog!: ElementRef<HTMLDialogElement>;

  open(): void {
    this.dialog.nativeElement.showModal();
  }

  close(): void {
    this.dialog.nativeElement.close();
  }

  protected cancel(): void {
    if (!this.busy()) this.close();
  }

  protected onCancel(event: Event): void {
    if (this.busy()) event.preventDefault();
  }
}
