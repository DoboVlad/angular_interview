import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err) => {
  // Bootstrap failure is unrecoverable; surface it even in production.
  console.error(err);
});
