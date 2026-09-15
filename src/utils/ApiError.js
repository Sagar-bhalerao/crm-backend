/** An error we deliberately return to the client, with an HTTP status. */
export class ApiError extends Error {
  constructor(status, message, details = null, code = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
    this.expected = true;
  }

  static badRequest(message, details) { return new ApiError(400, message, details, "BAD_REQUEST"); }
  static unauthorized(message = "You need to sign in.") { return new ApiError(401, message, null, "UNAUTHORIZED"); }
  static forbidden(message = "You do not have access to this.") { return new ApiError(403, message, null, "FORBIDDEN"); }
  static notFound(message = "Not found.") { return new ApiError(404, message, null, "NOT_FOUND"); }
  static conflict(message, details) { return new ApiError(409, message, details, "CONFLICT"); }
}
