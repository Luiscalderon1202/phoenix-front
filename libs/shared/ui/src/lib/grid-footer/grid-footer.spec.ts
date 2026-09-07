import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PageMeta } from '@phoenix/shared/api';
import { GridFooter } from './grid-footer';

/**
 * El selector de "Filas por página" debe reflejar el `pageSize` de la meta, que
 * NO tiene por qué ser la primera opción de la lista (empleados arranca en 50).
 */
describe('GridFooter — selector de tamaño de página', () => {
  let fixture: ComponentFixture<GridFooter>;
  let select: HTMLSelectElement;

  const meta = (pageSize: number): PageMeta => ({
    page: 1,
    pageSize,
    total: 200,
    totalPages: Math.ceil(200 / pageSize),
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GridFooter);
    fixture.componentRef.setInput('pageSizes', [10, 25, 50, 100]);
    fixture.componentRef.setInput('meta', meta(50));
    fixture.detectChanges();
    select = fixture.nativeElement.querySelector('select');
  });

  it('marca el tamaño vigente ya en el primer render', () => {
    expect(select.value).toBe('50');
  });

  it('se resincroniza cuando cambia la meta', () => {
    fixture.componentRef.setInput('meta', meta(100));
    fixture.detectChanges();
    expect(select.value).toBe('100');
  });

  it('emite el nuevo tamaño al cambiar la selección', () => {
    const emitidos: number[] = [];
    fixture.componentInstance.pageSizeChange.subscribe((v) => emitidos.push(v));
    select.value = '25';
    select.dispatchEvent(new Event('change'));
    expect(emitidos).toEqual([25]);
  });
});
