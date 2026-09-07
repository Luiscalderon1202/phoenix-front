import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { NOTIFICATION_SINK, provideErpHttp } from '@phoenix/shared/http';
import { NotificationService } from '@phoenix/shared/ui/chrome';
import { AuthStore, provideAuth } from '@phoenix/shared/auth';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideErpHttp(), // HttpClient + interceptors + API_BASE_URL (desde config.json en runtime)
    // Cablea el sink de errores del interceptor al toaster real. Vive aquí (composition root)
    // para no acoplar shared/http ↔ shared/ui: el error-interceptor muestra el mensaje normalizado.
    { provide: NOTIFICATION_SINK, useExisting: NotificationService },
    provideAuth(), // AuthStore + tokens invertidos (TENANT_ID_FN, REFRESH_TOKEN_FN, …)
    // Refresh silencioso en el bootstrap: la cookie httpOnly restaura la sesión tras F5.
    // No bloquea el arranque si no hay sesión.
    provideAppInitializer(() =>
      inject(AuthStore)
        .refresh()
        .catch(() => void 0),
    ),
  ],
};
