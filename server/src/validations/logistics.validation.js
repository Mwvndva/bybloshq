import { z } from 'zod';

// Permissive schemas: path params are non-empty strings (always present in the
// URL, so this never false-rejects a valid request); known body fields are
// optional/loose; .passthrough() keeps every other field the controller reads.
// This adds a clean 400 for malformed input + param validation without changing
// accept/reject behavior for currently-valid traffic.
const id = z.string().min(1, 'Required path parameter is missing');
const s = z.string().optional();
const n = z.coerce.number().optional();
const anyId = z.union([z.string(), z.number()]).optional();

export const login = z.object({ email: s, username: s, password: s }).passthrough();
export const updateLegStatus = z.object({ requestId: id, legType: id, status: s }).passthrough();
export const updateLocation = z.object({ requestId: id, lat: n, lng: n, accuracy: n, heading: n, speed: n }).passthrough();
