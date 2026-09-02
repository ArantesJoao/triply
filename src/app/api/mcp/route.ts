import { ZodError, type ZodType, type z } from 'zod';

import { toolArgs, type ToolName } from '@/lib/api/schemas';
import { TAG_COLOR_NAMES, tagColorNameByIndex } from '@/lib/tag-colors';
import { NOTE_HELP } from '@/lib/markdown';
import { TAG_ICON_KEYS } from '@/lib/tag-icons';
import {
  requireActor,
  requireTripAccess,
  requireTripOwner,
  type Actor,
} from '@/server/access';
import { originFor } from '@/server/oauth';
import {
  createCity,
  createColumn,
  createItem,
  createItems,
  deleteCity,
  deleteColumn,
  deleteItem,
  deleteItems,
  getBoard,
  getCity,
  importBoard,
  moveItem,
  moveItems,
  updateCity,
  updateColumn,
  updateItem,
  updateItems,
} from '@/server/board';
import { ApiError } from '@/server/errors';
import { deleteCityTag, renameCityTag } from '@/server/tags';
import {
  createTrip,
  deleteTrip,
  listTripsForUser,
  setTagStyle,
  updateTrip,
} from '@/server/trips';

/**
 * MCP server (JSON-RPC 2.0 over HTTP POST).
 *
 * Same service layer as the REST API, exposed as tools so Claude can drive the
 * board directly rather than a human relaying requests. Authentication is the
 * same bearer token the REST API takes:
 *
 *   claude mcp add --transport http triply https://<host>/api/mcp \
 *     --header "Authorization: Bearer triply_…"
 */

/**
 * Newest first. `initialize` echoes back whatever the client asked for if we
 * speak it, and otherwise answers with the newest — which is what the spec
 * tells a server to do when it cannot meet the request.
 *
 * Icons arrived in 2025-11-25; older clients simply ignore the field.
 */
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18'];
const PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/**
 * The route mark, for clients that show an icon beside the server or its
 * tools. Both files live in `public/` so the URLs are stable and unhashed —
 * `src/app/icon.svg` is a Next metadata file, served with a cache-busting
 * query. They must stay reachable without a token: clients fetch icons with no
 * credentials, and only `/api/mcp` is behind the bearer.
 *
 * PNG first because that is the one format an icon-rendering client MUST
 * support (per the spec's `icons` section); SVG second for anything that
 * would rather scale it. 512x512 because that's the resolution Anthropic's
 * own connector-directory submission asks for icon assets — the ceiling any
 * client is likely to want, so this scales down cleanly instead of ever
 * scaling up.
 *
 * `src` has to be absolute — a client is required to reject anything that is
 * not an https: or data: URI — so with no NEXT_PUBLIC_APP_URL we send none
 * at all rather than a relative path nothing will load.
 *
 * As of MCP spec 2025-11-25, Claude.ai does not yet read this field for
 * custom (non-directory) connectors — see
 * github.com/anthropics/claude-ai-mcp/issues/152 — so a connector row there
 * shows something else. It isn't `src/app/icon.svg` either (that one is
 * deliberately rounded, for the browser tab — see its own comment); the
 * best guess left is that whatever renders the connector list just tries a
 * conventional path like `/favicon.ico` without reading our HTML or this
 * field at all. `public/favicon.ico` and the other conventionally-named
 * files next to it get the square, no-baked-in-rounding treatment on that
 * guess — same reasoning as the icons here, just aimed at a URL instead of
 * a declared field.
 */
const ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

const ICONS = ORIGIN
  ? [
      {
        src: `${ORIGIN}/mcp-icon.png`,
        mimeType: 'image/png',
        sizes: ['512x512'],
      },
      {
        src: `${ORIGIN}/mcp-icon.svg`,
        mimeType: 'image/svg+xml',
        sizes: ['any'],
      },
    ]
  : undefined;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

/** Shared by every tool that takes a day start, so the wording never drifts. */
const DAY_START_DESCRIPTION =
  "Minutes past midnight where the day's time axis opens — 480 is 08:00 (the default), 600 is 10:00. On the half hour, 0–720. Set it to when these people actually get going; the axis still grows upward to hold anything earlier.";

const str = (description: string) => ({ type: 'string', description });
const bool = (description: string) => ({ type: 'boolean', description });

const itemProperties = {
  title: str('Activity name, e.g. "Borough Market".'),
  time: {
    type: ['string', 'null'],
    description:
      '24-hour "HH:MM", or null when the time is not known yet (the card then lives in the day\'s unscheduled tray).',
  },
  dayOffset: {
    type: 'integer',
    description:
      'Midnights past the column\'s own date. Use 1 for an activity after midnight — e.g. a 00:47 arrival on a day column dated the 11th. Defaults to 0.',
  },
  durationMin: {
    type: ['integer', 'null'],
    description: 'Optional length in minutes; renders the card as a block.',
  },
  blurb: str(`Free-text note on the card. ${NOTE_HELP}`),
  tags: {
    type: 'array',
    items: { type: 'string' },
    description: 'Free-form lowercase labels, e.g. ["food","market"].',
  },
} as const;

const columnSchema = {
  type: 'object',
  required: ['title'],
  properties: {
    id: str('Stable handle, e.g. "thu8" or "backlog". Optional.'),
    title: str('Column heading, e.g. "Thu 8" or "Backlog".'),
    timed: bool(
      'true = a day with a clock axis; false = a plain ordered list. Defaults to true.',
    ),
    date: str('Calendar date of this day as YYYY-MM-DD. Optional but recommended.'),
    items: { type: 'array', items: { type: 'object', properties: itemProperties } },
  },
} as const;

const citySchema = {
  type: 'object',
  required: ['title'],
  properties: {
    id: str('Stable handle, e.g. "london". Optional.'),
    title: str('City name.'),
    dayStartMin: {
      type: ['integer', 'null'],
      description: `${DAY_START_DESCRIPTION} Null (the default) follows the trip's own day start.`,
    },
    columns: { type: 'array', items: columnSchema },
  },
} as const;

type Tool = {
  name: ToolName;
  description: string;
  /** What the model reads. `schema` is what the server trusts. */
  inputSchema: Record<string, unknown>;
  schema: ZodType;
  /** Receives arguments already parsed by `schema`. */
  run: (args: never, actor: Actor) => Promise<unknown>;
};

/**
 * Ties a tool's `run` to its own schema, so the handler is typed by what the
 * validator actually produces rather than by hand-written `any`s.
 */
const defineTool = <S extends ZodType>(def: {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  schema: S;
  run: (args: z.output<S>, actor: Actor) => Promise<unknown>;
}): Tool => def;

/** Every tool below a trip scope checks membership first. */
async function scoped(tripId: string, actor: Actor) {
  await requireTripAccess(tripId, actor);
  return tripId;
}

/** As {@link scoped}, for the things only the trip's owner may do. */
async function owned(tripId: string, actor: Actor) {
  await requireTripOwner(tripId, actor);
  return tripId;
}

const tools: Tool[] = [
  defineTool({
    name: 'list_trips',
    description:
      'List every trip the authenticated user belongs to, with ids. Start here when you do not already know a tripId.',
    inputSchema: { type: 'object', properties: {} },
    schema: toolArgs.list_trips,
    run: async (_args, actor) => listTripsForUser(actor.userId),
  }),
  defineTool({
    name: 'get_board',
    description:
      'Read a whole trip as JSON — every city, column and item, with the id of each, plus the trip\'s per-tag colours and icons. Call this before changing anything so you can see what is already there.',
    inputSchema: {
      type: 'object',
      required: ['tripId'],
      properties: { tripId: str('Trip id from list_trips.') },
    },
    schema: toolArgs.get_board,
    run: async ({ tripId }, actor) => {
      const board = await getBoard(await scoped(tripId, actor));

      // Handing out the /join link is the owner's call, made in the app.
      delete (board as Partial<typeof board>).shareToken;

      return {
        ...board,
        // Stored as palette indices, reported as the names set_tag_style
        // takes — "2" tells a reader nothing.
        tagColors: Object.fromEntries(
          Object.entries(board.tagColors).map(([tag, index]) => [
            tag,
            tagColorNameByIndex(index),
          ]),
        ),
      };
    },
  }),
  defineTool({
    name: 'get_city',
    description: 'Read a single city, by id or by handle (e.g. "london").',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'city'],
      properties: { tripId: str('Trip id.'), city: str('City id or handle.') },
    },
    schema: toolArgs.get_city,
    run: async ({ tripId, city }, actor) =>
      getCity(await scoped(tripId, actor), city),
  }),
  defineTool({
    name: 'create_trip',
    description: 'Create a new, empty trip owned by the authenticated user.',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: { title: str('Trip name, e.g. "Europe, October 2026".') },
    },
    schema: toolArgs.create_trip,
    run: async ({ title }, actor) => ({
      id: await createTrip(actor.userId, title),
    }),
  }),
  defineTool({
    name: 'update_trip',
    description:
      "Rename a trip, choose which city tab the board opens on, and/or set the hour its days start at.",
    inputSchema: {
      type: 'object',
      required: ['tripId'],
      properties: {
        tripId: str('Trip id.'),
        title: str('New trip name.'),
        activeCityId: {
          type: ['string', 'null'],
          description:
            'City id the board should open on. Must be a city of this trip.',
        },
        dayStartMin: {
          type: 'integer',
          description: `${DAY_START_DESCRIPTION} Applies to every city that has not set its own.`,
        },
      },
    },
    schema: toolArgs.update_trip,
    run: async ({ tripId, title, activeCityId, dayStartMin }, actor) => {
      await updateTrip(await scoped(tripId, actor), {
        title,
        activeCityId,
        dayStartMin,
      });
      return { ok: true };
    },
  }),
  defineTool({
    name: 'delete_trip',
    description:
      'Delete a trip and every city, day and activity on it. Owner only, and not reversible — ask the person first.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'confirm'],
      properties: {
        tripId: str('Trip id.'),
        confirm: bool('Must be true. Guards against an accidental call.'),
      },
    },
    schema: toolArgs.delete_trip,
    run: async ({ tripId }, actor) => {
      await deleteTrip(await owned(tripId, actor));
      return { ok: true };
    },
  }),
  defineTool({
    name: 'set_tag_style',
    description:
      'Pin the colour and/or icon a tag renders with everywhere on the board. Tags already get a colour from a hash of their name and an icon guessed from it, so use this only to override that. Pass null for either field to go back to the automatic choice.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'tag'],
      properties: {
        tripId: str('Trip id.'),
        tag: str('Tag name, e.g. "food". Matched lower-case.'),
        color: {
          type: ['string', 'null'],
          enum: [...TAG_COLOR_NAMES, null],
          description: 'Palette colour, or null for the automatic one.',
        },
        icon: {
          type: ['string', 'null'],
          enum: [...TAG_ICON_KEYS, '', null],
          description:
            'Icon key; "" for no icon at all; null for the automatic guess.',
        },
      },
    },
    schema: toolArgs.set_tag_style,
    run: async ({ tripId, tag, color, icon }, actor) =>
      setTagStyle(await scoped(tripId, actor), tag, { color, icon }),
  }),
  defineTool({
    name: 'rename_tag',
    description:
      'Rename a tag on every card in one city. Tags are per-city, so this leaves the same tag in other cities alone. Fails if the city already has a card carrying the new name — pick a free name rather than merging two tags together. The tag keeps its colour and icon.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'city', 'tag', 'name'],
      properties: {
        tripId: str('Trip id.'),
        city: str('City id or handle.'),
        tag: str('Current tag name, e.g. "food". Matched lower-case.'),
        name: str('New tag name. Must not already be used in this city.'),
      },
    },
    schema: toolArgs.rename_tag,
    run: async ({ tripId, city, tag, name }, actor) =>
      renameCityTag(await scoped(tripId, actor), city, tag, name),
  }),
  defineTool({
    name: 'delete_tag',
    description:
      'Remove a tag from every card in one city. The cards themselves stay. Tags are per-city, so other cities keep theirs — and the tag\'s colour and icon are kept too as long as any of them still uses it.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'city', 'tag'],
      properties: {
        tripId: str('Trip id.'),
        city: str('City id or handle.'),
        tag: str('Tag name, e.g. "food". Matched lower-case.'),
      },
    },
    schema: toolArgs.delete_tag,
    run: async ({ tripId, city, tag }, actor) =>
      deleteCityTag(await scoped(tripId, actor), city, tag),
  }),
  defineTool({
    name: 'import_cities',
    description:
      'Bulk create: add one or more complete cities — with their day columns and every activity — in a single call. This is the preferred way to populate a trip from a plan someone has already written. Every city automatically gets a Backlog column if the payload omits one.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'cities'],
      properties: {
        tripId: str('Trip id.'),
        cities: { type: 'array', items: citySchema },
        replace: bool(
          'Delete all existing cities on this trip first. Destructive — defaults to false.',
        ),
      },
    },
    schema: toolArgs.import_cities,
    run: async ({ tripId, cities, replace }, actor) => ({
      created: await importBoard(await scoped(tripId, actor), {
        cities,
        replace,
      }),
    }),
  }),
  defineTool({
    name: 'create_city',
    description:
      'Add one city. Pass `columns` to create its days and activities at the same time.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'title'],
      properties: { tripId: str('Trip id.'), ...citySchema.properties },
    },
    schema: toolArgs.create_city,
    run: async ({ tripId, title, id, key, columns }, actor) => ({
      id: await createCity(await scoped(tripId, actor), {
        title,
        key: key ?? id,
        columns,
      }),
    }),
  }),
  defineTool({
    name: 'update_city',
    description:
      "Rename a city, and/or override the hour its days start at. Useful when one leg of a trip runs on a different clock to the rest — a late-dinner city against an early-start one.",
    inputSchema: {
      type: 'object',
      required: ['tripId', 'city'],
      properties: {
        tripId: str('Trip id.'),
        city: str('City id or handle.'),
        title: str('New name.'),
        dayStartMin: {
          type: ['integer', 'null'],
          description: `${DAY_START_DESCRIPTION} Null drops the override and follows the trip's day start.`,
        },
      },
    },
    schema: toolArgs.update_city,
    run: async ({ tripId, city, title, dayStartMin }, actor) => ({
      id: await updateCity(await scoped(tripId, actor), city, {
        title,
        dayStartMin,
      }),
    }),
  }),
  defineTool({
    name: 'delete_city',
    description: 'Delete a city and everything in it. Not reversible.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'city'],
      properties: { tripId: str('Trip id.'), city: str('City id or handle.') },
    },
    schema: toolArgs.delete_city,
    run: async ({ tripId, city }, actor) => {
      await deleteCity(await scoped(tripId, actor), city);
      return { ok: true };
    },
  }),
  defineTool({
    name: 'create_column',
    description:
      'Add a day (timed, with a clock axis) or a plain list to a city.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'city', 'title'],
      properties: {
        tripId: str('Trip id.'),
        city: str('City id or handle.'),
        ...columnSchema.properties,
      },
    },
    schema: toolArgs.create_column,
    run: async ({ tripId, city, title, id, key, timed, date, items }, actor) => ({
      id: await createColumn(await scoped(tripId, actor), city, {
        title,
        key: key ?? id,
        timed,
        date,
        items,
      }),
    }),
  }),
  defineTool({
    name: 'update_column',
    description: 'Rename a column, change its date, or switch timed/list mode.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'column'],
      properties: {
        tripId: str('Trip id.'),
        column: str('Column id or handle.'),
        title: str('New heading.'),
        timed: bool('Whether the column has a clock axis.'),
        date: str('YYYY-MM-DD.'),
      },
    },
    schema: toolArgs.update_column,
    run: async ({ tripId, column, title, timed, date }, actor) => ({
      id: await updateColumn(await scoped(tripId, actor), column, {
        title,
        timed,
        date,
      }),
    }),
  }),
  defineTool({
    name: 'delete_column',
    description:
      'Delete a column and its items. The reserved "backlog" column cannot be deleted.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'column'],
      properties: { tripId: str('Trip id.'), column: str('Column id or handle.') },
    },
    schema: toolArgs.delete_column,
    run: async ({ tripId, column }, actor) => {
      await deleteColumn(await scoped(tripId, actor), column);
      return { ok: true };
    },
  }),
  defineTool({
    name: 'create_item',
    description: 'Add one activity to a column.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'column'],
      properties: {
        tripId: str('Trip id.'),
        column: str('Column id or handle.'),
        ...itemProperties,
      },
    },
    schema: toolArgs.create_item,
    run: async ({ tripId, column, ...input }, actor) => ({
      id: await createItem(await scoped(tripId, actor), column, input),
    }),
  }),
  defineTool({
    name: 'create_items',
    description:
      'Bulk create: add several activities in one call, each into its own column (they need not be the same one). Prefer this over repeated create_item calls when adding more than one activity at a time.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'items'],
      properties: {
        tripId: str('Trip id.'),
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['column'],
            properties: {
              column: str('Column id or handle this activity goes into.'),
              ...itemProperties,
            },
          },
        },
      },
    },
    schema: toolArgs.create_items,
    run: async ({ tripId, items }, actor) => ({
      ids: await createItems(await scoped(tripId, actor), items),
    }),
  }),
  defineTool({
    name: 'update_item',
    description:
      'Edit an activity. Send time: null to unschedule it into the tray.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'itemId'],
      properties: {
        tripId: str('Trip id.'),
        itemId: str('Item id.'),
        ...itemProperties,
      },
    },
    schema: toolArgs.update_item,
    run: async ({ tripId, itemId, ...patch }, actor) => ({
      id: await updateItem(await scoped(tripId, actor), itemId, patch),
    }),
  }),
  defineTool({
    name: 'update_items',
    description:
      'Bulk edit: patch several activities in one call, each by its own itemId — including moving one to another column via columnId. Prefer this over repeated update_item calls when editing more than one activity at a time.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'items'],
      properties: {
        tripId: str('Trip id.'),
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['itemId'],
            properties: {
              itemId: str('Item id.'),
              columnId: str('Move it to this column id or handle. Optional.'),
              ...itemProperties,
            },
          },
        },
      },
    },
    schema: toolArgs.update_items,
    run: async ({ tripId, items }, actor) => {
      const scopedTripId = await scoped(tripId, actor);
      return { ids: await updateItems(scopedTripId, items) };
    },
  }),
  defineTool({
    name: 'move_item',
    description:
      'Move an activity to another column, optionally setting its time. Moving into a list column clears the time.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'itemId', 'columnId'],
      properties: {
        tripId: str('Trip id.'),
        itemId: str('Item id.'),
        columnId: str('Destination column id or handle.'),
        time: {
          type: ['string', 'null'],
          description: '"HH:MM", or null to unschedule.',
        },
        dayOffset: {
          type: 'integer',
          description: 'Midnights past the column date; 1 for after midnight.',
        },
      },
    },
    schema: toolArgs.move_item,
    run: async ({ tripId, itemId, columnId, time, dayOffset }, actor) => ({
      id: await moveItem(await scoped(tripId, actor), itemId, {
        columnId,
        time,
        dayOffset,
      }),
    }),
  }),
  defineTool({
    name: 'move_items',
    description:
      'Bulk move: relocate several activities in one call, each to its own destination column and (optionally) time. Prefer this over repeated move_item calls when moving more than one activity at a time — e.g. shoving a whole afternoon to another day.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'items'],
      properties: {
        tripId: str('Trip id.'),
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['itemId', 'columnId'],
            properties: {
              itemId: str('Item id.'),
              columnId: str('Destination column id or handle.'),
              time: {
                type: ['string', 'null'],
                description: '"HH:MM", or null to unschedule.',
              },
              dayOffset: {
                type: 'integer',
                description:
                  'Midnights past the column date; 1 for after midnight.',
              },
            },
          },
        },
      },
    },
    schema: toolArgs.move_items,
    run: async ({ tripId, items }, actor) => ({
      ids: await moveItems(await scoped(tripId, actor), items),
    }),
  }),
  defineTool({
    name: 'delete_item',
    description: 'Delete one activity.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'itemId'],
      properties: { tripId: str('Trip id.'), itemId: str('Item id.') },
    },
    schema: toolArgs.delete_item,
    run: async ({ tripId, itemId }, actor) => {
      await deleteItem(await scoped(tripId, actor), itemId);
      return { ok: true };
    },
  }),
  defineTool({
    name: 'delete_items',
    description:
      'Bulk delete: remove several activities in one call, by itemId. Prefer this over repeated delete_item calls when clearing more than one activity at a time.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'itemIds'],
      properties: {
        tripId: str('Trip id.'),
        itemIds: { type: 'array', items: { type: 'string' }, description: 'Item ids to delete.' },
      },
    },
    schema: toolArgs.delete_items,
    run: async ({ tripId, itemIds }, actor) => {
      await deleteItems(await scoped(tripId, actor), itemIds);
      return { ok: true };
    },
  }),
];

const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

const rpcResult = (id: JsonRpcRequest['id'], result: unknown) => ({
  jsonrpc: '2.0' as const,
  id: id ?? null,
  result,
});

const rpcError = (
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
  data?: unknown,
) => ({ jsonrpc: '2.0' as const, id: id ?? null, error: { code, message, data } });

/**
 * Turns a thrown error into something the model can act on, or null when the
 * failure is ours and its details shouldn't leave the server.
 */
function toolErrorMessage(error: unknown): string | null {
  if (error instanceof ZodError) {
    const issues = error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join('; ');
    return `Those arguments are not valid — ${issues}`;
  }

  if (error instanceof ApiError) return error.message;

  return null;
}

async function dispatch(request: JsonRpcRequest, actor: Actor) {
  const { method, params = {}, id } = request;

  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion as string | undefined;
      const agreed =
        asked && SUPPORTED_PROTOCOL_VERSIONS.includes(asked)
          ? asked
          : PROTOCOL_VERSION;

      return rpcResult(id, {
        protocolVersion: agreed,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'trip.ly', version: '1.0.0', icons: ICONS },
        instructions:
          'Trip planning boards. Call list_trips to find a trip, get_board to read one, and import_cities to create whole days at once. Times are 24-hour "HH:MM"; set dayOffset to 1 for anything after midnight.',
      });
    }

    case 'ping':
      return rpcResult(id, {});

    case 'tools/list':
      return rpcResult(id, {
        tools: tools.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
          icons: ICONS,
        })),
      });

    case 'tools/call': {
      const name = params.name as ToolName;
      const tool = toolByName.get(name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);

      try {
        const args = tool.schema.parse(params.arguments ?? {});
        const output = await tool.run(args as never, actor);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        });
      } catch (error) {
        // Tool failures come back as a result with isError, not a protocol
        // error, so the model can read the reason and correct itself.
        const message = toolErrorMessage(error);
        if (message === null) console.error('[mcp]', error);
        return rpcResult(id, {
          content: [
            { type: 'text', text: message ?? 'The tool call failed unexpectedly.' },
          ],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * What turns a 401 into a connection instead of a dead end.
 *
 * RFC 9728 section 5.1: a protected resource that refuses a request says where
 * its metadata lives, and the client follows that to the authorization server,
 * registers itself, and opens a browser — all without anyone pasting anything.
 * Omit this header and an unauthenticated client has nowhere to go.
 */
function wwwAuthenticate(req: Request): Record<string, string> {
  const metadata = `${originFor(req)}/.well-known/oauth-protected-resource/api/mcp`;
  return {
    'WWW-Authenticate': `Bearer resource_metadata="${metadata}", error="invalid_token"`,
  };
}

export async function POST(req: Request) {
  let actor: Actor;
  try {
    actor = await requireActor(req);
  } catch {
    return Response.json(
      rpcError(null, -32001, 'Connect through OAuth, or send an API token as "Authorization: Bearer triply_…".'),
      { status: 401, headers: wwwAuthenticate(req) },
    );
  }

  let payload: JsonRpcRequest | JsonRpcRequest[];
  try {
    payload = await req.json();
  } catch {
    return Response.json(rpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  const batch = Array.isArray(payload) ? payload : [payload];
  const responses = [];

  for (const request of batch) {
    // Notifications (no id) get no response, per JSON-RPC.
    const isNotification = request.id === undefined;
    const response = await dispatch(request, actor);
    if (!isNotification) responses.push(response);
  }

  if (responses.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(payload) ? responses : responses[0]);
}

/** Handy for confirming the endpoint and token work before wiring up a client. */
export async function GET(req: Request) {
  try {
    await requireActor(req);
  } catch {
    return Response.json(
      {
        error: 'unauthorized',
        message:
          'Connect through OAuth, or send Authorization: Bearer triply_…',
      },
      { status: 401, headers: wwwAuthenticate(req) },
    );
  }
  return Response.json({
    name: 'trip.ly',
    protocolVersion: PROTOCOL_VERSION,
    transport: 'http',
    tools: tools.map((tool) => tool.name),
  });
}
