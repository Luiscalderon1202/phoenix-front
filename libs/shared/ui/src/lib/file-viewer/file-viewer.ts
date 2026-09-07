import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Modal } from '../modal/modal';
import { Icon } from '../icon/icon';

/**
 * Visor de archivos in-app: renderiza imágenes y PDF embebidos dentro de un `erp-modal`
 * (en vez de abrir una pestaña nueva con `window.open`). Recibe una URL ya accesible
 * —normalmente prefirmada de MinIO— y el `mime`. Para tipos no previsualizables ofrece
 * abrir/descargar en pestaña nueva.
 *
 * Uso: `<erp-file-viewer [(open)]="visorOpen" [url]="url()" [mime]="mime()" [nombre]="nombre()" />`
 */
@Component({
  selector: 'erp-file-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, Icon],
  templateUrl: './file-viewer.html',
  styleUrl: './file-viewer.scss',
})
export class FileViewer {
  private readonly sanitizer = inject(DomSanitizer);

  /** Abre/cierra el visor (two-way). */
  readonly open = model(false);
  /** URL directa del archivo (prefirmada). `null` mientras se resuelve. */
  readonly url = input<string | null>(null);
  /** MIME del archivo, para elegir cómo renderizarlo. */
  readonly mime = input<string>('');
  /** Nombre para el título del modal. */
  readonly nombre = input<string>('');

  protected readonly esImagen = computed(() => this.mime().startsWith('image/'));
  protected readonly esPdf = computed(() => this.mime() === 'application/pdf');

  /** El `[src]` de un iframe exige una URL de recurso marcada como segura. */
  protected readonly safeUrl = computed<SafeResourceUrl | null>(() => {
    const u = this.url();
    return u ? this.sanitizer.bypassSecurityTrustResourceUrl(u) : null;
  });
}
