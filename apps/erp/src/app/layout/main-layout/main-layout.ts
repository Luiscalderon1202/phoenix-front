import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStore } from '@phoenix/shared/auth';
import { ConfirmDialog, Navbar, Sidebar, Toaster, UiPreferencesStore } from '@phoenix/shared/ui/chrome';
import { menusToNavNodes } from './menu-to-nav';

/**
 * Shell de la aplicación (orquestador). Vive en la app porque ENSAMBLA el chrome y lo conecta
 * con `AuthStore`/`UiPreferencesStore`; los componentes visuales son todos de `shared/ui` y se
 * mantienen presentacionales. Aquí no va lógica de negocio ni componentes de dominio.
 */
@Component({
  selector: 'erp-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Navbar, Sidebar, Toaster, ConfirmDialog],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly auth = inject(AuthStore);
  private readonly prefs = inject(UiPreferencesStore);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly tenant = this.auth.tenant;
  protected readonly collapsed = this.prefs.sidebarCollapsed;

  // En móvil el sidebar es un drawer superpuesto (oculto por defecto). Este estado es
  // independiente de `collapsed` (que controla el colapso en escritorio): el mismo botón ☰
  // alterna ambos, pero cada uno solo tiene efecto visible en su breakpoint.
  protected readonly mobileNavOpen = signal(false);

  // Árbol de navegación derivado del menú del usuario (backend, ya filtrado por permisos).
  // Reactivo: al (re)autenticarse o cambiar de tenant, el AuthStore actualiza `menus()`.
  protected readonly navNodes = computed(() => menusToNavNodes(this.auth.menus()));

  // Ruta activa para que el árbol resalte el item y abra sus ancestros.
  protected readonly activeRoute = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    // Carga (y recarga al cambiar de usuario) las preferencias cosméticas namespaced por userId.
    effect(() => {
      const uid = this.user()?.userid;
      this.prefs.load(uid != null ? String(uid) : null);
    });

    // Al navegar se cierra el drawer móvil (p.ej. al tocar un item del menú).
    effect(() => {
      this.activeRoute();
      this.mobileNavOpen.set(false);
    });
  }

  protected onToggleSidebar(): void {
    this.prefs.toggleSidebar(); // escritorio: colapsa/expande la columna
    this.mobileNavOpen.update((v) => !v); // móvil: abre/cierra el drawer
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected async onLogout(): Promise<void> {
    await this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
