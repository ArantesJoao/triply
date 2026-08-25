'use client';

import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { IconButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { InlineText } from '@/components/ui/inline-text';
import { Menu } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { BACKLOG_KEY } from '@/lib/board-model';

import { COLUMN_HEADER_PX } from './geometry';
import { useColumn, useStore } from './store';

export function ColumnHeader({
  columnId,
  count,
  onAddItem,
}: {
  columnId: string;
  count: number;
  onAddItem: () => void;
}) {
  const column = useColumn(columnId);
  const store = useStore();
  const [confirming, setConfirming] = useState(false);

  if (!column) return null;

  const reserved = column.key === BACKLOG_KEY;

  return (
    <>
      <header
        className="flex items-center gap-1.5 px-0.5"
        style={{ height: COLUMN_HEADER_PX }}
      >
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            column.timed ? 'bg-brand' : 'bg-line-strong',
          )}
        />

        <InlineText
          value={column.title}
          onCommit={(title) => title && store.renameColumn(columnId, title)}
          ariaLabel={`Rename column ${column.title}`}
          className="font-display text-[15px] leading-tight font-bold"
        />

        <span className="shrink-0 font-display text-[10px] font-medium text-faint tabular-nums">
          {count}
        </span>

        <IconButton
          label={`Add an activity to ${column.title}`}
          size="sm"
          variant="secondary"
          onClick={onAddItem}
          className="text-brand"
        >
          <Plus size={14} />
        </IconButton>

        <Menu
          actions={[
            {
              label: 'Delete column',
              icon: <Trash2 size={14} />,
              destructive: true,
              onSelect: () =>
                count > 0 ? setConfirming(true) : store.deleteColumn(columnId),
            },
          ]}
          trigger={(props) => (
            <IconButton
              {...props}
              label={`${column.title} options`}
              size="sm"
              variant="secondary"
              // The Backlog is reserved — it cannot be deleted in any city.
              disabled={reserved}
              className={cn(reserved && 'opacity-30')}
            >
              <MoreHorizontal size={14} />
            </IconButton>
          )}
        />
      </header>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete "${column.title}"?`}
        description={`This removes ${count} ${count === 1 ? 'card' : 'cards'} along with the column. It can't be undone.`}
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
                store.deleteColumn(columnId);
              }}
            >
              Delete column
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          Move anything you want to keep into the Backlog first.
        </p>
      </Dialog>
    </>
  );
}
