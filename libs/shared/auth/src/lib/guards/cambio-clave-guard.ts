import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth-store';

/**
 * Ruta a la que se desvía a quien tiene una contraseña temporal pendiente.
 * Se exporta para que el guard y la propia pantalla no la escriban por separado.
 */
export const RUTA_CAMBIO_CLAVE = '/cambiar-clave';

/**
 * Impide operar mientras la contraseña siga siendo la temporal.
 *
 * Existe porque la temporal NO es secreta: con `CLAVE_TEMPORAL_MODO=documento` es
 * el DNI de la persona —que figura en el listado de Personal— y en modo fija la
 * conoce todo el que haya creado una cuenta antes. Sin este desvío, una cuenta
 * recién creada quedaría accesible con un dato semipúblico por tiempo indefinido.
 *
 * ⚠️ Es una barrera de NAVEGACIÓN, no de datos: el backend sigue aceptando las
 * peticiones de ese usuario. Cierra el caso normal (la persona entra y opera sin
 * cambiar nada), no a un atacante que llame al API directo.
 */
export const cambioClaveGuard: CanActivateFn = (_route, state) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (!store.isAuthenticated() || !store.debeCambiarClave()) return true;
  // Sin esta salida el guard se redirigiría a sí mismo en bucle.
  if (state.url.startsWith(RUTA_CAMBIO_CLAVE)) return true;

  return router.createUrlTree([RUTA_CAMBIO_CLAVE]);
};
