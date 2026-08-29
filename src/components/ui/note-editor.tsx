'use client';

import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  Strikethrough,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { isEmptyNote } from '@/lib/markdown';

import { Markdown } from './markdown';
import { SheetLabel, useSheetIsMobile } from './sheet';

/**
 * The note.
 *
 * Read mode renders the Markdown; edit mode edits the Markdown that produced
 * it, with a toolbar and the usual shortcuts over the top. That is a
 * deliberate step short of the design's WYSIWYG surface — see
 * `docs/modal-redesign.md`. What matters downstream is unaffected: the value
 * is one Markdown string in the column it has always used, so a plain-text
 * note written before any of this is already valid and nothing needs
 * migrating.
 */

/** Long notes fold at eight lines rather than pushing the sheet's tail away. */
const CLAMP_LINES = 8;

export function NoteRead({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Measure rather than count characters: what overflows depends on the width
  // it is read at.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setClamped(node.scrollHeight - node.clientHeight > 2);
  }, [value]);

  return (
    <div>
      <div
        ref={ref}
        style={
          expanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: CLAMP_LINES,
                overflow: 'hidden',
              }
        }
      >
        <Markdown source={value} />
      </div>

      {clamped && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1.5 text-[12.5px] font-semibold text-brand-on-soft hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export function NoteEditor({
  value,
  onChange,
  autoFocus = false,
  disabled = false,
  label = 'Note',
}: {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const mobile = useSheetIsMobile();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setTimeout(() => {
      const node = ref.current;
      node?.focus();
      node?.setSelectionRange(node.value.length, node.value.length);
    }, 30);
    return () => window.clearTimeout(timer);
  }, [autoFocus]);

  /** Wraps the selection, or drops the markers with the caret between them. */
  const surround = (before: string, after = before) => {
    const node = ref.current;
    if (!node) return;
    const { selectionStart: from, selectionEnd: to } = node;
    const selected = value.slice(from, to);
    const next = `${value.slice(0, from)}${before}${selected}${after}${value.slice(to)}`;
    onChange(next);
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(from + before.length, to + before.length);
    });
  };

  /** Prefixes every line the selection touches — how a list gets made. */
  const prefixLines = (prefix: string) => {
    const node = ref.current;
    if (!node) return;
    const { selectionStart: from, selectionEnd: to } = node;
    const lineStart = value.lastIndexOf('\n', from - 1) + 1;
    const lineEnd = value.indexOf('\n', to) === -1 ? value.length : value.indexOf('\n', to);

    const block = value
      .slice(lineStart, lineEnd)
      .split('\n')
      .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line))
      .join('\n');

    const next = value.slice(0, lineStart) + block + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(lineStart, lineStart + block.length);
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      surround('**');
    } else if (mod && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      surround('_');
    } else if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      surround('[', '](https://)');
    } else if (event.key === 'Escape') {
      // Leaves the field, not edit mode. The sheet keeps its own Escape.
      event.stopPropagation();
      ref.current?.blur();
    }
  };

  type Tool =
    | { separator: true }
    | {
        label: string;
        icon: React.ReactNode;
        run: () => void;
        /** Dropped on mobile, where the row has to stay one thumb wide. */
        desktopOnly?: boolean;
      };

  const tools: Tool[] = [
    { label: 'Bold', icon: <Bold size={mobile ? 17 : 14} />, run: () => surround('**') },
    { label: 'Italic', icon: <Italic size={mobile ? 17 : 14} />, run: () => surround('_') },
    {
      label: 'Strikethrough',
      icon: <Strikethrough size={mobile ? 17 : 14} />,
      run: () => surround('~~'),
      desktopOnly: true,
    },
    { separator: true },
    { label: 'Bullet list', icon: <List size={mobile ? 17 : 14} />, run: () => prefixLines('- ') },
    {
      label: 'Checklist',
      icon: <ListChecks size={mobile ? 17 : 14} />,
      run: () => prefixLines('- [ ] '),
      desktopOnly: true,
    },
    {
      label: 'Link',
      icon: <LinkIcon size={mobile ? 17 : 14} />,
      run: () => surround('[', '](https://)'),
    },
  ];

  return (
    <div>
      <SheetLabel>{label}</SheetLabel>

      <div
        className={cn(
          'overflow-hidden rounded-xl border bg-card transition-shadow duration-150',
          focused
            ? 'border-brand shadow-[0_0_0_3px_rgba(99,102,241,0.12)]'
            : 'border-line',
          disabled && 'opacity-45',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-0.5 border-b border-line bg-subtle',
            mobile ? 'gap-1.5 px-3 py-1.5' : 'p-1.5',
          )}
        >
          {tools.map((tool, index) =>
            'separator' in tool ? (
              <span key={index} aria-hidden="true" className="mx-1 h-4.5 w-px bg-line" />
            ) : mobile && tool.desktopOnly ? null : (
              <button
                key={tool.label}
                type="button"
                disabled={disabled}
                aria-label={tool.label}
                title={tool.label}
                // Keep the caret where it was; the button must not take focus.
                onMouseDown={(event) => event.preventDefault()}
                onClick={tool.run}
                className={cn(
                  'grid shrink-0 place-items-center rounded-lg text-muted',
                  'transition-colors hover:bg-brand-soft hover:text-brand-on-soft',
                  mobile ? 'size-11' : 'size-7.5',
                )}
              >
                {tool.icon}
              </button>
            ),
          )}

        </div>

        <textarea
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Why it's worth it, what to book, who suggested it…"
          className={cn(
            'scroll-slim block w-full resize-y bg-transparent px-3.5 py-3 outline-none',
            'leading-relaxed placeholder:text-faint',
            mobile ? 'min-h-30 text-[15px]' : 'min-h-30 text-sm',
          )}
        />
      </div>
    </div>
  );
}

export { isEmptyNote };
