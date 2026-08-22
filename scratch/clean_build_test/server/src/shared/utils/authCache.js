const _authCache = new Map();
const AUTH_CACHE_TTL_MS = 5 * 1000;
const MAX_AUTH_CACHE_SIZE = 200;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of _authCache.entries()) {
    if (val.expiresAt < now) _authCache.delete(key);
  }
}, 15 * 1000).unref();

export function getCachedAuth(token) {
  const cached = _authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  return null;
}

export function setCachedAuth(token, user) {
  if (_authCache.size >= MAX_AUTH_CACHE_SIZE) {
    const oldestKey = _authCache.keys().next().value;
    if (oldestKey) _authCache.delete(oldestKey);
  }
  _authCache.set(token, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

export function invalidateAuthCache(token) {
  if (token) _authCache.delete(token);
}

export { _authCache, AUTH_CACHE_TTL_MS };
