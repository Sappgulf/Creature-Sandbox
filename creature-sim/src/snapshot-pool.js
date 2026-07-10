/**
 * Reusable-object pooling for per-tick snapshot arrays (worker-simulation.js).
 * Extracted from the worker module so it can be unit tested without pulling
 * in worker-only globals (self.onmessage, self.postMessage, etc.).
 */

/**
 * Fill `pool` so it mirrors `source` (same length, same order), reusing
 * existing pool entries in place via `assign` instead of allocating fresh
 * objects every call. Returns the (possibly resized) pool array.
 */
export function fillSnapshotPool(pool, source, assign) {
  if (pool.length > source.length) {
    pool.length = source.length;
  }
  for (let i = 0; i < source.length; i++) {
    let entry = pool[i];
    if (!entry) {
      entry = {};
      pool[i] = entry;
    }
    assign(entry, source[i]);
  }
  return pool;
}
