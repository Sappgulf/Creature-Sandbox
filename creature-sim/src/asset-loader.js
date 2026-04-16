/**
 * Asset Loader - Loads and manages SVG creature sprites and sprite sheets.
 * Supports optional manifest-driven animated sheets with cached frame extraction.
 */

const DEFAULT_SPRITE_FPS = 8;
const DEFAULT_SPRITE_SIZE = 64;
const ZOOM_SIZES = [32, 48, 64, 96, 128];

function clampPositiveInt(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function normalizeAnimationClip(rawClip, frameCount, defaultFps) {
  if (!rawClip) return null;

  let start = 0;
  let count = frameCount;
  let fps = defaultFps;
  let loop = true;
  let pingPong = false;

  if (Array.isArray(rawClip)) {
    start = Number(rawClip[0] ?? 0);
    count = Number(rawClip[1] ?? frameCount);
    fps = Number(rawClip[2] ?? defaultFps);
    if (rawClip.length > 3) loop = rawClip[3] !== false;
    if (rawClip.length > 4) pingPong = rawClip[4] === true;
  } else if (typeof rawClip === 'object') {
    start = Number(rawClip.start ?? 0);
    count = Number(rawClip.count ?? frameCount);
    fps = Number(rawClip.fps ?? defaultFps);
    loop = rawClip.loop !== false;
    pingPong = rawClip.pingPong === true;
  } else {
    return null;
  }

  const safeStart = Math.min(Math.max(0, Math.floor(start)), Math.max(0, frameCount - 1));
  const maxCount = Math.max(1, frameCount - safeStart);
  const safeCount = Math.min(maxCount, Math.max(1, Math.floor(count)));
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : defaultFps;
  return {
    start: safeStart,
    count: safeCount,
    fps: safeFps,
    loop,
    pingPong
  };
}

export class AssetLoader {
  constructor() {
    // Legacy single SVG assets: name -> svgText|null
    this.assets = new Map();
    // Sprite sheets: name -> metadata record
    this.spriteSheets = new Map();
    this.spriteSheetPaths = new Set();
    this.promises = [];
    this.isLoading = false;
    this.isLoaded = false;

    // Legacy one-frame cache
    this.tintedCanvasCache = new Map();
    this.tintedCanvasInFlight = new Map();

    // Sprite frame caches (name|size|color)
    this.tintedSpriteCache = new Map();
    this.tintedSpriteInFlight = new Map();
    this.untintedSpriteCache = new Map();
    this.untintedSpriteInFlight = new Map();
    this.unavailableSpriteKeys = new Set();

    this.maxTintedCanvases = 256;
    this.maxTintedSpriteVariants = 128;
    this.maxUntintedSpriteVariants = 192;
    this._missingAssetWarnings = new Set();
    this._manifestAutoQueued = false;
  }

  /**
   * Load an SVG file
   * @param {string} name - Asset identifier
   * @param {string} path - Path to SVG file
   */
  loadSVG(name, path) {
    if (typeof fetch === 'undefined') return Promise.resolve(null);

    const promise = fetch(path, { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load ${path}: ${response.statusText}`);
        }
        return response.text();
      })
      .then(svgText => {
        this.assets.set(name, svgText);
        return svgText;
      })
      .catch(error => {
        console.warn(`Failed to load SVG ${name}:`, error);
        // Store null to prevent repeated failed requests
        this.assets.set(name, null);
        return null;
      });

    return this._queuePromise(promise);
  }

  _queuePromise(promise) {
    this.promises.push(promise);
    return promise;
  }

  _touchLruCache(cache, key, maxEntries) {
    if (!cache.has(key)) return;
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  _rememberLru(cache, key, value, maxEntries) {
    if (cache.has(key)) {
      cache.delete(key);
    }
    cache.set(key, value);
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  _resolvePath(basePath, assetPath) {
    if (!assetPath) return null;
    if (assetPath.startsWith('http://') || assetPath.startsWith('https://') || assetPath.startsWith('/')) {
      return assetPath;
    }
    if (assetPath.startsWith('./') || assetPath.startsWith('../')) {
      return assetPath;
    }
    if (assetPath.startsWith('assets/')) {
      return `./${assetPath}`;
    }
    const slashIdx = basePath.lastIndexOf('/');
    if (slashIdx < 0) return `./${assetPath}`;
    return `${basePath.slice(0, slashIdx + 1)}${assetPath}`;
  }

  _normalizeSpriteSheet(name, path, rawConfig = {}) {
    const framesHint = clampPositiveInt(rawConfig.frames ?? rawConfig.frameCount ?? 1, 1);
    const frameWidth = clampPositiveInt(
      rawConfig.frameWidth ?? rawConfig.frameW ?? rawConfig.width ?? DEFAULT_SPRITE_SIZE,
      DEFAULT_SPRITE_SIZE
    );
    const frameHeight = clampPositiveInt(
      rawConfig.frameHeight ?? rawConfig.frameH ?? rawConfig.height ?? frameWidth,
      frameWidth
    );
    const fps = Number.isFinite(Number(rawConfig.fps)) && Number(rawConfig.fps) > 0
      ? Number(rawConfig.fps)
      : DEFAULT_SPRITE_FPS;
    const defaultAnimation = rawConfig.defaultAnimation || rawConfig.default || 'idle';
    const tintable = rawConfig.tintable === true || rawConfig.tint === true;
    const format = String(rawConfig.format || path.split('.').pop() || 'svg').toLowerCase();

    const sourceWidth = clampPositiveInt(rawConfig.sheetWidth ?? rawConfig.widthTotal ?? (frameWidth * framesHint), frameWidth);
    const sourceHeight = clampPositiveInt(rawConfig.sheetHeight ?? rawConfig.heightTotal ?? frameHeight, frameHeight);
    const inferredFrames = clampPositiveInt(Math.floor(sourceWidth / frameWidth), framesHint);
    const frameCount = Math.max(1, rawConfig.frames ? framesHint : inferredFrames);

    const animationsRaw = rawConfig.animations || rawConfig.states || {};
    const animations = {};
    if (animationsRaw && typeof animationsRaw === 'object') {
      for (const [stateName, clip] of Object.entries(animationsRaw)) {
        const normalized = normalizeAnimationClip(clip, frameCount, fps);
        if (normalized) animations[stateName] = normalized;
      }
    }

    if (!animations.idle) {
      animations.idle = {
        start: 0,
        count: frameCount,
        fps,
        loop: true,
        pingPong: false
      };
    }

    return {
      name,
      path,
      format,
      tintable,
      frameWidth,
      frameHeight,
      frameCount,
      fps,
      defaultAnimation,
      animations,
      sourceWidth,
      sourceHeight,
      image: null,
      svgText: null
    };
  }

  _loadImageFromUrl(path) {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = path;
    });
  }

  _loadImageFromSvgText(svgText) {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  /**
   * Load a sprite sheet (SVG or raster).
   * @param {string} name - Sprite identifier
   * @param {string} path - Path to sprite sheet file
   * @param {object} config - Frame metadata and animation clips
   */
  loadSpriteSheet(name, path, config = {}) {
    if (!name || !path || typeof fetch === 'undefined') return Promise.resolve(null);
    const normalized = this._normalizeSpriteSheet(name, path, config);
    const sheetKey = `${name}|${path}`;
    if (this.spriteSheetPaths.has(sheetKey)) {
      return Promise.resolve(this.spriteSheets.get(name) || null);
    }
    this.spriteSheetPaths.add(sheetKey);

    const isSvg = normalized.format === 'svg' || normalized.format === 'svgz' || /\.svg(\?.*)?$/i.test(path);
    const loadPromise = (async () => {
      try {
        if (isSvg) {
          const response = await fetch(path, { cache: 'force-cache' });
          if (!response.ok) throw new Error(`Failed to load ${path}: ${response.statusText}`);
          const svgText = await response.text();
          normalized.svgText = svgText;
          if (svgText.includes('currentColor')) {
            normalized.tintable = true;
          }
          if (!normalized.tintable) {
            normalized.image = await this._loadImageFromSvgText(svgText);
          }
        } else {
          normalized.image = await this._loadImageFromUrl(path);
        }

        if (normalized.image) {
          const sourceWidth = clampPositiveInt(normalized.image.naturalWidth || normalized.image.width, normalized.sourceWidth);
          const sourceHeight = clampPositiveInt(normalized.image.naturalHeight || normalized.image.height, normalized.sourceHeight);
          normalized.sourceWidth = sourceWidth;
          normalized.sourceHeight = sourceHeight;
          if (!config.frames && normalized.frameWidth > 0) {
            normalized.frameCount = Math.max(1, Math.floor(sourceWidth / normalized.frameWidth));
          }
        }

        this.spriteSheets.set(name, normalized);
        return normalized;
      } catch (error) {
        console.warn(`Failed to load sprite sheet ${name}:`, error);
        this.spriteSheets.set(name, null);
        return null;
      }
    })();

    return this._queuePromise(loadPromise);
  }

  /**
   * Optional manifest-based sprite registration.
   * Supported keys: `spriteSheets`, `sprites`, `assets`.
   */
  loadManifest(path = './assets/sprites/sprite-manifest.json', { optional = true } = {}) {
    if (typeof fetch === 'undefined') return Promise.resolve(null);
    this._manifestAutoQueued = true;
    this._manifestPath = path;

    const manifestPromise = (async () => {
      try {
        const response = await fetch(path, { cache: 'force-cache' });
        if (!response.ok) {
          if (optional && (response.status === 404 || response.status === 410)) {
            return null;
          }
          throw new Error(`Failed to load manifest ${path}: ${response.statusText}`);
        }

        const manifest = await response.json();
        const pendingLoads = [];
        const pushEntry = (name, entry) => {
          if (!name || !entry || typeof entry !== 'object') return;
          const src = entry.path || entry.src || entry.url || entry.file;
          if (!src) return;
          const resolvedPath = this._resolvePath(path, src);
          pendingLoads.push(this.loadSpriteSheet(name, resolvedPath, entry));
        };

        if (Array.isArray(manifest?.sprites)) {
          for (let i = 0; i < manifest.sprites.length; i++) {
            const entry = manifest.sprites[i];
            if (!entry) continue;
            const name = entry.name || entry.id || entry.key || `sprite_${i}`;
            pushEntry(name, entry);
          }
        }

        if (manifest?.spriteSheets && typeof manifest.spriteSheets === 'object') {
          for (const [name, entry] of Object.entries(manifest.spriteSheets)) {
            pushEntry(name, entry);
          }
        }

        if (manifest?.assets && typeof manifest.assets === 'object') {
          for (const [name, entry] of Object.entries(manifest.assets)) {
            pushEntry(name, entry);
          }
        }

        if (pendingLoads.length > 0) {
          await Promise.all(pendingLoads);
        }
        return manifest;
      } catch (error) {
        if (!optional) {
          console.warn(`Failed to load sprite manifest ${path}:`, error);
        }
        return null;
      }
    })();

    return this._queuePromise(manifestPromise);
  }

  _queueManifestAutoLoad() {
    if (this._manifestAutoQueued) return;
    this._manifestAutoQueued = true;
    this.loadManifest('./assets/sprites/sprite-manifest.json', { optional: true });
  }

  /**
   * Load all registered assets
   * @returns {Promise<Map>} Map of loaded assets
   */
  async loadAll() {
    this._queueManifestAutoLoad();

    if (this.isLoading) {
      await this._waitForPromisesToSettle();
      return this.assets;
    }

    this.isLoading = true;
    await this._waitForPromisesToSettle();
    this.isLoaded = true;
    this.isLoading = false;

    console.debug(`✅ Loaded ${this.assets.size} creature assets, ${this.spriteSheets.size} sprite sheets`);
    return this.assets;
  }

  async _waitForPromisesToSettle() {
    let cursor = 0;
    while (cursor < this.promises.length) {
      const pending = this.promises.slice(cursor);
      cursor = this.promises.length;
      await Promise.all(pending);
    }
  }

  /**
   * Get loaded SVG text
   * @param {string} name - Asset identifier
   * @returns {string|null} SVG text or null if not loaded
   */
  getSVG(name) {
    return this.assets.get(name) || null;
  }

  _getTintKey(name, color, size) {
    return `${name}|${color}|${size}`;
  }

  _rememberTintedCanvas(key, canvas) {
    if (!canvas) return;
    this._rememberLru(this.tintedCanvasCache, key, canvas, this.maxTintedCanvases);
  }

  _getSpriteVariantKey(name, size, color = '') {
    return `${name}|${size}|${color}`;
  }

  getNearestSpriteSize(requestedSize) {
    if (!requestedSize || requestedSize <= 0) return DEFAULT_SPRITE_SIZE;
    let nearest = ZOOM_SIZES[0];
    let minDiff = Math.abs(requestedSize - nearest);
    for (let i = 1; i < ZOOM_SIZES.length; i++) {
      const diff = Math.abs(requestedSize - ZOOM_SIZES[i]);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = ZOOM_SIZES[i];
      }
    }
    return nearest;
  }

  getSpriteSheet(name) {
    return this.spriteSheets.get(name) || null;
  }

  isSpriteTintable(name) {
    const sheet = this.getSpriteSheet(name);
    if (sheet) {
      if (typeof sheet.tintable === 'boolean') {
        return sheet.tintable;
      }
      if (sheet.format === 'svg' || sheet.svgText) {
        return true;
      }
    }
    const svgText = this.getSVG(name);
    return !!svgText && svgText.includes('currentColor');
  }

  _buildFrameSetFromImage(image, sheet, size) {
    if (typeof document === 'undefined' || !image) return null;
    const frameCount = Math.max(1, sheet?.frameCount ?? 1);
    const sourceWidth = clampPositiveInt(image.naturalWidth || image.width, frameCount * DEFAULT_SPRITE_SIZE);
    const sourceHeight = clampPositiveInt(image.naturalHeight || image.height, DEFAULT_SPRITE_SIZE);
    const srcFrameWidth = Math.max(1, sheet?.frameWidth ?? Math.floor(sourceWidth / frameCount));
    const srcFrameHeight = Math.max(1, sheet?.frameHeight ?? sourceHeight);

    const frames = new Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = size;
      frameCanvas.height = size;
      const frameCtx = frameCanvas.getContext('2d');
      frameCtx.drawImage(
        image,
        i * srcFrameWidth, 0, srcFrameWidth, srcFrameHeight,
        0, 0, size, size
      );
      frames[i] = frameCanvas;
    }

    return {
      name: sheet?.name ?? null,
      frameCount,
      frameSize: size,
      fps: sheet?.fps ?? DEFAULT_SPRITE_FPS,
      defaultAnimation: sheet?.defaultAnimation || 'idle',
      animations: sheet?.animations || null,
      frames
    };
  }

  _resolveSpriteSheetOrLegacy(name) {
    const sheet = this.getSpriteSheet(name);
    if (sheet) return sheet;
    const legacySvg = this.getSVG(name);
    if (!legacySvg) return null;
    return {
      name,
      format: 'svg',
      tintable: true,
      frameWidth: DEFAULT_SPRITE_SIZE,
      frameHeight: DEFAULT_SPRITE_SIZE,
      frameCount: 1,
      fps: DEFAULT_SPRITE_FPS,
      defaultAnimation: 'idle',
      animations: {
        idle: { start: 0, count: 1, fps: DEFAULT_SPRITE_FPS, loop: true, pingPong: false }
      },
      svgText: legacySvg,
      image: null
    };
  }

  async requestSpriteFrames(name, { size = DEFAULT_SPRITE_SIZE, color = null } = {}) {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
    const spriteSize = clampPositiveInt(size, DEFAULT_SPRITE_SIZE);
    const tintColor = color && typeof color === 'string' ? color : '';
    const key = this._getSpriteVariantKey(name, spriteSize, tintColor);
    const isTinted = tintColor.length > 0;

    const cache = isTinted ? this.tintedSpriteCache : this.untintedSpriteCache;
    const inFlight = isTinted ? this.tintedSpriteInFlight : this.untintedSpriteInFlight;
    const maxEntries = isTinted ? this.maxTintedSpriteVariants : this.maxUntintedSpriteVariants;

    if (cache.has(key)) {
      this._touchLruCache(cache, key, maxEntries);
      return cache.get(key);
    }
    if (this.unavailableSpriteKeys.has(key)) {
      return null;
    }
    if (inFlight.has(key)) {
      return inFlight.get(key);
    }

    const preparePromise = (async () => {
      const sheet = this._resolveSpriteSheetOrLegacy(name);
      if (!sheet) {
        this.unavailableSpriteKeys.add(key);
        if (!this._missingAssetWarnings.has(name)) {
          this._missingAssetWarnings.add(name);
          console.warn(`Sprite asset '${name}' not found`);
        }
        return null;
      }

      try {
        let image = null;
        if (isTinted) {
          const svgText = sheet.svgText || this.getSVG(name);
          if (!svgText) {
            this.unavailableSpriteKeys.add(key);
            return null;
          }
          const tintedSvg = svgText.includes('currentColor')
            ? svgText.replace(/currentColor/g, tintColor)
            : svgText;
          image = await this._loadImageFromSvgText(tintedSvg);
        } else {
          if (!sheet.image && sheet.svgText) {
            sheet.image = await this._loadImageFromSvgText(sheet.svgText);
            this.spriteSheets.set(name, sheet);
          }
          image = sheet.image;
        }

        if (!image) {
          this.unavailableSpriteKeys.add(key);
          return null;
        }

        const prepared = this._buildFrameSetFromImage(image, sheet, spriteSize);
        if (!prepared || !prepared.frames || prepared.frames.length === 0) {
          this.unavailableSpriteKeys.add(key);
          return null;
        }
        this._rememberLru(cache, key, prepared, maxEntries);
        return prepared;
      } catch (error) {
        console.warn(`Failed to prepare sprite frames for ${name}:`, error);
        this.unavailableSpriteKeys.add(key);
        return null;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, preparePromise);
    return preparePromise;
  }

  getSpriteFramesSync(name, { size = DEFAULT_SPRITE_SIZE, color = null } = {}) {
    const spriteSize = clampPositiveInt(size, DEFAULT_SPRITE_SIZE);
    const tintColor = color && typeof color === 'string' ? color : '';
    const key = this._getSpriteVariantKey(name, spriteSize, tintColor);
    const cache = tintColor ? this.tintedSpriteCache : this.untintedSpriteCache;
    const maxEntries = tintColor ? this.maxTintedSpriteVariants : this.maxUntintedSpriteVariants;
    if (!cache.has(key)) return null;
    this._touchLruCache(cache, key, maxEntries);
    return cache.get(key);
  }

  getAnimationFrameIndex(spriteOrName, state = 'idle', worldTime = 0, speedScale = 1) {
    const sprite = typeof spriteOrName === 'string'
      ? this.getSpriteSheet(spriteOrName)
      : spriteOrName;
    if (!sprite) return 0;

    const frameCount = Math.max(1, sprite.frameCount ?? sprite.frames?.length ?? 1);
    const clips = sprite.animations || null;
    const defaultState = sprite.defaultAnimation || 'idle';
    const clip = clips?.[state] || clips?.[defaultState] || normalizeAnimationClip([0, frameCount, sprite.fps || DEFAULT_SPRITE_FPS], frameCount, sprite.fps || DEFAULT_SPRITE_FPS);
    const start = Math.max(0, Math.min(frameCount - 1, clip.start ?? 0));
    const count = Math.max(1, Math.min(frameCount - start, clip.count ?? frameCount));
    const scaledFps = Math.max(0.5, (clip.fps || sprite.fps || DEFAULT_SPRITE_FPS) * Math.max(0.1, Number(speedScale) || 1));
    const frameStep = Math.floor(Math.max(0, worldTime) * scaledFps);

    if (clip.pingPong && count > 1) {
      const cycle = count * 2 - 2;
      const step = cycle > 0 ? frameStep % cycle : 0;
      return start + (step < count ? step : (cycle - step));
    }

    if (clip.loop === false) {
      return start + Math.min(count - 1, frameStep);
    }

    return start + (frameStep % count);
  }

  async getSpriteFrame(name, frameIndex = 0, size = 64, hue = null) {
    if (typeof document === 'undefined') return null;
    const color = hue !== null ? `hsl(${hue}, 50%, 50%)` : null;
    const frames = await this.requestSpriteFrames(name, { size, color });
    if (!frames || !frames.frames) return null;
    const idx = Math.max(0, Math.min(frameIndex, frames.frames.length - 1));
    return frames.frames[idx] || null;
  }

  getSpriteFrameSync(name, frameIndex = 0, size = 64, hue = null) {
    const color = hue !== null ? `hsl(${hue}, 50%, 50%)` : '';
    const frames = this.getSpriteFramesSync(name, { size, color });
    if (!frames || !frames.frames) return null;
    const idx = Math.max(0, Math.min(frameIndex, frames.frames.length - 1));
    return frames.frames[idx] || null;
  }

  /**
   * Creates a tinted canvas from an SVG
   * @param {string} name - Asset name
   * @param {string} color - CSS color string
   * @param {number} size - Canvas size
   * @returns {Promise<HTMLCanvasElement|null>}
   */
  async createTintedCanvas(name, color, size = 64) {
    // Worker safety check
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return null;
    }

    const cacheKey = this._getTintKey(name, color, size);
    if (this.tintedCanvasCache.has(cacheKey)) {
      const cached = this.tintedCanvasCache.get(cacheKey);
      // Touch key for simple LRU behavior
      this.tintedCanvasCache.delete(cacheKey);
      this.tintedCanvasCache.set(cacheKey, cached);
      return cached;
    }
    if (this.tintedCanvasInFlight.has(cacheKey)) {
      return this.tintedCanvasInFlight.get(cacheKey);
    }

    const createPromise = (async () => {
      try {
        const spriteSet = await this.requestSpriteFrames(name, { size, color });
        const frame = spriteSet?.frames?.[0] || null;
        this._rememberTintedCanvas(cacheKey, frame);
        return frame;
      } catch (error) {
        console.error(`Error creating tinted canvas for ${name}:`, error);
        return null;
      } finally {
        this.tintedCanvasInFlight.delete(cacheKey);
      }
    })();

    this.tintedCanvasInFlight.set(cacheKey, createPromise);
    return createPromise;
  }

  /**
   * Check if assets are ready
   * @returns {boolean}
   */
  isReady() {
    return this.isLoaded;
  }
}

// Global singleton instance
export const assetLoader = new AssetLoader();
