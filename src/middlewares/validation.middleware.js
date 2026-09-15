import { ApiError } from "../utils/ApiError.js";

/**
 * Validates part of the request against a Zod schema and replaces it with the
 * parsed value, so controllers always get clean, typed input.
 *
 *   router.post("/", validate({ body: createBrandSchema }), controller.create)
 */
export const validate = (schemas) => (req, res, next) => {
  for (const [part, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join(".") || part, message: i.message }));
      return next(ApiError.badRequest(details[0]?.message || "Check the values you entered.", details));
    }
    if (part === "query") Object.defineProperty(req, "query", { value: result.data, writable: true });
    else req[part] = result.data;
  }
  next();
};
