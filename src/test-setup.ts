import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import '@analogjs/vite-plugin-angular/setup-vitest';

// Single TestBed initialisation shared across the whole Vitest run.
getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
