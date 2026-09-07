import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Raíz de la app: solo monta el `router-outlet`. El chrome (navbar/sidebar/breadcrumbs) lo aporta
 * `MainLayout`, que envuelve las rutas privadas; `login` queda fuera, sin chrome.
 */
@Component({
  selector: 'erp-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
