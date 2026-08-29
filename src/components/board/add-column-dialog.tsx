'use client';

import { AlertCircle, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, IconButton } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Sheet,
  SheetBody,
  SheetFooter,
  SheetLabel,
  useSheetIsMobile,
} from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import {
  addDaysISO,
  formatDateShort,
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

/** Every date the city already has a day for, as one stable string. */
function useTakenDates(cityId: string): string {
  return useBoard((state) => {
    const city = state.cities[cityId];
    if (!city) return '';
    const dates: string[] = [];
    for (const columnId of city.columnIds) {
      const column = state.columns[columnId];
      if (column?.timed && column.date) dates.push(column.date);
    }
    return dates.sort().join(',');
  });
}

type Kind = 'timed' | 'list';

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
  const mobile = useSheetIsMobile();
  const earliest = useEarliestDate(cityId);
  const takenKey = useTakenDates(cityId);
  const taken = useMemo(
    () => (takenKey ? takenKey.split(',') : []),
    [takenKey],
  );

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Kind>('timed');
  const [date, setDate] = useState(earliest);
  // Once the name has been typed into, the date stops writing to it — nobody
  // wants "Anfield day" replaced by "Sat 29" because they nudged the date.
  const [named, setNamed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Read through a ref so the reset below fires on *opening* only. The board
  // polls for collaborators' changes, so `earliest` can move while the sheet
  // is up; depending on it directly would wipe a half-typed name. The live
  // value still drives the chips, the calendar's minimum and `dateOk` on every
  // render.
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
    setFailure(null);
  }, [open]);

  const chooseDate = (next: string) => {
    setDate(next);
    if (!named && isValidDate(next)) setTitle(formatDayTitle(next));
  };

  const chooseKind = (next: Kind) => {
    setKind(next);
    if (named) return;
    // A plain list has no date to name itself after, so it goes back to blank.
    setTitle(next === 'timed' && isValidDate(date) ? formatDayTitle(date) : '');
  };

  const timed = kind === 'timed';
  // The calendar greys out earlier days, but the value can still be stale if
  // a collaborator adds a day underneath you, so the range is enforced here
  // rather than trusted to the control.
  const dateOk = !timed || (isValidDate(date) && date >= earliest);
  const canCreate = Boolean(title.trim()) && dateOk && !busy;

  const submit = async () => {
    const clean = title.trim();
    if (!clean || !dateOk || busy) return;

    setBusy(true);
    setFailure(null);
    const id = await store.addColumn(cityId, clean, timed, timed ? date : null);
    setBusy(false);

    if (id) {
      onClose();
      return;
    }

    // `addColumn` also parks the failure on the board's save strip. Inside an
    // open sheet that is one report too many, so it is claimed here instead.
    setFailure('Could not add it. Check your connection and try again.');
    store.dismissError();
  };

  const onEnter = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') void submit();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Add a day or list"
      width="sm"
      // Three fields don't need a full screen.
      height="content"
      dismissible={!busy}
      header={
        <header
          className={cn(
            'flex items-start gap-3 border-b border-line',
            mobile ? 'px-[18px] pt-3 pb-3.5' : 'px-5 py-4',
          )}
        >
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                'font-display leading-tight',
                mobile ? 'text-[19px] font-black' : 'text-base font-bold',
              )}
            >
              Add a day or list
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Timed days share the city&rsquo;s clock. Lists are plain ordered
              stacks.
            </p>
          </div>

          {/* Same close affordance either side of the breakpoint. Disabled
              in flight, like the overlay and the drag, so a half-created
              column can't be orphaned. */}
          <IconButton
            label="Close"
            size={mobile ? 'md' : 'sm'}
            disabled={busy}
            onClick={onClose}
            className={mobile ? 'size-11 rounded-xl border border-line' : undefined}
          >
            <X size={mobile ? 18 : 15} />
          </IconButton>
        </header>
      }
      footer={
        <SheetFooter className={mobile ? undefined : 'justify-end'}>
          <Button
            size={mobile ? 'lg' : 'sm'}
            disabled={busy}
            onClick={onClose}
            className={mobile ? 'h-12 flex-1 rounded-[14px]' : undefined}
          >
            Cancel
          </Button>
          <Button
            size={mobile ? 'lg' : 'sm'}
            variant="primary"
            loading={busy}
            disabled={!canCreate}
            onClick={() => void submit()}
            className={mobile ? 'h-12 flex-[2] rounded-[14px] font-semibold' : undefined}
          >
            {busy ? 'Creating…' : 'Create'}
          </Button>
        </SheetFooter>
      }
    >
      <SheetBody className={cn('flex flex-col', mobile ? 'gap-[18px]' : 'gap-4')}>
        {failure && (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[13px] font-medium text-danger">{failure}</p>
          </div>
        )}

        <TypeChoice value={kind} onChange={chooseKind} disabled={busy} />

        {timed && (
          <DatePicker
            value={date}
            onChange={chooseDate}
            min={earliest}
            taken={taken}
            disabled={busy}
            invalid={!dateOk}
            error={`Pick ${formatDateShort(earliest)} or later.`}
          />
        )}

        <div>
          <SheetLabel htmlFor="column-name">Name</SheetLabel>
          <input
            id="column-name"
            value={title}
            readOnly={busy}
            onChange={(event) => {
              setNamed(true);
              setTitle(event.target.value);
            }}
            onKeyDown={onEnter}
            placeholder={timed ? 'Friday 8' : 'Food ideas…'}
            className={cn(
              'w-full rounded-[14px] border border-line bg-subtle px-4 text-ink',
              'transition-colors duration-150 ease-out outline-none',
              'placeholder:text-faint placeholder:italic',
              'hover:border-line-strong focus:border-brand focus:bg-card',
              busy && 'opacity-45',
              mobile ? 'h-13 text-base' : 'h-11 text-sm',
            )}
          />
          <p className="mt-1.5 text-[11.5px] text-faint">
            {timed
              ? 'Named after the date until you type your own.'
              : 'A list has no date — it sits at the end of the board.'}
          </p>
        </div>
      </SheetBody>
    </Sheet>
  );
}

/**
 * Two cards side by side on desktop, two stacked rows on a phone. The radio
 * mark is drawn rather than described by colour alone, so the choice survives
 * being read without it.
 */
function TypeChoice({
  value,
  onChange,
  disabled,
}: {
  value: Kind;
  onChange: (value: Kind) => void;
  disabled?: boolean;
}) {
  const mobile = useSheetIsMobile();

  const options: { value: Kind; label: string; description: string }[] = [
    { value: 'timed', label: 'Timed day', description: 'Has a clock axis' },
    { value: 'list', label: 'Plain list', description: 'Ordered stack' },
  ];

  return (
    <div>
      <SheetLabel>Type</SheetLabel>
      <div
        role="radiogroup"
        aria-label="Type"
        className={cn(mobile ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-2')}
      >
        {options.map((option) => {
          const selected = option.value === value;
          const mark = (
            <span
              aria-hidden="true"
              className={cn(
                'grid shrink-0 place-items-center rounded-full border',
                mobile ? 'size-4.5' : 'size-3.5',
                selected ? 'border-brand' : 'border-line-strong',
              )}
            >
              {/* Never signalled by colour alone. */}
              {selected && (
                <span
                  className={cn(
                    'rounded-full bg-brand',
                    mobile ? 'size-2' : 'size-1.5',
                  )}
                />
              )}
            </span>
          );

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              disabled={disabled}
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-[14px] border text-left transition-colors duration-150 ease-out',
                mobile
                  ? 'flex min-h-14 items-center gap-2.5 px-3.5 py-2.5'
                  : 'flex flex-col gap-1 px-3.5 py-3',
                selected
                  ? 'border-brand bg-brand-soft text-brand-on-soft'
                  : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink',
                disabled && 'opacity-50',
              )}
            >
              {mobile ? (
                <>
                  {mark}
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">
                      {option.label}
                    </span>
                    <span className="block text-[12.5px] opacity-80">
                      {option.description}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    {mark}
                    {option.label}
                  </span>
                  <span className="pl-5.5 text-xs opacity-80">
                    {option.description}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
