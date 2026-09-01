'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * Inline rename. Enter commits, Escape reverts, blur commits — no modal just to
 * change a title.
 */
export function InlineText({
  value,
  onCommit,
  placeholder = 'Untitled',
  className,
  ariaLabel,
  autoFocus = false,
  multiline = false,
  fitContent = false,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
  /** Focus and select on mount — used for freshly created items. */
  autoFocus?: boolean;
  multiline?: boolean;
  /**
   * Shrink the field to the width of its own text instead of filling its
   * container. For a title sitting in a wide bar, where a full-width hit area
   * and hover background read as an empty search box rather than a name you
   * can click. Ignored when `multiline`.
   */
  fitContent?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const reverted = useRef(false);

  // Track external updates (another person's edit) unless we're mid-typing.
  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [autoFocus]);

  const commit = () => {
    if (reverted.current) {
      reverted.current = false;
      return;
    }
    const next = draft.trim();
    if (next === value) return;
    onCommit(next);
  };

  const shared = {
    ref: ref as never,
    value: draft,
    placeholder,
    'aria-label': ariaLabel,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setDraft(event.target.value),
    onBlur: commit,
    onKeyDown: (
      event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        reverted.current = true;
        setDraft(value);
        ref.current?.blur();
      } else if (event.key === 'Enter' && (!multiline || event.metaKey)) {
        event.preventDefault();
        ref.current?.blur();
      }
    },
    className: cn(
      'w-full min-w-0 rounded-[6px] border-0 bg-transparent outline-none',
      'transition-colors duration-150 hover:bg-subtle focus:bg-subtle',
      'px-1 placeholder:text-faint placeholder:italic',
      // When fitting, the wrapper carries the offset instead, so the negative
      // margin does not fight the grid cell it is being measured into.
      !fitContent && '-mx-1',
      className,
    ),
  };

  if (multiline) return <textarea {...shared} rows={2} />;

  if (!fitContent) return <input {...shared} type="text" />;

  /*
   * An input has no intrinsic content width, so a copy of the text is stacked
   * in the same grid cell to supply one. The span is what the column is sized
   * from; the input lays over it at `w-full` and inherits that width, updating
   * as you type because both read the same draft.
   *
   * Measuring in CSS rather than JS keeps it correct on the first paint, with
   * no ref, no observer, and no reflow after mount. `field-sizing: content`
   * would replace all of this, but it is Chromium-only for now.
   *
   * `max-w-full` caps the field at the container so a very long title stops
   * growing and scrolls inside itself rather than shoving the toolbar off.
   */
  return (
    <span className="-mx-1 inline-grid max-w-full items-center align-middle">
      <span
        aria-hidden="true"
        className={cn(
          'invisible col-start-1 row-start-1 px-1 whitespace-pre',
          className,
        )}
      >
        {draft || placeholder}
      </span>
      <input
        {...shared}
        type="text"
        className={cn(shared.className, 'col-start-1 row-start-1')}
      />
    </span>
  );
}
