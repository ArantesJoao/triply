'use client';

import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button, IconButton } from '@/components/ui/button';
import { TagChip } from '@/components/ui/chip';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';

import { useBoard, useCity, useStore, useTrip } from './store';

/* ------------------------------------------------------------------ *
 * Tag management
 *
 * Tags have no entity behind them — they are strings on cards — so this list is
 * derived from the active city's cards and renames/removals are bulk edits of
 * those cards. That is also why it is scoped to one city: the same word in
 * another city belongs to a different set of plans and is left alone.
 * ------------------------------------------------------------------ */

export function TagsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const trip = useTrip();
  const city = useCity(trip.activeCityId);
  const columns = useBoard((s) => s.columns);
  const items = useBoard((s) => s.items);

  /** Every tag in the active city, with the number of cards carrying it. */
  const tags = useMemo(() => {
    if (!city) return [];
    const counts = new Map<string, number>();
    for (const columnId of city.columnIds) {
      const column = columns[columnId];
      if (!column) continue;
      for (const itemId of column.itemIds) {
        const item = items[itemId];
        if (!item) continue;
        for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    // Busiest first: the tags that actually organise the board sit at the top,
    // and the one-off typos sink to the bottom where they get noticed.
    return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
      (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
    );
  }, [city, columns, items]);

  const names = useMemo(() => tags.map((entry) => entry.tag), [tags]);

  if (!city) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tags"
      description={`Renaming or removing a tag here only touches cards in ${city.title}. Colours and icons stay shared across the trip.`}
      width="lg"
    >
      {tags.length === 0 ? (
        <p className="py-1 text-[13px] leading-relaxed text-muted">
          Nothing tagged in {city.title} yet. There is no list to set up first —
          type a tag onto a card and it shows up here.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {tags.map(({ tag, count }) => (
            <TagRow
              key={tag}
              cityId={city.id}
              cityTitle={city.title}
              tag={tag}
              count={count}
              names={names}
            />
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ *
 * One tag
 * ------------------------------------------------------------------ */

function TagRow({
  cityId,
  cityTitle,
  tag,
  count,
  names,
}: {
  cityId: string;
  cityTitle: string;
  tag: string;
  count: number;
  /** Every tag in this city — used to catch a rename onto an existing one. */
  names: string[];
}) {
  const trip = useTrip();
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const cards = `${count} ${count === 1 ? 'card' : 'cards'}`;

  const startEditing = () => {
    setDraft(tag);
    setError(null);
    setConfirming(false);
    setEditing(true);
  };

  const commit = () => {
    const next = draft.trim().toLowerCase();
    if (!next || next === tag) {
      setEditing(false);
      return;
    }
    // The server answers 409 for a collision too, but the user shouldn't have
    // to spend a round trip to learn what's already on screen.
    if (names.includes(next)) {
      setError(`"${next}" is already a tag here`);
      return;
    }
    store.renameTag(cityId, tag, next);
    setEditing(false);
  };

  return (
    <li className="flex flex-col gap-2 py-2.5">
      <div className="flex items-center gap-3">
        {editing ? (
          // An explicit edit mode rather than `InlineText`: commit-on-blur has
          // nowhere to put the duplicate-name message, and a rename that
          // silently does nothing is worse than one that says why.
          <>
            <div className="min-w-0 flex-1">
              <Input
                autoFocus
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commit();
                }}
                aria-label={`Rename tag ${tag}`}
                className="h-9"
              />
            </div>
            {/* No Escape-to-cancel: the dialog's own Escape handler runs on
                document capture and would close the whole dialog first, so the
                cancel button is the only affordance that can be trusted. */}
            <IconButton
              label="Cancel rename"
              size="sm"
              variant="secondary"
              onClick={() => setEditing(false)}
            >
              <X size={13} />
            </IconButton>
            <IconButton
              label={`Save the new name for ${tag}`}
              size="sm"
              variant="soft"
              onClick={commit}
            >
              <Check size={13} />
            </IconButton>
          </>
        ) : (
          <>
            <TagChip
              label={tag}
              tagColors={trip.tagColors}
              tagIcons={trip.tagIcons}
            />
            <span className="min-w-0 flex-1 truncate text-[12px] text-faint tabular-nums">
              {cards}
            </span>
            <IconButton
              label={`Rename tag ${tag}`}
              size="sm"
              variant="secondary"
              onClick={startEditing}
            >
              <Pencil size={13} />
            </IconButton>
            <IconButton
              label={`Remove tag ${tag}`}
              size="sm"
              variant="secondary"
              onClick={() => setConfirming(true)}
              className="hover:text-danger"
            >
              <Trash2 size={13} />
            </IconButton>
          </>
        )}
      </div>

      {error && <p className="text-[12px] text-danger">{error}</p>}

      {/* Confirmed in the row, not in a second Dialog: the outer dialog claims
          Escape on document capture, so a nested one would be dismissed
          together with its parent. */}
      {confirming && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-danger-border bg-danger-soft px-3 py-2">
          <p className="text-[12.5px] leading-relaxed text-danger">
            Remove &quot;{tag}&quot; from {cards}? This only affects{' '}
            {cityTitle} — other cities keep the tag.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setConfirming(false)}>
              Keep
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setConfirming(false);
                store.deleteTag(cityId, tag);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
