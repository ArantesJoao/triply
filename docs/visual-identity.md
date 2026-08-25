# Trip.ly — Visual Identity & UI Design Specification

> **Authority note:** This document is the authoritative design spec. Where it
> conflicts with the Claude Design project (`Trip Planner.dc.html`), **this
> document wins.** The Claude Design file is a structural/interaction reference.

## 1. Product identity

**Product name:** `trip.ly`

**Product type:** Collaborative trip-planning board.

**Primary positioning:** A clean, premium, lightweight tool that helps groups turn travel ideas into an organized shared itinerary.

The product should feel:

* Minimal
* Premium
* Modern
* Calm
* Highly usable
* Collaborative without feeling "social-media-like"
* Travel-oriented without relying on obvious travel clichés
* Suitable for becoming a public consumer product
* Equally intentional in light and dark mode

The closest visual references are:

* **Linear** for clarity, restraint, spacing, interaction quality, and overall polish
* **Airbnb** for approachability and consumer friendliness
* **Flighty** for premium travel-product character

The visual language should sit somewhere between Linear's precision and Airbnb/Flighty's warmth.

---

## 2. Brand concept

Trip.ly's main visual metaphor is:

> **Movement through a journey rather than a destination pin.**

Travel should be communicated subtly.

Avoid making airplanes, suitcases, globes, passports, or generic location pins the primary brand identity.

Instead, Trip.ly uses a **dotted exploratory route**.

The route represents:

* movement
* discovery
* changing plans
* multiple stops
* progression through a trip
* ideas becoming an itinerary
* a group moving through places together

This motif can appear throughout the product, especially in:

* branding
* empty states
* loading states
* onboarding
* subtle background illustrations
* success states
* drag-and-drop hints

It should never become decorative clutter.

---

## 3. Logo

### Primary wordmark

The product should be written:

`trip.ly`

Lowercase only.

The wordmark should feel modern and understated rather than playful.

Preferred treatment:

* `trip` in dark indigo
* `.ly` in periwinkle

However, the system should preserve multiple approved treatments:

#### Primary

`trip` = Indigo
`.ly` = Periwinkle

#### Monochrome

Entire wordmark uses one foreground color.

Used when:

* printing
* very small sizes
* monochrome contexts
* accessibility requires stronger contrast

#### Reversed

Primarily white on dark backgrounds, optionally retaining subtle periwinkle treatment for `.ly`.

---

## 4. Dotted route logo mark

This is an important part of the identity.

The route should follow the **zig-zag/exploration shape from the selected original concept**, not a simple upward curve.

Conceptually:

```text
         •
      •     •
   •          •
 •             •
                •
                  •
                       •
                            ●
```

This is illustrative rather than an exact coordinate specification.

The important characteristics are:

* composed entirely from individual circular dots
* no connecting stroke
* begins with relatively small dots
* follows a clearly non-linear exploratory path
* rises
* changes direction
* dips
* rises again
* terminates in a noticeably larger final dot
* feels like a path someone actually explored rather than a chart trending upward

The rhythm should feel organic but controlled.

Do **not** simplify it into:

```text
• • • • • ●
```

or a single smooth diagonal curve.

The route needs visible directional change.

---

### Route dot sizing

Use approximately 3 visual sizes:

* Small trail dots
* Medium transition dots
* Large destination/final dot

Example relative scale:

```text
small: 4–5px
medium: 7–9px
large: 14–18px
```

Exact size depends on context.

The final dot should feel like a destination or current point, but **not like a traditional map pin**.

---

## 5. App icon

The app icon uses the dotted route by itself.

No text inside the app icon.

The exact zig-zag/exploratory shape used in the primary logo should also appear in the icon.

Do not use a simplified curved line.

### Primary icon

Background: `Periwinkle #6366F1`

Route: White, with slight tonal variation allowed only if extremely subtle.

Rounded app container.

### Dark icon

Background: `Indigo #0F1230`

Route: Periwinkle / Pale Periwinkle

### Light icon

Background: Warm Off-White / White

Route: Periwinkle

Border may use Cool Gray when needed.

---

## 6. Core color palette

### Periwinkle — `#6366F1`

Primary brand color. Use for:

* primary buttons
* active indicators
* timeline markers
* selected states
* active tags
* focus states
* important icons
* dotted-route illustrations
* `.ly` in the primary logo

It should remain the most recognizable brand color. Avoid flooding entire screens with it.

### Pale Periwinkle — `#E6E9FF`

Supporting brand tone. Use for:

* subtle selected backgrounds
* tags
* empty-state surfaces
* hover backgrounds
* illustration fills
* soft information states
* dark-mode secondary accents

### Indigo — `#0F1230`

Primary dark neutral. Use for:

* primary text
* dark theme backgrounds
* logo
* strong icons
* high-emphasis UI

This should generally replace pure black.

### Warm Off-White — `#FAFAF8`

Primary light-mode background. The interface should feel slightly warmer than a sterile `#FFFFFF` application. White can still be used for raised surfaces.

### Cool Gray — `#ECEEF3`

Primary neutral divider / border / subtle surface color. Use for:

* borders
* dividers
* inactive controls
* light separators
* disabled surfaces

---

## 7. Recommended semantic color tokens

Implementation should preferably use semantic tokens rather than raw colors throughout components.

```css
--brand-primary: #6366F1;
--brand-primary-soft: #E6E9FF;

--text-primary: #0F1230;
--text-secondary: #5F637A;
--text-tertiary: #8A8FA3;

--surface-page: #FAFAF8;
--surface-card: #FFFFFF;
--surface-subtle: #F5F6F9;

--border-default: #ECEEF3;
--border-strong: #D9DCE5;

--focus: #6366F1;
```

Exact secondary neutral values can be tuned during implementation.

---

## 8. Dark mode

Dark mode is a first-class theme, not an afterthought.

```css
--surface-page: #0F1230;
--surface-card: #171A38;
--surface-raised: #1D2042;

--text-primary: #F8F8FB;
--text-secondary: #B8BCD0;

--border-default: rgba(255,255,255,0.08);

--brand-primary: #7B7EF7;
--brand-primary-soft: rgba(99,102,241,0.16);
```

Avoid:

* pure `#000000`
* excessive glowing gradients
* neon treatments
* high-saturation cyberpunk aesthetics

Dark mode should remain calm and premium.

---

## 9. Typography

### Display and headings — **Satoshi**

Use for product headings, screen headings, section titles, card titles where slightly stronger brand character is desirable.

Recommended weights: Medium, Semibold, Bold only sparingly.

### UI and body — **Inter**

Use for buttons, form fields, metadata, labels, helper text, body text, times, tags.

This makes the interface highly readable and keeps dense planning screens practical.

### Optional data / technical text

**Satoshi Mono** or a clean monospace fallback. Only for specialized data contexts. Do not use monospace heavily in the consumer UI.

---

## 10. Basic type scale

```text
Display:      32 / 38
H1:           28 / 34
H2:           22 / 28
H3:           18 / 24

Card title:   16 / 24

Body:         14 / 20
Meta:         13 / 18
Small:        12 / 16
```

Mobile typography should remain compact enough for itinerary density. Avoid oversized marketing-style headings inside the actual planning board.

---

## 11. Shape language

The interface should feel slightly rounded, but not bubbly.

```text
Small controls:     8px
Standard controls:  10–12px
Cards:              12–16px
Large panels:       16px
Illustration cards: 16–20px
```

**12px** is the default general-purpose radius. **16px** is the typical Plan Card / major card radius. Avoid excessive 24–32px pill styling.

---

## 12. Spacing

Use an 8px-based spacing system: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

The UI should feel spacious without wasting mobile screen area.

Dense planning content should use approximately:

```text
12–16px card padding
8–12px element gaps
16px screen gutters on mobile
20–24px gutters on larger layouts
```

---

## 13. Borders and elevation

The UI should rely mostly on whitespace, subtle borders, and background contrast rather than large shadows.

Default border: `1px Cool Gray`. Raised cards may use a very subtle shadow.

```text
Level 0: no shadow
Level 1: subtle card separation
Level 2: floating menus / drag previews only
```

Avoid obvious Material-style shadows.

---

## 14. Iconography

Icons should be thin, geometric, rounded where appropriate, approximately 1.75–2px stroke, visually similar to Lucide / Linear-style icons.

Default sizes: `16px` small, `18px` control, `20px` standard, `24px` prominent.

Icons should communicate function rather than decorate the page.

Primary icon color: Indigo. Active icon color: Periwinkle.

---

## 15. Motion

Motion should reinforce spatial relationships.

`120–180ms`, `ease-out` for normal UI transitions. Drag/drop interactions may use slightly longer spring-based movement.

Use motion for reordering, card relocation, selected states, expanding inputs, opening dialogs, timeline positioning.

Do not animate everything.

The dotted route can occasionally animate progressively in first-time empty states, loading, and onboarding, but should otherwise remain static.

---

## 16. General app structure

```text
Trip
 ├── London
 ├── Amsterdam
 ├── Barcelona
 ├── Edinburgh
 └── Glasgow
```

Each city contains:

```text
Timed day columns
+
Backlog
+
Any user-created list columns
```

The city navigation must remain obvious and continuously accessible.

Map / Insights / Budget / Notes / voting / commenting / social feeds are **not v1 requirements**. Do not implement those simply because they appeared in visual explorations.

---

## 17. Desktop board

Timed columns appear side by side. All timed columns share exactly the same vertical time axis geometry. **This alignment is a core visual requirement.**

```text
             Thu 8          Fri 9          Sat 10
09:00        card           —              card
10:00
11:00                        card
12:00
13:00        card                          card
```

`13:00` must occupy exactly the same Y-coordinate across every timed day.

The axis should typically cover `06:00 → 02:00 next day`.

---

## 18. Mobile board

Mobile use is extremely important. Do not simply shrink the desktop board.

* active city remains visible
* day navigation remains easy to reach
* one timed day can become the primary viewport
* adjacent days can be horizontally accessible
* Backlog remains quick to access
* drag/drop must work with touch
* actions require comfortable tap areas
* important controls should not require hover

Minimum tap target: `44 × 44px`.

---

## 19. UI Cue Strip

A reusable group of core controls establishing the design language for Trip.ly's most common controls. Not necessarily a literal permanent strip in every screen.

1. City Tab
2. Tag Chip
3. Primary Button
4. Plan Card
5. Timeline Marker

---

## 20. City Tab

**Purpose:** Switch between cities. e.g. `▧ London`

**Default:** white/light surface, Indigo text, subtle border, small destination/city icon if useful, 12px radius.

**Active:** Periwinkle accent, stronger border or Pale Periwinkle background.

Do not use a loud filled button for every city. City tabs need to remain readable when all 5 cities are present.

```text
Height: ~44px
Horizontal padding: 16px
Vertical padding: 10–12px
Icon: 20px
Icon/text gap: 8px
Radius: 12px
```

---

## 21. Tag Chip

Example: `● Museums   ×`

**Default:** Pale Periwinkle or neutral surface, Indigo text, small Periwinkle dot, optional remove `×`.

**Selected:** stronger Periwinkle border or fill, clear active indication, must not rely solely on color.

```text
Height: 36–40px
Radius: 10–12px
Dot: 8px
Close icon: 16px
```

Tags should remain visually compact because multiple tags may appear on a card.

---

## 22. Primary Button

Background: Periwinkle. Text: White. Radius: 12px. Minimum height: 44px. Icon: 18px.

The button should feel clean rather than glossy. No unnecessary gradients.

* Hover: slightly darker or raised.
* Pressed: deeper Indigo/Periwinkle treatment.
* Focus: visible accessible focus ring.

Contextual variants: `Add to Trip`, `Add your first plan`, `Save your first idea`, `Add day / list`, `Copy link`.

---

## 23. Timeline Marker

```text
  ◉
  │
  │
```

```text
Inner circle: ~12px
Outer circle: ~20px
Timeline stroke: ~2px
```

Use Periwinkle for active/current markers.

A marker may display day, date, title, and time. Within Trip.ly's actual board, adapt this language to the real day-column/timeline structure.

---

## 24. Plan Card

One of the most important components. It represents an activity or plan.

The production version maps directly to:

```ts
Item {
  title
  time
  blurb
  tags
}
```

Do **not** require images, participants, bookmarks, or completion statuses unless those features are separately added. Those appeared in visual mockups primarily to demonstrate styling.

### Anatomy

1. Title
2. Time, when scheduled
3. Short blurb
4. Tags
5. Actions

Optional future: media, collaborator avatars, save state.

### Styling

```text
Radius: 16px
Padding: 12–16px
Border: 1px subtle neutral
Background: card surface
```

* Title: Satoshi Semibold 16px / 24px
* Metadata: Inter Regular 14px / 20px
* Blurb: Inter Regular 13px / 18px

Tags should fit below without making the card visually chaotic.

### Compact card

When used on the timeline, a Plan Card may become much denser:

```text
14:00
Alfama Walk
[walk] [sights]
```

**The card's measured rendered height must determine collision/layout behavior. Never assume a fixed card height.**

---

## 25. Plan Card behavior

| Action | Result |
| --- | --- |
| Tap/click | Open editing/details |
| Drag | Move the card |
| Timed → timed | Updates column and time |
| Timed → unscheduled tray | Clears time |
| Backlog → timed | Assigns a time based on vertical drop location |
| Timed → backlog/list | Removes scheduled time |

---

## 26. Drag state

Dragged cards should:

* lift visually slightly
* maintain their real dimensions
* use a subtle shadow
* preserve the Trip.ly card styling
* clearly indicate target column
* show target time when dragging across timeline

Do not allow cards to visually detach from the destination layout.

---

## 27. Empty City

City exists and has a Backlog but **nothing scheduled yet**.

```text
London

No plans yet

This city has a backlog,
but no plans on the timeline.

[ + Add your first plan ]
```

**Illustration:** faint abstract street map, dotted Trip.ly route, single larger route endpoint. Mostly Pale Periwinkle / Periwinkle / Cool Gray. Avoid highly detailed tourism artwork.

**Purpose:** communicate "The city already contains ideas; now start turning them into a schedule."

---

## 28. No Timed Plans Yet

Belongs inside a **specific timed day**, not the whole city. The time axis remains visible.

```text
09:00  │
       │
12:00  │
       │   No timed plans yet
15:00  │
       │   Drag an idea here
18:00  │   or tap + to get started.
       │
21:00  │
```

**Important principle:** Do **not** remove the axis simply because the day is empty. The empty state teaches the user how time-based scheduling works.

**Empty drop area:** very subtle dashed border, large hit area, dotted route illustration, simple drag hint, plus CTA.

**Behavior:** dragging a Backlog item over the drop area highlights the target, shows the proposed time, and allows positioning on the axis. Tapping `+` opens new-item creation.

---

## 29. Unscheduled tray

Each timed day requires an unscheduled holding area above the axis. **This is structurally important.**

```text
UNSCHEDULED

[ Lunch ]
[ Match — kickoff TBC ]
```

It should have:

* fixed height
* internal scrolling if needed
* **no effect on the Y-position where the shared timeline begins**

Otherwise cross-column time alignment breaks.

---

## 30. Backlog Starter

Shown when a city's Backlog contains zero items.

```text
Your backlog is empty

Save ideas as you browse so
you're ready to build the plan.

Restaurants to try
Landmarks to see
Transit & logistics

[ + Save your first idea ]
```

The example categories are explanatory text, not fixed categories. Trip.ly tags are completely free-form.

**Illustration:** a simple open container / collection concept with a few lightweight idea cards emerging from it (restaurant, landmark, transit symbols). The dotted route can connect or move around the objects. Keep the illustration very pale.

**CTA:** `Save your first idea` — creates a Backlog item and immediately focuses the editable title.

---

## 31. Group Planning

The concept art explored a richer future collaborative experience. The **visual language** is valid. The **full feature set is not currently v1**.

Current actual collaboration:

* everyone accesses the same board
* everyone can edit
* last-write-wins is sufficient

### V1 visual collaboration cues

Subtle indicators when technically practical: `Saving…`, `Saved`, `Updated just now`.

Optional presence cue: `3 people viewing`. Do not require identity/avatar infrastructure just for visual effect.

### Future Group Planning language

Presence, avatars, reactions, voting, activity feed, comments, suggestions — all using the same restrained Trip.ly component system.

---

## 32. New City Placeholder

```text
Ready to plan Amsterdam?

Start collecting ideas and turn them
into an itinerary together.

[ + Add your first idea ]
```

Because cities are predefined in v1, avoid showing `Add a new city` unless the product later supports arbitrary destinations.

**Illustration:** light destination abstraction plus dotted path — abstract skyline, simplified landmark silhouette, subtle geography. Do not make the brand dependent on city illustrations.

---

## 33. Search Empty State

Only implement once search exists.

```text
No results found

We couldn't find anything for
"canal breakfast".

Try another keyword or adjust your filters.
```

Illustration: dotted route, magnifying glass, very pale abstract landscape/path. Keep tone informative rather than apologetic.

Provide the existing query, filter controls, a clear-filter action, and contextual retry suggestions. Do not create unrelated results purely to avoid an empty state.

---

## 34. Filter by Tag — Empty State

```text
[All] [food] [sights] [transit] [outdoors] [hidden gems ×]

No ideas match your filters

We couldn't find any ideas with
"hidden gems".

[ Clear filters ]

Explore another tag
```

**Selected tag styling:** Periwinkle fill or outline, check indicator when useful, remove `×`. It should be immediately obvious which filters are active.

**Behavior:** removing a chip removes that tag; `Clear filters` removes all active filters; results update immediately.

---

## 35. Invite & Share

```text
Invite your travel crew

Anyone with the link can view
and contribute to the trip.

trip.ly/xxxxxxxx

[ Copy link ]
```

Use a standard card surface, generous spacing, share/link icon, prominent Copy Link button, optional dotted route illustration.

Do not turn this into a complex permissions management screen.

---

## 36. List columns

Untimed columns such as Backlog behave as simple ordered stacks.

```text
Backlog                       …

[ card ]
[ card ]
[ card ]

+ Add item
```

Drop position determines order. No timeline should appear.

---

## 37. Column headers

Column title is editable. Actions menu may contain `Rename` and `Delete column`.

Backlog cannot be deleted. Deleting another populated column requires confirmation.

---

## 38. Adding a column

CTA: `+ Add day / list`

```text
Name
[________________]

Type
(•) Timed day
( ) Plain list

[Cancel] [Create]
```

Keep the dialog compact.

---

## 39. Inline editing

New items should immediately enter title editing:

* autofocus
* select-all when appropriate
* Enter saves
* Escape cancels/reverts where sensible
* blur commits

Avoid making users open a full modal just to rename something.

---

## 40. Time input

Each scheduled card should support direct time editing. Prefer the native time control on mobile where possible.

Time display: 24-hour format because the underlying model already uses `HH:MM`.

The UI should correctly distinguish times after midnight. Internally, use date-qualified values even if only `HH:MM` is displayed.

---

## 41. Timeline layout

All timed columns share exactly the same scale.

```text
06:00 07:00 08:00 ... 23:00 00:00 01:00 02:00
```

Recommended snapping: **15 minutes**. Dropping between markers should calculate the corresponding timestamp.

---

## 42. Collision handling

**Cards must never cover each other. Do not use assumed heights.**

Two acceptable approaches:

* **Lane packing** — cards with overlapping time positions sit side-by-side. *(preferable if practical)*
* **Dynamic cascading** — later cards shift downward using actual measured card dimensions.

---

## 43. Responsive strategy

* **Desktop:** show multiple day columns when screen width permits. Backlog/list columns may coexist horizontally.
* **Tablet:** allow horizontal board scrolling while preserving the time-axis relationship.
* **Phone:** focus on one primary day/list viewport at a time while maintaining easy horizontal navigation. Cards should occupy most available width. Avoid tiny multi-column calendar views.

---

## 44. Scroll behavior

Editing or moving one card must not reset horizontal scroll, vertical timeline scroll, selected city, selected day, or list position.

Avoid full-board rerenders. This is both an implementation and UX requirement.

---

## 45. Loading states

Prefer skeletons instead of spinners for board initialization: pale card skeletons, subtle axis placeholders.

The dotted route can appear for initial product loading but should not become a repetitive loader everywhere.

---

## 46. Error states

Errors should be calm and local.

```text
Couldn't save this change.

[Try again]
```

Do not replace the entire board when only one mutation fails. Because collaboration is casual and last-write-wins, avoid complex merge dialogs.

---

## 47. Focus states and accessibility

Every interactive control must have a visible keyboard focus state: `2px Periwinkle outline, 2px offset`.

Do not rely on color alone for selected states, errors, completion, or active filters.

Tap targets: minimum approximately `44px`. Text contrast should meet WCAG AA.

---

## 48. Empty-state visual system

All Trip.ly empty states should feel related:

```text
small/light illustration
+
dotted exploratory route
+
clear headline
+
1 short supporting paragraph
+
1 obvious primary action
+
optional lightweight secondary action
```

Avoid oversized cartoon illustrations.

---

## 49. Empty-state tone

Writing should be concise, encouraging, calm, practical.

Good:

```text
No timed plans yet
Drag an idea here or add one to get started.
```

Avoid:

```text
Oops! It looks like you haven't added any amazing adventures yet! 🚀
```

Trip.ly should not sound overly enthusiastic or childish.

---

## 50. Visual density

```text
Hierarchy > decoration
Spacing > borders
Typography > badges
Interaction feedback > animation
```

Tags and metadata should remain secondary to activity titles and times.

---

## 51. Recommended base component tokens

```ts
const triplyTheme = {
  colors: {
    periwinkle: "#6366F1",
    palePeriwinkle: "#E6E9FF",
    indigo: "#0F1230",
    warmOffWhite: "#FAFAF8",
    coolGray: "#ECEEF3",
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48, "4xl": 64 },
  icon: { sm: 16, md: 20, lg: 24 },
  controlHeight: { default: 44 }
}
```

Starting design tokens rather than absolute implementation constraints.

---

## 52. Core component hierarchy

```text
Brand
├── Logo
├── RouteMark
└── AppIcon

Primitives
├── Button
├── IconButton
├── Input
├── TimeInput
├── Chip
├── Badge
├── Tooltip
├── Dropdown
├── Dialog
└── Divider

Navigation
├── CityTabs
├── CityTab
└── ColumnHeader

Planning
├── PlanCard
├── TimedColumn
├── ListColumn
├── SharedTimeAxis
├── TimelineMarker
├── UnscheduledTray
├── AddItem
└── AddColumn

Collaboration
└── ShareDialog

States
├── EmptyCity
├── EmptyTimeline
├── EmptyBacklog
├── NewCityPlaceholder
├── SearchEmpty
└── TagFilterEmpty
```

---

## 53. NOT settled v1 features

Do not interpret these as implementation requirements:

Map view, map navigation, Insights, Budget section, Notes section, individual profiles, member roles, comments, voting, reactions, activity feeds, user avatars, presence indicators, saved/bookmarked plans, completed/cancelled plan states, popular destination discovery, AI recommendations, search (unless separately added), tag filtering (unless included as a nice-to-have).

The concept images containing those elements demonstrated how the Trip.ly identity could scale.

---

## 54. Features that ARE core

1. City tabs
2. Timed day columns
3. One perfectly shared vertical time axis
4. Cross-midnight scheduling
5. Unscheduled trays
6. Backlog
7. Additional plain-list columns
8. Plan Cards
9. Free-form tags
10. Add/edit/delete flows
11. Drag and drop
12. Touch support
13. Shared persistence
14. Light and dark themes
15. Responsive mobile behavior
16. Smooth partial updates without full-board rerendering

---

## 55. Final aesthetic rule

When choosing between two visual approaches, prefer the one that feels:

> **simpler, calmer, and more deliberate.**

Trip.ly should never feel like a project-management dashboard with travel graphics pasted onto it.

It should feel like a purpose-built travel product with the organizational quality of Linear, the consumer friendliness of Airbnb, and some of the premium travel sensibility of Flighty.

The dotted route is the visual signature tying all of that together.
