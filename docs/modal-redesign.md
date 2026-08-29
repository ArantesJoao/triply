# Modal redesign — Activity card & Add a day or list

Implementation plan for the consolidated modal spec in the Claude Design
project [`Modal Redesign.dc.html`][design] (`6fe5afb2-…`). Scope is the two
modals named in that spec: **Activity card** (`board/item-dialog.tsx`) and
**Add a day or list** (`board/add-column-dialog.tsx`). The other four modals
listed in the design's `Remaining modals.md` — Day start, Import, Tags, Share —
are explicitly *not* in scope and are left on the existing `ui/dialog.tsx`
shell, untouched.

[design]: https://claude.ai/design/p/6fe5afb2-5696-404d-a29a-9d40ec1467c9?file=Modal+Redesign.dc.html

## The shape of the change

Today both modals are the same thing: a centred `Dialog`, `pt-[10vh]`, header +
body + `bg-subtle` footer, identical on a phone. Every field is a live control
from the moment it opens, every change writes immediately, and nothing tells
you that it did.

The redesign changes three things at once:

1. **Read first, edit on purpose.** The activity card opens read-only and
   renders its values as type. `Edit` flips the whole sheet; `Save` / `Cancel`
   commit or discard explicitly. Nothing is written until Save.
2. **One responsive primitive.** A `Sheet` renders a centred modal at `md` and
   above and a bottom drawer below it, so no modal picks its own responsive
   behaviour any more.
3. **One date/time control.** Quick-pick chips up front, the full picker one
   tap away — the same interaction for Add-a-day's Date and the activity
   card's Time.

Two fields do change, on top of what the mock asked for. Duration loses its
`None` — every activity takes some time, and "None" only ever meant "nobody has
said yet", which drew a zero-height block on the axis and made a real half hour
look like an omission; 30m is the new default and 45m joins the list. And the
`Same day / After midnight` toggle is gone: it asked the reader to think about
midnight in order to enter a time, which is a question almost no card has an
answer to. `dayOffset` still exists on the record and is still set by dragging
a card across midnight on the axis — it just isn't something the sheet asks.

## Files

### New

| File | What it is |
|---|---|
| `ui/sheet.tsx` | The responsive shell. Centred modal ≥ `md`, bottom drawer below. Focus trap, Escape, overlay dismissal, scroll lock, drag-to-dismiss, `dismissible={false}` for in-flight states, `height="full" \| "content"`. Takes `header` and `footer` as slots and exposes `SheetBody` / `SheetFooter` / `SheetLabel`, rather than the fixed title/description `Dialog` imposes — which is what lets the confirm replace the sheet's content in place. |
| `ui/confirm.tsx` | The destructive / discard confirmation. Renders **in place of** the sheet's content, not as a second overlay — `Dialog` claims Escape on document capture and a stacked overlay would fight it. |
| `ui/button.tsx` (edit) | Adds a filled `destructive` variant. The existing `danger` is outlined, which is right for a Delete sitting quietly in a footer and wrong for the confirmation itself, where the destructive act *is* the panel's primary action. |
| `ui/date-picker.tsx` | Quick chips (next three free dates) + `Another date` expanding a full month calendar in place. Taken days shown in a muted fill, unavailable days dimmed and unclickable, resolved date always stated in full underneath. |
| `ui/time-picker.tsx` | Field + panel: five quick chips, an `Exact` row with a 30-minute stepper, `Clear`. Desktop popover anchored under the field; mobile nested drawer over the parent sheet. |
| `ui/note-editor.tsx` | The Note field. Read renderer with an ~8-line clamp and `Show more`; edit toolbar (bold / italic / strike / list / checklist / link) over the Markdown source. |
| `ui/markdown.tsx` | Renders the note's Markdown as React nodes. |
| `lib/markdown.ts` | The strict subset parser (`parseNote`), safe-href checking, and `unsupportedConstructs` — the constructs the editor can't render, named, for the MCP validator that comes later. |
| `ui/read-field.tsx` | The read-mode pieces: the labelled section, and the faint dashed `+ Add a note / tags` row an empty field collapses into. |

### Modified

| File | Change |
|---|---|
| `board/item-dialog.tsx` | Rewritten onto `Sheet` with the read ⇄ edit flip, draft state, explicit commit, save-failure banner, delete confirm, and the mobile `⋯` menu. |
| `board/add-column-dialog.tsx` | Moved onto `Sheet`, Date swapped for `DatePicker`, `Creating…` in-flight state, content-height drawer on mobile. |
| `board/store.tsx` | Two additions: `holdSync()` to pause the poll while a sheet is dirty, and `saveItem()` — a save path that reports failure to its caller instead of to the board's save strip. |
| `lib/time.ts` | Display formatters (`formatDateShort`, `formatDateLong`, `formatMonthTitle`), the month-grid helpers the calendar draws on, and the clock arithmetic behind the time stepper (`stepTime`, `commonStartTimes`). Nothing existing changes. |
| `app/globals.css` | Drawer easing token and the `.prose-note` rules for rendered Markdown. Reduced motion is already handled globally. |

`ui/dialog.tsx` is **not** modified. The other four modals keep it and keep
their current behaviour exactly; migrating them onto `Sheet` is follow-up work,
not part of this change. The cost is that `Sheet` carries its own focus-trap
and scroll-lock rather than sharing `Dialog`'s — accepted deliberately, because
sharing them would mean editing the shell four other modals depend on.

## Activity card

**Read is the default state** for any card that has something to read.

A card being created does not, and it does not exist yet either. Every route
that makes one — the cue strip's *Add to Trip*, a column header's `+`, the
empty-axis prompt, the list-column add rows — funnels through `handleAddItem`,
which used to call `store.addItem` on the spot. That put a blank, titleless
card on everyone's board the instant the button was pressed and left it there
if you changed your mind. It now only records a `pending` request
(`{ columnId, time }`); the sheet opens in edit mode on an empty draft, and the
record is created by **Save** and by nothing else. Backing out leaves no trace.
Save hands the new id back through `onCreated`, so the sheet stays open and
flips to read mode on the card it just made.

While a card is pending there is nothing to delete and nowhere to move it, so
Delete and the move/duplicate targets are not rendered.

Read mode has no input borders and no placeholder text.

It shows the note, the tags, and where the card lives — and nothing else. Time
and duration are already stated in the header as a range, so the mock's tiles
under the title said the same thing twice; they exist only in edit mode, where
they are controls rather than a readout. The note and the tags still collapse
into a dashed `+ Add …` row when empty, and tapping one enters edit mode with
that field focused.

**Edit flips the whole sheet.** The header pill switches to *Editing*, the
footer becomes `Cancel` / `Save`. Every field edits a local draft:

- **`Cancel` means "stop editing"** and lands in read mode. **The `X`, Escape
  and the overlay mean "leave"** and close the sheet. Both discard the draft,
  so both ask first when there is one — but they ask with different
  consequences, which is why `Confirm` carries `discard-read` and
  `discard-close` rather than one `discard`. On a pending card `Cancel` closes
  too, because there is no read mode to fall back to.
- **The unsaved-work confirmation offers three ways out**, not two: *Save and
  close* / *Discard and close* / *Keep editing* — and the first two say where
  they land, so the two routes out of an edit can't be confused for each other.
  See [Cancel vs Save vs Close](#cancel-vs-save-vs-close) for why.
- **An untouched draft never asks.** Closing a card you only looked at, or a
  new one you typed nothing into, just closes — there is no data to lose. This
  is the one rule the confirmation defers to.
- `Save` locks the fields and shows `Saving…` in the button only. On success
  the sheet stays open and flips back to read mode on the record it has just
  written — saving is not a reason to take the card away from whoever was
  reading it. `Done` is what closes it. On failure the sheet stays open with a
  banner above the body, every value intact, and the button reads `Try again`.
- The poll-driven refetch is held (`store.holdSync()`) for as long as the sheet
  is dirty, so a collaborator's poll can't overwrite a half-typed draft.

**Fields**: Title, Time, Duration (30m / 45m / 1h / 2h / 3h), Note, Tags,
Move-or-duplicate, Delete, Unschedule. Unschedule clears the time and zeroes
`dayOffset` with it; in a plain-list column Time is disabled and renders as a
read-only tile captioned *not timed*. New cards are created at 30m, and a card
written before duration was mandatory is drafted at 30m the moment it is
edited. Validation is minimal — Title can't be empty on Save (inline, danger
tone, focus moves to the field).

**Move or duplicate is edit-only.** Read mode states where the activity lives
as a fact (*Thu 8 · London · 2nd of 5 activities*) and offers no way to
relocate it. Both actions apply immediately on tap — they are structural, not
part of the Save payload.

**Secondary and destructive actions.** Desktop: Delete bottom-left in the
footer, Unschedule beside the Day control. Mobile: the footer carries the
primary pair only and the header `⋯` stands in for both — Duplicate /
Unschedule / Delete in read mode, and Delete alone in edit mode, where the day
targets and Unschedule are already on screen and offering them twice would be
the three-placements problem again. Delete always routes through the confirm,
says it is irreversible, and has no undo toast because the board has no undo
stack.

**Every sheet closes the same way on both breakpoints.** The drawer carries the
same `X` as the modal, wired to the same path, on top of the handle-drag and
the overlay tap. A drawer dismissible only by gesture leaves the affordance
most people reach for first with nowhere to land, and the drag is the one input
here that can be taken away by the browser (see below).

## Add a day or list

Fields and rules are unchanged: Type, Date (timed only, minimum = the day after
the city's last dated day), Name. Plain list removes the Date field entirely
and resets Name to the *Food ideas…* placeholder — unless a name has been
typed, which is never overwritten by a type or date change. Enter submits;
Create disables on an empty trimmed name.

Date moves to the quick-pick control: the next three free dates as chips plus
`Another date` for the calendar, with the resolved date always stated in full
underneath so a chip tap is never ambiguous. Picking a day closes the calendar
again — it was opened to answer one question, and it has been answered. An
out-of-range or unparsable date turns the field danger-toned with the message
inline and disables Create.

While the request is in flight the button reads `Creating…`, both fields go
read-only, and the sheet cannot be dismissed by overlay tap or drag, so a
half-created column can't be orphaned.

Reset on open is as today. The live earliest date keeps driving the minimum and
the chips while the sheet is open — collaborators can add days underneath you —
without ever rewriting a half-typed name. Mobile is a **content-height**
drawer, not the 90% sheet: three fields don't need a full screen.

## Motion

Desktop: the panel is vertically centred and capped at `80vh`, with the header
and footer pinned and the body scrolling inside it — so the gap above and below
never changes with the content, and a long note can't push the footer off the
screen. Overlay 150ms fade; panel 180ms opacity + `translateY(8px)` +
`scale(.98)` on `--ease-out`, the token already in `globals.css`.

Drawer: overlay fades while the sheet translates `100%` → `0` over 500ms on
`cubic-bezier(.32,.72,0,1)`; dismissal is the same curve reversed at ~350ms.
16px top corners only. Drag-dismissible from the handle and any non-scrolled
area of the body, following the finger 1:1; release past 25% of sheet height or
above 0.4 velocity dismisses, anything less springs back. The handle's hit area
is 44px though it draws at 8px.

Nested drawers (date, time) use the stacked look: parent scales to `.96`, lifts
12px and dims. Never more than two levels.

With `prefers-reduced-motion`, every translate and scale drops to a 100ms
opacity fade. Drag-to-dismiss still works.

## Decisions taken, and what they cost

**No new dependencies.** The spec names shadcn/Vaul for the drawer. `Sheet`
hand-rolls it instead, in about 150 lines of pointer events. Adding a
dependency here would mean an install and a lockfile change to verify a
behaviour that is fully expressible with the platform, and this repo's working
agreement keeps builds out of the edit loop. Same reasoning for Markdown: the
parser is a small strict-subset one in `lib/markdown.ts` rather than
remark/rehype.

**Markdown is rendered to React nodes, never to an HTML string.** There is no
`dangerouslySetInnerHTML` anywhere in the note path, so the allow-list is
enforced by construction rather than by a sanitiser that has to be right.

**No hint text under the controls.** The mock's `Markdown works too` label and
the keyboard-shortcut line are gone, along with the tag-styling and
move-applies-immediately tips that had been carried over. A control that needs
a caption to be understood is a control to fix, not to annotate.

**The note editor edits Markdown source, not rich text.** This is the one place
the implementation departs from the mock. The design's *edit (note focused)*
frame shows a WYSIWYG surface with rendered bold and bullets under the toolbar;
what ships is the same toolbar and the same shortcuts (⌘B / ⌘I / ⌘K, list and
checklist buttons, the `Markdown works too` hint) acting on a plain Markdown
textarea, with read mode fully rendered. A contentEditable WYSIWYG with a
lossless Markdown round-trip is a large surface to get right and an easy one to
get subtly wrong; the storage contract, every supported construct, and the read
experience are unaffected. Worth revisiting on its own.

**Storage is unchanged.** The note stays a single Markdown string in the
existing `blurb` column. Today's plain-text notes are already valid Markdown,
so there is no migration and no schema change.

**MCP needs nothing for this change.** Because `blurb` stays a plain string
that is neither stripped nor converted, the MCP read → write round-trip is
already byte-identical. The spec's stricter ask — reject unsupported constructs
with an error naming them, rather than accepting them silently — is a change to
the MCP tool surface, not to these two modals, and is listed below as follow-up.

**Move on mobile closes the sheet.** The spec says a move closes the sheet when
the destination column is off-screen. Rather than measure that, the rule is:
desktop keeps the sheet open and re-titles it, mobile closes it — on mobile the
board shows one column at a time, so the destination is off-screen by
definition.

## Cancel vs Save vs Close

The first pass got this wrong in a way worth recording, because the fix came
from the literature rather than from taste.

The confirmation used to offer *Discard* and *Keep editing* and nothing else,
with Discard as a filled red primary. Two problems, and they compound. The
dialog exists to prevent losing work, yet the fastest way out of it was the
button that loses the work — and someone who pressed the X meaning "I'm done
with this, keep it" had no way to say so: back to the editor, press Save, press
X again.

The pattern the guidance converges on is three options — save, discard, keep
editing — because "save and leave" is the most common thing a person means when
they close a form with work in it. So:

- **Save and close** is the primary action, on the right.
- **Discard and close** drops to a quiet danger button, on the left and away
  from it — the same placement the sheet's own footer gives Delete.
- **Keep editing** dismisses the confirmation.

The labels name their destination because the sheet has two ways out of an
edit. From the X it reads *Save and close* / *Discard and close*; from Cancel,
which only stops editing, it reads *Save* / *Discard changes*. [NN/G's *Cancel
vs Close*][cancel-vs-close] is precisely about users being unable to tell those
two apart when the buttons don't say.

Two rules from [Cloudscape][cloudscape] the sheet already followed and keeps
following: no confirmation when there is nothing to lose (an untouched draft,
or a new card nothing was typed into, just closes), and none after a save has
succeeded.

The delete confirmation deliberately does **not** take this shape. It has no
third option — there is no "save" for a deletion — so it stays two buttons with
the destructive act as the primary, and wears the danger-toned icon while the
unsaved-work dialog wears a neutral one. Losing a minute of typing and
destroying a card for everyone on the trip should not look identical.

One place this repo knowingly departs from the guidance: NN/G's first choice is
"when in doubt, save, then out" — make the X save. That collides with the
explicit-commit model the whole sheet is built on, so it asks instead, which is
the article's other sanctioned answer.

[cancel-vs-close]: https://www.nngroup.com/articles/cancel-vs-close/
[cloudscape]: https://cloudscape.design/patterns/general/unsaved-changes/

## Two traps worth knowing about

Both cost a round of debugging, and both are easy to reintroduce.

**A touch drag has to be claimed before the browser claims it.** Drag-to-dismiss
did nothing on a real touchscreen, even from the handle. Without
`touch-action: none` the browser hands a vertical gesture to the nearest
scroller before our handlers have seen enough of it to act, then fires
`pointercancel` — so the sheet sprang back every time. The handle and the
header set `touch-action: none`; neither scrolls, so they can give the whole
gesture up. The body keeps native scrolling and stays best-effort. Separately,
the release decision now reads the last position an actual `pointermove`
reported rather than the coordinates on the up/cancel event, because a cancel
reports wherever the finger was when the browser took over — throwing away a
drag the user had already pulled halfway down the screen.

**Effect cleanups that restore focus must not depend on a caller's inline
arrow.** `Sheet`'s Escape/focus-trap/scroll-lock effect hands focus back to
whatever opened the sheet when it tears down. `requestClose` closes over
`onDismissAttempt`, which arrives as an inline arrow and so changes identity
every render — putting it in the dependency list re-ran the effect on every
keystroke, and the cleanup pulled the caret out of whatever field was being
typed into. Those identities are held in refs now, and the effect depends on
`open` alone.

**`twMerge` only replaces classes it recognises as the same group.** The
confirm button carried the default `secondary` variant with `bg-danger` and
`hover:brightness-110` layered on top: `bg-card` lost to `bg-danger` as
intended, but the variant's `hover:bg-subtle` had nothing to collide with and
survived, so hovering turned a red button near-white under white text. Reach
for a variant rather than painting over one.

## Follow-up, not in this change

- Migrate Day start, Import, Tags and Share onto `Sheet`.
- `ui/field.tsx`'s `ChoiceGroup` is left in place but no longer has a caller —
  the type choice is now two cards on desktop and two 56px rows on mobile,
  which the generic chip group can't express. Delete it, or give it the new
  shape, when the remaining modals move across.
- The MCP allow-list validator that rejects unsupported Markdown by name.
- `TimePicker` replacing the start-time control in `day-start-dialog.tsx`
  (`ui/time-field.tsx` stays until then).
- The note's WYSIWYG surface.
