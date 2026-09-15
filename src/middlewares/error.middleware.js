import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

/** Anything that did not match a route. */
export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

/** Turns a PostgreSQL driver error into something the user can act on. */
function fromPostgres(err) {
  switch (err.code) {
    case "23505": return ApiError.conflict("That code is already in use. Choose a different one.");
    case "23503": return ApiError.badRequest("The related record does not exist.");
    case "23502": return ApiError.badRequest(`"${err.column}" is required.`);
    case "22P02": return ApiError.badRequest("One of the values has the wrong format.");
    case "42P01": return new ApiError(500, "A required table is missing. Run: npm run db:migrate");
    case "42501": return new ApiError(500, "The database user is not allowed to read or write that table.");
    case "ECONNREFUSED": return new ApiError(503, "Cannot reach PostgreSQL. Is the server running?");
    default: return null;
  }
}

/** Single place where every error becomes a JSON response. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const apiError = err instanceof ApiError ? err : fromPostgres(err) || new ApiError(500, "Something went wrong on the server.");

  if (!apiError.expected || apiError.status >= 500) {
    console.error(`${req.method} ${req.originalUrl} ->`, err);
  }

  res.status(apiError.status).json({
    success: false,
    message: apiError.message,
    error: {
      code: apiError.code || "SERVER_ERROR",
      ...(apiError.details ? { details: apiError.details } : {}),
      // Stack traces are for the developer's terminal, never for a production response.
      ...(env.isProduction ? {} : { original: err.message }),
    },
  });
}
