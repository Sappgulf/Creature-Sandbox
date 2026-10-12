export function installDrawImageProbe({ prototype: proto, now = () => performance.now(), inGameLoop = () => false }) {
  if (!proto || typeof proto.drawImage !== 'function') return null;

  const original = proto.drawImage;
  const probe = {
    count: 0,
    timeMs: 0,
    rootTimeMs: 0,
    maxMs: 0,
    byCanvas: {}
  };
  const contextBuckets = new WeakMap();

  const getCanvasKey = context => {
    const source = context?.canvas;
    if (!source) return 'unknown';
    if (source.id) return source.id;
    if (source.className) return String(source.className);
    return `${Number(source.width) || 0}x${Number(source.height) || 0}`;
  };

  const patchedDrawImage = function patchedDrawImage(...args) {
    const inRoot = inGameLoop();
    const started = now();
    try {
      return original.apply(this, args);
    } finally {
      const elapsed = now() - started;
      const validContext = this !== null && (typeof this === 'object' || typeof this === 'function');
      let bucket = validContext ? contextBuckets.get(this) : null;
      if (!bucket) {
        const key = getCanvasKey(this);
        bucket = probe.byCanvas[key] || { count: 0, timeMs: 0, maxMs: 0 };
        probe.byCanvas[key] = bucket;
        if (validContext) contextBuckets.set(this, bucket);
      }
      probe.count += 1;
      probe.timeMs += elapsed;
      if (inRoot) probe.rootTimeMs += elapsed;
      probe.maxMs = Math.max(probe.maxMs, elapsed);
      bucket.count += 1;
      bucket.timeMs += elapsed;
      bucket.maxMs = Math.max(bucket.maxMs, elapsed);
    }
  };

  proto.drawImage = patchedDrawImage;
  return {
    probe,
    restore: () => {
      if (proto.drawImage === patchedDrawImage) proto.drawImage = original;
    }
  };
}

export function summarizeFrameCpu(root, drawImage, intervalCount) {
  const frames = Number(root?.count || 0);
  const rootScopeMs = Number(root?.totalMs || 0);
  const drawImageMs = Number(drawImage?.rootTimeMs || 0);
  const allDrawImageMs = Number(drawImage?.timeMs || 0);
  const profileComplete = !!root && frames === intervalCount + 1 && Number.isFinite(rootScopeMs);
  const nonDraw = profileComplete ? Math.max(0, rootScopeMs - drawImageMs) : NaN;
  return {
    frames,
    intervals: intervalCount,
    profileComplete,
    rootScopeMs,
    drawImageMs,
    unscopedDrawImageMs: Math.max(0, allDrawImageMs - drawImageMs),
    profiledNonDrawImageMs: Number(nonDraw.toFixed(3)),
    profiledNonDrawImagePerFrameMs: Number((nonDraw / Math.max(1, frames)).toFixed(4))
  };
}
