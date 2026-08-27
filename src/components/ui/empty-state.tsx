import { RouteMark } from '@/components/brand/route-mark';
import { TagChip } from '@/components/ui/chip';
import { cn } from '@/lib/cn';

/**
 * The shared shape behind every empty state: a light illustration carrying the
 * dotted route, one headline, one short paragraph, one obvious action. Calm and
 * practical — never chirpy.
 */
export function EmptyState({
  title,
  body,
  hint,
  action,
  secondary,
  illustration,
  size = 'md',
  className,
}: {
  title: string;
  body?: React.ReactNode;
  /** Sits between the copy and the action — examples, not another sentence. */
  hint?: React.ReactNode;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  illustration?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        size === 'md' ? 'gap-4 px-6 py-12' : 'gap-2.5 px-4 py-8',
        className,
      )}
    >
      {illustration ?? <RouteMark width={size === 'md' ? 104 : 76} animate />}

      <div className="max-w-sm">
        <h3
          className={cn(
            'font-display font-bold text-ink',
            size === 'md' ? 'text-lg' : 'text-[13px]',
          )}
        >
          {title}
        </h3>
        {body && (
          <p
            className={cn(
              'mt-1.5 leading-relaxed text-balance text-muted',
              size === 'md' ? 'text-[13px]' : 'text-[11.5px]',
            )}
          >
            {body}
          </p>
        )}
      </div>

      {hint}

      {(action || secondary) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

/**
 * The cityscape shown for a city with nothing planned yet.
 *
 * The asset is an alpha mask, not a picture, so the ink is whatever colour this
 * element carries (`bg-brand` here). It re-tints itself with the theme, has no
 * white background to hide in dark mode, and the rounded edge fade is part of
 * the mask. See scripts/build-city-mask.mjs.
 */
export function CityIllustration({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'mask-city aspect-[3/2] bg-brand',
        // The negative margin cancels the two levels of px-6 above it, so on a
        // phone the illustration runs edge to edge instead of sitting inside
        // the text's gutters. The margin box still matches the content box, so
        // this cannot introduce horizontal scroll. The cap only applies from
        // sm up, or it would claw back that edge-to-edge width on big phones.
        '-mx-12 w-[calc(100%+6rem)] sm:max-w-sm',
        className,
      )}
    />
  );
}

/**
 * An open box with ideas floating out — the empty Backlog.
 *
 * Same treatment as `CityIllustration`: an alpha mask rather than a picture, so
 * the element's own colour is the ink and the box, cards and route dots re-tint
 * themselves with the theme. See scripts/build-backlog-mask.mjs.
 */
export function BacklogIllustration({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('mask-backlog aspect-square w-40 bg-brand', className)}
    />
  );
}

/**
 * Three example tags under the empty-Backlog copy.
 *
 * They are real `TagChip`s resolving their own colour and icon from the tag
 * name, so what the user sees here is exactly what their own tags will look
 * like. Examples of the shape of a tag, not a taxonomy — trip.ly tags stay
 * free-form, which is also why they are lowercase, as typed ones are.
 */
export function BacklogTagHint({
  size = 'sm',
  className,
}: {
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex flex-wrap items-center justify-center',
        size === 'sm' ? 'gap-1' : 'gap-1.5',
        className,
      )}
    >
      {['restaurants', 'landmarks', 'transit'].map((tag) => (
        <TagChip key={tag} label={tag} size={size} />
      ))}
    </div>
  );
}
