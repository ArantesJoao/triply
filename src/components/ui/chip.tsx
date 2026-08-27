'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { tagColor, type TagColor } from '@/lib/tag-colors';
import { tagIconKey, type TagIconKey } from '@/lib/tag-icons';
import { useDarkMode } from '@/lib/use-dark-mode';

import { TagIcon } from './tag-icon';

/**
 * The chip's leading mark: a check when selected, the tag's icon when it has
 * one, else the plain coloured dot. Exported so the tag-style popover's
 * trigger can render exactly the same mark.
 */
export function TagIndicator({
  icon,
  dot,
  selected = false,
  size = 'md',
}: {
  icon?: TagIconKey | null;
  dot: string;
  selected?: boolean;
  size?: 'sm' | 'md';
}) {
  if (selected) {
    return (
      <Check
        size={size === 'sm' ? 10 : 12}
        className="shrink-0"
        style={{ color: dot }}
        strokeWidth={3}
      />
    );
  }

  if (icon) {
    return (
      <TagIcon
        icon={icon}
        size={size === 'sm' ? 11 : 13}
        color={dot}
        className="shrink-0"
      />
    );
  }

  return (
    <span
      className={cn('shrink-0 rounded-full', size === 'sm' ? 'size-1' : 'size-2')}
      style={{ background: dot }}
    />
  );
}

/**
 * Tag chip — r=12, coloured dot or icon, theme-aware.
 *
 * Each tag gets a deterministic colour from an 8-hue palette (via
 * `tagColor()`) and, where its name suggests one, an icon (via `tagIconKey()`).
 * Pass `color` to override the colour directly, or `tagColors` / `tagIcons` to
 * let the tag-name lookup respect the trip's overrides. Compact `sm` variant is
 * for plan-card inline tags.
 */
export function TagChip({
  label,
  onRemove,
  onClick,
  selected = false,
  color,
  tagColors,
  tagIcons,
  indicator,
  size = 'md',
  className,
}: {
  label: string;
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
  /** Override the auto-derived colour directly. */
  color?: TagColor;
  /** Per-trip `{ tagName: paletteIndex }` overrides (from the store). */
  tagColors?: Record<string, number>;
  /** Per-trip `{ tagName: iconKey }` overrides (from the store). */
  tagIcons?: Record<string, string>;
  /** Replaces the leading dot/icon — used to make it a style-picker trigger. */
  indicator?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const interactive = Boolean(onClick);
  const Wrapper = interactive ? 'button' : 'span';
  const c = color ?? tagColor(label, tagColors);
  const icon = tagIconKey(label, tagIcons);
  const dark = useDarkMode();

  const bg = dark ? c.bgDark : c.bg;
  const text = dark ? c.textDark : c.text;
  const dot = dark ? c.dotDark : c.dot;
  const border = dark ? c.borderDark : c.border;

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center border transition-colors duration-150 ease-out',
        size === 'sm' ? 'rounded-lg' : 'rounded-xl',
        size === 'sm'
          ? 'h-[22px] gap-1 pr-1.5 pl-2 text-[10px]'
          : 'h-8 gap-1.5 pr-2 pl-3 text-xs',
        className,
      )}
      style={{
        background: bg,
        color: text,
        borderColor: selected ? border : 'transparent',
      }}
    >
      {/* Dot / icon / check indicator */}
      {indicator ?? (
        <TagIndicator icon={icon} dot={dot} selected={selected} size={size} />
      )}

      <Wrapper
        {...(interactive
          ? { type: 'button' as const, onClick, 'aria-pressed': selected }
          : {})}
        className={cn(
          // Display-only. Tags are stored and matched lowercase (see
          // `TagInput`), so this capitalises without touching the value.
          'min-w-0 truncate font-medium capitalize',
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
          <X size={size === 'sm' ? 10 : 16} strokeWidth={2.5} />
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
  tagColors,
  tagIcons,
  renderIndicator,
  placeholder = '+ tag',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Per-trip tag colour overrides forwarded to each chip. */
  tagColors?: Record<string, number>;
  /** Per-trip tag icon overrides forwarded to each chip. */
  tagIcons?: Record<string, string>;
  /** Makes each chip's mark interactive — see `TagStyleTrigger`. */
  renderIndicator?: (tag: string) => React.ReactNode;
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
          tagColors={tagColors}
          tagIcons={tagIcons}
          indicator={renderIndicator?.(tag)}
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
        className="h-8 w-24 min-w-0 rounded-xl border border-dashed border-line-strong bg-transparent px-3 text-xs outline-none placeholder:text-faint focus:border-brand"
      />
    </div>
  );
}
