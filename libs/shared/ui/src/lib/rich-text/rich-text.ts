import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Editor de texto enriquecido liviano, sin dependencias externas. Una barra de
 * herramientas (negrita, cursiva, subrayado, listas, enlace, limpiar) opera
 * sobre un `contenteditable`. Implementa ControlValueAccessor: el valor del
 * control es HTML (string), igual que cualquier input reactivo:
 *
 *   <erp-rich-text formControlName="descripcion" placeholder="Describe…" />
 *
 * El HTML se muestra luego con `[innerHTML]`, que Angular sanea (elimina
 * scripts/handlers) antes de pintar. Usa `document.execCommand`: está marcado
 * como obsoleto pero sigue soportado en todos los navegadores y evita añadir
 * una dependencia de editor.
 */
@Component({
  selector: 'erp-rich-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rich-text.html',
  styleUrl: './rich-text.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichText),
      multi: true,
    },
  ],
})
export class RichText implements ControlValueAccessor, AfterViewInit {
  private readonly editorRef = viewChild.required<ElementRef<HTMLDivElement>>('editor');

  readonly placeholder = input('');

  protected readonly disabled = signal(false);
  protected readonly empty = signal(true);

  /** Buffer para el valor recibido antes de que el `contenteditable` exista. */
  private pending = '';
  private ready = false;

  ngAfterViewInit(): void {
    this.ready = true;
    this.render(this.pending);
  }

  // ── ControlValueAccessor ──────────────────────────────────────────
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(v: string | null): void {
    this.pending = v ?? '';
    if (this.ready) this.render(this.pending);
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  private render(html: string): void {
    const el = this.editorRef().nativeElement;
    el.innerHTML = html;
    this.empty.set(el.textContent?.trim() === '');
  }

  // ── Edición ───────────────────────────────────────────────────────
  protected onInput(): void {
    const el = this.editorRef().nativeElement;
    const vacio = el.textContent?.trim() === '';
    this.empty.set(vacio);
    // Un contenteditable vacío deja basura tipo "<br>"; normalizamos a "".
    this.onChange(vacio ? '' : el.innerHTML);
  }

  protected onBlur(): void {
    this.onInput();
    this.onTouched();
  }

  /** Ejecuta un comando de formato sobre la selección actual. */
  protected exec(cmd: string, value?: string): void {
    if (this.disabled()) return;
    this.editorRef().nativeElement.focus();
    document.execCommand(cmd, false, value);
    this.onInput();
  }

  protected addLink(): void {
    const url = window.prompt('URL del enlace (https://…):')?.trim();
    if (url) this.exec('createLink', url);
  }
}
