'use client';

import {
  AlertCircle,
  CalendarX,
  Clock,
  Copy,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, IconButton } from '@/components/ui/button';
import { TagChip, TagInput } from '@/components/ui/chip';
import { ConfirmPanel } from '@/components/ui/confirm';
import { Menu, type MenuEntry } from '@/components/ui/menu';
import { NoteEditor, NoteRead } from '@/components/ui/note-editor';
import { AddRow, ReadSection } from '@/components/ui/read-field';
import {
  Sheet,
  SheetBody,
  SheetFooter,
  SheetLabel,
  useSheetIsMobile,
} from '@/components/ui/sheet';
import { TimePicker } from '@/components/ui/time-picker';
import { cn } from '@/lib/cn';
import { isEmptyNote } from '@/lib/markdown';
import {
  commonStartTimes,
  DEFAULT_DURATION_MIN,
  fromAxisMinutes,
  toAxisMinutes,
} from '@/lib/time';

import { useBoard, useItem, useStore, useTrip, type ItemRecord } from './store';
import { TagStyleTrigger } from './tag-style-popover';

/**
 * Every activity takes some time, so there is no "None" here. It only ever
 * meant "nobody has said yet", which drew a zero-height block on the axis and
 * made a real half hour look like an omission.
 */
const DURATIONS = [
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '3h', value: 180 },
];

/** The fields the sheet edits, and the whole of what Save writes. */
type Draft = {
  title: string;
  time: string | null;
  durationMin: number;
  blurb: string;
  tags: string[];
};

/** Which control the flip into edit mode should land on. */
type FocusField = 'title' | 'note' | 'tags' | 'move' | null;

/**
 * Two ways out of an edit, and they end in different places.
 *
 * `discard-close` came from the X, Escape or the overlay — the ask was to
 * leave the card, so discarding leaves it. `discard-read` came from Cancel,
 * which only ever meant "stop editing", so discarding drops back to read mode
 * with the sheet still open. Collapsing the two would make one of the two
 * buttons lie.
 */
type Confirm = 'delete' | 'discard-close' | 'discard-read' | null;

/** What the sheet is asked to create, before anything exists to load. */
export type PendingItem = { columnId: string; time: string | null };

const draftFromItem = (item: ItemRecord): Draft => ({
  title: item.title,
  time: item.time,
  // Cards written before duration was mandatory still carry a null.
  durationMin: item.durationMin ?? DEFAULT_DURATION_MIN,
  blurb: item.blurb,
  tags: item.tags,
});

const blankDraft = (time: string | null): Draft => ({
  title: '',
  time,
  durationMin: DEFAULT_DURATION_MIN,
  blurb: '',
  tags: [],
});

const sameDraft = (a: Draft, b: Draft) =>
  a.title === b.title &&
  a.time === b.time &&
  a.durationMin === b.durationMin &&
  a.blurb === b.blurb &&
  sameTags(a.tags, b.tags);

/**
 * The activity card.
 *
 * It opens read-only and stays that way until asked otherwise. That is the
 * whole idea: the old dialog made every field a live control the moment it
 * appeared and wrote each keystroke straight through, so opening a card to
 * check what time it was looked exactly like opening it to change what time it
 * was — and nothing ever told you a change had been saved, because there was
 * no moment at which one was.
 *
 * Edit flips the entire sheet, Save writes once, Cancel restores the record as
 * loaded. Move and duplicate are the exceptions: they are structural rather
 * than part of the record, so they apply on tap and are edit-only.
 */
export function ItemDialog({
  itemId,
  pending,
  onCreated,
  onClose,
}: {
  itemId: string | null;
  /**
   * A card the board has been asked for and not yet created. The sheet opens
   * in edit mode on an empty draft, and nothing reaches the server until Save
   * — so backing out of a blank card leaves no trace of it.
   */
  pending: PendingItem | null;
  /** Hands back the record Save created, so the sheet can stay open on it. */
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const item = useItem(itemId ?? '');
  const store = useStore();
  const trip = useTrip();
  const mobile = useSheetIsMobile();
  const columns = useBoard((state) => state.columns);
  const cities = useBoard((state) => state.cities);

  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [focusField, setFocusField] = useState<FocusField>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  const creating = pending != null;
  const currentColumn = creating
    ? columns[pending.columnId]
    : item
      ? columns[item.columnId]
      : undefined;
  const city = currentColumn ? cities[currentColumn.cityId] : undefined;

  /** Every column in the same city — the move/duplicate targets. */
  const siblings = useMemo(() => {
    if (!currentColumn) return [];
    const target = cities[currentColumn.cityId];
    return (target?.columnIds ?? [])
      .map((id) => columns[id])
      .filter((column) => column && column.id !== currentColumn.id);
  }, [currentColumn, cities, columns]);

  /**
   * The times this trip actually starts things at. Read once per opening
   * rather than subscribed to: a collaborator scheduling something while the
   * sheet is up should not re-order the chips under the user's thumb.
   */
  const timeOptions = useMemo(
    () =>
      commonStartTimes(
        Object.values(store.getState().items).map((entry) => entry.time),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, itemId, pending],
  );

  // Load the draft when the sheet opens on a different card, and only then —
  // a poll landing mid-edit must not reach in here.
  useEffect(() => {
    if (pending) {
      // Nothing to read, so straight into edit with the caret in the title.
      setDraft(blankDraft(pending.time));
      setMode('edit');
      setFocusField('title');
    } else {
      if (!itemId) return;
      const current = store.getState().items[store.resolveId(itemId)];
      if (!current) return;
      setDraft(draftFromItem(current));
      setMode('read');
      setFocusField(null);
    }
    setConfirm(null);
    setSaving(false);
    setSaveError(null);
    setTitleError(false);
  }, [itemId, pending, store]);

  /**
   * Has anything changed since the sheet took its copy?
   *
   * A saved card is measured against the record, so a structural edit applied
   * outside the draft — the ⋯ menu's Unschedule, say — doesn't leave the sheet
   * looking dirty for a change that has already landed. A card being created
   * is measured against the empty draft it opened with, which is what makes
   * "fully empty" a thing the sheet can recognise and leave alone.
   */
  const baseline = useMemo(
    () => (pending ? blankDraft(pending.time) : item ? draftFromItem(item) : null),
    [pending, item],
  );

  const dirty = Boolean(draft && baseline && !sameDraft(draft, baseline));

  /**
   * The title takes the caret whenever edit mode is entered aiming at it —
   * whether that came from the Edit button or from the sheet opening on a card
   * the board has only just created. Runs after the shell's own focus pass,
   * which is what the delay is for.
   */
  useEffect(() => {
    if (mode !== 'edit' || focusField !== 'title') return;
    const timer = window.setTimeout(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [mode, focusField]);

  // Hold the poll off while there is an uncommitted draft, so a collaborator's
  // revision can't replace the record this sheet is describing.
  useEffect(() => {
    if (mode !== 'edit' || !dirty) return;
    return store.holdSync();
  }, [mode, dirty, store]);

  if (!currentColumn || !draft) return null;
  if (!creating && (!itemId || !item)) return null;

  /**
   * The record, where there is one. Null for the whole of a card's creation,
   * which is what everything below has to be careful about: read mode, Delete
   * and the move targets all describe something that does not exist yet.
   */
  const saved: ItemRecord | null = creating ? null : (item as ItemRecord);
  const savedId: string | null = creating ? null : (itemId as string);

  const patch = (next: Partial<Draft>) =>
    setDraft((current) => (current ? { ...current, ...next } : current));

  const enterEdit = (field: FocusField = null) => {
    setFocusField(field);
    setSaveError(null);
    setMode('edit');
  };

  /** Drops the draft and goes back to reading the record as it stands. */
  const leaveEdit = () => {
    if (!item) return;
    setDraft(draftFromItem(item));
    setMode('read');
    setTitleError(false);
    setSaveError(null);
    setConfirm(null);
  };

  /**
   * Cancel means "stop editing". On a saved card that lands in read mode; on
   * one still being created there is nothing to read, so it leaves.
   */
  const cancel = () => {
    if (dirty) {
      setConfirm(creating ? 'discard-close' : 'discard-read');
      return;
    }
    if (creating) onClose();
    else leaveEdit();
  };

  /**
   * The X, Escape and the overlay all mean "leave". An untouched card goes
   * without ceremony — including a new one, which was never written and so has
   * nothing to lose.
   */
  const requestClose = () => {
    if (mode === 'edit' && dirty) {
      setConfirm('discard-close');
      return;
    }
    onClose();
  };

  /**
   * The single write. `close` is set when the save was asked for on the way
   * out — from the unsaved-changes confirmation's *Save and close* — in which
   * case the sheet leaves rather than settling back into read mode.
   */
  const save = async ({ close = false }: { close?: boolean } = {}) => {
    const clean = draft.title.trim();

    if (!clean) {
      // Reached from the confirmation too, so put the sheet back before
      // pointing at the field that needs filling in.
      setConfirm(null);
      setMode('edit');
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }

    // The only moment a new card reaches the server. Creation is optimistic
    // and instant, so there is no in-flight state to show — the sheet reopens
    // on the record it just made.
    if (creating) {
      const id = store.addItem(pending.columnId, {
        title: clean,
        time: draft.time,
        dayOffset: 0,
        durationMin: draft.durationMin,
        blurb: draft.blurb,
        tags: draft.tags,
      });
      if (close) onClose();
      else onCreated(id);
      return;
    }

    // Dismiss the confirmation first, so a failure lands on the editor with
    // the banner and the draft rather than behind a dialog.
    setConfirm(null);
    setSaving(true);
    setSaveError(null);
    try {
      await store.saveItem(itemId as string, {
        title: clean,
        time: draft.time,
        // An unscheduled card has no day to be on the far side of.
        dayOffset: draft.time ? (item?.dayOffset ?? 0) : 0,
        durationMin: draft.durationMin,
        blurb: draft.blurb,
        tags: draft.tags,
      });
      // Back to read, on the record that was just written — a save is not a
      // reason to take the card away from whoever was looking at it.
      setDraft({ ...draft, title: clean });
      if (close) onClose();
      else setMode('read');
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Could not save the activity.',
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * Structural, so it applies on tap rather than waiting for Save. On mobile
   * the board shows one column at a time, which makes the destination
   * off-screen by definition — so a move there closes the sheet.
   */
  const moveTo = (columnId: string, timed: boolean) => {
    if (!savedId || !saved) return;
    store.moveItem(savedId, {
      columnId,
      time: timed ? draft.time : null,
      dayOffset: saved.dayOffset,
    });
    if (mobile) onClose();
  };

  const duplicateTo = (columnId: string, timed: boolean) => {
    void store.addItem(columnId, {
      title: draft.title,
      blurb: draft.blurb,
      tags: draft.tags,
      durationMin: draft.durationMin,
      time: timed ? draft.time : null,
      dayOffset: saved?.dayOffset ?? 0,
    });
  };

  const unschedule = () => patch({ time: null });

  /* --- read-mode facts --------------------------------------------- */

  const index = savedId
    ? currentColumn.itemIds.indexOf(store.resolveId(savedId))
    : -1;
  const total = currentColumn.itemIds.length;
  const place = index >= 0 ? `${ordinal(index + 1)} of ${total} activities` : null;

  const start = saved ? toAxisMinutes(saved.time, saved.dayOffset) : null;
  const range =
    saved && start != null && saved.durationMin
      ? `${saved.time} – ${fromAxisMinutes(start + saved.durationMin).time}`
      : (saved?.time ?? null);

  const where = [currentColumn.title, city?.title].filter(Boolean).join(' · ');
  const title = saved?.title || 'Name this activity';

  /**
   * An untitled card left over from an abandoned edit — the one case where
   * Edit is the accent action in read mode, because there is nothing to read.
   * A freshly created card never gets here; it opens in edit mode already.
   */
  const untouched = !saved?.title;

  /* --- confirmation ------------------------------------------------- */

  const deleting = confirm === 'delete';
  /** The X, Escape and the overlay all leave; Cancel only stops editing. */
  const leaving = confirm === 'discard-close';

  /**
   * Replaces the sheet's content rather than stacking over it — see
   * `ui/confirm.tsx` for why that is not only a matter of taste.
   *
   * The unsaved-work version says where each button lands, because the sheet
   * has two ways to abandon an edit and they end up in different places. A
   * confirmation that reads the same for both would make one of them a lie.
   */
  const confirmPanel = deleting ? (
    <ConfirmPanel
      icon={<Trash2 size={19} />}
      tone="danger"
      title={`Delete ${saved?.title ? `“${saved.title}”` : 'this activity'}?`}
      description={`It disappears from ${currentColumn.title} for everyone on the trip. This can’t be undone.`}
      confirmLabel="Delete activity"
      cancelLabel="Keep it"
      onConfirm={() => {
        if (savedId) store.deleteItem(savedId);
        onClose();
      }}
      onCancel={() => setConfirm(null)}
    />
  ) : confirm ? (
    <ConfirmPanel
      icon={<AlertCircle size={19} />}
      tone="neutral"
      title="Save your changes?"
      description={
        leaving
          ? 'You are closing this activity with changes that have not been saved.'
          : 'You are leaving the editor with changes that have not been saved.'
      }
      save={{
        label: leaving ? 'Save and close' : 'Save',
        onSelect: () => void save({ close: leaving }),
      }}
      confirmLabel={leaving ? 'Discard and close' : 'Discard changes'}
      cancelLabel="Keep editing"
      onConfirm={() => {
        if (leaving) onClose();
        else leaveEdit();
      }}
      onCancel={() => setConfirm(null)}
    />
  ) : null;

  /* --- header ------------------------------------------------------- */

  const editing = mode === 'edit';

  /**
   * Mobile's ⋯, which stands in for everything desktop puts in the footer or
   * beside a control. In edit mode it holds only Delete: the day targets and
   * Unschedule are already on screen there, and offering them twice is the
   * three-placements problem the design set out to avoid. A card that hasn't
   * been created has nothing for it at all.
   */
  const menuActions: MenuEntry[] = creating
    ? []
    : editing
      ? [
          {
            label: 'Delete activity',
            icon: <Trash2 size={15} />,
            destructive: true,
            onSelect: () => setConfirm('delete'),
          },
        ]
      : [
          {
            label: 'Duplicate…',
            icon: <Copy size={15} />,
            // Duplicating lives with the day targets, which are edit-only.
            onSelect: () => enterEdit('move'),
          },
          ...(saved?.time
            ? [
                {
                  label: 'Unschedule',
                  icon: <CalendarX size={15} />,
                  onSelect: () => {
                    if (savedId) {
                      store.patchItem(savedId, { time: null, dayOffset: 0 });
                    }
                    patch({ time: null });
                  },
                },
              ]
            : []),
          { separator: true },
          {
            label: 'Delete activity',
            icon: <Trash2 size={15} />,
            destructive: true,
            onSelect: () => setConfirm('delete'),
          },
        ];

  const header = (
    <header
      className={cn(
        'flex items-start gap-3 border-b border-line',
        mobile ? 'px-[18px] pt-3 pb-3.5' : 'px-5 pt-5 pb-4.5',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {editing ? (
          <Pill tone="brand" icon={<Pencil size={11} strokeWidth={2.5} />}>
            Editing{!mobile && ` · ${currentColumn.title}`}
          </Pill>
        ) : (
          <div className="flex items-center gap-2">
            {range ? (
              <Pill tone="brand" icon={<Clock size={11} strokeWidth={2.5} />}>
                {range}
              </Pill>
            ) : (
              <Pill tone="quiet">Unscheduled</Pill>
            )}
            <span className="truncate text-[12.5px] text-faint">{where}</span>
          </div>
        )}

        {editing ? (
          <>
            <input
              ref={titleRef}
              value={draft.title}
              disabled={saving}
              aria-label="Activity title"
              aria-invalid={titleError}
              placeholder="What is it?"
              onChange={(event) => {
                setTitleError(false);
                patch({ title: event.target.value });
              }}
              className={cn(
                '-ml-2.5 w-full rounded-[10px] border bg-subtle px-2.5 py-0.5 outline-none',
                'font-display leading-tight font-black tracking-[-0.01em]',
                mobile ? 'text-[19px]' : 'text-[22px]',
                titleError
                  ? 'border-danger-border bg-danger-soft'
                  : 'border-line focus:border-brand focus:bg-card',
                saving && 'opacity-45',
              )}
            />
            {titleError && (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <AlertCircle size={13} className="shrink-0" />
                An activity needs a name.
              </p>
            )}
          </>
        ) : (
          <h2
            className={cn(
              'font-display leading-tight font-black tracking-[-0.01em]',
              mobile ? 'text-[21px]' : 'text-[22px]',
              !saved?.title && 'text-faint',
            )}
          >
            {title}
          </h2>
        )}
      </div>

      {/* Desktop keeps Edit and Close in the header; mobile keeps the ⋯. */}
      {/*
        * Desktop keeps Edit and Close in the header. Mobile gets the same two
        * jobs done with a ⋯ and the same X — a drawer that can only be
        * dismissed by dragging or tapping the overlay leaves the one gesture
        * every user reaches for first with nowhere to land.
        */}
      <div className="flex shrink-0 items-center gap-1.5">
        {!mobile && !editing && (
          <Button
            size="sm"
            variant={untouched ? 'primary' : 'secondary'}
            onClick={() => enterEdit(untouched ? 'title' : null)}
          >
            <Pencil size={13} />
            Edit
          </Button>
        )}

        {mobile && menuActions.length > 0 && (
          <Menu
            trigger={(props) => (
              <button
                {...props}
                type="button"
                aria-label="More actions"
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <MoreHorizontal size={18} />
              </button>
            )}
            actions={menuActions}
          />
        )}

        <IconButton
          label="Close"
          size={mobile ? 'md' : 'sm'}
          disabled={saving}
          onClick={requestClose}
          className={mobile ? 'size-11 rounded-xl border border-line' : undefined}
        >
          <X size={mobile ? 18 : 15} />
        </IconButton>
      </div>
    </header>
  );

  /* --- footer ------------------------------------------------------- */

  const footer = (
    <SheetFooter>
      {editing ? (
        <>
          {!mobile && (
            <>
              {/* Nothing exists to delete until the first Save. */}
              {!creating && (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={saving}
                  onClick={() => setConfirm('delete')}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              )}
              <div className="flex-1" />
            </>
          )}
          <Button
            size={mobile ? 'lg' : 'sm'}
            disabled={saving}
            onClick={cancel}
            className={mobile ? 'h-12 flex-1 rounded-[14px]' : undefined}
          >
            Cancel
          </Button>
          <Button
            size={mobile ? 'lg' : 'sm'}
            variant="primary"
            loading={saving}
            onClick={() => void save()}
            className={mobile ? 'h-12 flex-[2] rounded-[14px] font-semibold' : undefined}
          >
            {saving ? 'Saving…' : saveError ? 'Try again' : 'Save'}
          </Button>
        </>
      ) : (
        <>
          {!mobile && (
            <>
              <Button size="sm" variant="danger" onClick={() => setConfirm('delete')}>
                <Trash2 size={14} />
                Delete
              </Button>
              <div className="flex-1" />
            </>
          )}
          {mobile && (
            <Button
              size="lg"
              onClick={() => enterEdit(untouched ? 'title' : null)}
              className="h-12 flex-1 rounded-[14px]"
            >
              <Pencil size={15} />
              Edit
            </Button>
          )}
          <Button
            size={mobile ? 'lg' : 'sm'}
            variant="primary"
            onClick={onClose}
            className={mobile ? 'h-12 flex-[2] rounded-[14px] font-semibold' : undefined}
          >
            Done
          </Button>
        </>
      )}
    </SheetFooter>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      onDismissAttempt={() => {
        // Escape and overlay-click behave as Cancel, which means they ask
        // before throwing anything away.
        if (confirm) {
          setConfirm(null);
          return false;
        }
        // Escape and the overlay mean "leave", the same as the X — so
        // discarding from here leaves too.
        if (editing && dirty) {
          setConfirm('discard-close');
          return false;
        }
        return true;
      }}
      label={saved?.title || 'New activity'}
      // Held at one width across the flip and the confirm: the panel replacing
      // its own contents should not also change size under the cursor.
      width="lg"
      height={confirm ? 'content' : 'full'}
      dismissible={!saving}
      raised={pickerOpen}
      header={confirm ? undefined : header}
      footer={confirm ? undefined : footer}
    >
      {confirm ? (
        confirmPanel
      ) : (
        <SheetBody className="flex flex-col gap-5">
          {saveError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0 text-[13px]">
                <p className="font-medium text-danger">{saveError}</p>
                <p className="mt-0.5 text-muted">
                  Everything you typed is still here. Check your connection and try
                  again.
                </p>
              </div>
            </div>
          )}

          {editing ? (
            <EditBody
              draft={draft}
              patch={patch}
              timed={currentColumn.timed}
              timeOptions={timeOptions}
              onUnschedule={unschedule}
              onPickerOpenChange={setPickerOpen}
              saving={saving}
              focusField={focusField}
              trip={trip}
              siblings={creating ? [] : siblings}
              onMove={moveTo}
              onDuplicate={duplicateTo}
              mobile={mobile}
            />
          ) : saved ? (
            <ReadBody
              item={saved}
              trip={trip}
              place={place}
              where={where}
              onEditField={enterEdit}
            />
          ) : null}
        </SheetBody>
      )}
    </Sheet>
  );
}

/* ===================================================================== *
 * Read
 * ===================================================================== */

/**
 * Read mode carries only what the header doesn't. Time and duration are
 * already stated up there as a range, so repeating them as tiles under the
 * title was the same fact twice — they belong to edit mode, where they are
 * controls rather than a readout.
 */
function ReadBody({
  item,
  trip,
  place,
  where,
  onEditField,
}: {
  item: { blurb: string; tags: string[] };
  trip: { tagColors: Record<string, number>; tagIcons: Record<string, string> };
  place: string | null;
  where: string;
  onEditField: (field: FocusField) => void;
}) {
  return (
    <>
      {isEmptyNote(item.blurb) ? (
        <AddRow label="Add a note" onClick={() => onEditField('note')} />
      ) : (
        <ReadSection label="Note">
          <NoteRead value={item.blurb} />
        </ReadSection>
      )}

      {item.tags.length === 0 ? (
        <AddRow label="Add tags" onClick={() => onEditField('tags')} />
      ) : (
        <ReadSection label="Tags">
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                tagColors={trip.tagColors}
                tagIcons={trip.tagIcons}
              />
            ))}
          </div>
        </ReadSection>
      )}

      {/* Where it lives is a fact in read mode — moving it is edit-only. */}
      <ReadSection label="Lives in">
        <span className="text-sm">
          {where}
          {place && <span className="text-[12.5px] text-faint"> · {place}</span>}
        </span>
      </ReadSection>
    </>
  );
}

/* ===================================================================== *
 * Edit
 * ===================================================================== */

function EditBody({
  draft,
  patch,
  timed,
  timeOptions,
  onUnschedule,
  onPickerOpenChange,
  saving,
  focusField,
  trip,
  siblings,
  onMove,
  onDuplicate,
  mobile,
}: {
  draft: Draft;
  patch: (next: Partial<Draft>) => void;
  timed: boolean;
  timeOptions: string[];
  onUnschedule: () => void;
  onPickerOpenChange: (open: boolean) => void;
  saving: boolean;
  focusField: FocusField;
  trip: { tagColors: Record<string, number>; tagIcons: Record<string, string> };
  siblings: { id: string; title: string; timed: boolean }[];
  onMove: (columnId: string, timed: boolean) => void;
  onDuplicate: (columnId: string, timed: boolean) => void;
  mobile: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Tapping a dashed "+ Add a time" row in read mode enters edit mode aimed at
  // that field; this is where the aim lands. The note is left out because its
  // editor takes focus itself, caret at the end of what is already written.
  useEffect(() => {
    if (!focusField || focusField === 'title' || focusField === 'note') return;
    const node = rootRef.current?.querySelector<HTMLElement>(
      `[data-field="${focusField}"] :is(button, input, textarea):not(:disabled)`,
    );
    node?.focus();
    node?.scrollIntoView({ block: 'nearest' });
  }, [focusField]);

  return (
    <div
      ref={rootRef}
      className={cn('flex flex-col gap-5', saving && 'pointer-events-none')}
    >
      <div
        data-field="time"
        className={cn('flex flex-wrap items-end gap-3', saving && 'opacity-45')}
      >
        {timed ? (
          <TimePicker
            value={draft.time}
            options={timeOptions}
            disabled={saving}
            onOpenChange={mobile ? onPickerOpenChange : undefined}
            onChange={(time) => patch({ time })}
            onClear={draft.time ? onUnschedule : undefined}
          />
        ) : (
          <div>
            <SheetLabel>Time</SheetLabel>
            <div className="flex h-10 w-[124px] items-center rounded-[11px] border border-line bg-subtle px-3 text-sm text-faint">
              not timed
            </div>
          </div>
        )}

        {draft.time && (
          <button
            type="button"
            disabled={saving}
            onClick={onUnschedule}
            className="h-9 rounded-full border border-line px-3 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            Unschedule
          </button>
        )}
      </div>

      <div data-field="duration" className={cn(saving && 'opacity-45')}>
        <SheetLabel>Duration</SheetLabel>
        <PillGroup
          options={DURATIONS}
          value={draft.durationMin}
          onChange={(durationMin) => patch({ durationMin })}
          disabled={saving}
        />
      </div>

      <div className={cn(saving && 'opacity-45')}>
        <NoteEditor
          value={draft.blurb}
          disabled={saving}
          autoFocus={focusField === 'note'}
          onChange={(blurb) => patch({ blurb })}
        />
      </div>

      <div data-field="tags" className={cn(saving && 'opacity-45')}>
        <SheetLabel>Tags</SheetLabel>
        <TagInput
          tags={draft.tags}
          tagColors={trip.tagColors}
          tagIcons={trip.tagIcons}
          renderIndicator={(tag) => <TagStyleTrigger tag={tag} />}
          onChange={(tags) => patch({ tags })}
        />
      </div>

      {siblings.length > 0 && (
        <div data-field="move" className={cn(saving && 'opacity-45')}>
          <SheetLabel>Move or duplicate to</SheetLabel>

          {/* A horizontal row of pills on desktop; a stacked list on a phone,
              where a 32px pill in a scroller is a poor target. */}
          <div
            className={cn(
              mobile
                ? 'flex flex-col gap-2'
                : 'scroll-slim flex gap-1.5 overflow-x-auto pb-1',
            )}
          >
            {siblings.map((column) => (
              <div
                key={column.id}
                className={cn(
                  'flex shrink-0 items-center overflow-hidden border border-line',
                  mobile ? 'h-13 rounded-[14px]' : 'rounded-full',
                )}
              >
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onMove(column.id, column.timed)}
                  className={cn(
                    'flex-1 text-left text-muted transition-colors hover:bg-subtle hover:text-ink',
                    mobile ? 'h-full px-4 text-[15px]' : 'h-8 px-3 text-xs',
                  )}
                >
                  {column.title}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  title={`Duplicate into ${column.title}`}
                  aria-label={`Duplicate into ${column.title}`}
                  onClick={() => onDuplicate(column.id, column.timed)}
                  className={cn(
                    'grid shrink-0 place-items-center border-l border-line text-brand transition-colors hover:bg-brand-soft',
                    mobile ? 'h-full w-13' : 'size-8',
                  )}
                >
                  <Copy size={mobile ? 16 : 13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================================================================== *
 * Small shared bits
 * ===================================================================== */

function Pill({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: 'brand' | 'quiet';
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5',
        'font-display text-[11px] font-bold whitespace-nowrap tabular-nums',
        tone === 'brand'
          ? 'bg-brand-soft text-brand-on-soft'
          : 'bg-inset text-muted',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** The segmented control both Day and Duration wear. */
function PillGroup<T extends string | number | null>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-fit flex-wrap items-center gap-1 rounded-full bg-inset p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              'h-8 rounded-full px-3 font-display text-[11.5px] font-semibold transition-colors',
              selected
                ? 'bg-brand text-brand-contrast'
                : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Order matters — a reordered tag list is a changed one. Compared element by
 * element rather than by joining: a tag may contain a space ("book ahead"), so
 * any join would make `['a b']` and `['a', 'b']` look identical.
 */
function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index]);
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
