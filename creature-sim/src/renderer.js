import { clamp } from './utils.js';
import { RendererConfig } from './renderer-config.js';
import { RendererFeatureManager } from './renderer-features.js';
import { RendererPerformanceMonitor } from './renderer-performance.js';
import { getDebugFlags } from './debug-flags.js';
import { assetLoader } from './asset-loader.js';
import { applyFeatureVizMethods } from './renderer-features-viz.js';
import { applyMinimapMethods } from './renderer-minimap.js';
import { applyCreatureMethods } from './renderer-creatures.js';

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
    this.miniMapAutoHide = RendererConfig.MINIMAP.AUTO_HIDE;
    this.miniMapOpacity = RendererConfig.MINIMAP.OPACITY;
    this.miniMapTargetOpacity = RendererConfig.MINIMAP.TARGET_OPACITY;

    // Visual enhancement settings
    this.weatherIntensity = 0;
    this.weatherType = null;

    // NEW: Name labels & trait visualization
    this.enableNameLabels = true;
    this.enableTraitVisualization = true;
    this.hoveredCreatureId = null;
    this.enableNests = false;

    // Cache lineage computation
    this._lineageCache = { rootId: null, set: null, frame: 0 };
    this._clusterCache = { clusters: null, frame: -1 };
    this._nameCache = null; // Cache for creature names to avoid repeated lookups
    this._visibleCreatures = [];
    this._renderList = [];

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
        lineageSet = world.descendantsOf(lineageRootId);
        this._lineageCache = { rootId: lineageRootId, set: lineageSet, frame: world.t };
      }
    }

    // Advanced visualizations (after food, before creatures)
    if (this.enableMating) {
      this.drawMatingDisplays(world);
    }

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

  _drawDecoration(dec) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(dec.x, dec.y);
    ctx.globalAlpha = 0.4;

    switch (dec.type) {
      case 'tree':
        // Simple tree silhouette
        ctx.fillStyle = `hsl(${dec.hue}, 45%, 25%)`;
        ctx.beginPath();
        ctx.arc(0, -dec.size * 0.4, dec.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-dec.size * 0.15, -dec.size * 0.2, dec.size * 0.3, dec.size);
        break;

      case 'rock':
        // Jagged rock
        ctx.fillStyle = `hsl(${dec.hue}, 20%, 40%)`;
        ctx.beginPath();
        ctx.moveTo(-dec.size * 0.4, dec.size * 0.3);
        ctx.lineTo(0, -dec.size * 0.5);
        ctx.lineTo(dec.size * 0.5, 0);
        ctx.lineTo(dec.size * 0.2, dec.size * 0.3);
        ctx.closePath();
        ctx.fill();
        break;

      case 'cactus':
        // Simple cactus
        ctx.fillStyle = `hsl(${dec.hue}, 50%, 35%)`;
        ctx.fillRect(-dec.size * 0.2, -dec.size * 0.8, dec.size * 0.4, dec.size);
        ctx.fillRect(-dec.size * 0.5, -dec.size * 0.4, dec.size * 0.3, dec.size * 0.3);
        break;

      case 'reed':
        // Tall grass/reed
        ctx.strokeStyle = `hsl(${dec.hue}, 40%, 40%)`;
        ctx.lineWidth = dec.size * 0.1;
        ctx.beginPath();
        ctx.moveTo(0, dec.size * 0.3);
        ctx.lineTo(dec.size * 0.1, -dec.size * 0.5);
        ctx.stroke();
        break;

      case 'flower':
        // Small flower
        ctx.fillStyle = `hsl(${dec.hue}, 70%, 55%)`;
        ctx.beginPath();
        ctx.arc(0, -dec.size * 0.3, dec.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  drawBiomes(world) {
    // REDESIGNED: Subtle atmospheric biome rendering (player-focused!)
    const ctx = this.ctx;
    const bounds = this._viewBounds;

    // Biome colors for terrain ground
    const biomeColors = {
      forest: [72, 96, 84],
      desert: [150, 118, 84],
      tundra: [122, 137, 156],
      swamp: [74, 102, 97],
      ocean: [62, 98, 132],
      mountain: [111, 102, 96],
      jungle: [74, 112, 98],
      savanna: [148, 133, 89],
      meadow: [129, 143, 104],
      grassland: [114, 124, 92],
      water: [76, 112, 146],
      wetland: [86, 122, 111]
    };

    // Fill base background
    ctx.fillStyle = this.background;
    const visibleWidth = bounds.x2 - bounds.x1;
    const visibleHeight = bounds.y2 - bounds.y1;
    const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
    ctx.fillRect(bounds.x1 - extendAmount, bounds.y1 - extendAmount, visibleWidth + extendAmount * 2, visibleHeight + extendAmount * 2);

    const atmosphereGradient = ctx.createLinearGradient(
      bounds.x1,
      bounds.y1,
      bounds.x2,
      bounds.y2
    );
    atmosphereGradient.addColorStop(0, 'rgba(248, 218, 178, 0.18)');
    atmosphereGradient.addColorStop(0.45, 'rgba(142, 163, 191, 0.08)');
    atmosphereGradient.addColorStop(1, 'rgba(52, 64, 88, 0.14)');
    ctx.fillStyle = atmosphereGradient;
    ctx.fillRect(
      bounds.x1 - extendAmount,
      bounds.y1 - extendAmount,
      visibleWidth + extendAmount * 2,
      visibleHeight + extendAmount * 2
    );

    // Blend biome-colored ground with soft radial patches to avoid the hard
    // checkerboard look of one-fill-per-cell terrain blocks.
    if (world.getBiomeAt && this.camera.zoom > 0.18) {
      const sampleSpacing = Math.max(110, 250 / this.camera.zoom);
      const overlayAlpha = clamp(0.2 + this.camera.zoom * 0.13, 0.2, 0.32);
      const influenceRadius = sampleSpacing * 0.92;
      const startX = Math.floor(bounds.x1 / sampleSpacing) * sampleSpacing;
      const startY = Math.floor(bounds.y1 / sampleSpacing) * sampleSpacing;
      for (let gx = startX; gx < bounds.x2 + sampleSpacing; gx += sampleSpacing) {
        for (let gy = startY; gy < bounds.y2 + sampleSpacing; gy += sampleSpacing) {
          const cx = gx + sampleSpacing * 0.5;
          const cy = gy + sampleSpacing * 0.5;
          const biome = world.getBiomeAt(cx, cy);
          const biomeColor = biome?.type ? biomeColors[biome.type] : null;
          if (!biomeColor) {
            continue;
          }

          const gradient = ctx.createRadialGradient(
            cx,
            cy,
            influenceRadius * 0.12,
            cx,
            cy,
            influenceRadius
          );
          gradient.addColorStop(0, `rgba(${biomeColor.join(',')}, ${overlayAlpha})`);
          gradient.addColorStop(0.55, `rgba(${biomeColor.join(',')}, ${overlayAlpha * 0.46})`);
          gradient.addColorStop(1, `rgba(${biomeColor.join(',')}, 0)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(
            cx - influenceRadius,
            cy - influenceRadius,
            influenceRadius * 2,
            influenceRadius * 2
          );
        }
      }
    }

    // Draw decorations with better visibility (less dense)
    if (world.decorations && this.camera.zoom > 0.4) {
      // Only draw subset of decorations based on zoom (avoid clutter)
      const skipFactor = Math.max(1, Math.floor(5 / this.camera.zoom));

      for (let i = 0; i < world.decorations.length; i += skipFactor) {
        const dec = world.decorations[i];

        // Frustum cull decorations
        if (dec.x < bounds.x1 || dec.x > bounds.x2 || dec.y < bounds.y1 || dec.y > bounds.y2) {
          continue;
        }

        this._drawDecoration(dec);
      }
    }

    // Draw water biomes with animated waves
    this._drawWaterBiomes(world);

    // Day/night lighting overlay
    if (this.enableDayNight) {
      this._drawDayNightOverlay(world);
    }

    // NEW: Season visual overlay
    this._drawSeasonOverlay(world);

    const mood = world.moodState || world.environment?.getMoodState?.();
    if (mood?.type && mood.type !== 'neutral') {
      this._drawMoodOverlay(world, mood.intensity, mood.type);
    }

    // Weather effects
    if (this.enableWeather && this.weatherType) {
      this._drawWeatherEffects(world);
    }
  }

  _getBiomeTint(biomeType) {
    switch (biomeType) {
      case 'forest': return 'rgba(72, 96, 84, 0.4)';
      case 'desert': return 'rgba(150, 118, 84, 0.32)';
      case 'mountain': return 'rgba(111, 102, 96, 0.28)';
      case 'wetland': return 'rgba(86, 122, 111, 0.36)';
      case 'water': return 'rgba(76, 112, 146, 0.46)';
      case 'meadow': return 'rgba(129, 143, 104, 0.34)';
      case 'grassland':
      default: return 'rgba(114, 124, 92, 0.34)';
    }
  }

  /**
   * Draw water biomes with animated wave effects
   */
  _drawWaterBiomes(world) {
    const ctx = this.ctx;
    const bounds = this._viewBounds;
    const zoom = this.camera.zoom;

    // Skip water effects if zoomed out too far (performance)
    if (zoom < 0.25) return;

    const worldTime = world.t || 0;
    const sampleSize = Math.max(40, 100 / zoom);

    // Sample the visible area for water biomes
    const startX = Math.max(0, Math.floor(bounds.x1 / sampleSize) * sampleSize);
    const startY = Math.max(0, Math.floor(bounds.y1 / sampleSize) * sampleSize);
    const endX = Math.min(world.width, bounds.x2);
    const endY = Math.min(world.height, bounds.y2);

    ctx.save();

    for (let y = startY; y < endY; y += sampleSize) {
      for (let x = startX; x < endX; x += sampleSize) {
        const biome = world.getBiomeAt(x, y);
        if (biome?.type !== 'water') continue;

        const depth = biome.depth || 0.5;
        const isDeep = depth > 0.7;

        // Base water color
        const baseColor = isDeep ? 'rgba(30, 64, 175, 0.6)' : 'rgba(59, 130, 246, 0.5)';
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, sampleSize, sampleSize);

        // Animated wave highlights (only when zoomed in enough)
        if (zoom > 0.5) {
          const waveOffset = Math.sin(worldTime * 2 + x * 0.02 + y * 0.01) * 0.5 + 0.5;
          const waveAlpha = 0.1 + waveOffset * 0.15;

          ctx.fillStyle = `rgba(147, 197, 253, ${waveAlpha})`;

          // Draw wavy lines
          const waveY = y + sampleSize * 0.3 + Math.sin(worldTime * 1.5 + x * 0.03) * sampleSize * 0.1;
          ctx.beginPath();
          ctx.moveTo(x, waveY);

          for (let wx = x; wx < x + sampleSize; wx += 10) {
            const wy = waveY + Math.sin(worldTime * 2 + wx * 0.05) * 3;
            ctx.lineTo(wx, wy);
          }

          ctx.lineTo(x + sampleSize, y + sampleSize);
          ctx.lineTo(x, y + sampleSize);
          ctx.closePath();
          ctx.fill();
        }

        // Deep water caustic pattern (extra visual for deep water)
        if (isDeep && zoom > 0.7) {
          const causticTime = worldTime * 0.5;
          const cx = x + sampleSize / 2;
          const cy = y + sampleSize / 2;

          ctx.strokeStyle = `rgba(147, 197, 253, ${0.15 + Math.sin(causticTime) * 0.05})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(
            cx + Math.sin(causticTime * 1.3) * 5,
            cy + Math.cos(causticTime * 0.9) * 5,
            sampleSize * 0.3,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  _drawDayNightOverlay(world) {
    const ctx = this.ctx;

    const dayNight = world.dayNightState || world.environment?.getDayNightState?.();
    const light = dayNight?.light ?? 1;
    const phase = dayNight?.phase ?? null;
    const darkness = clamp(1 - light, 0, 0.75);

    if (darkness > 0.05) {
      // Fill entire visible area, not just world bounds
      const bounds = this._viewBounds;
      const visibleWidth = bounds.x2 - bounds.x1;
      const visibleHeight = bounds.y2 - bounds.y1;
      const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
      ctx.fillStyle = `rgba(5, 14, 34, ${darkness})`;
      ctx.fillRect(
        bounds.x1 - extendAmount,
        bounds.y1 - extendAmount,
        visibleWidth + extendAmount * 2,
        visibleHeight + extendAmount * 2
      );
    }

    if (phase === 'dawn' || phase === 'dusk' || phase === 'night') {
      const tint = phase === 'dawn'
        ? `rgba(255, 170, 120, ${0.12 * (1 - darkness * 0.5)})`
        : phase === 'dusk'
          ? `rgba(120, 110, 200, ${0.12 * (1 - darkness * 0.4)})`
          : `rgba(35, 60, 120, ${0.08 + darkness * 0.15})`;
      const bounds = this._viewBounds;
      const visibleWidth = bounds.x2 - bounds.x1;
      const visibleHeight = bounds.y2 - bounds.y1;
      const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
      ctx.fillStyle = tint;
      ctx.fillRect(
        bounds.x1 - extendAmount,
        bounds.y1 - extendAmount,
        visibleWidth + extendAmount * 2,
        visibleHeight + extendAmount * 2
      );
    }
  }

  // NEW: Draw season-based overlay tint
  _drawSeasonOverlay(world) {
    const ctx = this.ctx;
    const season = world.currentSeason || 'spring';

    let tint = null;
    switch (season) {
      case 'spring':
        tint = 'rgba(255, 214, 168, 0.035)';
        break;
      case 'summer':
        tint = 'rgba(255, 196, 118, 0.04)';
        break;
      case 'autumn':
        tint = 'rgba(214, 124, 68, 0.055)';
        break;
      case 'winter':
        tint = 'rgba(187, 214, 240, 0.08)';
        break;
    }

    if (tint) {
      // Fill entire visible area, not just world bounds
      const bounds = this._viewBounds;
      const visibleWidth = bounds.x2 - bounds.x1;
      const visibleHeight = bounds.y2 - bounds.y1;
      const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
      ctx.fillStyle = tint;
      ctx.fillRect(
        bounds.x1 - extendAmount,
        bounds.y1 - extendAmount,
        visibleWidth + extendAmount * 2,
        visibleHeight + extendAmount * 2
      );
    }
  }

  _drawWeatherEffects(_world) {
    const weatherType = _world?.environment?.weatherType;
    const weatherIntensity = _world?.environment?.weatherIntensity || 0;
    if (!weatherType || weatherIntensity <= 0) return;

    const bounds = this._viewBounds;
    const ctx = this.ctx;

    // Aurora Borealis effect
    if (weatherType === 'aurora') {
      const time = performance.now() * 0.001;
      const gradient = ctx.createLinearGradient(0, bounds.y1, 0, bounds.y1 + 200);
      gradient.addColorStop(0, 'rgba(0, 255, 128, 0)');
      gradient.addColorStop(0.3, `rgba(0, 255, 200, ${0.15 * weatherIntensity})`);
      gradient.addColorStop(0.5, `rgba(128, 255, 255, ${0.2 * weatherIntensity})`);
      gradient.addColorStop(0.7, `rgba(0, 200, 255, ${0.15 * weatherIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 255, 128, 0)');

      ctx.fillStyle = gradient;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
      ctx.clip();

      // Draw wavy aurora bands
      for (let i = 0; i < 3; i++) {
        const yOffset = 30 + i * 40;
        const waveOffset = Math.sin(time * 0.5 + i * 0.7) * 20;

        ctx.beginPath();
        ctx.moveTo(bounds.x1, bounds.y1 + yOffset);

        for (let x = bounds.x1; x <= bounds.x2; x += 20) {
          const y = bounds.y1 + yOffset + Math.sin(x * 0.005 + time * 0.8 + i) * waveOffset;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(bounds.x2, bounds.y1 + yOffset + 60);
        ctx.lineTo(bounds.x1, bounds.y1 + yOffset + 60);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }

  _drawMoodOverlay(world, intensity, type) {
    if (!type || intensity <= 0.05) return;
    const bounds = this._viewBounds;
    const visibleWidth = bounds.x2 - bounds.x1;
    const visibleHeight = bounds.y2 - bounds.y1;
    const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
    const tint = type === 'wind'
      ? `rgba(129, 167, 255, ${0.08 * intensity})`
      : `rgba(110, 200, 180, ${0.08 * intensity})`;
    this.ctx.fillStyle = tint;
    this.ctx.fillRect(
      bounds.x1 - extendAmount,
      bounds.y1 - extendAmount,
      visibleWidth + extendAmount * 2,
      visibleHeight + extendAmount * 2
    );

    if (type === 'wind' && intensity > 0.12) {
      this.drawWindStreaks(world, intensity);
    }
  }

  drawWindStreaks(world, intensity) {
    const ctx = this.ctx;
    const bounds = this._viewBounds;
    const streakCount = Math.floor(10 + intensity * 10);
    const baseLength = 45 + intensity * 60;
    ctx.save();
    ctx.strokeStyle = `rgba(226, 240, 255, ${0.12 + intensity * 0.2})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < streakCount; i++) {
      const seed = i * 73.1;
      const x = bounds.x1 + ((seed * 31) % 1) * (bounds.x2 - bounds.x1);
      const y = bounds.y1 + ((seed * 17) % 1) * (bounds.y2 - bounds.y1);
      const offset = Math.sin((world.t * 0.6) + seed) * 12;
      ctx.beginPath();
      ctx.moveTo(x - baseLength * 0.4, y + offset);
      ctx.lineTo(x + baseLength * 0.6, y + offset - baseLength * 0.2);
      ctx.stroke();
    }
    ctx.restore();
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
    let radius = 120;
    let color = 'rgba(120, 255, 180, 0.35)';
    let stroke = 'rgba(120, 255, 180, 0.6)';
    if (tool === 'calm') {
      radius = 140;
      color = 'rgba(120, 210, 255, 0.25)';
      stroke = 'rgba(120, 210, 255, 0.6)';
    } else if (tool === 'chaos') {
      radius = 160;
      color = 'rgba(200, 120, 255, 0.2)';
      stroke = 'rgba(200, 120, 255, 0.55)';
    } else if (tool === 'spawn') {
      radius = 26;
      color = 'rgba(130, 200, 255, 0.25)';
      stroke = 'rgba(130, 200, 255, 0.7)';
    } else if (tool === 'prop') {
      radius = 58;
      color = 'rgba(180, 140, 255, 0.2)';
      stroke = 'rgba(180, 140, 255, 0.62)';
    } else if (tool === 'remove') {
      radius = 28;
      color = 'rgba(255, 120, 120, 0.22)';
      stroke = 'rgba(255, 120, 120, 0.7)';
    }

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
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

  _drawSpriteAt(frame, x, y, size) {
    if (!frame || !size || size <= 0) return;
    this.ctx.drawImage(frame, x - size * 0.5, y - size * 0.5, size, size);
  }

  _shouldUseFoodSprites(visibleFoodCount) {
    if (visibleFoodCount <= 0) return false;
    if (this.camera.zoom < 0.75) return false;
    const maxDetailed = this.isMobile ? 80 : 180;
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
      this._drawSpriteAt(frame, f.x, f.y, drawSize);

      if (type === 'golden_fruit') {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'gold';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
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
      this.ctx.drawImage(frame, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
      this.ctx.restore();
      return true;
    }

    this._drawSpriteAt(frame, prop.x, prop.y, drawSize);
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

    // Draw each vegetation type with its color
    const defaultColors = {
      grass: 'rgba(126,210,120,0.85)',
      berries: 'rgba(200,100,150,0.85)',
      fruit: 'rgba(255,180,80,0.85)',
      golden_fruit: 'rgba(255,215,0,0.95)'
    };

    for (const [type, items] of Object.entries(byType)) {
      if (items.length === 0) continue;

      ctx.fillStyle = items[0].color || defaultColors[type] || defaultColors.grass;

      // OPTIMIZATION: Batch draw all items of this type
      ctx.beginPath();
      for (let i = 0; i < items.length; i++) {
        const f = items[i];
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();

      // OPTIMIZATION: Only draw stems when zoomed in enough
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

      // Special handling for Golden Fruit (rare)
      if (type === 'golden_fruit') {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'gold';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < items.length; i++) {
          const f = items[i];
          ctx.moveTo(f.x + f.r + 1, f.y);
          ctx.arc(f.x, f.y, f.r + 1, 0, Math.PI * 2);
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
