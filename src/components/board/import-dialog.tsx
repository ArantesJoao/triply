'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/field';

import { request, useStore, useTrip } from './store';

const EXAMPLE = `{
  "cities": [
    {
      "title": "Barcelona",
      "columns": [
        {
          "title": "Fri 16",
          "timed": true,
          "date": "2026-10-16",
          "items": [
            {
              "title": "Sagrada Família",
              "time": "10:00",
              "blurb": "Book the tower slot ahead.",
              "tags": ["landmark"]
            }
          ]
        }
      ]
    }
  ]
}`;

/**
 * Paste a whole city as JSON. The same payload the REST API and MCP server
 * take, so a plan drafted with Claude can be dropped straight in.
 */
export function ImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const trip = useTrip();
  const store = useStore();
  const [text, setText] = useState(EXAMPLE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'error' | 'ok';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (open) setMessage(null);
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(text);
      // Accept either { cities: [...] } or a bare single city.
      const payload = Array.isArray(parsed.cities)
        ? parsed
        : { cities: [parsed] };

      const { created } = await request<{ created: string[] }>(
        `/api/trips/${trip.id}/import`,
        { method: 'POST', body: JSON.stringify(payload) },
      );

      await store.refetch();
      setMessage({
        tone: 'ok',
        text: `Imported ${created.length} ${created.length === 1 ? 'city' : 'cities'}.`,
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          error instanceof SyntaxError
            ? "That isn't valid JSON. Check for a trailing comma."
            : error instanceof Error
              ? error.message
              : 'Import failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import a plan"
      description="Paste a city (or several) with their days and activities."
      width="lg"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" variant="primary" loading={busy} onClick={submit}>
            Import
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <Label htmlFor="import-json">City JSON</Label>
          <textarea
            id="import-json"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            rows={14}
            className="w-full resize-y rounded-xl border border-line bg-[#0F1230] p-3 font-mono text-[11.5px] leading-relaxed text-[#D9DCF5] outline-none focus:border-brand"
          />
        </div>

        <p className="text-[11.5px] leading-relaxed text-faint">
          Every city gets a Backlog automatically. Times are 24-hour{' '}
          <code className="rounded bg-subtle px-1 py-0.5">HH:MM</code>; add{' '}
          <code className="rounded bg-subtle px-1 py-0.5">
            &quot;dayOffset&quot;: 1
          </code>{' '}
          for anything after midnight.
        </p>

        {message && (
          <p
            className={
              message.tone === 'error'
                ? 'rounded-[10px] border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] text-danger'
                : 'rounded-[10px] border border-line bg-brand-soft px-3 py-2 text-[12.5px] text-brand-on-soft'
            }
          >
            {message.text}
          </p>
        )}
      </div>
    </Dialog>
  );
}
