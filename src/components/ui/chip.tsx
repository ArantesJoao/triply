'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * Tag chip. Compact on purpose — several sit on one Plan Card, and tags stay
 * secondary to the activity title.
 */
export function TagChip({
  label,
  onRemove,
  onClick,
  selected = false,
  size = 'md',
  className,
}: {
  label: string;
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const interactive = Boolean(onClick);
  const Wrapper = interactive ? 'button' : 'span';

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border transition-colors duration-150 ease-out',
        selected
          ? 'border-brand bg-brand-soft text-brand-on-soft'
          : 'border-transparent bg-brand-soft text-brand-on-soft',
        size === 'sm' ? 'h-5 gap-1 pr-1.5 pl-2' : 'h-7 gap-1.5 pr-2 pl-2.5',
        className,
      )}
    >
      {/* Selection carries a check as well as colour. */}
      {selected ? (
        <Check size={size === 'sm' ? 9 : 12} className="shrink-0" strokeWidth={3} />
      ) : (
        <span
          className={cn(
            'shrink-0 rounded-full bg-brand',
            size === 'sm' ? 'size-1' : 'size-1.5',
          )}
        />
      )}

      <Wrapper
        {...(interactive
          ? { type: 'button' as const, onClick, 'aria-pressed': selected }
          : {})}
        className={cn(
          'min-w-0 truncate font-medium',
          size === 'sm' ? 'text-[10px]' : 'text-xs',
          interactive && 'cursor-pointer',
        )}
      >
        {label}
      </Wrapper>

      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove tag ${label}`}
          className="grid shrink-0 place-items-center rounded-full opacity-55 transition-opacity hover:opacity-100"
        >
          <X size={size === 'sm' ? 9 : 12} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}

/**
 * Free-text tag entry — no taxonomy, no picker. Enter or comma commits,
 * Backspace on an empty field removes the last tag.
 */
export function TagInput({
  tags,
  onChange,
  placeholder = '+ tag',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const commit = (raw: string) => {
    const value = raw.trim().toLowerCase();
    setDraft('');
    if (!value || tags.includes(value)) return;
    onChange([...tags, value]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <TagChip
          key={tag}
          label={tag}
          onRemove={() => onChange(tags.filter((t) => t !== tag))}
        />
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commit(draft);
          } else if (event.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={placeholder}
        aria-label="Add a tag"
        className="h-7 w-24 min-w-0 rounded-full border border-dashed border-line-strong bg-transparent px-2.5 text-xs outline-none placeholder:text-faint focus:border-brand"
      />
    </div>
  );
}
