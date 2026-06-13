import { Pipe, PipeTransform } from '@angular/core';

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'seconds' },
  { amount: 60, unit: 'minutes' },
  { amount: 24, unit: 'hours' },
  { amount: 7, unit: 'days' },
  { amount: 4.34524, unit: 'weeks' },
  { amount: 12, unit: 'months' },
  { amount: Number.POSITIVE_INFINITY, unit: 'years' },
];

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/**
 * Formats an epoch-ms timestamp as a relative string ("3 hours ago").
 * Pure pipe — recomputes only when its input changes.
 */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '';
    let duration = (value - Date.now()) / 1000;
    for (const division of DIVISIONS) {
      if (Math.abs(duration) < division.amount) {
        return rtf.format(Math.round(duration), division.unit);
      }
      duration /= division.amount;
    }
    return '';
  }
}
