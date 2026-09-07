import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../auth-store';

/**
 * Página de login (componente smart). Orquesta `AuthStore.login()`, que ya integra la device key
 * (ECDSA P-256 en IndexedDB, clave pública JWK en el body) y `withCredentials` para recibir la
 * cookie httpOnly de refresh. El access token queda SOLO en memoria (signals del store).
 *
 * Decisiones de diseño: SSO Microsoft visible pero deshabilitado ("próximamente"); sin
 * "Recuérdame". Multi-tenant v1: se usa el tenant que devuelva el backend; el cambio posterior
 * vive en el navbar (switchTenant), no aquí.
 *
 * Nota de arquitectura: este componente NO usa `<erp-icon>` (shared/ui es `type:ui` y shared/auth
 * es `type:data-access`; la frontera prohíbe la dependencia). Por eso sus SVG van inline en la
 * plantilla; su fuente canónica sigue siendo `ICON_REGISTRY` (brand/microsoft/eye/eye-off).
 */
@Component({
  selector: 'erp-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  // El "usuario" puede ser un nombre de usuario o un correo: solo se exige que no esté vacío
  // (sin Validators.email). La clave `email` se conserva por el contrato de `AuthStore.login()`.
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.form.getRawValue());
      await this.router.navigateByUrl(this.router.parseUrl(this.returnUrl() ?? '/inicio'));
    } catch (e: unknown) {
      this.error.set(this.mapError(e));
    } finally {
      this.submitting.set(false);
    }
  }

  /** Si `authGuard` redirigió aquí con `?returnUrl=…`, volver ahí tras el login. */
  private returnUrl(): string | null {
    return new URLSearchParams(location.search).get('returnUrl');
  }

  /**
   * Mensaje genérico de credenciales. NO se distingue "usuario inexistente" de "contraseña
   * incorrecta": mismo texto para ambos (práctica de seguridad estándar; no filtrar enumeración).
   */
  private mapError(_e: unknown): string {
    return 'Usuario o contraseña incorrectos.';
  }
}
