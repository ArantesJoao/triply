'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ChoiceGroup, Input } from '@/components/ui/field';

import { useStore } from './store';

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
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'timed' | 'list'>('timed');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setKind('timed');
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    const clean = title.trim();
    if (!clean || busy) return;
    setBusy(true);
    await store.addColumn(cityId, clean, kind === 'timed');
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
            disabled={!title.trim()}
            onClick={submit}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
          placeholder="Thu 8, Food ideas…"
        />

        <ChoiceGroup
          label="Type"
          value={kind}
          onChange={setKind}
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
      </div>
    </Dialog>
  );
}
