import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'erp-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Inicio</h1>
    <p>Bienvenido a Phoenix. Selecciona un módulo en la navegación.</p>
  `,
})
export class HomePage {}
