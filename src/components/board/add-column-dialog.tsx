'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ChoiceGroup, Input } from '@/components/ui/field';
import {
  addDaysISO,
  formatDayTitle,
  isValidDate,
  todayISO,
} from '@/lib/time';

import { useBoard, useStore } from './store';

/**
 * The first date a new timed day may take: the morning after the city's last
 * dated day, or today when nothing is dated yet.
 *
 * Days are compared by their date rather than by column order, so a day
 * inserted out of sequence still can't push the next one into the past.
 * Returns a plain string, which keeps the selector's identity stable.
 */
function useEarliestDate(cityId: string): string {
  return useBoard((state) => {
    const city = state.cities[cityId];
    if (!city) return todayISO();

    let latest: string | null = null;
    for (const columnId of city.columnIds) {
      const column = state.columns[columnId];
      if (!column?.timed || !column.date) continue;
      if (!latest || column.date > latest) latest = column.date;
    }

    return latest ? addDaysISO(latest, 1) : todayISO();
  });
}

/** "+ Add day / list" — name, and whether it has a clock. Deliberately compact. */
export function AddColumnDialog({
  open,
  cityId,
  onClose,
}: {
  open: boolean;
  cityId: string;
  onClose: () => void;
}) {
  const store = useStore();
  const earliest = useEarliestDate(cityId);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'timed' | 'list'>('timed');
  const [date, setDate] = useState(earliest);
  // Once the name has been typed into, the date stops writing to it — nobody
  // wants "Anfield day" replaced by "Sat 29" because they nudged the date.
  const [named, setNamed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Read through a ref so the reset below fires on *opening* only. The board
  // polls for collaborators' changes, so `earliest` can move while the dialog
  // is up; depending on it directly would wipe a half-typed name. The live
  // value still drives `min` and `dateOk` on every render.
  const earliestRef = useRef(earliest);
  earliestRef.current = earliest;

  useEffect(() => {
    if (!open) return;
    const start = earliestRef.current;
    setKind('timed');
    setDate(start);
    setTitle(formatDayTitle(start));
    setNamed(false);
    setBusy(false);
  }, [open]);

  const chooseDate = (next: string) => {
    setDate(next);
    if (!named && isValidDate(next)) setTitle(formatDayTitle(next));
  };

  const chooseKind = (next: 'timed' | 'list') => {
    setKind(next);
    if (named) return;
    // A plain list has no date to name itself after, so it goes back to blank.
    setTitle(next === 'timed' && isValidDate(date) ? formatDayTitle(date) : '');
  };

  const timed = kind === 'timed';
  // The picker greys out earlier days, but the field is still typeable, so the
  // range is enforced here too rather than trusted to the browser.
  const dateOk = !timed || (isValidDate(date) && date >= earliest);

  const submit = async () => {
    const clean = title.trim();
    if (!clean || !dateOk || busy) return;
    setBusy(true);
    await store.addColumn(cityId, clean, timed, timed ? date : null);
    setBusy(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a day or list"
      description="Timed days share the city's clock. Lists are plain ordered stacks."
      width="sm"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            disabled={!title.trim() || !dateOk}
            onClick={submit}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ChoiceGroup
          label="Type"
          value={kind}
          onChange={chooseKind}
          options={[
            {
              value: 'timed',
              label: 'Timed day',
              description: 'Has a clock axis',
            },
            {
              value: 'list',
              label: 'Plain list',
              description: 'Ordered stack',
            },
          ]}
        />

        {timed && (
          <Input
            label="Date"
            type="date"
            value={date}
            min={earliest}
            aria-invalid={!dateOk}
            className={dateOk ? undefined : 'border-danger-border'}
            onChange={(event) => chooseDate(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
            hint={dateOk ? undefined : `Pick ${formatDayTitle(earliest)} or later.`}
          />
        )}

        <Input
          label="Name"
          value={title}
          onChange={(event) => {
            setNamed(true);
            setTitle(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
          placeholder={timed ? 'Friday 8' : 'Food ideas…'}
        />
      </div>
    </Dialog>
  );
}
