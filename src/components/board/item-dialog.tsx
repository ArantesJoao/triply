'use client';

import { Copy, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { TagInput } from '@/components/ui/chip';
import { Dialog } from '@/components/ui/dialog';
import { Label, Textarea } from '@/components/ui/field';
import { InlineText } from '@/components/ui/inline-text';
import { cn } from '@/lib/cn';
import { normaliseTime } from '@/lib/time';

import { useBoard, useItem, useStore } from './store';

const DURATIONS = [
  { label: 'None', value: null },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '3h', value: 180 },
];

/** Card details: time, duration, note, tags, and where it lives. */
export function ItemDialog({
  itemId,
  autoFocusTitle,
  onClose,
}: {
  itemId: string | null;
  autoFocusTitle: boolean;
  onClose: () => void;
}) {
  const item = useItem(itemId ?? '');
  const store = useStore();
  const columns = useBoard((state) => state.columns);
  const cities = useBoard((state) => state.cities);

  const currentColumn = item ? columns[item.columnId] : undefined;

  /** Every column in the same city — the move/duplicate targets. */
  const siblings = useMemo(() => {
    if (!currentColumn) return [];
    const city = cities[currentColumn.cityId];
    return (city?.columnIds ?? [])
      .map((id) => columns[id])
      .filter((column) => column && column.id !== currentColumn.id);
  }, [currentColumn, cities, columns]);

  if (!itemId || !item || !currentColumn) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={item.title || 'New activity'}
      description={`${currentColumn.title}${item.time ? ` · ${item.time}` : ' · unscheduled'}`}
      width="lg"
      footer={
        <>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              store.deleteItem(item.id);
              onClose();
            }}
          >
            <Trash2 size={14} />
            Delete
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <Label>Title</Label>
          <InlineText
            value={item.title}
            autoFocus={autoFocusTitle}
            onCommit={(title) => store.patchItem(item.id, { title })}
            ariaLabel="Activity title"
            placeholder="What is it?"
            className="font-display text-[17px] leading-snug font-semibold"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="item-time">Time</Label>
            <input
              id="item-time"
              type="time"
              value={item.time ?? ''}
              onChange={(event) =>
                store.patchItem(item.id, {
                  time: normaliseTime(event.target.value),
                })
              }
              disabled={!currentColumn.timed}
              className="h-10 rounded-[11px] border border-line bg-subtle px-3 text-sm tabular-nums outline-none focus:border-brand disabled:opacity-40"
            />
          </div>

          {item.time && (
            <div>
              <Label>Day</Label>
              <div className="flex items-center gap-1 rounded-full bg-inset p-0.5">
                {[0, 1].map((offset) => (
                  <button
                    key={offset}
                    type="button"
                    onClick={() =>
                      store.patchItem(item.id, { dayOffset: offset })
                    }
                    aria-pressed={item.dayOffset === offset}
                    className={cn(
                      'h-8 rounded-full px-3 font-display text-[11.5px] font-semibold transition-colors',
                      item.dayOffset === offset
                        ? 'bg-brand text-brand-contrast'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {offset === 0 ? 'Same day' : 'After midnight'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.time && (
            <button
              type="button"
              onClick={() => store.patchItem(item.id, { time: null })}
              className="h-9 rounded-full border border-line px-3 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              Unschedule
            </button>
          )}
        </div>

        <div>
          <Label>Duration</Label>
          <div className="flex flex-wrap items-center gap-1 rounded-full bg-inset p-0.5 self-start w-fit">
            {DURATIONS.map((duration) => (
              <button
                key={duration.label}
                type="button"
                onClick={() =>
                  store.patchItem(item.id, { durationMin: duration.value })
                }
                aria-pressed={item.durationMin === duration.value}
                className={cn(
                  'h-8 rounded-full px-3 font-display text-[11.5px] font-semibold transition-colors',
                  item.durationMin === duration.value
                    ? 'bg-brand text-brand-contrast'
                    : 'text-muted hover:text-ink',
                )}
              >
                {duration.label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          label="Note"
          defaultValue={item.blurb}
          onBlur={(event) =>
            store.patchItem(item.id, { blurb: event.target.value })
          }
          placeholder="Why it's worth it, what to book, who suggested it…"
        />

        <div>
          <Label>Tags</Label>
          <TagInput
            tags={item.tags}
            onChange={(tags) => store.patchItem(item.id, { tags })}
          />
        </div>

        {siblings.length > 0 && (
          <div>
            <Label>Move or duplicate to</Label>
            <div className="scroll-slim flex gap-1.5 overflow-x-auto pb-1">
              {siblings.map((column) => (
                <div
                  key={column.id}
                  className="flex shrink-0 items-center overflow-hidden rounded-full border border-line"
                >
                  <button
                    type="button"
                    onClick={() => {
                      store.moveItem(item.id, {
                        columnId: column.id,
                        time: column.timed ? item.time : null,
                        dayOffset: item.dayOffset,
                      });
                      onClose();
                    }}
                    className="h-8 px-3 text-[12px] text-muted transition-colors hover:bg-subtle hover:text-ink"
                  >
                    {column.title}
                  </button>
                  <button
                    type="button"
                    title={`Duplicate into ${column.title}`}
                    aria-label={`Duplicate into ${column.title}`}
                    onClick={() =>
                      void store.addItem(column.id, {
                        title: item.title,
                        blurb: item.blurb,
                        tags: item.tags,
                        durationMin: item.durationMin,
                        time: column.timed ? item.time : null,
                        dayOffset: item.dayOffset,
                      })
                    }
                    className="grid h-8 w-8 place-items-center border-l border-line text-brand transition-colors hover:bg-brand-soft"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
