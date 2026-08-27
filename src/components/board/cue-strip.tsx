'use client';

import { Building2, ChevronDown, Filter, Plus, Tags } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { TagChip } from '@/components/ui/chip';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';

import {
  useBoard,
  useCity,
  useCityIds,
  useStore,
  useTrip,
} from './store';
import { TagStyleTrigger } from './tag-style-popover';
import { TagsDialog } from './tags-dialog';

/* ------------------------------------------------------------------ *
 * 06  UI Cue Strip
 *
 * Two-row bar below the header:
 *   Row 1 — City tabs + Add City + Add to Trip button
 *   Row 2 — Collapsible tag filter tray (toggled by a filter button)
 * ------------------------------------------------------------------ */

export function CueStrip({
  onAddItem,
  activeFilters,
  onToggleFilter,
}: {
  onAddItem: () => void;
  activeFilters: string[];
  onToggleFilter: (tag: string) => void;
}) {
  const trip = useTrip();
  const cityIds = useCityIds();
  const store = useStore();
  const columns = useBoard((s) => s.columns);
  const items = useBoard((s) => s.items);
  const city = useCity(trip.activeCityId);
  const [addingCity, setAddingCity] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  /** All unique tags in the active city. */
  const allTags = useMemo(() => {
    if (!city) return [];
    const set = new Set<string>();
    for (const columnId of city.columnIds) {
      const column = columns[columnId];
      if (!column) continue;
      for (const itemId of column.itemIds) {
        const item = items[itemId];
        if (!item) continue;
        for (const tag of item.tags) set.add(tag);
      }
    }
    return Array.from(set).sort();
  }, [city, columns, items]);

  const handleCitySwitch = useCallback(
    (cityId: string) => store.setActiveCity(cityId),
    [store],
  );

  const hasFilters = activeFilters.length > 0;

  return (
    <>
      <div className="shrink-0 border-b border-line bg-card">
        {/* Row 1 — City tabs + actions */}
        <div className="scroll-none flex items-center gap-2 overflow-x-auto px-4 py-2">
          {/* City Tabs */}
          {cityIds.map((cityId) => (
            <CueStripCityTab
              key={cityId}
              cityId={cityId}
              active={cityId === trip.activeCityId}
              onSelect={handleCitySwitch}
            />
          ))}

          {/* + City */}
          <button
            type="button"
            onClick={() => setAddingCity(true)}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3.5 text-[13px] text-muted transition-colors hover:border-brand hover:text-brand"
          >
            <Plus size={16} />
            City
          </button>

          {/* Spacer */}
          <span className="flex-1" />

          {/* Filter toggle — only when there are tags to filter */}
          {allTags.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-medium transition-colors',
                hasFilters
                  ? 'border-brand bg-brand-soft text-brand-on-soft'
                  : 'border-line text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              <Filter size={14} />
              {hasFilters ? activeFilters.length : 'Filter'}
              <ChevronDown
                size={14}
                className={cn(
                  'transition-transform duration-200',
                  filtersOpen && 'rotate-180',
                )}
              />
            </button>
          )}

          {/* Manage tags. Unlike the filter toggle this stays put whether or not
              the city has tags yet: it's a fixed place to look, and the dialog
              explains where tags come from when there are none. */}
          {city && (
            <button
              type="button"
              onClick={() => setTagsOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-line px-3 text-[13px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              <Tags size={14} />
              Tags
            </button>
          )}

          {/* Primary action — Add to Trip */}
          <button
            type="button"
            onClick={onAddItem}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium',
              'bg-brand text-brand-contrast transition-colors',
              'hover:bg-brand-hover active:bg-brand-active',
            )}
          >
            Add to Trip
            <Plus size={18} />
          </button>
        </div>

        {/* Row 2 — Collapsible tag filter tray */}
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2.5">
              {allTags.map((tag) => (
                <TagChip
                  key={tag}
                  label={tag}
                  tagColors={trip.tagColors}
                  tagIcons={trip.tagIcons}
                  indicator={
                    <TagStyleTrigger
                      tag={tag}
                      selected={activeFilters.includes(tag)}
                    />
                  }
                  selected={activeFilters.includes(tag)}
                  onClick={() => onToggleFilter(tag)}
                  onRemove={
                    activeFilters.includes(tag)
                      ? () => onToggleFilter(tag)
                      : undefined
                  }
                />
              ))}

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    for (const tag of activeFilters) onToggleFilter(tag);
                  }}
                  className="ml-1 text-[11px] font-medium text-muted transition-colors hover:text-ink"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddCityDialog open={addingCity} onClose={() => setAddingCity(false)} />
      <TagsDialog open={tagsOpen} onClose={() => setTagsOpen(false)} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * City Tab (cue-strip variant)
 *
 * Spec: icon 20px, gap 8px, padding 16px h / 12px v, r = 12.
 * Active state shows periwinkle outline.
 * ------------------------------------------------------------------ */

function CueStripCityTab({
  cityId,
  active,
  onSelect,
}: {
  cityId: string;
  active: boolean;
  onSelect: (cityId: string) => void;
}) {
  const city = useCity(cityId);
  if (!city) return null;

  return (
    <button
      type="button"
      onClick={() => onSelect(cityId)}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 font-display text-sm font-semibold whitespace-nowrap transition-colors duration-150',
        active
          ? 'border-brand bg-brand-soft text-brand-on-soft'
          : 'border-line bg-card text-ink hover:border-line-strong',
      )}
    >
      <Building2
        size={20}
        className={cn('shrink-0', active ? 'text-brand' : 'text-faint')}
      />
      {city.title}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Add city dialog
 * ------------------------------------------------------------------ */

function AddCityDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const store = useStore();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = title.trim();
    if (!clean || busy) return;
    setBusy(true);
    await store.addCity(clean);
    setBusy(false);
    setTitle('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a city"
      description="It starts with an empty Backlog. Add days once you know the dates."
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
            disabled={!title.trim()}
            onClick={submit}
          >
            Add city
          </Button>
        </>
      }
    >
      <Input
        label="City"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void submit();
        }}
        placeholder="Amsterdam"
      />
    </Dialog>
  );
}
