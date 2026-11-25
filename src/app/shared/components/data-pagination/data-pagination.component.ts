import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-data-pagination',
  templateUrl: './data-pagination.component.html',
  styleUrl: './data-pagination.component.scss',
})
export class DataPaginationComponent {
  readonly rangeText = input.required<string>();
  readonly page = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly pageSize = input<number>(20);
  readonly pageSizeOptions = input<readonly number[]>([8, 20, 50]);
  readonly pageSizeClass = input('');
  readonly loading = input(false);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  protected previous(): void {
    if (this.page() > 1 && !this.loading()) this.pageChange.emit(this.page() - 1);
  }

  protected next(): void {
    if (this.page() < this.pageCount() && !this.loading()) this.pageChange.emit(this.page() + 1);
  }

  protected changePageSize(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLSelectElement)) return;
    const size = Number(input.value);
    if (this.pageSizeOptions().includes(size)) {
      this.pageSizeChange.emit(size);
    }
  }
}
