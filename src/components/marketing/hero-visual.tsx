'use client';

import { CheckCheck, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

import { heroTiming, useHeroSequence, WORDS } from './use-hero-sequence';

const {
  WORD_STAGGER,
  WORD_DUR,
  DONE_LINE_START,
  DONE_LINE_DUR,
  DOTS_START,
  DOT_STAGGER,
  DOT_DUR,
  CHEVRON_START,
  CHEVRON_DUR,
  CARDS_START,
  CARD_STAGGER,
  CARD_DUR,
} = heroTiming;

const FRI_ITEMS = [
  { title: 'Borough Market', meta: '09:00 · 1h', rowH: 'h-14', cardH: 'h-12' },
  { title: 'Tate Modern', meta: '10:00 · 2h', rowH: 'h-28', cardH: 'h-[104px]' },
  { title: 'Lunch nearby', meta: '12:15 · 1h', rowH: 'h-14', cardH: 'h-12' },
] as const;

/**
 * The hero's "Claude writes to the board" panel: the prompt card, the
 * connecting dots, and the board preview. Plays its reveal sequence once on
 * mount and once more if it fully leaves and re-enters the viewport — see
 * `useHeroSequence`.
 */
export function HeroVisual() {
  const { visibilityRef, playKey, started } = useHeroSequence();

  return (
    <div
      ref={visibilityRef}
      className="flex min-w-0 flex-col cursor-default opacity-0 select-none"
      style={{ animation: 'triply-fade-up-visual 420ms var(--ease-out) 150ms both' }}
    >
      {/* `contents` keeps this remount boundary out of the flex layout above. */}
      <div key={playKey} className="contents">
        <div className="flex flex-col gap-2.5 rounded-t-[18px] rounded-b-[4px] bg-[#0F1230] px-4.5 py-4">
          <span className="inline-flex items-center gap-1.5 font-display text-[10.5px] font-bold tracking-[0.14em] text-faint uppercase">
            <img src="/mcp-icon-rounded.svg" width={12} height={12} alt="" className="block" />
            In Claude or ChatGPT
          </span>
          <span className="text-pretty text-[14.5px] leading-relaxed text-[#F8F8FB]">
            <span
              className={cn('transition-opacity ease-out', started ? 'opacity-100' : 'opacity-0')}
              style={{ transitionDuration: `${WORD_DUR}ms`, transitionDelay: '0ms' }}
            >
              &ldquo;
            </span>
            {WORDS.flatMap((word, i) => [
              i > 0 ? ' ' : null,
              <span
                key={i}
                className={cn(
                  'transition-opacity ease-out',
                  started ? 'opacity-100' : 'opacity-0',
                )}
                style={{
                  transitionDuration: `${WORD_DUR}ms`,
                  transitionDelay: `${i * WORD_STAGGER}ms`,
                }}
              >
                {word}
              </span>,
            ])}
            <span
              className={cn('transition-opacity ease-out', started ? 'opacity-100' : 'opacity-0')}
              style={{
                transitionDuration: `${WORD_DUR}ms`,
                transitionDelay: `${(WORDS.length - 1) * WORD_STAGGER}ms`,
              }}
            >
              &rdquo;
            </span>
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[13px] font-medium text-[#7B7EF7] transition-[opacity,transform] ease-out',
              started ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
            )}
            style={{
              transitionDuration: `${DONE_LINE_DUR}ms`,
              transitionDelay: `${DONE_LINE_START}ms`,
            }}
          >
            <CheckCheck size={15} strokeWidth={2.25} />
            Wrote 3 items to London, lunch in Soho added
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5 py-2.5">
          {(
            [
              ['size-1', 'bg-line-strong'],
              ['size-1.5', 'bg-brand-soft'],
              ['size-1.5', 'bg-brand'],
            ] as const
          ).map(([size, color], i) => (
            <span
              key={i}
              className={cn(
                size,
                color,
                'rounded-full transition-[opacity,transform] ease-out',
                started ? 'scale-100 opacity-100' : 'scale-[.6] opacity-0',
              )}
              style={{
                transitionDuration: `${DOT_DUR}ms`,
                transitionDelay: `${DOTS_START + i * DOT_STAGGER}ms`,
                transitionTimingFunction: 'var(--ease-spring)',
              }}
            />
          ))}
          <ChevronDown
            size={15}
            strokeWidth={2.25}
            className={cn(
              'text-brand transition-[opacity,transform] ease-out',
              started ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
            )}
            style={{
              transitionDuration: `${CHEVRON_DUR}ms`,
              transitionDelay: `${CHEVRON_START}ms`,
              transitionTimingFunction: 'var(--ease-spring)',
            }}
          />
        </div>

        <div className="min-w-0 overflow-hidden rounded-t-[4px] rounded-b-[20px] border border-line bg-card shadow-float">
          <div className="flex items-center gap-2 overflow-hidden border-b border-line px-3.5 py-3">
            <span className="inline-flex h-[30px] items-center whitespace-nowrap rounded-[10px] bg-brand-soft px-3 text-[13px] font-semibold text-brand-on-soft">
              London
            </span>
            <span className="inline-flex h-[30px] items-center rounded-[10px] border border-line px-3 text-[13px] whitespace-nowrap text-muted">
              Amsterdam
            </span>
            <span className="inline-flex h-[30px] items-center rounded-[10px] border border-line px-3 text-[13px] whitespace-nowrap text-muted">
              Barcelona
            </span>
          </div>
          <div className="grid grid-cols-[44px_1fr_1fr]">
            <div className="flex flex-col border-r border-line">
              <div className="h-[34px]" />
              {['09:00', '10:00', '11:00', '12:00'].map((t) => (
                <div
                  key={t}
                  className="h-14 pr-2 text-right text-[11px] tabular-nums text-faint"
                >
                  {t}
                </div>
              ))}
            </div>
            <div className="flex flex-col border-r border-line px-2 pb-3">
              <div className="flex h-[34px] items-center font-display text-[12.5px] font-bold">
                Fri 9
              </div>
              {FRI_ITEMS.map((item, i) => (
                <div key={item.title} className={cn(item.rowH, 'pt-1')}>
                  <div
                    className={cn(
                      item.cardH,
                      'rounded-xl border border-line-strong bg-brand-soft px-2.5 py-1.5',
                      'transition-[transform,opacity] ease-out',
                      started
                        ? 'translate-y-0 scale-100 opacity-100'
                        : 'translate-y-1.5 scale-[.97] opacity-0',
                    )}
                    style={{
                      transitionDuration: `${CARD_DUR}ms`,
                      transitionDelay: `${CARDS_START + i * CARD_STAGGER}ms`,
                    }}
                  >
                    <span className="block font-display text-[12.5px] leading-tight font-bold">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-brand-on-soft">{item.meta}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col px-2 pb-3">
              <div className="flex h-[34px] items-center font-display text-[12.5px] font-bold">
                Sat 10
              </div>
              <div className="h-14" />
              <div className="h-14 pt-1">
                <div className="h-12 rounded-xl border border-line bg-card px-2.5 py-1.5">
                  <span className="block font-display text-[12.5px] leading-tight font-bold">
                    Camden walk
                  </span>
                  <span className="text-[11px] text-faint">10:00 · 1h</span>
                </div>
              </div>
              <div className="h-14" />
              <div className="h-14 pt-1">
                <div className="h-12 rounded-xl border border-line bg-card px-2.5 py-1.5">
                  <span className="block font-display text-[12.5px] leading-tight font-bold">
                    Lunch, Soho
                  </span>
                  <span className="text-[11px] text-faint">12:00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
