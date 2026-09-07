import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../auth-store';

/**
 * Cambio obligatorio de contraseña.
 *
 * Aquí aterriza quien ingresa con la clave temporal. Es obligatorio porque esa
 * clave NO es secreta: con `CLAVE_TEMPORAL_MODO=documento` es el DNI de la
 * persona —que aparece en el listado de Personal— y en modo fija la conoce todo
 * el que haya creado una cuenta antes.
 *
 * Nota de arquitectura, igual que en LoginPage: `shared/auth` es `type:data-access`
 * y la frontera prohíbe depender de `shared/ui`, así que esta pantalla no usa
 * `<erp-icon>` ni sus componentes.
 */
@Component({
  selector: 'erp-cambio-clave-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './cambio-clave-page.html',
  styleUrl: './cambio-clave-page.scss',
})
export class CambioClavePage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrar = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    claveActual: ['', [Validators.required]],
    claveNueva: ['', [Validators.required, Validators.minLength(8)]],
    repetir: ['', [Validators.required]],
  });

  /** Solo informativo: quien llega por su propia voluntad ve otro texto. */
  protected readonly obligatorio = this.auth.debeCambiarClave;

  protected toggleMostrar(): void {
    this.mostrar.update((v) => !v);
  }

  /** La confirmación se valida aquí y no con un validador de grupo: es un solo caso. */
  protected get noCoincide(): boolean {
    const { claveNueva, repetir } = this.form.getRawValue();
    return repetir.length > 0 && claveNueva !== repetir;
  }

  async onSubmit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid || this.noCoincide) {
      this.form.markAllAsTouched();
      return;
    }

    const { claveActual, claveNueva } = this.form.getRawValue();
    this.submitting.set(true);
    try {
      await this.auth.cambiarClave({ claveActual, claveNueva });
      // El guard ya no redirige: debeCambiarClave bajó a false.
      await this.router.navigate(['/inicio']);
    } catch (e) {
      this.error.set(
        e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
