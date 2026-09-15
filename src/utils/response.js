/**
 * Every successful response looks the same:
 *   { success: true, message, data }
 */
export const sendOk = (res, data, message = "OK") => res.status(200).json({ success: true, message, data });
export const sendCreated = (res, data, message = "Created") => res.status(201).json({ success: true, message, data });

/** Paginated list payload. */
export const listPayload = (items, { page, pageSize, total }) => ({
  items,
  pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
});
