import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideAngularModule,
  LayoutDashboard,
  Library,
  Settings as SettingsIcon,
  Moon,
  Sun,
} from 'lucide-angular';
import { ThemeService } from './core/services/theme.service';
import { ToastComponent } from './shared/components/toast/toast';

@Component({
  selector: 'be-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    ToastComponent,
  ],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="shell-header">
      <div class="be-container shell-header__inner">
        <a routerLink="/" class="wordmark" aria-label="Blue Eclipse home">
          <span class="wordmark__mark" aria-hidden="true"></span>
          <span class="wordmark__text">Blue&nbsp;Eclipse</span>
        </a>

        <nav class="shell-nav" aria-label="Primary">
          <a
            routerLink="/"
            routerLinkActive="is-active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <lucide-icon [img]="LayoutDashboard" [size]="16" />
            <span>Dashboard</span>
          </a>
          <a routerLink="/browse" routerLinkActive="is-active">
            <lucide-icon [img]="Library" [size]="16" />
            <span>Browse</span>
          </a>
          <a routerLink="/settings" routerLinkActive="is-active">
            <lucide-icon [img]="SettingsIcon" [size]="16" />
            <span>Settings</span>
          </a>
        </nav>

        <button
          type="button"
          class="theme-toggle"
          (click)="theme.toggle()"
          [attr.aria-label]="
            theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'
          "
        >
          @if (theme.isDark()) {
            <lucide-icon [img]="Sun" [size]="18" />
          } @else {
            <lucide-icon [img]="Moon" [size]="18" />
          }
        </button>
      </div>
    </header>

    <main id="main" class="shell-main">
      <router-outlet />
    </main>

    <footer class="shell-footer">
      <div class="be-container">
        <span>Blue Eclipse — practice like it's the real interview.</span>
        <span class="be-muted">Built with Angular 22 · Signals · Zoneless</span>
      </div>
    </footer>

    <be-toast />
  `,
  styleUrl: './app.scss',
})
export class App {
  protected readonly theme = inject(ThemeService);

  protected readonly LayoutDashboard = LayoutDashboard;
  protected readonly Library = Library;
  protected readonly SettingsIcon = SettingsIcon;
  protected readonly Moon = Moon;
  protected readonly Sun = Sun;
}
