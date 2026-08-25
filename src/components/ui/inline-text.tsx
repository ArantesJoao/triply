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
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
  /** Focus and select on mount — used for freshly created items. */
  autoFocus?: boolean;
  multiline?: boolean;
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
      'px-1 -mx-1 placeholder:text-faint placeholder:italic',
      className,
    ),
  };

  return multiline ? (
    <textarea {...shared} rows={2} />
  ) : (
    <input {...shared} type="text" />
  );
}
