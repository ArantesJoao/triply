# Trip planner — build spec

> **Note:** §6 of this document lists "No accounts/auth" as a v1 non-goal. That has
> been **superseded**: the app uses Google OAuth sign-in. The programmatic API
> (§4) keeps a non-OAuth path via a shared bearer token.

## 1. What this is

A shared trip-planning board for a group of friends (4 people) touring London,
Amsterdam, Barcelona, Edinburgh, and Glasgow in October 2026. One tab per city.
Each city holds a set of "days" (activities scheduled against a clock) and
"lists" (unordered collections like a backlog of ideas). The whole group edits
the same board.

It needs to work well on a phone, since it'll mostly get opened on the go
during the trip.

## 2. Data model

Nothing here is hardcoded — cities, columns, and items are all things the
user (or Claude, via the API in section 4) creates, renames, and deletes.
The five cities below are seed data, not a fixed enum.

```
Board
 └─ activeCityId: string
 └─ cities: City[]

City
 ├─ id: string
 ├─ title: string             // editable, e.g. "London"
 └─ columns: Column[]

Column
 ├─ id: string
 ├─ title: string             // editable, e.g. "Thu 8", "Backlog"
 ├─ timed: boolean            // true = has a clock/axis, false = plain list
 └─ items: Item[]

Item
 ├─ id: string
 ├─ title: string
 ├─ time: string | null       // "HH:MM" 24h, or null/empty = unscheduled
 ├─ blurb: string             // short free-text note
 └─ tags: string[]            // free-form, user-defined, lowercase
```

Starting point: `london`, `amsterdam`, `barcelona`, `edinburgh`, `glasgow`.
Only `london` starts populated (seed data in section 9). The other four
start with a single `Backlog` column and nothing else — real placeholders,
not dummy content. Any of these five can be renamed or deleted like any
other city, same as columns.

Every column has an id; `backlog` is reserved and cannot be deleted, in any
city. Any other column (timed or not) can be renamed or deleted. Handle the
edge case of deleting a city sensibly (e.g. don't allow deleting the very
last remaining one, or handle a zero-city state gracefully).

## 3. Core features

### 3.1 City tabs

One tab per city. Cities are fully user-manageable: add a new one, rename
one, delete one — the same as columns are (section 3.6). Switching tabs
shows that city's board.

### 3.2 Timed columns — the shared time axis

This is the central interaction, and the main thing worth getting right.

- Timed columns for the active city render side by side, sharing **one**
  vertical time axis. If 19:00 appears in one day's column, it must line up
  at the exact same height as 19:00 in every other day's column. This was
  the single most important piece of feedback during prototyping — don't
  regress on it.
- Axis range should comfortably cover roughly 06:00 through to the small
  hours (e.g. 02:00 the next day), since some items land right after
  midnight (see the Sunday Anfield return, 00:47).
- Items are positioned on the axis by their `time` field. Dragging a card
  onto the axis should set/update its time based on drop position (snap to
  the nearest 15 minutes is reasonable). Users should also be able to type
  or pick an exact time directly on the card (a native time input is fine
  and was well received in the prototype).
- **Overlap handling is required, not optional.** Two cards must never
  overlap or obscure each other, even when their times are close together
  (e.g. 12:00 and 12:15). Either lane-pack them side by side within the
  column, or push the later one down until it clears the earlier one —
  either is acceptable. The prototype used a fixed card-height constant to
  "cascade" cards downward, which broke as soon as card content grew (see
  section 8) — don't repeat that; measure actual rendered card size, or use
  a layout approach that doesn't depend on a guessed constant.

### 3.3 Unscheduled tray

Not every item has a known time yet (e.g. a match kickoff still TBC, "lunch"
with no fixed slot). Each timed column needs a small holding area for these
— above the axis, fixed height, scrollable if it overflows — so it doesn't
push the axis start position down and break the cross-column alignment.
Dragging an item here (or clearing its time field) should unschedule it;
giving it a time should move it onto the axis.

### 3.4 List columns (Backlog, and any other untimed column)

Plain ordered lists, manually reorderable by drag — no time axis involved.
Every city has a `Backlog`. Users can add more list-style columns too (see
3.6). Cards here behave like normal draggable list items: drop position
determines order.

### 3.5 Tags

Every item — in every column, timed or not, including Backlog — can have
zero or more free-form tags (e.g. `food`, `pub`, `landmark`, `football`,
`market`, `park`, `walk`, `transit`, `shopping`, `logistics`). Users add a
tag by typing free text, remove one with a click. No fixed taxonomy — this
is closer to a lightweight label system than a category picker.

### 3.6 Adding/editing/deleting

- Add, rename, or delete a city (subject to the edge case note in section 2).
- Add an item to any column; new items start blank and unscheduled, and the
  title should be immediately editable (focus + select-all on creation).
- Add a new column ("+ Add day / list"): ask for a name, and whether it
  should be timed (has an axis) or a plain list.
- Rename any column or item title inline.
- Delete any item. Delete any column except `backlog` (confirm if it has
  items in it).
- Everything on this list should also be possible through the API in
  section 4, not just through the UI — that's the whole point of it.

### 3.7 Drag and drop, generally

Needs to work with both mouse and touch — this will get used on phones.
Whatever library or approach is used, dragging a card should:

- work smoothly across column boundaries within the same city,
- give clear feedback about where it'll land,
- never let a card end up detached from its actual column's layout.

## 4. Programmatic access — hard requirement

The main way this board gets populated won't be clicking "+ Add activity"
over and over. The intended workflow is: paste a rough trip plan into a
conversation with Claude and have Claude create the matching cities, days,
and activities directly.

- Expose a documented HTTP API (plain REST is fine) with full CRUD on
  cities, columns, and items — mirroring the data model in section 2
  directly (same field names, same types), so an LLM given the schema can
  generate correct requests without a translation layer.
- Include a bulk-create/import endpoint that accepts a JSON payload for a
  whole city (or the whole board) — the city, its columns, and all items —
  and creates everything in one call. This matters more than one-item-at-a-
  time endpoints.
- Include a read endpoint that returns the full board or a single city as
  JSON, so Claude can see what's already there before adding to it.
- Every action available in the UI (section 3.6) should be reachable through
  this API too.
- Auth: a simple shared token is fine.

Nice-to-have: expose this as an MCP server in addition to a plain REST API.

## 5. Persistence & multi-user

All four people should see and edit the same board. Last-write-wins conflict
handling is fine at this scale (4 people, casual use).

## 6. Non-goals for v1

- ~~No accounts/auth, no per-user permissions.~~ *(superseded — Google OAuth)*
- No booking/payment integration.
- No offline mode requirement (nice to have, not required).
- No automated conflict resolution beyond last-write-wins.
- No map view.

## 7. Possible nice-to-haves

- Filter/highlight items by tag within a city.
- A simple duration field so axis cards can show a block instead of a point.
- Quick "duplicate to another day" for recurring stop types.

## 8. Lessons learned from the HTML/JS prototype — do not repeat

- **Hand-rolled pointer-event dragging with manual absolute positioning was
  fragile.** Cards intermittently rendered detached from their intended
  column. Use a proven drag-and-drop library (e.g. `dnd-kit`,
  `@hello-pangea/dnd`) rather than hand-rolling pointer math and
  `elementFromPoint` hit-testing.
- **A hardcoded card-height constant drove the anti-overlap logic**, so when
  card content grew (adding the tags row), overlap got visibly worse instead
  of adapting. Measure actual rendered size, or use a layout strategy that
  doesn't depend on a guessed constant.
- **Full-board re-render on every edit** (every blur, every tag add/remove,
  every drop) caused jank and lost scroll position. Use normal component
  state so only what changed actually re-renders.
- **Time handled as raw "HH:MM" strings with an hour-based heuristic for
  "this is actually after midnight"** was a hack. Store real date+time (or at
  minimum, date-qualified time) so cross-midnight items are unambiguous.

## 9. Seed data — London

```json
{
  "activeCity": "london",
  "cities": {
    "london": {
      "columns": [
        {
          "id": "thu8", "title": "Thu 8", "timed": true,
          "items": [
            { "title": "Check-in", "time": "19:00", "blurb": "Realistically after immigration, bags, and the ride into town.", "tags": ["logistics"] },
            { "title": "Dinner & reunion pints", "time": "20:00", "blurb": "Jet lag's real — keep it low-key, somewhere near where you're staying.", "tags": ["food", "pub"] }
          ]
        },
        {
          "id": "fri9", "title": "Fri 9", "timed": true,
          "items": [
            { "title": "Portobello Road Market", "time": "09:00", "blurb": "Antiques, food stalls, colourful streets.", "tags": ["market", "shopping"] },
            { "title": "Notting Hill streets", "time": "09:45", "blurb": "The famous pastel-coloured houses, good for photos.", "tags": ["walk", "landmark"] },
            { "title": "Hyde Park & Kensington Gardens", "time": "12:00", "blurb": "Walk east through the park toward Buckingham Palace.", "tags": ["park"] },
            { "title": "Buckingham Palace (exterior) & St James's Park", "time": "12:45", "blurb": "Check the guard-change schedule if you want to catch it.", "tags": ["landmark", "park"] },
            { "title": "Westminster walk", "time": "14:00", "blurb": "Big Ben, Houses of Parliament, Westminster Abbey exterior.", "tags": ["landmark"] },
            { "title": "Trafalgar Square", "time": "15:30", "blurb": "Fountains, National Gallery steps, always lively.", "tags": ["landmark"] },
            { "title": "Covent Garden", "time": "16:15", "blurb": "Street performers, shops — good spot to sit down.", "tags": ["shopping", "landmark"] },
            { "title": "Last work stretch", "time": "17:00", "blurb": "Final business hours for whoever is still working, then everyone regroups.", "tags": ["logistics"] },
            { "title": "Carnaby Street & Soho", "time": "18:00", "blurb": "Neon lights, record shops, boutiques.", "tags": ["shopping"] },
            { "title": "Chinatown", "time": "18:45", "blurb": "Snack stop, lanterns, lively energy.", "tags": ["food"] },
            { "title": "Brick Lane wander", "time": "19:30", "blurb": "Street art, vintage shops, right next to Shoreditch.", "tags": ["market", "walk"] },
            { "title": "Shoreditch or Soho pub crawl", "time": "20:15", "blurb": "First fully free evening for everyone — good pub density.", "tags": ["pub"] },
            { "title": "Late spot", "time": "22:30", "blurb": "Karaoke or a late bar if the night's still young.", "tags": ["pub"] }
          ]
        },
        {
          "id": "sat10", "title": "Sat 10", "timed": true,
          "items": [
            { "title": "South Bank riverside walk", "time": "09:00", "blurb": "Westminster Bridge → London Eye, easy morning walk.", "tags": ["walk", "landmark"] },
            { "title": "Borough Market", "time": "09:45", "blurb": "Home of the viral chocolate-covered strawberries (Turnips stall).", "tags": ["food", "market"] },
            { "title": "Leake Street Graffiti Tunnel", "time": "10:30", "blurb": "Colourful, low-key detour near Waterloo.", "tags": ["walk"] },
            { "title": "St Paul's Cathedral (exterior) & Millennium Bridge", "time": "11:15", "blurb": "Dome views, walk across to the City side.", "tags": ["landmark"] },
            { "title": "Tower Bridge & Tower of London (exterior)", "time": "12:00", "blurb": "Classic view, walk across the bridge.", "tags": ["landmark"] },
            { "title": "Sky Garden", "time": "12:45", "blurb": "Free rooftop skyline view — book the slot online in advance.", "tags": ["landmark"] },
            { "title": "Spitalfields Market", "time": "14:00", "blurb": "Covered Victorian market, good food stalls.", "tags": ["market", "food"] },
            { "title": "Camden Market", "time": "15:00", "blurb": "Browse the stalls, plenty of food if anyone wants a bite.", "tags": ["market", "food"] },
            { "title": "Regent's Canal boat ride to Little Venice", "time": "16:15", "blurb": "Scenic ~45min narrowboat trip from Camden Lock.", "tags": ["transit", "park"] },
            { "title": "Primrose Hill viewpoint", "time": "17:00", "blurb": "Short walk from Little Venice; best panoramic skyline spot.", "tags": ["park"] },
            { "title": "Pub session, Camden/Primrose Hill", "time": "19:00", "blurb": "Wind down — keep it reasonable, big Sunday ahead.", "tags": ["pub"] }
          ]
        },
        {
          "id": "sun11", "title": "Sun 11", "timed": true,
          "items": [
            { "title": "Train to Liverpool", "time": "07:41", "blurb": "London Euston → Liverpool Lime St, direct, LNER.", "tags": ["transit"] },
            { "title": "Liverpool vs Man City", "time": null, "blurb": "Anfield, hospitality tickets — kickoff not yet announced.", "tags": ["football"] },
            { "title": "Train back to London", "time": "19:33", "blurb": "Liverpool Lime St → London Euston, 1 change, arriving 00:47.", "tags": ["transit"] }
          ]
        },
        {
          "id": "mon12", "title": "Mon 12", "timed": true,
          "items": [
            { "title": "Meet at Piccadilly Circus", "time": "09:00", "blurb": "Start point for the day.", "tags": ["logistics"] },
            { "title": "Wembley Stadium (exterior)", "time": "09:45", "blurb": "Quick photo stop, iconic arch.", "tags": ["football"] },
            { "title": "Craven Cottage tour (Fulham FC)", "time": "11:15", "blurb": "Book this slot first — it's the tightest.", "tags": ["football"] },
            { "title": "Lunch", "time": null, "blurb": "Somewhere between Fulham and Stamford Bridge.", "tags": ["food"] },
            { "title": "Stamford Bridge tour (Chelsea)", "time": "14:00", "blurb": "Walk over from Fulham.", "tags": ["football"] },
            { "title": "Emirates Stadium tour (Arsenal)", "time": "16:00", "blurb": "Check the last entry time.", "tags": ["football"] },
            { "title": "Rough Trade East", "time": "18:00", "blurb": "Record shop in Shoreditch.", "tags": ["shopping"] },
            { "title": "Dinner", "time": null, "blurb": "Somewhere in Shoreditch before the pub.", "tags": ["food"] },
            { "title": "Pint at Howl at the Moon (Hoxton)", "time": "20:00", "blurb": "", "tags": ["pub"] }
          ]
        },
        {
          "id": "tue13", "title": "Tue 13", "timed": true,
          "items": [
            { "title": "Train to Amsterdam", "time": "06:00", "blurb": "Departs London — tight after Monday night.", "tags": ["transit"] }
          ]
        },
        {
          "id": "backlog", "title": "Backlog", "timed": false,
          "items": [
            { "title": "Tottenham Hotspur Stadium tour", "time": null, "blurb": "Cut from Monday's plan — off route.", "tags": ["football"] },
            { "title": "Little Venice canal walk (on foot)", "time": null, "blurb": "Alternative to the boat ride.", "tags": ["walk", "park"] },
            { "title": "Greenwich & Cutty Sark", "time": null, "blurb": "Not yet scheduled — riverboat from central London.", "tags": ["landmark", "park"] },
            { "title": "Hampstead Heath", "time": null, "blurb": "Not yet scheduled — views and swimming ponds.", "tags": ["park"] },
            { "title": "Kew Gardens", "time": null, "blurb": "Not yet scheduled — a bit further out.", "tags": ["park"] },
            { "title": "Columbia Road Flower Market", "time": null, "blurb": "Sundays only, clashes with the Anfield day.", "tags": ["market"] }
          ]
        }
      ]
    },
    "amsterdam": { "columns": [ { "id": "backlog", "title": "Backlog", "timed": false, "items": [] } ] },
    "barcelona": { "columns": [ { "id": "backlog", "title": "Backlog", "timed": false, "items": [] } ] },
    "edinburgh": { "columns": [ { "id": "backlog", "title": "Backlog", "timed": false, "items": [] } ] },
    "glasgow":   { "columns": [ { "id": "backlog", "title": "Backlog", "timed": false, "items": [] } ] }
  }
}
```
