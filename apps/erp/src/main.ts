import { bootstrapApplication } from '@angular/platform-browser';
import { loadRuntimeConfig } from '@phoenix/shared/http';
import { appConfig } from './app/app.config';
import { App } from './app/app';

loadRuntimeConfig().then(() => {
  bootstrapApplication(App, appConfig).catch((err) => console.error(err));
});
