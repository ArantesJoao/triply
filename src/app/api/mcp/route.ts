import { requireActor, requireTripAccess, type Actor } from '@/server/access';
import {
  createCity,
  createColumn,
  createItem,
  deleteCity,
  deleteColumn,
  deleteItem,
  getBoard,
  getCity,
  importBoard,
  moveItem,
  updateCity,
  updateColumn,
  updateItem,
} from '@/server/board';
import { ApiError } from '@/server/errors';
import { createTrip, listTripsForUser, updateTrip } from '@/server/trips';

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

const PROTOCOL_VERSION = '2025-06-18';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

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
  blurb: str('Short free-text note.'),
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
    columns: { type: 'array', items: columnSchema },
  },
} as const;

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, never>, actor: Actor) => Promise<unknown>;
};

/** Every tool below a trip scope checks membership first. */
async function scoped(tripId: string, actor: Actor) {
  await requireTripAccess(tripId, actor);
  return tripId;
}

const tools: Tool[] = [
  {
    name: 'list_trips',
    description:
      'List every trip the authenticated user belongs to, with ids. Start here when you do not already know a tripId.',
    inputSchema: { type: 'object', properties: {} },
    run: async (_args, actor) => listTripsForUser(actor.userId),
  },
  {
    name: 'get_board',
    description:
      'Read a whole trip as JSON — every city, column and item. Call this before adding to an existing day so you can see what is already there.',
    inputSchema: {
      type: 'object',
      required: ['tripId'],
      properties: { tripId: str('Trip id from list_trips.') },
    },
    run: async ({ tripId }, actor) => getBoard(await scoped(tripId, actor)),
  },
  {
    name: 'get_city',
    description: 'Read a single city, by id or by handle (e.g. "london").',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'city'],
      properties: { tripId: str('Trip id.'), city: str('City id or handle.') },
    },
    run: async ({ tripId, city }, actor) =>
      getCity(await scoped(tripId, actor), city),
  },
  {
    name: 'create_trip',
    description: 'Create a new, empty trip owned by the authenticated user.',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: { title: str('Trip name, e.g. "Europe, October 2026".') },
    },
    run: async ({ title }, actor) => ({
      id: await createTrip(actor.userId, title),
    }),
  },
  {
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
    run: async ({ tripId, cities, replace }, actor) => ({
      created: await importBoard(await scoped(tripId, actor), {
        cities,
        replace,
      }),
    }),
  },
  {
    name: 'create_city',
    description:
      'Add one city. Pass `columns` to create its days and activities at the same time.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'title'],
      properties: { tripId: str('Trip id.'), ...citySchema.properties },
    },
    run: async ({ tripId, title, id, columns }, actor) => ({
      id: await createCity(await scoped(tripId, actor), { title, key: id, columns }),
    }),
  },
  {
    name: 'update_city',
    description: 'Rename a city.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'city', 'title'],
      properties: {
        tripId: str('Trip id.'),
        city: str('City id or handle.'),
        title: str('New name.'),
      },
    },
    run: async ({ tripId, city, title }, actor) => ({
      id: await updateCity(await scoped(tripId, actor), city, { title }),
    }),
  },
  {
    name: 'delete_city',
    description: 'Delete a city and everything in it. Not reversible.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'city'],
      properties: { tripId: str('Trip id.'), city: str('City id or handle.') },
    },
    run: async ({ tripId, city }, actor) => {
      await deleteCity(await scoped(tripId, actor), city);
      return { ok: true };
    },
  },
  {
    name: 'set_active_city',
    description: 'Choose which city tab the board opens on.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'cityId'],
      properties: { tripId: str('Trip id.'), cityId: str('City id.') },
    },
    run: async ({ tripId, cityId }, actor) => {
      await updateTrip(await scoped(tripId, actor), { activeCityId: cityId });
      return { ok: true };
    },
  },
  {
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
    run: async ({ tripId, city, title, id, timed, date, items }, actor) => ({
      id: await createColumn(await scoped(tripId, actor), city, {
        title,
        key: id,
        timed,
        date,
        items,
      }),
    }),
  },
  {
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
    run: async ({ tripId, column, title, timed, date }, actor) => ({
      id: await updateColumn(await scoped(tripId, actor), column, {
        title,
        timed,
        date,
      }),
    }),
  },
  {
    name: 'delete_column',
    description:
      'Delete a column and its items. The reserved "backlog" column cannot be deleted.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'column'],
      properties: { tripId: str('Trip id.'), column: str('Column id or handle.') },
    },
    run: async ({ tripId, column }, actor) => {
      await deleteColumn(await scoped(tripId, actor), column);
      return { ok: true };
    },
  },
  {
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
    run: async ({ tripId, column, ...input }, actor) => ({
      id: await createItem(await scoped(tripId, actor), column, input),
    }),
  },
  {
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
    run: async ({ tripId, itemId, ...patch }, actor) => ({
      id: await updateItem(await scoped(tripId, actor), itemId, patch),
    }),
  },
  {
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
    run: async ({ tripId, itemId, columnId, time, dayOffset }, actor) => ({
      id: await moveItem(await scoped(tripId, actor), itemId, {
        columnId,
        time,
        dayOffset,
      }),
    }),
  },
  {
    name: 'delete_item',
    description: 'Delete one activity.',
    inputSchema: {
      type: 'object',
      required: ['tripId', 'itemId'],
      properties: { tripId: str('Trip id.'), itemId: str('Item id.') },
    },
    run: async ({ tripId, itemId }, actor) => {
      await deleteItem(await scoped(tripId, actor), itemId);
      return { ok: true };
    },
  },
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

async function dispatch(request: JsonRpcRequest, actor: Actor) {
  const { method, params = {}, id } = request;

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'trip.ly', version: '1.0.0' },
        instructions:
          'Trip planning boards. Call list_trips to find a trip, get_board to read one, and import_cities to create whole days at once. Times are 24-hour "HH:MM"; set dayOffset to 1 for anything after midnight.',
      });

    case 'ping':
      return rpcResult(id, {});

    case 'tools/list':
      return rpcResult(id, {
        tools: tools.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });

    case 'tools/call': {
      const name = params.name as string;
      const tool = toolByName.get(name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);

      try {
        const args = (params.arguments ?? {}) as Record<string, never>;
        const output = await tool.run(args, actor);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        });
      } catch (error) {
        // Tool failures come back as a result with isError, not a protocol
        // error, so the model can read the reason and correct itself.
        const message =
          error instanceof ApiError
            ? error.message
            : 'The tool call failed unexpectedly.';
        if (!(error instanceof ApiError)) console.error('[mcp]', error);
        return rpcResult(id, {
          content: [{ type: 'text', text: message }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function POST(req: Request) {
  let actor: Actor;
  try {
    actor = await requireActor(req);
  } catch {
    return Response.json(
      rpcError(null, -32001, 'Send an API token as "Authorization: Bearer triply_…".'),
      { status: 401 },
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
      { error: 'unauthorized', message: 'Send Authorization: Bearer triply_…' },
      { status: 401 },
    );
  }
  return Response.json({
    name: 'trip.ly',
    protocolVersion: PROTOCOL_VERSION,
    transport: 'http',
    tools: tools.map((tool) => tool.name),
  });
}
