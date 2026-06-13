import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'level-up';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly title: string;
  readonly message?: string;
}

/**
 * Tiny signal-based toast queue. Components read `toasts()` and render them;
 * any service can `show()`. Toasts auto-dismiss after `ttlMs`.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<readonly Toast[]>([]);

  show(
    kind: ToastKind,
    title: string,
    message?: string,
    ttlMs = 3200,
  ): number {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, title, message }]);
    setTimeout(() => this.dismiss(id), ttlMs);
    return id;
  }

  levelUp(level: number): void {
    this.show(
      'level-up',
      'Level up!',
      `You're on a roll — stepping up to level ${level} questions.`,
    );
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
