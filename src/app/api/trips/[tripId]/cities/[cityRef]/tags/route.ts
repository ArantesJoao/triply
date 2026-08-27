import { body, tripRoute } from '@/lib/api/handler';
import { renameTagBody } from '@/lib/api/schemas';
import { badRequest } from '@/server/errors';
import { deleteCityTag, renameCityTag } from '@/server/tags';

type P = { tripId: string; cityRef: string };

/**
 * The tag travels in the body or the query string rather than as a path
 * segment: tags are free-form, and a "/" in one ("food/drink") would split the
 * route out from under it.
 */
export const PATCH = tripRoute<P>(async ({ req, tripId, params }) => {
  const { tag, name } = await body(req, renameTagBody);
  return renameCityTag(tripId, params.cityRef, tag, name);
});

/** ?tag=… removes that tag from every card in the city. */
export const DELETE = tripRoute<P>(async ({ req, tripId, params }) => {
  const tag = new URL(req.url).searchParams.get('tag');
  if (!tag) throw badRequest('Pass the tag to remove as ?tag=…');
  return deleteCityTag(tripId, params.cityRef, tag);
});
