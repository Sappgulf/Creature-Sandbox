import { clamp } from './utils.js';
import { RendererConfig } from './renderer-config.js?v=20260527-tranche4';
import { RendererFeatureManager } from './renderer-features.js?v=20260527-tranche4';
import { RendererPerformanceMonitor } from './renderer-performance.js?v=20260527-tranche4';
import { getDebugFlags } from './debug-flags.js';
import { assetLoader } from './asset-loader.js?v=20260423-assets1';
import { applyFeatureVizMethods } from './renderer-features-viz.js';
import { applyMinimapMethods } from './renderer-minimap.js';
import { applyCreatureMethods } from './renderer-creatures.js?v=20260527-tranche4';
import {
  drawBiomeGround,
  drawWaterBiomes,
  drawCreatureTerritoryZones,
  drawDayNightOverlay,
  drawSeasonOverlay,
  drawMoodOverlay,
  drawWindStreaks,
  drawDecoration,
  getBiomeTint
} from './renderer-biome.js?v=20260423-assets1';
import { drawWeatherEffects } from './renderer-weather.js';
import { ghostTrails } from './ecosystem-ghosts.js';

// SPLIT: biome and weather rendering extracted to renderer-biome.js / renderer-weather.js

export class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;

    // Detect mobile for performance optimizations
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);

    // Setup image smoothing based on device
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = this.isMobile ?
      RendererConfig.CANVAS.IMAGE_SMOOTHING.MOBILE :
      RendererConfig.CANVAS.IMAGE_SMOOTHING.DESKTOP;

    // Initialize subsystems
    this.features = new RendererFeatureManager(this);
    this.performance = new RendererPerformanceMonitor(this);

    // Legacy properties for backward compatibility
    this.background = RendererConfig.CANVAS.DEFAULT_BACKGROUND;
    this.lastMiniMap = null;
    this.miniMapSettings = {
      heatmap: true,
      disaster: true,
      territories: true
    };

    // Day/night cycle state
    this.timeOfDay = RendererConfig.DAY_NIGHT.START_TIME;
    this.dayNightSpeed = RendererConfig.DAY_NIGHT.SPEED;

    // Mini-map state
    this.miniMapAutoHide = RendererConfig.FEATURES.MINIMAP_AUTO_HIDE;
    this.miniMapOpacity = RendererConfig.MINIMAP.OPACITY;
    this.miniMapTargetOpacity = RendererConfig.MINIMAP.TARGET_OPACITY;

    // Visual enhancement settings
    this.weatherIntensity = 0;
    this.weatherType = null;

    // NEW: Name labels & trait visualization
    this.enableNameLabels = true;
    this.enableTraitVisualization = true;
    this.enableCreatureZones = false; // Advanced overlay; keep gameplay assets readable by default.
    this.hoveredCreatureId = null;
    this.enableNests = false;

    // Cache lineage computation
    this._lineageCache = { rootId: null, set: null, frame: 0 };
    this._clusterCache = { clusters: null, frame: -1 };
    this._nameCache = null; // Cache for creature names to avoid repeated lookups
    this._visibleCreatures = [];
    this._renderList = [];
    this._creatureRenderOptions = {};

    // OPTIMIZATION: Mini-map heatmap cache
    this._heatmapCache = {
      data: null,
      width: 0,
      height: 0,
      lastUpdate: 0,
      updateInterval: 30 // Update every 30 frames (~0.5s at 60fps)
    };

    // LEGENDARY OPTIMIZATION: Frustum culling + performance tracking
    this._viewBounds = { x1: 0, y1: 0, x2: 0, y2: 0 };
    this.renderedCount = 0;
    this.culledCount = 0;

    // Particle system for atmospheric effects (reduced on mobile)
    this.particles = [];
    this.maxParticles = this.isMobile ? 50 : 200;

    // LEGENDARY OPTIMIZATION: Pre-create reusable Path2D objects
    this._circlePath = new Path2D();
    this._circlePath.arc(0, 0, 1, 0, Math.PI * 2);

    this._foodSpriteAssetByType = {
      grass: 'food_grass',
      berries: 'food_berries',
      fruit: 'food_fruit',
      golden_fruit: 'food_golden_fruit'
    };
    this._foodTypeOrder = ['grass', 'berries', 'fruit', 'golden_fruit'];
    this._foodVisuals = {
      grass: {
        color: 'rgba(100,220,90,0.9)',
        glow: 'rgba(80,200,60,0.35)',
        pulseSpeed: 1.4
      },
      berries: {
        color: 'rgba(255,80,130,0.9)',
        glow: 'rgba(255,50,100,0.4)',
        pulseSpeed: 1.1
      },
      fruit: {
        color: 'rgba(255,160,50,0.9)',
        glow: 'rgba(255,140,30,0.4)',
        pulseSpeed: 0.9
      },
      golden_fruit: {
        color: 'rgba(255,230,50,0.95)',
        glow: 'rgba(255,200,0,0.5)',
        pulseSpeed: 0.7
      }
    };
    this._propSpriteAssetByType = {
      bounce: 'prop_bounce',
      spring: 'prop_spring',
      spinner: 'prop_spinner',
      seesaw: 'prop_seesaw',
      conveyor: 'prop_conveyor',
      slope: 'prop_slope',
      fan: 'prop_fan',
      sticky: 'prop_sticky',
      gravity: 'prop_gravity',
      button: 'prop_button',
      launch: 'prop_launch'
    };
    this._foodSpriteSize = 48;
    this._propSpriteSize = 96;
  }

  clear(width, height) {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
  }

  setMiniMapOption(option, value) {
    if (Object.prototype.hasOwnProperty.call(this.miniMapSettings, option)) {
      this.miniMapSettings[option] = !!value;
    }
  }

  // Feature management methods
  setFeature(feature, enabled) {
    this.features.setFeature(feature, enabled);
  }

  toggleFeature(feature) {
    this.features.toggleFeature(feature);
  }

  isFeatureEnabled(feature) {
    return this.features.isFeatureEnabled(feature);
  }

  getPerformanceStats() {
    return {
      renderer: this.performance.getStats(),
      features: this.features.getPerformanceImpact()
    };
  }

  drawWorld(world, opts = {}) {
    // Performance monitoring
    this.performance.beginFrame();

    const {
      selectedId = null,
      pinnedId = null,
      lineageRootId = null,
      hoveredId = null,
      worldTime = 0,
      travelPreview = null,
      cameraTravel = null
    } = opts;
    const camera = this.camera;
    const ctx = this.ctx;
    const debugFlags = getDebugFlags();
    const spawnDebug = debugFlags.spawnDebug;

    ctx.save();

    // Apply screen shake offset (for dramatic effects)
    const shakeOffset = (world.particles && typeof world.particles.getShakeOffset === 'function')
      ? world.particles.getShakeOffset()
      : { x: 0, y: 0 };

    ctx.translate(opts.viewportWidth / 2 + shakeOffset.x, opts.viewportHeight / 2 + shakeOffset.y);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // OPTIMIZATION: Calculate view frustum for culling
    const margin = 100; // Extra margin for smooth culling
    this._viewBounds.x1 = camera.x - opts.viewportWidth / (2 * camera.zoom) - margin;
    this._viewBounds.y1 = camera.y - opts.viewportHeight / (2 * camera.zoom) - margin;
    this._viewBounds.x2 = camera.x + opts.viewportWidth / (2 * camera.zoom) + margin;
    this._viewBounds.y2 = camera.y + opts.viewportHeight / (2 * camera.zoom) + margin;
    if (spawnDebug && world._debugSpawn && world._debugSpawn.version !== this._lastDebugSpawnVersion) {
      this._pendingDebugSpawn = world._debugSpawn;
      this._lastDebugSpawnVersion = world._debugSpawn.version;
    }

    // Draw biomes
    this.drawBiomes(world);

    // Sandbox props
    this.drawSandboxProps(world);

    // Calm zones (subtle, ambient)
    this.drawCalmZones(world, opts);

    if (opts.godModeActive) {
      this.drawFoodPatches(world);
    }

    if (this.enableNests) {
      this.drawNests(world);
    }

    // Feature 1: Draw territories
    if (this.enableTerritories) {
      this.drawTerritories(world);
    }

    this.drawFood(world);
    this.drawCorpses(world); // NEW: Draw corpses for scavengers

    // Feature 2: Draw memory for selected creature
    if (this.enableMemory && selectedId) {
      const creature = world.getAnyCreatureById(selectedId);
      if (creature && creature.memory) {
        this.drawMemory(creature);
      }
    }

    // Feature 4: Draw social bonds
    if (this.enableSocialBonds) {
      this.drawSocialBonds(world);
    }

    // Feature 9: Draw migration arrows
    if (this.enableMigration) {
      this.drawMigration(world);
    }

    // Cache lineage descendants to avoid expensive BFS every frame
    let lineageSet = null;
    if (lineageRootId) {
      if (this._lineageCache.rootId === lineageRootId && this._lineageCache.frame === world.t) {
        lineageSet = this._lineageCache.set;
      } else {
        const descendants = world.descendantsOf(lineageRootId);
        lineageSet = descendants instanceof Set
          ? descendants
          : new Set((descendants || []).map(item => item?.id ?? item));
        this._lineageCache = { rootId: lineageRootId, set: lineageSet, frame: world.t };
      }
    }

    // Advanced visualizations (after food, before creatures)
    if (this.enableMating) {
      this.drawMatingDisplays(world);
    }

    // Draw ecosystem ghost trails (behind creatures)
    ghostTrails.update();
    ghostTrails.draw(ctx, camera, worldTime);

    this.drawCreatures(world, { selectedId, pinnedId, hoveredId, lineageSet, worldTime, selectionPulseUntil: opts.selectionPulseUntil });
    if (spawnDebug && this._pendingDebugSpawn) {
      const spawnInfo = this._pendingDebugSpawn;
      const creature = world.getAnyCreatureById?.(spawnInfo.creatureId);
      const bounds = this._viewBounds;
      const inView = creature
        ? creature.x >= bounds.x1 && creature.x <= bounds.x2 && creature.y >= bounds.y1 && creature.y <= bounds.y2
        : false;
      const alpha = creature ? clamp(creature.energy / 40, 0.25, 1) : null;
      console.debug('[Spawn][render]', {
        spawn: spawnInfo,
        camera: {
          x: Number(camera.x.toFixed(2)),
          y: Number(camera.y.toFixed(2)),
          zoom: Number(camera.zoom.toFixed(3))
        },
        bounds: {
          x1: Number(bounds.x1.toFixed(2)),
          y1: Number(bounds.y1.toFixed(2)),
          x2: Number(bounds.x2.toFixed(2)),
          y2: Number(bounds.y2.toFixed(2))
        },
        creature: creature
          ? {
            id: creature.id,
            x: Number(creature.x.toFixed(2)),
            y: Number(creature.y.toFixed(2)),
            size: creature.size,
            energy: Number(creature.energy?.toFixed?.(2) ?? creature.energy),
            alpha,
            inView,
            visible: creature.visible !== false
          }
          : null,
        renderedCount: this.renderedCount,
        culledCount: this.culledCount
      });
      this._pendingDebugSpawn = null;
    }

    if (opts.showGoalDebug) {
      this.drawGoalDebug(world);
    }

    if (opts.godModeActive) {
      this.drawGodModePreview(opts);
    }
    if (opts.showMemoryDebug) {
      this.drawMemoryDebug(world);
    }
    if (opts.showLifeStageDebug) {
      this.drawLifeStageDebug(world);
    }

    // NEW: Draw particle effects (birth sparkles, death markers, etc.)
    if (world.particles) {
      world.particles.draw(ctx);
    }

    if (selectedId) {
      const selectedCreature = world.getAnyCreatureById?.(selectedId);
      if (selectedCreature) {
        this._drawFamilyConnections(world, selectedCreature);
      }
    }

    // Advanced visualizations (after creatures)
    if (this.enableEmotions && selectedId) {
      const creature = world.getAnyCreatureById(selectedId);
      if (creature) this.drawEmotions(creature);
    }

    if (this.enableIntelligence) {
      this.drawIntelligenceIndicators(world);
    }

    if (cameraTravel) {
      this.drawTravelIndicator(cameraTravel, { preview: false });
    }
    if (travelPreview) {
      this.drawTravelIndicator(travelPreview, { preview: true });
    }

    ctx.restore();

    // Draw god mode effects
    this._drawGodModeEffects();

    // Draw mini-map overlay (bottom-right corner)
    if (this.enableMiniMap) {
      this.drawMiniMap(world, opts);
    } else {
      this.lastMiniMap = null;
    }

    // Performance monitoring and adaptive quality
    this.performance.endFrame();
    this.performance.adjustQuality();
  }

  _drawFamilyConnections(world, creature) {
    const ctx = this.ctx;
    ctx.save();
    const dashLength = 4 / this.camera.zoom;
    ctx.setLineDash([dashLength, dashLength * 0.75]);
    ctx.lineWidth = 1.2 / this.camera.zoom;

    const parents = Array.isArray(creature.parents) && creature.parents.length
      ? creature.parents
      : (creature.parentId ? [creature.parentId] : []);
    if (parents.length) {
      ctx.strokeStyle = 'rgba(255,210,130,0.45)';
      ctx.beginPath();
      for (const pid of parents) {
        const parent = world.getAnyCreatureById?.(pid);
        if (!parent) continue;
        ctx.moveTo(creature.x, creature.y);
        ctx.lineTo(parent.x, parent.y);
      }
      ctx.stroke();
    }

    const children = Array.isArray(creature.children) ? creature.children : [];
    if (children.length) {
      ctx.strokeStyle = 'rgba(146,210,255,0.55)';
      ctx.beginPath();
      for (const cid of children) {
        const child = world.getAnyCreatureById?.(cid);
        if (!child) continue;
        ctx.moveTo(creature.x, creature.y);
        ctx.lineTo(child.x, child.y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawGodModeEffects() {
    if (!window.godModeEffects || window.godModeEffects.length === 0) return;

    const ctx = this.ctx;
    const now = performance.now();

    // Update and draw effects
    for (let i = window.godModeEffects.length - 1; i >= 0; i--) {
      const effect = window.godModeEffects[i];
      const age = (now - effect.createdAt) / 1000; // seconds
      effect.life = 1 - (age / 1.5); // 1.5 second duration

      if (effect.life <= 0) {
        window.godModeEffects.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = effect.life;
      ctx.font = `${32 * (1 + (1 - effect.life) * 0.5)}px Arial`; // Grow as it fades
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Float upward
      const floatOffset = (1 - effect.life) * 30;

      // Draw emoji with glow
      ctx.shadowColor = effect.color;
      ctx.shadowBlur = 20;
      ctx.fillText(effect.emoji, effect.x, effect.y - floatOffset);

      ctx.restore();
    }
  }

  drawTravelIndicator(segment, { preview = false } = {}) {
    if (!segment?.from || !segment?.to) return;
    const ctx = this.ctx;
    const from = segment.from;
    const to = segment.to;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const ringRadius = Math.max(10, Math.min(36, dist * 0.08));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = preview ? 0.85 : 1;
    if (preview) {
      ctx.setLineDash([14, 10]);
      ctx.strokeStyle = 'rgba(123, 183, 255, 0.7)';
      ctx.lineWidth = 2.5;
    } else {
      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, 'rgba(250, 250, 200, 0.85)');
      gradient.addColorStop(1, 'rgba(250, 204, 21, 0.85)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 4;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.lineWidth = preview ? 2 : 3;
    ctx.strokeStyle = preview ? 'rgba(123, 183, 255, 0.9)' : 'rgba(250, 204, 21, 0.95)';
    ctx.fillStyle = preview ? 'rgba(123, 183, 255, 0.2)' : 'rgba(250, 204, 21, 0.25)';
    ctx.arc(to.x, to.y, ringRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (!preview) {
      const progress = clamp(segment.progress ?? 0, 0, 1);
      const markerX = from.x + dx * progress;
      const markerY = from.y + dy * progress;
      ctx.fillStyle = 'rgba(255, 253, 130, 0.95)';
      ctx.beginPath();
      ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBiomes(world) {
    // REDESIGNED: Subtle atmospheric biome rendering (player-focused!)
    const ctx = this.ctx;
    const bounds = this._viewBounds;

    drawBiomeGround(this, ctx, world);

    // Draw decorations with better visibility (less dense)
    if (world.decorations && this.camera.zoom > 0.4) {
      const skipFactor = Math.max(1, Math.floor(5 / this.camera.zoom));
      for (let i = 0; i < world.decorations.length; i += skipFactor) {
        const dec = world.decorations[i];
        if (dec.x < bounds.x1 || dec.x > bounds.x2 || dec.y < bounds.y1 || dec.y > bounds.y2) {
          continue;
        }
        drawDecoration(this, ctx, dec, world);
      }
    }

    // Draw creature territory zones (dominant creature types in regions)
    if (this.enableCreatureZones && this.camera.zoom > 0.3) {
      drawCreatureTerritoryZones(this, ctx, world);
    }

    // Draw water biomes with animated waves
    drawWaterBiomes(this, ctx, world);

    // Day/night lighting overlay
    if (this.enableDayNight) {
      drawDayNightOverlay(this, ctx, world);
    }

    // NEW: Season visual overlay
    drawSeasonOverlay(this, ctx, world);

    const mood = world.moodState || world.environment?.getMoodState?.();
    if (mood?.type && mood.type !== 'neutral') {
      drawMoodOverlay(this, ctx, world, mood.intensity, mood.type);
    }

    // Weather effects
    if (this.enableWeather && this.weatherType) {
      drawWeatherEffects(this, ctx, world);
    }
  }

  _getBiomeTint(biomeType) {
    return getBiomeTint(biomeType);
  }

  drawWindStreaks(world, intensity) {
    drawWindStreaks(this, this.ctx, world, intensity);
  }

  drawCalmZones(world) {
    const zones = world.environment?.calmZones;
    if (!zones || zones.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(160, 240, 220, 0.25)';
    ctx.fillStyle = 'rgba(120, 220, 200, 0.08)';
    ctx.lineWidth = 2;
    for (const zone of zones) {
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFoodPatches(world) {
    const patches = world.ecosystem?.foodPatches;
    if (!patches || patches.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 255, 180, 0.22)';
    ctx.lineWidth = 1.5;
    for (const patch of patches) {
      ctx.beginPath();
      ctx.arc(patch.x, patch.y, patch.radius * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGodModePreview(opts) {
    const pointer = opts.godModePointer;
    if (!pointer) return;
    const ctx = this.ctx;
    const tool = opts.godModeTool || 'food';
    let radius = 82;
    let color = 'rgba(120, 255, 180, 0.12)';
    let stroke = 'rgba(120, 255, 180, 0.34)';
    if (tool === 'calm') {
      radius = 96;
      color = 'rgba(120, 210, 255, 0.1)';
      stroke = 'rgba(120, 210, 255, 0.34)';
    } else if (tool === 'chaos') {
      radius = 108;
      color = 'rgba(200, 120, 255, 0.09)';
      stroke = 'rgba(200, 120, 255, 0.32)';
    } else if (tool === 'spawn') {
      radius = 26;
      color = 'rgba(130, 200, 255, 0.14)';
      stroke = 'rgba(130, 200, 255, 0.44)';
    } else if (tool === 'prop') {
      radius = 48;
      color = 'rgba(180, 140, 255, 0.1)';
      stroke = 'rgba(180, 140, 255, 0.38)';
    } else if (tool === 'remove') {
      radius = 28;
      color = 'rgba(255, 120, 120, 0.12)';
      stroke = 'rgba(255, 120, 120, 0.44)';
    }

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _getSpriteRuntime(name, size, color = null) {
    if (!name) return null;
    const options = color ? { size, color } : { size };
    const cached = assetLoader.getSpriteFramesSync(name, options);
    if (cached) return cached;
    assetLoader.requestSpriteFrames(name, options).catch((e) => { console.debug('[Renderer] sprite load failed:', name, e); });
    return null;
  }

  _drawSpriteAt(frame, x, y, size, anchor = null) {
    if (!frame || !size || size <= 0) return;
    const anchorX = Number.isFinite(Number(anchor?.x)) ? Number(anchor.x) : 0.5;
    const anchorY = Number.isFinite(Number(anchor?.y)) ? Number(anchor.y) : 0.5;
    this.ctx.drawImage(frame, x - size * anchorX, y - size * anchorY, size, size);
  }

  _shouldUseFoodSprites(visibleFoodCount) {
    if (visibleFoodCount <= 0) return false;
    if (this.camera.zoom < 0.75) return false;
    const quality = this.performance?.getCurrentQuality?.() || this.performance?.currentQuality || 'high';
    const maxByQuality = this.isMobile
      ? { ultra: 80, high: 70, medium: 54, low: 0 }
      : { ultra: 118, high: 82, medium: 54, low: 0 };
    const maxDetailed = maxByQuality[quality] ?? (this.isMobile ? 54 : 90);
    return visibleFoodCount <= maxDetailed;
  }

  _drawFoodSprites(world, visibleFood) {
    let needGrass = false;
    let needBerries = false;
    let needFruit = false;
    let needGolden = false;
    for (let i = 0; i < visibleFood.length; i++) {
      const type = visibleFood[i].type || 'grass';
      if (type === 'grass') needGrass = true;
      else if (type === 'berries') needBerries = true;
      else if (type === 'fruit') needFruit = true;
      else if (type === 'golden_fruit') needGolden = true;
    }

    const grassSprite = needGrass ? this._getSpriteRuntime(this._foodSpriteAssetByType.grass, this._foodSpriteSize) : null;
    const berriesSprite = needBerries ? this._getSpriteRuntime(this._foodSpriteAssetByType.berries, this._foodSpriteSize) : null;
    const fruitSprite = needFruit ? this._getSpriteRuntime(this._foodSpriteAssetByType.fruit, this._foodSpriteSize) : null;
    const goldenSprite = needGolden ? this._getSpriteRuntime(this._foodSpriteAssetByType.golden_fruit, this._foodSpriteSize) : null;

    if ((needGrass && !grassSprite) || (needBerries && !berriesSprite) || (needFruit && !fruitSprite) || (needGolden && !goldenSprite)) {
      return false;
    }

    const time = world?.t ?? 0;
    const ctx = this.ctx;

    const glowColors = {
      grass: 'rgba(80,200,60,0.4)',
      berries: 'rgba(255,50,100,0.45)',
      fruit: 'rgba(255,140,30,0.45)',
      golden_fruit: 'rgba(255,200,0,0.6)'
    };
    const pulseSpeeds = {
      grass: 1.4,
      berries: 1.1,
      fruit: 0.9,
      golden_fruit: 0.7
    };

    for (let i = 0; i < visibleFood.length; i++) {
      const f = visibleFood[i];
      const type = f.type || 'grass';
      let sprite = grassSprite;
      let speedScale = 1;
      if (type === 'berries') {
        sprite = berriesSprite;
        speedScale = 0.9;
      } else if (type === 'fruit') {
        sprite = fruitSprite;
        speedScale = 0.8;
      } else if (type === 'golden_fruit') {
        sprite = goldenSprite;
        speedScale = 1.25;
      }
      const frameIndex = assetLoader.getAnimationFrameIndex(sprite, 'idle', time, speedScale);
      const frame = sprite.frames[frameIndex] || sprite.frames[0];
      const drawSize = Math.max(4, (f.r || 2) * 3);
      const pulse = Math.sin(time * pulseSpeeds[type] + i * 0.1) * 0.5 + 0.5;

      ctx.save();
      ctx.shadowBlur = 6 + pulse * 4;
      ctx.shadowColor = glowColors[type] || glowColors.grass;
      this._drawSpriteAt(frame, f.x, f.y, drawSize, sprite.anchor);
      ctx.restore();

      if (type === 'golden_fruit') {
        ctx.save();
        ctx.shadowBlur = 15 + pulse * 10;
        ctx.shadowColor = 'rgba(255,215,0,0.8)';
        ctx.strokeStyle = `rgba(255,255,200,${0.3 + pulse * 0.25})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, drawSize * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    return true;
  }

  _shouldUsePropSprites(propCount) {
    if (propCount <= 0) return false;
    if (this.camera.zoom < 0.7) return false;
    const maxDetailed = this.isMobile ? 36 : 72;
    return propCount <= maxDetailed;
  }

  _drawSandboxPropSprite(prop, world) {
    if (!prop) return false;
    const spriteName = this._propSpriteAssetByType[prop.type];
    if (!spriteName) return false;
    const tintColor = assetLoader.isSpriteTintable(spriteName) ? (prop.color || null) : null;
    const sprite = this._getSpriteRuntime(spriteName, this._propSpriteSize, tintColor);
    if (!sprite) return false;

    const time = world?.t ?? 0;
    const speedScale = 0.8 + Math.min(1.4, (prop.strength ?? 1) * 0.5);
    const frameIndex = assetLoader.getAnimationFrameIndex(sprite, 'idle', time, speedScale);
    const frame = sprite.frames[frameIndex] || sprite.frames[0];
    if (!frame) return false;

    const radius = prop.radius || 40;
    const drawSize = Math.max(18, radius * 2.2);
    const directional = prop.type === 'conveyor' || prop.type === 'slope' || prop.type === 'fan';
    const dynamicSpin = prop.type === 'spinner';
    const dynamicTilt = prop.type === 'seesaw';
    if (directional || dynamicSpin || dynamicTilt) {
      let angle = prop.dir ?? 0;
      if (dynamicSpin) {
        angle += (time * 2.2) % (Math.PI * 2);
      } else if (dynamicTilt) {
        angle += Math.sin(time * 1.8 + (prop.id || 0)) * 0.2;
      }
      this.ctx.save();
      this.ctx.translate(prop.x, prop.y);
      this.ctx.rotate(angle);
      const anchorX = Number.isFinite(Number(sprite.anchor?.x)) ? Number(sprite.anchor.x) : 0.5;
      const anchorY = Number.isFinite(Number(sprite.anchor?.y)) ? Number(sprite.anchor.y) : 0.5;
      this.ctx.drawImage(frame, -drawSize * anchorX, -drawSize * anchorY, drawSize, drawSize);
      this.ctx.restore();
      return true;
    }

    this._drawSpriteAt(frame, prop.x, prop.y, drawSize, sprite.anchor);
    return true;
  }

  drawSandboxProps(world) {
    const props = world.sandbox?.props;
    if (!props || props.length === 0) return;
    const useSpriteProps = this._shouldUsePropSprites(props.length);

    const ctx = this.ctx;
    ctx.save();

    for (const prop of props) {
      if (!prop) continue;
      if (useSpriteProps && this._drawSandboxPropSprite(prop, world)) {
        ctx.globalAlpha = 1;
        continue;
      }
      const radius = prop.radius || 40;
      const color = prop.color || '#94a3b8';

      switch (prop.type) {
        case 'bounce': {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius * 0.45, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'spring': {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = '#f0fdf4';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius * 0.55, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(prop.x - radius * 0.35, prop.y);
          ctx.lineTo(prop.x + radius * 0.35, prop.y);
          ctx.stroke();
          break;
        }
        case 'spinner': {
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          const spin = (world.t * 2.2) % (Math.PI * 2);
          ctx.save();
          ctx.translate(prop.x, prop.y);
          ctx.rotate(spin);
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-radius * 0.6, 0);
          ctx.lineTo(radius * 0.6, 0);
          ctx.moveTo(0, -radius * 0.6);
          ctx.lineTo(0, radius * 0.6);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'seesaw': {
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.6;
          ctx.save();
          ctx.translate(prop.x, prop.y);
          const tilt = Math.sin(world.t * 1.8 + prop.id) * 0.2;
          ctx.rotate(tilt);
          ctx.beginPath();
          ctx.moveTo(-radius * 0.7, 0);
          ctx.lineTo(radius * 0.7, 0);
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = '#1f2937';
          ctx.beginPath();
          ctx.arc(prop.x, prop.y + radius * 0.25, radius * 0.18, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'conveyor': {
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          const dir = prop.dir ?? 0;
          ctx.save();
          ctx.translate(prop.x, prop.y);
          ctx.rotate(dir);
          ctx.strokeStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(-radius * 0.5, 0);
          ctx.lineTo(radius * 0.5, 0);
          ctx.lineTo(radius * 0.35, -radius * 0.2);
          ctx.moveTo(radius * 0.5, 0);
          ctx.lineTo(radius * 0.35, radius * 0.2);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'slope': {
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.4;
          const dir = prop.dir ?? 0;
          ctx.save();
          ctx.translate(prop.x, prop.y);
          ctx.rotate(dir);
          ctx.beginPath();
          ctx.moveTo(-radius * 0.6, radius * 0.3);
          ctx.lineTo(radius * 0.6, -radius * 0.3);
          ctx.stroke();
          ctx.strokeStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(radius * 0.35, -radius * 0.25);
          ctx.lineTo(radius * 0.55, -radius * 0.25);
          ctx.lineTo(radius * 0.48, -radius * 0.1);
          ctx.moveTo(radius * 0.55, -radius * 0.25);
          ctx.lineTo(radius * 0.48, -radius * 0.4);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'fan': {
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          const dir = prop.dir ?? 0;
          ctx.save();
          ctx.translate(prop.x, prop.y);
          ctx.rotate(dir);
          ctx.fillStyle = 'rgba(226,232,240,0.5)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, radius * 0.7, -0.35, 0.35);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'sticky': {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = '#fdf2f8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius * 0.55, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'gravity': {
          const gradient = ctx.createRadialGradient(prop.x, prop.y, radius * 0.2, prop.x, prop.y, radius);
          gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
          gradient.addColorStop(1, 'rgba(30,41,59,0.05)');
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius * 0.65, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'button': {
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius * 0.4, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'launch': {
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fee2e2';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, radius * 0.35, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(prop.x, prop.y - radius * 0.4);
          ctx.lineTo(prop.x, prop.y - radius * 0.7);
          ctx.stroke();
          break;
        }
        default:
          break;
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  drawFood(world) {
    if (!world || !world.food || world.food.length === 0 || !world.foodGrid) return;
    const ctx = this.ctx;
    const bounds = this._viewBounds;

    // OPTIMIZATION: Use spatial grid for frustum culling
    const visibleFood = world.foodGrid.queryRect(bounds.x1, bounds.y1, bounds.x2, bounds.y2);

    // Update performance stats
    this.performance.stats.totalObjects += world.food.length;
    this.performance.stats.rendered += visibleFood.length;
    this.performance.stats.culled += (world.food.length - visibleFood.length);

    if (visibleFood.length === 0) return;
    if (this._shouldUseFoodSprites(visibleFood.length) && this._drawFoodSprites(world, visibleFood)) {
      return;
    }

    // OPTIMIZATION: Reuse type grouping to avoid allocations
    if (!this._foodByType) this._foodByType = { grass: [], berries: [], fruit: [], golden_fruit: [] };
    const byType = this._foodByType;
    byType.grass.length = 0;
    byType.berries.length = 0;
    byType.fruit.length = 0;
    byType.golden_fruit.length = 0;

    for (let i = 0; i < visibleFood.length; i++) {
      const f = visibleFood[i];
      const type = f.type || 'grass';
      if (byType[type]) {
        byType[type].push(f);
      }
    }

    const time = world?.t ?? 0;
    const quality = this.performance?.getCurrentQuality?.() || this.performance?.currentQuality || 'high';
    const lowDetailFood = quality !== 'ultra' && (visibleFood.length > 120 || this.camera.zoom < 1.08);

    const foodVisuals = this._foodVisuals;
    const foodTypeOrder = this._foodTypeOrder;
    for (let typeIndex = 0; typeIndex < foodTypeOrder.length; typeIndex++) {
      const type = foodTypeOrder[typeIndex];
      const items = byType[type];
      if (items.length === 0) continue;

      const visual = foodVisuals[type] || foodVisuals.grass;
      const pulse = Math.sin(time * visual.pulseSpeed + items.length * 0.1) * 0.5 + 0.5;
      const baseColor = items[0].color || visual.color;

      if (lowDetailFood) {
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        for (let i = 0; i < items.length; i++) {
          const f = items[i];
          const radius = Math.max(1.5, f.r || 2);
          ctx.moveTo(f.x + radius, f.y);
          ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
        }
        ctx.fill();

        if (type === 'golden_fruit') {
          ctx.strokeStyle = 'rgba(255,255,200,0.38)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < items.length; i++) {
            const f = items[i];
            const radius = Math.max(2, (f.r || 2) + 1.5);
            ctx.moveTo(f.x + radius, f.y);
            ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
          }
          ctx.stroke();
        }
        continue;
      }

      const glowSize = 3 + pulse * 2;
      const glowAlpha = 0.2 + pulse * 0.15;

      ctx.save();
      ctx.shadowBlur = glowSize;
      ctx.shadowColor = visual.glow;

      ctx.fillStyle = baseColor;
      ctx.beginPath();
      for (let i = 0; i < items.length; i++) {
        const f = items[i];
        const sizeMod = 1 + pulse * 0.08 + (f.r || 2) * 0.03;
        ctx.moveTo(f.x + f.r * sizeMod, f.y);
        ctx.arc(f.x, f.y, f.r * sizeMod, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = glowAlpha;
      ctx.fillStyle = visual.glow;
      ctx.beginPath();
      for (let i = 0; i < items.length; i++) {
        const f = items[i];
        const auraSize = (f.r || 2) + glowSize * 1.5;
        ctx.moveTo(f.x + auraSize, f.y);
        ctx.arc(f.x, f.y, auraSize, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();

      if (type === 'fruit' && this.camera.zoom > 0.5) {
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < items.length; i++) {
          const f = items[i];
          ctx.moveTo(f.x, f.y + f.r);
          ctx.lineTo(f.x, f.y + f.r + 2);
        }
        ctx.stroke();
      }

      if (type === 'golden_fruit') {
        ctx.save();
        ctx.shadowBlur = 18 + pulse * 6;
        ctx.shadowColor = 'rgba(255,215,0,0.8)';
        ctx.strokeStyle = `rgba(255,255,200,${0.3 + pulse * 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < items.length; i++) {
          const f = items[i];
          ctx.moveTo(f.x + f.r + 2, f.y);
          ctx.arc(f.x, f.y, f.r + 2, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // NEW: Draw corpses for scavengers to find
  drawCorpses(world) {
    if (!world || !world.corpses || world.corpses.length === 0 || !world.corpseGrid) return;
    const ctx = this.ctx;
    const bounds = this._viewBounds;

    // OPTIMIZATION: Use spatial grid for frustum culling
    const visibleCorpses = world.corpseGrid.queryRect(bounds.x1, bounds.y1, bounds.x2, bounds.y2);

    // Update performance stats
    this.performance.stats.totalObjects += world.corpses.length;
    this.performance.stats.rendered += visibleCorpses.length;
    this.performance.stats.culled += (world.corpses.length - visibleCorpses.length);

    for (const corpse of visibleCorpses) {
      const decayAlpha = 1 - corpse.decay;
      const energyRatio = corpse.energy / corpse.maxEnergy;

      // Draw corpse as a dark brown/gray decaying mass
      ctx.save();
      ctx.globalAlpha = decayAlpha * 0.7;
      ctx.fillStyle = corpse.fromPredator ? '#5D4E37' : '#6B8E23'; // Brown for predators, olive for herbivores
      ctx.beginPath();
      ctx.arc(corpse.x, corpse.y, corpse.size * energyRatio, 0, Math.PI * 2);
      ctx.fill();

      // Draw small X to indicate it's dead
      ctx.strokeStyle = '#000000';
      ctx.globalAlpha = decayAlpha * 0.5;
      ctx.lineWidth = 1;
      const x = corpse.x;
      const y = corpse.y;
      const s = corpse.size * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.stroke();

      ctx.restore();
    }
  }

}

applyFeatureVizMethods(Renderer);
applyCreatureMethods(Renderer);
applyMinimapMethods(Renderer);
