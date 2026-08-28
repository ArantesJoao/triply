'use client';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TimeField } from '@/components/ui/time-field';
import {
  DAY_START_STEP_MINUTES,
  MAX_DAY_START_MIN,
  dayStartFor,
  formatAxisLabel,
  toAxisMinutes,
} from '@/lib/time';

import { useCity, useStore, useTrip } from './store';

/**
 * A typed "HH:MM" to the minutes-past-midnight the API takes, rounded onto the
 * half hour and clamped to the allowed range. Null when it isn't a time yet —
 * a field mid-edit reads "09:" for a keystroke or two.
 */
function toDayStart(time: string): number | null {
  const minutes = toAxisMinutes(time, 0);
  if (minutes === null) return null;
  const snapped =
    Math.round(minutes / DAY_START_STEP_MINUTES) * DAY_START_STEP_MINUTES;
  return Math.min(MAX_DAY_START_MIN, Math.max(0, snapped));
}

/** Every value the day start may take: half-hourly, midnight to noon. */
const CHOICES = Array.from(
  { length: MAX_DAY_START_MIN / DAY_START_STEP_MINUTES + 1 },
  (_, i) => formatAxisLabel(i * DAY_START_STEP_MINUTES),
);

/**
 * Where the day's time axis opens, for this city and for the trip.
 *
 * Both levers sit in one dialog because they are one decision read twice: the
 * trip's is what a city uses until it says otherwise, so choosing the city's
 * only makes sense next to the value it is departing from.
 *
 * Nothing on the board moves when either changes. The axis still grows to hold
 * anything scheduled earlier, so this can only ever trim dead hours off the
 * top of an empty day — never hide a card.
 */
export function DayStartDialog({
  cityId,
  open,
  onClose,
}: {
  cityId: string;
  open: boolean;
  onClose: () => void;
}) {
  const store = useStore();
  const trip = useTrip();
  const city = useCity(cityId);

  if (!city) return null;

  const overridden = city.dayStartMin !== null;
  const effective = dayStartFor(trip.dayStartMin, city.dayStartMin);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Day start"
      description={`${city.title}'s days currently open at ${formatAxisLabel(effective)}.`}
      width="sm"
      footer={
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <TimeField
            label={city.title}
            value={formatAxisLabel(effective)}
            options={CHOICES}
            onCommit={(time) => {
              const next = toDayStart(time);
              if (next !== null && next !== effective) {
                store.setCityDayStart(cityId, next);
              }
            }}
            hint={
              overridden
                ? undefined
                : 'Following the trip. Change it and this city keeps its own.'
            }
          />

          {/* Only worth offering once there is an override to drop. */}
          {overridden && (
            <button
              type="button"
              onClick={() => store.setCityDayStart(cityId, null)}
              className="mt-1.5 text-xs text-muted underline underline-offset-2 transition-colors hover:text-ink"
            >
              Follow the trip ({formatAxisLabel(trip.dayStartMin)})
            </button>
          )}
        </div>

        <TimeField
          label="Every other city"
          value={formatAxisLabel(trip.dayStartMin)}
          options={CHOICES}
          onCommit={(time) => {
            const next = toDayStart(time);
            if (next !== null && next !== trip.dayStartMin) {
              store.setTripDayStart(next);
            }
          }}
          hint="An early item still pulls the axis up above this — it only decides where an empty day begins."
        />
      </div>
    </Dialog>
  );
}
