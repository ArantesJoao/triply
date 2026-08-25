/**
 * Errors that are safe to surface verbatim to an API caller. Anything else
 * bubbles up as a generic 500 so internal detail doesn't leak.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'bad_request', message, details);

export const unauthorized = (message = 'Authentication required.') =>
  new ApiError(401, 'unauthorized', message);

export const forbidden = (message = 'You do not have access to this trip.') =>
  new ApiError(403, 'forbidden', message);

export const notFound = (what = 'Resource') =>
  new ApiError(404, 'not_found', `${what} not found.`);

export const conflict = (message: string) =>
  new ApiError(409, 'conflict', message);
