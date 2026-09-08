import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PersonaApi, ReferenciaApi, RolApi } from '@phoenix/basic/data-access';
import {
  DISTRITO_MIN_BUSQUEDA,
  PERSONA_MAX_APELLIDO,
  PERSONA_MAX_DIRECCION,
  PERSONA_MAX_NOMBRE,
  PERSONA_MAX_NOMBRE_COMERCIAL,
  PERSONA_MAX_RAZ_SOC,
  PERSONA_MAX_TITULO,
  etiquetaDistrito,
  type Distrito,
  type PersonaFicha,
  type PersonaInput,
  type TipoPersona,
} from '@phoenix/basic/domain';
import {
  ComboSearch,
  ConfirmService,
  FormContent,
  Icon,
  NotificationService,
  PageHeader,
} from '@phoenix/shared/ui';

/** Opción del combo de distrito: el id más la etiqueta ya compuesta. */
interface OpcionDistrito {
  distritoid: number;
  etiqueta: string;
  nombre: string;
}

/**
 * Alta y edición de una persona (`basic.persona`, proceso `PERSONA`).
 *
 * Es PÁGINA PROPIA y no un modal porque el formulario tiene dos variantes —natural y
 * jurídica— y cuatro listas dinámicas más los roles.
 *
 * ⚠ **EL PERMISO NO ES SOLO EL DEL MENÚ.** Además del proceso `PERSONA` que exige el
 * guard de la ruta, el stored procedure comprueba por su cuenta `persona-add` (alta) o
 * `persona-edit` (edición) contra `basic.proceso`, el SEGUNDO sistema de permisos del
 * legacy. Y ese sistema **no tiene paso libre para el superusuario**: sin la concesión,
 * ni el administrador puede guardar. Sale como 403 y lo notifica el interceptor.
 *
 * ⚠ **LAS CINCO LISTAS SE GUARDAN POR REEMPLAZO.** El backend recibe siempre el juego
 * completo y borra lo que no llegue. Por eso el formulario carga la ficha entera antes de
 * editar y la manda entera al guardar: mandar solo lo tocado vaciaría el resto.
 *
 * ⚠ **LA FOTO NO SE TOCA AQUÍ.** Tiene su propio endpoint en el legacy y su propio
 * permiso (`persona-photo`), y no está migrada. La ficha la trae de solo lectura.
 */
@Component({
  selector: 'erp-persona-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, FormContent, ComboSearch, Icon],
  templateUrl: './persona-form-page.html',
  styleUrl: './persona-form-page.scss',
})
export class PersonaFormPage {
  private readonly api = inject(PersonaApi);
  private readonly referencia = inject(ReferenciaApi);
  private readonly rolApi = inject(RolApi);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly maxTitulo = PERSONA_MAX_TITULO;
  protected readonly maxApellido = PERSONA_MAX_APELLIDO;
  protected readonly maxNombre = PERSONA_MAX_NOMBRE;
  protected readonly maxRazSoc = PERSONA_MAX_RAZ_SOC;
  protected readonly maxNombreComercial = PERSONA_MAX_NOMBRE_COMERCIAL;
  protected readonly maxDireccion = PERSONA_MAX_DIRECCION;
  protected readonly minBusquedaDistrito = DISTRITO_MIN_BUSQUEDA;

  /** `null` = alta; con valor = edición de esa persona. */
  private readonly personaid = signal<number | null>(this.leerIdDeRuta());

  private leerIdDeRuta(): number | null {
    const crudo = this.route.snapshot.paramMap.get('id');
    if (!crudo) return null;
    const id = Number(crudo);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  protected readonly esEdicion = computed(() => this.personaid() !== null);
  protected readonly titulo = computed(() =>
    this.esEdicion() ? 'Editar persona' : 'Nueva persona',
  );

  // ── Formulario ──────────────────────────────────────────────────────
  /**
   * Un solo formulario para los dos tipos. Los campos de la mitad que no aplica se
   * quedan ahí pero no se validan: `actualizarValidadoresPorTipo` los enciende y los
   * apaga, porque los `required` dependen de `tipo`.
   */
  protected readonly form = this.fb.nonNullable.group({
    tipo: 'N' as TipoPersona,

    // Persona natural.
    titulo: ['', [Validators.maxLength(PERSONA_MAX_TITULO)]],
    ape_pat: ['', [Validators.maxLength(PERSONA_MAX_APELLIDO)]],
    ape_mat: ['', [Validators.maxLength(PERSONA_MAX_APELLIDO)]],
    nombre: ['', [Validators.maxLength(PERSONA_MAX_NOMBRE)]],
    sexo: '',
    est_civil: '',
    nacimiento: '',

    // Persona jurídica.
    raz_soc: ['', [Validators.maxLength(PERSONA_MAX_RAZ_SOC)]],
    nombre_comercial: ['', [Validators.maxLength(PERSONA_MAX_NOMBRE_COMERCIAL)]],

    // Comunes.
    direccion: ['', [Validators.maxLength(PERSONA_MAX_DIRECCION)]],
    distritoid: [0, [Validators.required, Validators.min(1)]],
    paisid: [0, [Validators.required, Validators.min(1)]],

    telefonos: this.fb.array<ReturnType<PersonaFormPage['filaTelefono']>>([]),
    emails: this.fb.array<ReturnType<PersonaFormPage['filaEmail']>>([]),
    redes: this.fb.array<ReturnType<PersonaFormPage['filaRed']>>([]),
    documentos: this.fb.array<ReturnType<PersonaFormPage['filaDocumento']>>([]),
    roles: this.fb.nonNullable.control<number[]>([]),
  });

  constructor() {
    this.actualizarValidadoresPorTipo(this.form.controls.tipo.value);
    this.form.controls.tipo.valueChanges.subscribe((tipo) =>
      this.actualizarValidadoresPorTipo(tipo),
    );
    // Editar arranca pidiendo la ficha; el alta no pide nada.
    void this.cargar();
  }

  /**
   * Enciende los `required` de la mitad que aplica y apaga los de la otra.
   *
   * ⚠ `nacimiento` es obligatorio para una persona NATURAL: la columna
   * `basic.persona_natural.nacimiento` es NOT NULL. Sin esto, el alta reventaba en la
   * base con un error que no decía qué campo faltaba.
   */
  private actualizarValidadoresPorTipo(tipo: TipoPersona): void {
    const c = this.form.controls;
    const natural = tipo === 'N';

    c.ape_pat.setValidators(
      natural
        ? [Validators.required, Validators.maxLength(PERSONA_MAX_APELLIDO)]
        : [Validators.maxLength(PERSONA_MAX_APELLIDO)],
    );
    c.nombre.setValidators(
      natural
        ? [Validators.required, Validators.maxLength(PERSONA_MAX_NOMBRE)]
        : [Validators.maxLength(PERSONA_MAX_NOMBRE)],
    );
    c.nacimiento.setValidators(natural ? [Validators.required] : []);
    c.raz_soc.setValidators(
      natural
        ? [Validators.maxLength(PERSONA_MAX_RAZ_SOC)]
        : [Validators.required, Validators.maxLength(PERSONA_MAX_RAZ_SOC)],
    );

    this.esNatural.set(natural);

    for (const ctrl of [c.ape_pat, c.nombre, c.nacimiento, c.raz_soc]) {
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  /**
   * ⚠ SEÑAL, no `computed(() => this.form.controls.tipo.value === 'N')`.
   *
   * Un control de formulario reactivo NO es una señal: un `computed` que lo lea se
   * calcula una vez y no vuelve a recalcularse nunca. La plantilla se quedaba pintando
   * para siempre la mitad de persona natural aunque el usuario eligiera jurídica. Se
   * actualiza desde el mismo `valueChanges` que mueve los validadores.
   */
  protected readonly esNatural = signal(true);

  // ── Listas dinámicas ────────────────────────────────────────────────
  protected filaTelefono(v?: {
    telefonoid?: number;
    tipoid?: number;
    numero?: string;
    nombre?: string;
    main?: boolean;
    publico?: boolean;
  }) {
    return this.fb.nonNullable.group({
      // 0 = alta. Con valor, el backend ACTUALIZA esa fila en vez de duplicarla.
      telefonoid: v?.telefonoid ?? 0,
      tipoid: [v?.tipoid ?? 0, [Validators.required, Validators.min(1)]],
      numero: [v?.numero ?? '', [Validators.required]],
      nombre: v?.nombre ?? '',
      main: v?.main ?? false,
      publico: v?.publico ?? false,
    });
  }

  protected filaEmail(v?: {
    emailid?: number;
    tipoid?: number;
    email?: string;
    main?: boolean;
    publico?: boolean;
  }) {
    return this.fb.nonNullable.group({
      emailid: v?.emailid ?? 0,
      tipoid: [v?.tipoid ?? 0, [Validators.required, Validators.min(1)]],
      email: [v?.email ?? '', [Validators.required, Validators.email]],
      main: v?.main ?? false,
      publico: v?.publico ?? false,
    });
  }

  protected filaRed(v?: { tipoid?: number; usuario?: string }) {
    return this.fb.nonNullable.group({
      tipoid: [v?.tipoid ?? 0, [Validators.required, Validators.min(1)]],
      usuario: [v?.usuario ?? '', [Validators.required]],
    });
  }

  protected filaDocumento(v?: { tipoid?: number; numero?: string }) {
    return this.fb.nonNullable.group({
      tipoid: [v?.tipoid ?? 0, [Validators.required, Validators.min(1)]],
      numero: [v?.numero ?? '', [Validators.required]],
    });
  }

  protected get telefonos(): FormArray {
    return this.form.controls.telefonos as unknown as FormArray;
  }
  protected get emails(): FormArray {
    return this.form.controls.emails as unknown as FormArray;
  }
  protected get redes(): FormArray {
    return this.form.controls.redes as unknown as FormArray;
  }
  protected get documentos(): FormArray {
    return this.form.controls.documentos as unknown as FormArray;
  }

  /** Añade una fila con el tipo marcado «por defecto» ya elegido, si lo hay. */
  protected agregarTelefono(): void {
    this.telefonos.push(this.filaTelefono({ tipoid: this.tipoPorDefecto('telefono') }));
  }
  protected agregarEmail(): void {
    this.emails.push(this.filaEmail({ tipoid: this.tipoPorDefecto('email') }));
  }
  protected agregarRed(): void {
    this.redes.push(this.filaRed());
  }
  protected agregarDocumento(): void {
    this.documentos.push(this.filaDocumento());
  }

  protected quitar(lista: FormArray, i: number): void {
    lista.removeAt(i);
  }

  private tipoPorDefecto(cual: 'telefono' | 'email'): number {
    const lista = cual === 'telefono' ? this.tiposTelefono() : this.tiposEmail();
    return lista.find((t) => t.pordefecto)?.tipoid ?? 0;
  }

  // ── Roles ───────────────────────────────────────────────────────────
  protected tieneRol(rolid: number): boolean {
    return this.form.controls.roles.value.includes(rolid);
  }

  protected alternarRol(rolid: number): void {
    const actuales = this.form.controls.roles.value;
    this.form.controls.roles.setValue(
      actuales.includes(rolid) ? actuales.filter((r) => r !== rolid) : [...actuales, rolid],
    );
  }

  // ── Catálogos ───────────────────────────────────────────────────────
  // ⚠ `hasValue()` y no `value() ?? []`: un resource en error LANZA al leer `value()`, y
  // como esto se lee durante el render, un catálogo caído se llevaría la pantalla entera.
  private readonly paisesRes = resource({
    loader: () => firstValueFrom(this.referencia.paises()),
  });
  private readonly rolesRes = resource({ loader: () => firstValueFrom(this.rolApi.list()) });
  private readonly tiposTelefonoRes = resource({
    loader: () => firstValueFrom(this.referencia.tiposTelefono()),
  });
  private readonly tiposEmailRes = resource({
    loader: () => firstValueFrom(this.referencia.tiposEmail()),
  });
  private readonly tiposRedRes = resource({
    loader: () => firstValueFrom(this.referencia.tiposRedSocial()),
  });
  private readonly tiposIDRes = resource({
    loader: () => firstValueFrom(this.referencia.tiposID()),
  });

  protected readonly roles = computed(() =>
    this.rolesRes.hasValue() ? this.rolesRes.value() : [],
  );
  protected readonly tiposTelefono = computed(() =>
    this.tiposTelefonoRes.hasValue() ? this.tiposTelefonoRes.value() : [],
  );
  protected readonly tiposEmail = computed(() =>
    this.tiposEmailRes.hasValue() ? this.tiposEmailRes.value() : [],
  );
  protected readonly tiposRed = computed(() =>
    this.tiposRedRes.hasValue() ? this.tiposRedRes.value() : [],
  );
  protected readonly tiposID = computed(() =>
    this.tiposIDRes.hasValue() ? this.tiposIDRes.value() : [],
  );
  protected readonly paises = computed(() =>
    this.paisesRes.hasValue() ? this.paisesRes.value() : [],
  );

  // ── Distritos (buscador, no catálogo) ───────────────────────────────
  protected readonly busquedaDistrito = signal('');
  private readonly distritosRes = resource({
    params: () => this.busquedaDistrito(),
    loader: ({ params }) => firstValueFrom(this.referencia.distritos({ q: params })),
  });
  private readonly distritoActual = signal<OpcionDistrito | null>(null);

  protected readonly opcionesDistrito = computed<OpcionDistrito[]>(() => {
    const hallados = this.distritosRes.hasValue() ? this.distritosRes.value() : [];
    const encontrados: OpcionDistrito[] = hallados.map((d: Distrito) => ({
      distritoid: d.distritoid,
      etiqueta: etiquetaDistrito(d),
      nombre: d.nombre,
    }));
    const actual = this.distritoActual();
    if (actual && !encontrados.some((o) => o.distritoid === actual.distritoid)) {
      return [actual, ...encontrados];
    }
    return encontrados;
  });

  protected readonly buscandoDistritos = this.distritosRes.isLoading;

  protected onBuscarDistrito(texto: string): void {
    this.busquedaDistrito.set(texto.trim());
  }

  // ── Carga de la ficha ───────────────────────────────────────────────
  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);
  /** Registro de alta, de solo lectura; solo existe al editar. */
  protected readonly registro = signal('');

  private async cargar(): Promise<void> {
    const id = this.personaid();
    if (id === null) return;

    this.cargando.set(true);
    try {
      const ficha = await firstValueFrom(this.api.get(id));
      this.volcar(ficha);
    } catch {
      // El interceptor ya notificó; se deja el aviso en pantalla porque sin ficha el
      // formulario no puede editar nada.
      this.errorCarga.set('No se pudo cargar la ficha de la persona.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Vuelca la ficha en el formulario, listas incluidas. */
  private volcar(f: PersonaFicha): void {
    this.registro.set(f.registro);
    this.distritoActual.set({
      distritoid: f.distritoid,
      etiqueta: `${f.distrito_nombre} (${f.provincia_nombre}, ${f.departamento_nombre})`,
      nombre: f.distrito_nombre,
    });

    this.form.patchValue({
      tipo: f.tipo,
      titulo: f.titulo,
      ape_pat: f.ape_pat,
      ape_mat: f.ape_mat,
      nombre: f.nombre,
      sexo: f.sexo,
      est_civil: f.est_civil,
      nacimiento: f.nacimiento,
      raz_soc: f.raz_soc,
      nombre_comercial: f.nombre_comercial,
      direccion: f.direccion,
      distritoid: f.distritoid,
      paisid: f.paisid,
      roles: f.roles,
    });

    this.telefonos.clear();
    for (const t of f.telefonos) this.telefonos.push(this.filaTelefono(t));
    this.emails.clear();
    for (const e of f.emails) this.emails.push(this.filaEmail(e));
    this.redes.clear();
    for (const r of f.social_media) this.redes.push(this.filaRed(r));
    this.documentos.clear();
    for (const d of f.documentos) this.documentos.push(this.filaDocumento(d));
  }

  // ── Guardado ────────────────────────────────────────────────────────
  protected async onGuardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.error('Revise los campos marcados.');
      return;
    }
    if (this.guardando()) return;

    const v = this.form.getRawValue();
    const natural = v.tipo === 'N';

    /**
     * ⚠ Se manda SIEMPRE el juego completo de las cinco listas: el backend guarda por
     * reemplazo y borra lo que no llegue.
     *
     * Y se limpian los campos de la mitad que no aplica. El stored procedure escribe en
     * `persona_natural` o en `persona_juridica` según el tipo y borra la fila del otro,
     * así que arrastrar una razón social en una persona natural solo confundiría al
     * siguiente que lea el JSON.
     */
    const input: PersonaInput = {
      tipo: v.tipo,
      direccion: v.direccion,
      distritoid: v.distritoid,
      paisid: v.paisid,

      titulo: natural ? v.titulo : '',
      ape_pat: natural ? v.ape_pat : '',
      ape_mat: natural ? v.ape_mat : '',
      nombre: natural ? v.nombre : '',
      sexo: natural ? v.sexo : '',
      est_civil: natural ? v.est_civil : '',
      nacimiento: natural ? v.nacimiento : '',

      raz_soc: natural ? '' : v.raz_soc,
      nombre_comercial: natural ? '' : v.nombre_comercial,
      sunat_activo: false,
      sunat_habido: false,

      telefonos: this.telefonos.getRawValue(),
      emails: this.emails.getRawValue(),
      social_media: this.redes.getRawValue(),
      documentos: this.documentos.getRawValue(),
      roles: v.roles,
    };

    this.guardando.set(true);
    try {
      const id = this.personaid();
      const guardada =
        id === null
          ? await firstValueFrom(this.api.create(input))
          : await firstValueFrom(this.api.update(id, input));

      this.notify.success(id === null ? 'Persona creada.' : 'Persona actualizada.');
      this.form.markAsPristine();
      void this.router.navigate(['/mantenimiento/personas']);
      return void guardada;
    } catch {
      // 403 (permiso del stored procedure), 409 (duplicado) y 422 (validación): el
      // `error-interceptor` ya mostró el `message` del backend, que en 4xx es seguro. La
      // página se queda con lo escrito.
    } finally {
      this.guardando.set(false);
    }
  }

  /** Vuelve al listado, avisando si hay cambios sin guardar. */
  protected async onCancelar(): Promise<void> {
    if (this.form.dirty) {
      const ok = await this.confirm.ask({
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar. ¿Salir de todos modos?',
        confirmText: 'Salir',
        tone: 'danger',
      });
      if (!ok) return;
    }
    void this.router.navigate(['/mantenimiento/personas']);
  }
}
