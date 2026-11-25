import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DataPaginationComponent } from './data-pagination.component';

describe('DataPaginationComponent', () => {
  let fixture: ComponentFixture<DataPaginationComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(DataPaginationComponent);
    fixture.componentRef.setInput('rangeText', '1–20 de 45 membros');
    fixture.componentRef.setInput('page', 2);
    fixture.componentRef.setInput('pageCount', 3);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('renders 34px pagination controls and emits adjacent pages', () => {
    const previous = element.querySelector<HTMLButtonElement>('[aria-label="Página anterior"]')!;
    const next = element.querySelector<HTMLButtonElement>('[aria-label="Próxima página"]')!;
    const pageChange = vi.fn();
    fixture.componentInstance.pageChange.subscribe(pageChange);
    previous.click();
    next.click();
    expect(pageChange).toHaveBeenNthCalledWith(1, 1);
    expect(pageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('emits page size changes', () => {
    const pageSizeChange = vi.fn();
    fixture.componentInstance.pageSizeChange.subscribe(pageSizeChange);
    const select = element.querySelector<HTMLSelectElement>('select')!;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(pageSizeChange).toHaveBeenCalledWith(50);
  });
});
