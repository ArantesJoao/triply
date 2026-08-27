'use client';

import { Building2, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button, IconButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { InlineText } from '@/components/ui/inline-text';
import { Menu } from '@/components/ui/menu';
import { cn } from '@/lib/cn';

import { useBoard, useCityIds, useStore, useTrip } from './store';

export function CityTabs() {
  const trip = useTrip();
  const cityIds = useCityIds();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="scroll-none flex items-center gap-2 overflow-x-auto border-b border-line bg-card px-4 py-2">
        {cityIds.map((cityId) => (
          <CityTab
            key={cityId}
            cityId={cityId}
            active={cityId === trip.activeCityId}
          />
        ))}

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3.5 text-[13px] text-muted transition-colors hover:border-brand hover:text-brand"
        >
          <Plus size={16} />
          City
        </button>
      </div>

      <AddCityDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function CityTab({ cityId, active }: { cityId: string; active: boolean }) {
  const store = useStore();
  const city = useBoard((state) => state.cities[cityId]);
  const columns = useBoard((state) => state.columns);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!city) return null;

  const itemCount = city.columnIds.reduce(
    (total, columnId) => total + (columns[columnId]?.itemIds.length ?? 0),
    0,
  );

  return (
    <>
      <div
        className={cn(
          'group/tab flex h-11 shrink-0 items-center gap-2 rounded-xl border pr-1.5 pl-3.5 transition-colors duration-150',
          active
            ? 'border-brand bg-brand-soft text-brand-on-soft'
            : 'border-line bg-card text-ink hover:border-line-strong',
        )}
      >
        <Building2
          size={20}
          className={cn('shrink-0', active ? 'text-brand' : 'text-faint')}
        />

        {renaming ? (
          <InlineText
            value={city.title}
            autoFocus
            ariaLabel={`Rename ${city.title}`}
            onCommit={(title) => {
              if (title) store.renameCity(cityId, title);
              setRenaming(false);
            }}
            className="w-24 font-display text-sm font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => store.setActiveCity(cityId)}
            onDoubleClick={() => setRenaming(true)}
            aria-current={active ? 'page' : undefined}
            className="font-display text-sm font-semibold whitespace-nowrap"
          >
            {city.title}
          </button>
        )}

        <span className="font-display text-[10px] text-faint tabular-nums">
          {itemCount}
        </span>

        <Menu
          actions={[
            { label: 'Rename', onSelect: () => setRenaming(true) },
            {
              label: 'Delete city',
              icon: <Trash2 size={14} />,
              destructive: true,
              onSelect: () =>
                itemCount > 0 ? setConfirming(true) : store.deleteCity(cityId),
            },
          ]}
          trigger={(props) => (
            <IconButton
              {...props}
              label={`${city.title} options`}
              size="sm"
              className="opacity-0 transition-opacity group-hover/tab:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
            >
              <MoreHorizontal size={14} />
            </IconButton>
          )}
        />
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete ${city.title}?`}
        description={`Every day, list and card in this city goes with it (${itemCount} in total). This can't be undone.`}
        width="sm"
        footer={
          <>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setConfirming(false);
                store.deleteCity(cityId);
              }}
            >
              Delete city
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          The rest of the trip is unaffected.
        </p>
      </Dialog>
    </>
  );
}

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
