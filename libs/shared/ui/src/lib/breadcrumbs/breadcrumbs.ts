import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  type ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
} from '@angular/router';
import { filter } from 'rxjs';

/** Migaja de pan: etiqueta + url acumulada (la última es la página actual, sin enlace). */
interface Crumb {
  label: string;
  url: string;
}

/**
 * Breadcrumbs derivados de la RUTA de Angular (no de un estado paralelo). Recorre la cadena de
 * `ActivatedRoute` activa y lee `route.data.breadcrumb` (o `title`) de cada tramo. Se auto-mantiene
 * al navegar: no hay que sincronizar nada manualmente.
 *
 * Cada ruta declara, p.ej.: `data: { title: 'Balance', breadcrumb: 'Balance de comprobación' }`.
 */
@Component({
  selector: 'erp-breadcrumbs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav class="breadcrumbs" aria-label="Ruta de navegación">
      <ol class="breadcrumbs__list">
        @for (crumb of trail(); track crumb.url; let last = $last) {
          <li class="breadcrumbs__item">
            @if (last) {
              <span class="breadcrumbs__current" aria-current="page">{{ crumb.label }}</span>
            } @else {
              <a class="breadcrumbs__link" [routerLink]="crumb.url">{{ crumb.label }}</a>
              <span class="breadcrumbs__sep" aria-hidden="true">/</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [
    `
      .breadcrumbs__list {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: var(--fs-13);
      }
      .breadcrumbs__item {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      .breadcrumbs__link {
        color: var(--text-muted);
        text-decoration: none;
      }
      .breadcrumbs__link:hover {
        color: var(--active-text);
        text-decoration: underline;
      }
      .breadcrumbs__sep {
        color: var(--text-dim);
      }
      .breadcrumbs__current {
        color: var(--text);
        font-weight: var(--fw-semibold);
      }
    `,
  ],
})
export class Breadcrumbs {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly trail = signal<Crumb[]>([]);

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.trail.set(this.build()));

    this.trail.set(this.build());
  }

  /** Recorre la cadena de snapshots desde la raíz acumulando segmentos de URL y etiquetas. */
  private build(): Crumb[] {
    const crumbs: Crumb[] = [];
    let url = '';
    let snapshot: ActivatedRouteSnapshot | null = this.route.snapshot.root;

    while (snapshot) {
      const segment = snapshot.url.map((s) => s.path).join('/');
      if (segment) url += `/${segment}`;

      const label = (snapshot.data['breadcrumb'] ?? snapshot.data['title']) as string | undefined;
      // Evita duplicar una migaja cuando un tramo sin segmento propio repite la etiqueta del padre.
      if (label && crumbs[crumbs.length - 1]?.label !== label) {
        crumbs.push({ label, url: url || '/' });
      }

      snapshot = snapshot.firstChild;
    }

    return crumbs;
  }
}
