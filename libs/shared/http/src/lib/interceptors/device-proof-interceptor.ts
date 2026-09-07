import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { DEVICE_PROOF_FN } from '../tokens';
import { requiresDeviceProof } from '../auth-endpoints';

/**
 * Añade el header `X-Device-Proof` (DPoP-style) SOLO a los endpoints de auth (login/refresh).
 * La firma se obtiene por inversión (`DEVICE_PROOF_FN`); si no hay clave → no hay proof → el
 * servidor pedirá login. Comportamiento esperado.
 */
export const deviceProofInterceptor: HttpInterceptorFn = (req, next) => {
  if (!requiresDeviceProof(req.url)) {
    return next(req);
  }
  const createProof = inject(DEVICE_PROOF_FN);
  return from(createProof(req.method, req.url)).pipe(
    switchMap((proof) =>
      next(proof ? req.clone({ setHeaders: { 'X-Device-Proof': proof } }) : req),
    ),
  );
};
