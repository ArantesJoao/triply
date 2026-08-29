'use client';

import { cn } from '@/lib/cn';

import { Button } from './button';
import { useSheetIsMobile } from './sheet';

/**
 * The confirmation step for a destructive action, or for leaving work behind.
 *
 * It replaces the sheet's content in place rather than stacking a second
 * overlay. That is not only a visual preference: the modal shells here claim
 * Escape on the document's capture phase, so a stacked overlay would fight the
 * sheet underneath it for the key.
 *
 * Two shapes, decided by whether `save` is given:
 *
 * - **Two buttons** — a plain destructive confirmation. Delete is the primary
 *   action, because destroying the thing is what was asked for.
 * - **Three buttons** — the unsaved-work question. Keeping the work is the
 *   primary action and discarding it drops to a quiet danger button. Offering
 *   only *discard* and *keep editing* leaves the fastest way out of the dialog
 *   as the one that loses your typing, and makes someone who meant "I'm done
 *   here" go back and press Save themselves.
 */
export function ConfirmPanel({
  icon,
  title,
  description,
  save,
  confirmLabel,
  cancelLabel = 'Keep it',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** The safe way out. Its presence is what makes this a three-way choice. */
  save?: { label: string; onSelect: () => void };
  /** The destructive choice. */
  confirmLabel: string;
  /** Backing out of the confirmation entirely. */
  cancelLabel?: string;
  tone?: 'danger' | 'neutral';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const mobile = useSheetIsMobile();

  return (
    <div className={cn(mobile ? 'px-[18px] pt-1 pb-6' : 'p-5')}>
      <span
        aria-hidden="true"
        className={cn(
          'mb-3 grid size-11 place-items-center rounded-[14px]',
          tone === 'danger'
            ? 'bg-danger-soft text-danger'
            : 'bg-brand-soft text-brand-on-soft',
        )}
      >
        {icon}
      </span>

      <h3
        className={cn(
          'font-display font-black',
          mobile ? 'text-[19px]' : 'text-[17px]',
        )}
      >
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>

      {save ? (
        <div
          className={cn(
            'mt-[18px] flex gap-2.5',
            // Safest first down the screen on a phone; on desktop the
            // destructive option sits away on the left, the way the sheet's
            // own footer puts Delete away from Save.
            mobile ? 'flex-col' : 'items-center',
          )}
        >
          {mobile ? (
            <>
              <Button
                size="lg"
                variant="primary"
                onClick={save.onSelect}
                className="h-12 w-full rounded-[14px] font-semibold"
              >
                {save.label}
              </Button>
              <Button
                size="lg"
                onClick={onCancel}
                className="h-12 w-full rounded-[14px]"
              >
                {cancelLabel}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={onConfirm}
                className="h-12 w-full rounded-[14px] text-danger hover:bg-danger-soft hover:text-danger"
              >
                {confirmLabel}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={onConfirm}
                className="text-danger hover:bg-danger-soft hover:text-danger"
              >
                {confirmLabel}
              </Button>
              <div className="flex-1" />
              <Button size="sm" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button size="sm" variant="primary" onClick={save.onSelect}>
                {save.label}
              </Button>
            </>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'mt-[18px] flex gap-2.5',
            mobile ? 'flex-col-reverse' : 'justify-end',
          )}
        >
          <Button
            size={mobile ? 'lg' : 'sm'}
            onClick={onCancel}
            className={mobile ? 'h-12 w-full rounded-[14px]' : undefined}
          >
            {cancelLabel}
          </Button>
          <Button
            size={mobile ? 'lg' : 'sm'}
            variant={tone === 'danger' ? 'destructive' : 'primary'}
            onClick={onConfirm}
            className={cn(mobile && 'h-12 w-full rounded-[14px] font-semibold')}
          >
            {confirmLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
