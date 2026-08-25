import { ZodError, type ZodType } from 'zod';

import {
  requireActor,
  requireTripAccess,
  requireTripOwner,
  type Actor,
  type TripAccess,
} from '@/server/access';
import { ApiError } from '@/server/errors';

export type RouteContext<P> = {
  req: Request;
  actor: Actor;
  params: P;
};

export type TripContext<P> = RouteContext<P> & {
  tripId: string;
  access: TripAccess;
};

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.code, message: error.message, details: error.details },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: 'invalid_body',
        message: 'The request body did not match the expected shape.',
        details: error.issues,
      },
      { status: 400 },
    );
  }

  console.error('[api] unhandled error', error);
  return Response.json(
    { error: 'internal_error', message: 'Something went wrong.' },
    { status: 500 },
  );
}

function ok(data: unknown) {
  if (data instanceof Response) return data;
  return Response.json(data ?? { ok: true });
}

/** Requires a signed-in session or a valid API bearer token. */
export function authed<P = Record<string, never>>(
  handler: (ctx: RouteContext<P>) => Promise<unknown>,
) {
  return async (req: Request, segment: { params: Promise<P> }) => {
    try {
      const actor = await requireActor(req);
      const params = ((await segment?.params) ?? {}) as P;
      return ok(await handler({ req, actor, params }));
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** As {@link authed}, and additionally requires membership of `params.tripId`. */
export function tripRoute<P extends { tripId: string }>(
  handler: (ctx: TripContext<P>) => Promise<unknown>,
  options: { owner?: boolean } = {},
) {
  return async (req: Request, segment: { params: Promise<P> }) => {
    try {
      const actor = await requireActor(req);
      const params = await segment.params;
      const access = options.owner
        ? await requireTripOwner(params.tripId, actor)
        : await requireTripAccess(params.tripId, actor);
      return ok(
        await handler({ req, actor, params, tripId: params.tripId, access }),
      );
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Parses and validates a JSON body, tolerating an empty one. */
export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body was not valid JSON.');
  }
  return schema.parse(raw);
}
