'use client';

import { Ban, Check, Wand2 } from 'lucide-react';

import { TagIndicator } from '@/components/ui/chip';
import { Popover } from '@/components/ui/popover';
import { TAG_ICON_LABELS, TagIcon } from '@/components/ui/tag-icon';
import { cn } from '@/lib/cn';
import {
  TAG_PALETTE_SIZE,
  tagColor,
  tagColorByIndex,
} from '@/lib/tag-colors';
import { TAG_ICON_GROUPS, guessTagIcon, tagIconKey } from '@/lib/tag-icons';
import { useDarkMode } from '@/lib/use-dark-mode';

import { useStore, useTrip } from './store';

/* ------------------------------------------------------------------ *
 * Tag style popover
 *
 * The chip's leading mark doubles as the trigger: tap the icon (or dot) on
 * any chip and you get that tag's icon grid and colour swatches in one panel.
 * Both settings are trip-wide, so restyling a tag from the filter tray updates
 * every card that carries it.
 *
 * Icons resolve from an explicit pick, or from a keyword guess off the tag name
 * when there is no override. "Auto" drops the override so the guess takes over
 * again, and only appears for tags that have a guess behind it — otherwise it
 * would render exactly what "None" renders.
 * ------------------------------------------------------------------ */

export function TagStyleTrigger({
  tag,
  selected = false,
  size = 'md',
}: {
  tag: string;
  selected?: boolean;
  size?: 'sm' | 'md';
}) {
  const trip = useTrip();
  const dark = useDarkMode();

  const colour = tagColor(tag, trip.tagColors);
  const dot = dark ? colour.dotDark : colour.dot;
  const icon = tagIconKey(tag, trip.tagIcons);

  return (
    <Popover
      align="start"
      label={`Style for tag ${tag}`}
      className="w-[268px]"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          title={`Style tag "${tag}"`}
          aria-label={`Style tag ${tag}`}
          className="grid shrink-0 place-items-center rounded-full transition-transform hover:scale-125"
        >
          <TagIndicator icon={icon} dot={dot} selected={selected} size={size} />
        </button>
      )}
    >
      {() => <TagStylePanel tag={tag} />}
    </Popover>
  );
}

function TagStylePanel({ tag }: { tag: string }) {
  const trip = useTrip();
  const store = useStore();
  const dark = useDarkMode();

  const colour = tagColor(tag, trip.tagColors);
  const activeDot = dark ? colour.dotDark : colour.dot;
  const ink = dark ? colour.textDark : colour.text;

  const override = trip.tagIcons[tag];
  const guess = guessTagIcon(tag);
  const active = tagIconKey(tag, trip.tagIcons);
  const isAuto = !(tag in trip.tagIcons);

  return (
    <div className="flex flex-col gap-3">
      <span
        className="truncate text-[11px] font-semibold capitalize"
        style={{ color: ink }}
      >
        {tag}
      </span>

      {/* Colour */}
      <div className="flex items-center gap-1">
        {Array.from({ length: TAG_PALETTE_SIZE }, (_, i) => {
          const palette = tagColorByIndex(i);
          const dot = dark ? palette.dotDark : palette.dot;
          const isActive = activeDot === dot;
          return (
            <button
              key={i}
              type="button"
              title={`Colour ${i + 1}`}
              aria-label={`Colour ${i + 1}`}
              aria-pressed={isActive}
              onClick={() => store.setTagColor(tag, i)}
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full transition-transform',
                isActive ? 'scale-110' : 'hover:scale-110',
              )}
              style={{ background: dot }}
            >
              {isActive && <Check size={12} strokeWidth={3} className="text-white" />}
            </button>
          );
        })}
      </div>

      <div className="h-px bg-line" />

      {/* Auto / none */}
      <div className="flex items-center gap-1.5">
        {/* Without a guess, "Auto" would produce the same bare dot as "None" —
            a control that looks like a choice but isn't. */}
        {guess && (
          <StyleToggle
            active={isAuto}
            onClick={() => store.setTagIcon(tag, null)}
            title={`Match the tag name (${TAG_ICON_LABELS[guess]})`}
          >
            <Wand2 size={11} />
            Auto
            <TagIcon icon={guess} size={11} className="opacity-70" />
          </StyleToggle>
        )}

        <StyleToggle
          active={override === ''}
          onClick={() => store.setTagIcon(tag, '')}
          title="Show a plain dot instead of an icon"
        >
          <Ban size={11} />
          None
        </StyleToggle>
      </div>

      {/* Icon grid */}
      <div className="scroll-slim -mr-1 flex max-h-[210px] flex-col gap-2 overflow-y-auto pr-1">
        {TAG_ICON_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-faint">{group.label}</span>
            <div className="flex flex-wrap gap-1">
              {group.keys.map((key) => {
                const isActive = !isAuto && active === key;
                return (
                  <button
                    key={key}
                    type="button"
                    title={TAG_ICON_LABELS[key]}
                    aria-label={TAG_ICON_LABELS[key]}
                    aria-pressed={isActive}
                    onClick={() => store.setTagIcon(tag, key)}
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-[9px] border transition-colors',
                      isActive
                        ? 'border-transparent text-white'
                        : 'border-line text-muted hover:border-line-strong hover:text-ink',
                    )}
                    style={isActive ? { background: activeDot } : undefined}
                  >
                    <TagIcon icon={key} size={14} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StyleToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-[9px] border px-2 text-[11px] font-medium transition-colors',
        active
          ? 'border-brand bg-brand-soft text-brand-on-soft'
          : 'border-line text-muted hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
