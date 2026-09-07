import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStore } from '../auth-store';

/**
 * Factory de guard que verifica una acción sobre una opción de menú. Úsalo como `canMatch`.
 * Si el usuario no tiene el permiso, redirige a `/forbidden`.
 *
 * Lleva `menuid` porque los permisos se conceden por (menú, acción): la misma clave `ACT`
 * significa cosas distintas en Personal y en Tablas Básicas. Los ids salen de `oauth.menu`
 * (el backend los espeja en `internal/shared/menu`).
 *
 * ⚠️ Es solo para el enrutado: oculta la pantalla, no protege el dato. Cada endpoint
 * revalida el mismo par por su cuenta.
 */
export function permissionGuard(menuid: number, code: string): CanMatchFn {
  return () =>
    inject(AuthStore).can(menuid, code) || inject(Router).createUrlTree(['/forbidden']);
}

/**
 * Guard por proceso: el modelo de permisos de Phoenix.
 *
 * Sustituye a `permissionGuard` para las pantallas migradas de pseraphis, donde
 * el permiso es un código de proceso y no un par (menuid, acción). Se mantienen
 * los dos mientras convivan ambos modelos.
 *
 *     canMatch: [procesoGuard('PERSONA')]
 */
export function procesoGuard(proceso: string): CanMatchFn {
  return () =>
    inject(AuthStore).puedeProceso(proceso) || inject(Router).createUrlTree(['/forbidden']);
}
