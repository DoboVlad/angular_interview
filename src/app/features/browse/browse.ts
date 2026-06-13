import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { LucideAngularModule, Search, X } from 'lucide-angular';
import {
  Category,
  Difficulty,
  Question,
  Subcategory,
} from '../../core/models/question.model';
import { QuizService } from '../../core/services/quiz.service';
import { signalControl, signalForm } from '../../shared/forms/signal-forms';
import { CodeBlockComponent } from '../../shared/components/code-block/code-block';
import { DifficultyDotsComponent } from '../../shared/components/difficulty-dots/difficulty-dots';

const CATEGORIES: readonly Category[] = [
  'angular',
  'javascript',
  'typescript',
  'web',
];
const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5];

@Component({
  selector: 'be-browse',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollingModule,
    LucideAngularModule,
    CodeBlockComponent,
    DifficultyDotsComponent,
  ],
  templateUrl: './browse.html',
  styleUrl: './browse.scss',
})
export class Browse {
  private readonly quiz = inject(QuizService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly bank = this.quiz.bank;
  protected readonly categories = CATEGORIES;
  protected readonly difficulties = DIFFICULTIES;

  // Signal Form: multi-select filters + search.
  protected readonly filters = signalForm({
    search: signalControl<string>(''),
    categories: signalControl<Category[]>([]),
    subcategories: signalControl<Subcategory[]>([]),
    difficulties: signalControl<Difficulty[]>([]),
  });

  /** Debounced search term — updated 220ms after the last keystroke. */
  private readonly debouncedSearch = signal<string>('');

  /** Subcategories present in the bank, for the filter list. */
  protected readonly allSubcategories = computed<Subcategory[]>(() => {
    const set = new Set<Subcategory>();
    for (const q of this.bank.value() ?? []) set.add(q.subcategory);
    return [...set].sort();
  });

  protected readonly filtered = computed<Question[]>(() => {
    const all = this.bank.value() ?? [];
    const term = this.debouncedSearch().trim().toLowerCase();
    const cats = this.filters.controls.categories.value();
    const subs = this.filters.controls.subcategories.value();
    const diffs = this.filters.controls.difficulties.value();

    return all.filter((q) => {
      if (cats.length && !cats.includes(q.category)) return false;
      if (subs.length && !subs.includes(q.subcategory)) return false;
      if (diffs.length && !diffs.includes(q.difficulty)) return false;
      if (term) {
        const haystack = (
          q.question +
          ' ' +
          (q.options?.join(' ') ?? '') +
          ' ' +
          q.tags.join(' ')
        ).toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  });

  protected readonly selected = signal<Question | null>(null);

  protected readonly Search = Search;
  protected readonly X = X;

  constructor() {
    // Debounce the search control into `debouncedSearch` without RxJS.
    let handle: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      const value = this.filters.controls.search.value();
      if (handle) clearTimeout(handle);
      handle = setTimeout(() => untracked(() => this.debouncedSearch.set(value)), 220);
    });
    this.destroyRef.onDestroy(() => {
      if (handle) clearTimeout(handle);
    });
  }

  protected toggleCategory(cat: Category): void {
    this.toggle(this.filters.controls.categories, cat);
  }
  protected toggleSubcategory(sub: Subcategory): void {
    this.toggle(this.filters.controls.subcategories, sub);
  }
  protected toggleDifficulty(diff: Difficulty): void {
    this.toggle(this.filters.controls.difficulties, diff);
  }

  private toggle<T>(
    control: { value: () => T[]; set: (v: T[]) => void },
    value: T,
  ): void {
    const current = control.value();
    control.set(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  }

  protected isCategoryOn(cat: Category): boolean {
    return this.filters.controls.categories.value().includes(cat);
  }
  protected isSubcategoryOn(sub: Subcategory): boolean {
    return this.filters.controls.subcategories.value().includes(sub);
  }
  protected isDifficultyOn(diff: Difficulty): boolean {
    return this.filters.controls.difficulties.value().includes(diff);
  }

  protected clearFilters(): void {
    this.filters.reset();
    this.debouncedSearch.set('');
  }

  protected select(q: Question): void {
    this.selected.set(q);
  }
  protected closeDetail(): void {
    this.selected.set(null);
  }
}
