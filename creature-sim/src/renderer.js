import { clamp } from './utils.js';
import { RendererConfig } from './renderer-config.js';
import { RendererFeatureManager } from './renderer-features.js';
import { RendererPerformanceMonitor } from './renderer-performance.js';

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
    this.timeOfDay = 0; // 0-1 (0=midnight, 0.5=noon)
    this.dayNightSpeed = 0.0002; // Slow cycle
    this.weatherIntensity = 0;
    this.weatherType = null;
    
    // NEW: Name labels & trait visualization
    this.enableNameLabels = true;
    this.enableTraitVisualization = true;
    this.hoveredCreatureId = null;
    
    // Cache lineage computation
    this._lineageCache = { rootId: null, set: null, frame: 0 };
    this._clusterCache = { clusters: null, frame: -1 };
    this._nameCache = null; // Cache for creature names to avoid repeated lookups
    
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
  }

  clear(width, height) {
    this.ctx.save();
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0,0,width,height);
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

  drawWorld(world, opts={}) {
    // Performance monitoring
    this.performance.beginFrame();

    const {
      selectedId=null,
      pinnedId=null,
      lineageRootId=null,
      worldTime=0,
      travelPreview=null,
      cameraTravel=null
    } = opts;
    const camera = this.camera;
    const ctx = this.ctx;

    ctx.save();
    
    // Apply screen shake offset (for dramatic effects)
    const shakeOffset = (world.particles && typeof world.particles.getShakeOffset === 'function') 
      ? world.particles.getShakeOffset() 
      : { x: 0, y: 0 };
    
    ctx.translate(opts.viewportWidth/2 + shakeOffset.x, opts.viewportHeight/2 + shakeOffset.y);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    
    // OPTIMIZATION: Calculate view frustum for culling
    const margin = 100; // Extra margin for smooth culling
    this._viewBounds.x1 = camera.x - opts.viewportWidth / (2 * camera.zoom) - margin;
    this._viewBounds.y1 = camera.y - opts.viewportHeight / (2 * camera.zoom) - margin;
    this._viewBounds.x2 = camera.x + opts.viewportWidth / (2 * camera.zoom) + margin;
    this._viewBounds.y2 = camera.y + opts.viewportHeight / (2 * camera.zoom) + margin;

    // Draw biomes
    this.drawBiomes(world);
    
    // Feature 1: Draw territories
    if (this.enableTerritories) {
      this.drawTerritories(world);
    }
    
    this.drawFood(world.food);
    this.drawCorpses(world.corpses); // NEW: Draw corpses for scavengers
    
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
    
    this.drawCreatures(world.creatures, { selectedId, pinnedId, lineageSet, worldTime });
    
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

  drawTravelIndicator(segment, { preview=false }={}) {
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
    
    switch(dec.type) {
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
    const sampleSize = Math.max(30, 120 / this.camera.zoom); // Larger samples = less blocky
    
    // Base background - fill entire visible area (including areas outside world bounds when zoomed out)
    ctx.fillStyle = '#15201a'; // Match CSS background
    
    // Calculate the full visible area in world coordinates
    const visibleWidth = bounds.x2 - bounds.x1;
    const visibleHeight = bounds.y2 - bounds.y1;
    const extendAmount = Math.max(visibleWidth, visibleHeight) * 2; // Extend far beyond visible area
    
    // Fill entire visible area + large margin (to handle any zoom level)
    ctx.fillRect(
      bounds.x1 - extendAmount, 
      bounds.y1 - extendAmount, 
      visibleWidth + extendAmount * 2, 
      visibleHeight + extendAmount * 2
    );
    
    // Fill world area (may overlap, but ensures world is fully covered)
    ctx.fillRect(0, 0, world.width, world.height);
    
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
    
    // Weather effects
    if (this.enableWeather && this.weatherType) {
      this._drawWeatherEffects(world);
    }
  }
  
  _getBiomeTint(biomeType) {
    // Subtle color tints (not overpowering!)
    switch(biomeType) {
      case 'forest': return 'rgba(34, 139, 34, 0.6)'; // Gentle green
      case 'desert': return 'rgba(218, 165, 32, 0.5)'; // Warm gold
      case 'mountain': return 'rgba(105, 105, 105, 0.4)'; // Cool gray
      case 'wetland': return 'rgba(64, 224, 208, 0.5)'; // Cyan tint
      case 'water': return 'rgba(30, 64, 175, 0.7)'; // Deep blue for water
      case 'meadow': return 'rgba(154, 205, 50, 0.6)'; // Yellow-green
      case 'grassland':
      default: return 'rgba(107, 142, 35, 0.5)'; // Olive
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
    
    // FIX: Use world's time of day (0-24 hours) instead of internal clock
    const hour = world.timeOfDay % 24;
    
    // Calculate darkness (0=bright day, 1=dark night)
    // Night: 20-6, Day: 6-20
    let darkness = 0;
    if (hour >= 20 || hour < 6) {
      darkness = 0.5; // Full night
    } else if (hour >= 6 && hour < 8) {
      // Dawn (6-8am): darkness fades
      darkness = 0.5 * (1 - (hour - 6) / 2);
    } else if (hour >= 18 && hour < 20) {
      // Dusk (6-8pm): darkness grows
      darkness = 0.5 * ((hour - 18) / 2);
    } else {
      // Day (8am-6pm): no darkness
      darkness = 0;
    }
    
    if (darkness > 0.05) {
      // Fill entire visible area, not just world bounds
      const bounds = this._viewBounds;
      const visibleWidth = bounds.x2 - bounds.x1;
      const visibleHeight = bounds.y2 - bounds.y1;
      const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
      ctx.fillStyle = `rgba(0, 10, 30, ${darkness})`;
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
    switch(season) {
      case 'spring':
        tint = 'rgba(127, 219, 106, 0.08)'; // Fresh green tint
        break;
      case 'summer':
        tint = 'rgba(255, 215, 0, 0.05)'; // Golden tint
        break;
      case 'autumn':
        tint = 'rgba(255, 140, 66, 0.12)'; // Orange tint
        break;
      case 'winter':
        tint = 'rgba(176, 224, 230, 0.15)'; // Icy blue tint
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
  
  _drawWeatherEffects(world) {
    // Placeholder for weather particles (rain, snow, dust)
    // Will be enhanced with particle system
  }

  drawFood(food) {
    if (food.length === 0) return;
    const ctx = this.ctx;
    const bounds = this._viewBounds;
    
    // OPTIMIZATION: Frustum cull food items
    const visibleFood = [];
    for (let i = 0; i < food.length; i++) {
      const f = food[i];
      const margin = f.r || 5;
      if (f.x + margin >= bounds.x1 && f.x - margin <= bounds.x2 &&
          f.y + margin >= bounds.y1 && f.y - margin <= bounds.y2) {
        visibleFood.push(f);
      }
    }
    
    if (visibleFood.length === 0) return;
    
    // OPTIMIZATION: Group food by type for batched rendering
    const byType = { grass: [], berries: [], fruit: [] };
    for (let i = 0; i < visibleFood.length; i++) {
      const f = visibleFood[i];
      const type = f.type || 'grass';
      if (byType[type]) {
        byType[type].push(f);
      }
    }
    
    // Draw each vegetation type with its color
    for (const [type, items] of Object.entries(byType)) {
      if (items.length === 0) continue;
      
      // OPTIMIZATION: Use cached color
      const defaultColors = {
        grass: 'rgba(126,210,120,0.85)',
        berries: 'rgba(200,100,150,0.85)',
        fruit: 'rgba(255,180,80,0.85)'
      };
      ctx.fillStyle = items[0].color || defaultColors[type] || defaultColors.grass;
      
      // OPTIMIZATION: Batch draw all items of this type
      ctx.beginPath();
      for (let i = 0; i < items.length; i++) {
        const f = items[i];
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
      }
      ctx.fill();
      
      // OPTIMIZATION: Only draw stems when zoomed in enough
      if (type === 'fruit' && this.camera.zoom > 0.5) {
        // Draw stem/leaf for fruit trees
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
    }
  }

  // NEW: Draw corpses for scavengers to find
  drawCorpses(corpses) {
    if (!corpses || corpses.length === 0) return;
    const ctx = this.ctx;
    const bounds = this._viewBounds;

    for (const corpse of corpses) {
      // Frustum culling: skip corpses outside view
      const margin = corpse.size * 3;
      if (corpse.x + margin < bounds.x1 || corpse.x - margin > bounds.x2 ||
          corpse.y + margin < bounds.y1 || corpse.y - margin > bounds.y2) {
        continue;
      }
      
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

  drawCreatures(creatures, opts) {
    const ctx = this.ctx;
    const { worldTime = 0 } = opts;
    
    // Reset performance metrics
    this.renderedCount = 0;
    this.culledCount = 0;
    
    // OPTIMIZATION: Cache zoom first (used by multiple checks below)
    const zoom = this.camera.zoom;
    
    // OPTIMIZATION: Throttle clustering - only compute every 60 frames (~1Hz)
    // Also skip clustering when zoomed out (not useful to see)
    let clusterMap = null;
    if (this.enableClustering && zoom > 0.3) {
      const currentFrame = Math.floor(worldTime * 0.25); // Update ~4x per second max
      if (this._clusterCache.frame !== currentFrame) {
        // Only compute clustering when needed and visible
        this._clusterCache.clusters = this._computeClusters(creatures);
        this._clusterCache.frame = currentFrame;
      }
      clusterMap = this._clusterCache.clusters;
    }
    
    // OPTIMIZATION: Cache other expensive checks
    const showShadows = zoom > 0.4; // Only show shadows when zoomed in
    const showOutlines = zoom > 0.5;
    const showTrails = this.enableTrails && zoom > 0.6; // Only show trails when zoomed in
    const showNames = this.enableNameLabels && zoom > 0.5; // Higher threshold for names
    
    // OPTIMIZATION: Cache name lookups (only recompute when selection/zoom changes significantly)
    const nameCacheKey = `${opts.selectedId}-${opts.pinnedId}-${Math.floor(zoom * 10)}`;
    if (!this._nameCache || this._nameCache.key !== nameCacheKey) {
      this._nameCache = { key: nameCacheKey, map: new Map() };
    }
    const nameCache = this._nameCache.map;
    
    // OPTIMIZATION: Frustum cull creatures outside view
    const bounds = this._viewBounds;
    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i];
      
      // Skip creatures outside view (unless selected/pinned)
      const isSelected = opts.selectedId === c.id;
      const isPinned = opts.pinnedId === c.id;
      if (!isSelected && !isPinned) {
        if (c.x < bounds.x1 || c.x > bounds.x2 || c.y < bounds.y1 || c.y > bounds.y2) {
          this.culledCount++;
          continue; // Culled!
        }
      }
      
      this.renderedCount++;
      
      const inLineage = opts.lineageSet ? opts.lineageSet.has(c.id) : false;
      const alpha = clamp(c.energy / 40, 0.25, 1);
      
      // OPTIMIZATION: Only save/restore when alpha changes
      if (alpha < 0.99) {
        ctx.save();
        ctx.globalAlpha = alpha;
      }
      
      // OPTIMIZATION: Only draw shadows when zoomed in and for visible creatures
      if (showShadows && (isSelected || isPinned || zoom > 0.6)) {
        this._drawCreatureShadow(c);
      }
      
      // Override hue if clustering is enabled
      const clusterHue = clusterMap ? clusterMap.get(c.id) : null;
      
      c.draw(ctx, {
        isSelected,
        isPinned,
        inLineage,
        showTrail: showTrails, // Use throttled value
        showVision: this.enableVision,
        clusterHue,
        zoom // Pass zoom for optimization decisions in creature.draw()
      });
      
      // Draw disease visual effects for sick creatures
      if (c.statuses?.has('disease') && zoom > 0.3) {
        this._drawDiseaseEffect(c, worldTime);
      }
      
      // OPTIMIZATION: Only draw outlines when zoomed in enough
      if (showOutlines && (isSelected || isPinned)) {
        this._drawCreatureOutline(c, isSelected);
      }
      
      // OPTIMIZATION: Only draw names for selected/pinned or when zoomed in significantly
      if (showNames && (isSelected || isPinned || zoom > 1.2)) {
        this._drawCreatureName(c, isSelected, isPinned, opts, nameCache);
      }
      
      if (alpha < 0.99) {
        ctx.restore();
      }
    }
  }
  
  _drawCreatureShadow(creature) {
    // Soft drop shadow for depth (makes creatures pop!)
    const ctx = this.ctx;
    const r = creature.genes.size;
    
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    
    // Shadow offset (slightly down and right)
    const offsetX = 2;
    const offsetY = 3;
    
    ctx.beginPath();
    ctx.ellipse(
      creature.x + offsetX,
      creature.y + offsetY,
      r * 1.1,
      r * 0.6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }
  
  _drawCreatureOutline(creature, isSelected) {
    // Subtle outline for contrast (not too thick!)
    const ctx = this.ctx;
    const r = creature.genes.size;
    
    ctx.save();
    ctx.strokeStyle = isSelected ? 'rgba(123, 183, 255, 0.6)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.beginPath();
    ctx.arc(creature.x, creature.y, r + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  
  /**
   * Draw disease visual effect for sick creatures
   * @param {object} creature - The creature to draw effect for
   * @param {number} worldTime - Current world time for animation
   */
  _drawDiseaseEffect(creature, worldTime) {
    const ctx = this.ctx;
    const diseaseStatus = creature.statuses.get('disease');
    if (!diseaseStatus) return;
    
    const r = creature.genes?.size || 4;
    const severity = diseaseStatus.metadata?.severity || diseaseStatus.severity || 0.5;
    const diseaseColor = diseaseStatus.metadata?.color || '#7fff7f';
    
    ctx.save();
    
    // Pulsing sick aura
    const pulse = Math.sin(worldTime * 4) * 0.3 + 0.7;
    const auraRadius = r + 3 + severity * 4;
    
    // Outer glow
    const gradient = ctx.createRadialGradient(
      creature.x, creature.y, r,
      creature.x, creature.y, auraRadius
    );
    gradient.addColorStop(0, `${diseaseColor}00`);
    gradient.addColorStop(0.5, `${diseaseColor}${Math.floor(severity * pulse * 40).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, `${diseaseColor}00`);
    
    ctx.beginPath();
    ctx.arc(creature.x, creature.y, auraRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Rotating disease particles
    const particleCount = Math.floor(3 + severity * 3);
    const rotationSpeed = worldTime * 2;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + rotationSpeed;
      const distance = r + 2 + Math.sin(worldTime * 3 + i) * 2;
      const px = creature.x + Math.cos(angle) * distance;
      const py = creature.y + Math.sin(angle) * distance;
      const particleSize = 1.5 + severity;
      
      ctx.beginPath();
      ctx.arc(px, py, particleSize, 0, Math.PI * 2);
      ctx.fillStyle = `${diseaseColor}${Math.floor(pulse * 180).toString(16).padStart(2, '0')}`;
      ctx.fill();
    }
    
    // Sick creature tint overlay
    ctx.globalAlpha = severity * 0.15 * pulse;
    ctx.beginPath();
    ctx.arc(creature.x, creature.y, r, 0, Math.PI * 2);
    ctx.fillStyle = diseaseColor;
    ctx.fill();
    
    ctx.restore();
  }
  
  _drawCreatureName(creature, isSelected, isPinned, opts, nameCache=null) {
    // Draw creature name/ID above it
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    
    // OPTIMIZATION: Skip if already checked before entering this function
    if (zoom < 0.4 && !isSelected && !isPinned) return;
    
    // OPTIMIZATION: Use cached name if available
    let name = null;
    let nameColor = '#ffffff';
    
    if (nameCache && nameCache.has(creature.id)) {
      const cached = nameCache.get(creature.id);
      name = cached.name;
      nameColor = cached.color;
    } else {
      // Get creature name (from lineage tracker if available)
      name = `#${creature.id}`;
      if (opts.lineageTracker) {
        const rootId = opts.lineageTracker.getRoot(opts.world, creature.id);
        const familyName = opts.lineageTracker.names.get(rootId);
        if (familyName) {
          name = `${familyName} #${creature.id}`;
        }
        
        // Cache color lookup too
        const rootCreature = opts.world.getAnyCreatureById(rootId);
        if (rootCreature) {
          nameColor = `hsl(${rootCreature.genes.hue}, 70%, 70%)`;
        }
      }
      
      // Cache the result
      if (nameCache) {
        nameCache.set(creature.id, { name, color: nameColor });
      }
    }
    
    // Position above creature
    const offsetY = -creature.size - 8;
    
    ctx.save();
    ctx.font = `${Math.max(10, 12 * zoom)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    // Background for readability
    const metrics = ctx.measureText(name);
    const padding = 4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      creature.x - metrics.width / 2 - padding,
      creature.y + offsetY - 14 - padding,
      metrics.width + padding * 2,
      14 + padding * 2
    );
    
    // Draw name
    ctx.fillStyle = isSelected || isPinned ? '#7bb7ff' : nameColor;
    ctx.fillText(name, creature.x, creature.y + offsetY);
    ctx.restore();
  }

  _computeClusters(creatures, k=5) {
    if (creatures.length < k) return new Map();
    
    // OPTIMIZATION: Aggressive sampling for large populations
    // 100 samples is enough for visual clustering
    const maxSampleSize = 100;
    const sampleCreatures = creatures.length > maxSampleSize
      ? creatures.filter((_, i) => i % Math.ceil(creatures.length / maxSampleSize) === 0)
      : creatures;
    
    // Simple k-means clustering on [speed, metabolism, sense, aggression]
    // Pre-allocate feature array
    const features = new Array(sampleCreatures.length);
    for (let i = 0; i < sampleCreatures.length; i++) {
      const c = sampleCreatures[i];
      features[i] = [
        c.genes.speed / 2.0,
        c.genes.metabolism / 2.0,
        c.genes.sense / 200.0,
        (c.genes.aggression || 1.0) / 2.2
      ];
    }
    
    // Initialize centroids from first k features (deterministic, avoids Math.random overhead)
    const centroids = [];
    const step = Math.max(1, Math.floor(features.length / k));
    for (let i = 0; i < k; i++) {
      const idx = (i * step) % features.length;
      centroids.push([...features[idx]]);
    }
    
    // OPTIMIZATION: Single iteration often sufficient for visual clustering
    for (let iter = 0; iter < 1; iter++) {
      const assignments = features.map(f => {
        let minDist = Infinity;
        let cluster = 0;
        for (let i = 0; i < k; i++) {
          const dist = this._euclidean(f, centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            cluster = i;
          }
        }
        return cluster;
      });
      
      // Update centroids
      for (let i = 0; i < k; i++) {
        const clusterPoints = features.filter((_, idx) => assignments[idx] === i);
        if (clusterPoints.length > 0) {
          centroids[i] = this._mean(clusterPoints);
        }
      }
    }
    
    // Final assignment with color mapping
    const clusterColors = [0, 60, 120, 180, 240, 300]; // Evenly spaced hues
    const clusterMap = new Map();
    
    // OPTIMIZATION: Use efficient for loop for final assignment
    for (let idx = 0; idx < features.length; idx++) {
      const f = features[idx];
      let minDist = Infinity;
      let cluster = 0;
      for (let i = 0; i < k; i++) {
        const dist = this._euclidean(f, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          cluster = i;
        }
      }
      const hue = clusterColors[cluster];
      clusterMap.set(sampleCreatures[idx].id, hue);
    }
    
    // OPTIMIZATION: For sampled creatures, assign non-sampled creatures to nearest cluster
    if (creatures.length > maxSampleSize) {
      const sampledIds = new Set(sampleCreatures.map(c => c.id));
      for (let i = 0; i < creatures.length; i++) {
        const c = creatures[i];
        if (!sampledIds.has(c.id)) {
          // Find nearest sampled creature and use its cluster
          let nearestId = sampleCreatures[0].id;
          let nearestDist = Infinity;
          for (let j = 0; j < sampleCreatures.length; j++) {
            const sc = sampleCreatures[j];
            const dist = Math.abs(c.genes.speed - sc.genes.speed) +
                        Math.abs(c.genes.metabolism - sc.genes.metabolism);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestId = sc.id;
            }
          }
          clusterMap.set(c.id, clusterMap.get(nearestId));
        }
      }
    }
    
    return clusterMap;
  }

  _euclidean(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
  }

  _mean(points) {
    const dims = points[0].length;
    const mean = new Array(dims).fill(0);
    for (const p of points) {
      for (let i = 0; i < dims; i++) {
        mean[i] += p[i];
      }
    }
    return mean.map(v => v / points.length);
  }

  // ============================================================================
  // FEATURE VISUALIZATIONS
  // ============================================================================
  
  drawTerritories(world) {
    const ctx = this.ctx;
    
    // Draw territory circles
    for (const [id, territory] of world.territories.entries()) {
      const owner = world.registry.get(id);
      if (!owner || !owner.alive) continue;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(territory.x, territory.y, territory.radius, 0, Math.PI * 2);
      
      // Color based on rank
      const hue = territory.dominanceRank === 1 ? 0 : (territory.dominanceRank <= 3 ? 30 : 50);
      const alpha = territory.dominanceRank === 1 ? 0.15 : 0.08;
      ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.4)`;
      ctx.lineWidth = territory.dominanceRank === 1 ? 2 : 1;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      
      // Draw rank indicator
      if (territory.dominanceRank <= 3) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`#${territory.dominanceRank}`, territory.x - 8, territory.y + 6);
        ctx.restore();
      }
    }
    
    // Draw conflict zones
    for (const conflict of world.territoryConflicts) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(conflict.x, conflict.y, 20 * conflict.intensity, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 80, 80, ${conflict.intensity * 0.3})`;
      ctx.fill();
      ctx.restore();
    }
  }
  
  drawMemory(creature) {
    const ctx = this.ctx;
    
    for (const mem of creature.memory.locations) {
      ctx.save();
      const alpha = mem.strength * 0.6;
      let color;
      
      switch(mem.type) {
        case 'food':
          color = `rgba(100, 255, 100, ${alpha})`;
          break;
        case 'danger':
          color = `rgba(255, 100, 100, ${alpha})`;
          break;
        case 'safe':
          color = `rgba(100, 200, 255, ${alpha})`;
          break;
        default:
          color = `rgba(200, 200, 200, ${alpha})`;
      }
      
      ctx.beginPath();
      ctx.arc(mem.x, mem.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color.replace(String(alpha), String(alpha * 1.5));
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
  
  drawSocialBonds(world) {
    const ctx = this.ctx;
    
    for (const creature of world.creatures) {
      if (!creature.social || !creature.alive) continue;
      
      // Draw herding connections for herbivores
      if (!creature.genes.predator && creature.social.herdMates.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(150, 255, 150, 0.15)';
        ctx.lineWidth = 1;
        
        for (const mate of creature.social.herdMates.slice(0, 3)) {
          ctx.beginPath();
          ctx.moveTo(creature.x, creature.y);
          ctx.lineTo(mate.x, mate.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      
      // Draw pack connections for predators
      if (creature.genes.predator && creature.social.packTarget) {
        const target = world.getAnyCreatureById(creature.social.packTarget);
        if (target && target.alive) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 150, 150, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(creature.x, creature.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    }
  }
  
  drawMigration(world) {
    const ctx = this.ctx;
    
    for (const creature of world.creatures) {
      if (!creature.migration || !creature.alive) continue;
      if (creature.migration.targetBiome === null || creature.migration.settled) continue;
      if (!creature.target || !creature.target.migration) continue;
      
      // Draw line to migration target
      const targetX = creature.target.x;
      const targetY = creature.target.y;
      
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 200, 100, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 10]);
      
      ctx.beginPath();
      ctx.moveTo(creature.x, creature.y);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      
      // Draw arrow at target
      const dx = targetX - creature.x;
      const dy = targetY - creature.y;
      const angle = Math.atan2(dy, dx);
      ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
      ctx.translate(targetX, targetY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-10, -5);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();
      
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ============================================================================
  // ADVANCED FEATURE VISUALIZATIONS
  // ============================================================================
  
  drawEmotions(creature) {
    if (!creature.emotions) return;
    const ctx = this.ctx;
    const em = creature.emotions;
    
    // Draw emotional aura
    const dominantEmotion = this._getDominantEmotion(em);
    if (dominantEmotion.strength > 0.3) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(creature.x, creature.y, 25 + dominantEmotion.strength * 10, 0, Math.PI * 2);
      ctx.fillStyle = `${dominantEmotion.color.replace('1)', dominantEmotion.strength * 0.15 + ')')}`;
      ctx.fill();
      ctx.restore();
    }
    
    // Draw emotion bar chart next to creature
    const emotions = [
      { name: 'Fear', value: em.fear, color: 'rgba(255, 100, 100, 0.8)' },
      { name: 'Hunger', value: em.hunger, color: 'rgba(255, 200, 100, 0.8)' },
      { name: 'Confidence', value: em.confidence, color: 'rgba(100, 255, 100, 0.8)' },
      { name: 'Curiosity', value: em.curiosity, color: 'rgba(100, 200, 255, 0.8)' }
    ];
    
    ctx.save();
    const barX = creature.x + 40;
    const barY = creature.y - 30;
    const barWidth = 4;
    const barHeight = 30;
    
    emotions.forEach((e, i) => {
      const x = barX + i * 6;
      const h = e.value * barHeight;
      ctx.fillStyle = e.color;
      ctx.fillRect(x, barY + barHeight - h, barWidth, h);
      
      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '8px monospace';
      ctx.fillText(e.name[0], x, barY + barHeight + 10);
    });
    ctx.restore();
  }
  
  _getDominantEmotion(em) {
    const emotions = [
      { name: 'fear', strength: em.fear, color: 'rgba(255, 80, 80, 1)' },
      { name: 'stress', strength: em.stress, color: 'rgba(180, 80, 180, 1)' },
      { name: 'contentment', strength: em.contentment, color: 'rgba(100, 255, 150, 1)' },
      { name: 'curiosity', strength: em.curiosity, color: 'rgba(100, 200, 255, 1)' }
    ];
    
    return emotions.reduce((max, e) => e.strength > max.strength ? e : max, emotions[0]);
  }
  
  drawSensoryViz(world) {
    const ctx = this.ctx;
    
    for (const creature of world.creatures) {
      if (!creature.senseType || creature.senseType === 'normal') continue;
      
      const radius = creature.getEnhancedSenseRadius ? creature.getEnhancedSenseRadius() : creature.genes.sense;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(creature.x, creature.y, radius, 0, Math.PI * 2);
      
      let color;
      switch(creature.senseType) {
        case 'echolocation':
          color = 'rgba(200, 100, 255, 0.1)';
          break;
        case 'chemical':
          color = 'rgba(100, 255, 200, 0.1)';
          break;
        case 'thermal':
          color = 'rgba(255, 150, 100, 0.1)';
          break;
        default:
          color = 'rgba(200, 200, 200, 0.05)';
      }
      
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color.replace('0.1', '0.3');
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
  
  drawIntelligenceIndicators(world) {
    const ctx = this.ctx;
    
    for (const creature of world.creatures) {
      if (!creature.intelligence || creature.intelligence.level < 0.8) continue;
      
      // Show light bulb for intelligent creatures
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 100, ${creature.intelligence.level * 0.5})`;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('💡', creature.x - 6, creature.y - 15);
      
      // Show innovation count
      if (creature.intelligence.innovations > 0) {
        ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
        ctx.font = '10px sans-serif';
        ctx.fillText(`×${creature.intelligence.innovations}`, creature.x + 8, creature.y - 12);
      }
      ctx.restore();
    }
  }
  
  drawMatingDisplays(world) {
    const ctx = this.ctx;
    
    for (const creature of world.creatures) {
      if (!creature.sexuality || !creature.sexuality.isDisplaying) continue;
      
      // Draw sparkle/display animation
      const time = Date.now() * 0.005;
      const phase = Math.sin(time + creature.id) * 0.5 + 0.5;
      
      ctx.save();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time;
        const dist = 20 + phase * 10;
        const x = creature.x + Math.cos(angle) * dist;
        const y = creature.y + Math.sin(angle) * dist;
        
        ctx.fillStyle = `hsla(${(creature.genes.hue + i * 45) % 360}, 100%, 70%, ${phase * 0.8})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + phase * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Heart/display indicator
      ctx.fillStyle = 'rgba(255, 100, 150, 0.8)';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('💗', creature.x - 8, creature.y - 20);
      ctx.restore();
    }
  }

  drawMiniMap(world, opts) {
    const ctx = this.ctx;
    const camera = this.camera;
    
    // Auto-hide when camera is moving
    if (this.miniMapAutoHide && opts.cameraMoving) {
      this.miniMapTargetOpacity = 0.0;
    } else {
      this.miniMapTargetOpacity = 1.0;
    }
    
    // Smooth fade
    this.miniMapOpacity += (this.miniMapTargetOpacity - this.miniMapOpacity) * 0.15;
    
    // Skip drawing if fully transparent
    if (this.miniMapOpacity < 0.01) return;
    
    // Reset transform for overlay
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = this.miniMapOpacity;
    
    // Get canvas CSS size (for click handler matching) and DPR (for drawing coordinates)
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;
    const dpr = window.devicePixelRatio || 1;
    
    // FULLY FIXED: Show complete world with perfect aspect ratio
    const maxMapWidth = 220; // Larger for better visibility
    const maxMapHeight = 160;
    const aspectRatio = world.width / world.height; // 4000/2800 = 1.43
    
    // Calculate map size maintaining world aspect ratio
    let mapW, mapH;
    if (world.width / maxMapWidth > world.height / maxMapHeight) {
      // Width-constrained
      mapW = maxMapWidth;
      mapH = maxMapWidth / aspectRatio;
    } else {
      // Height-constrained
      mapH = maxMapHeight;
      mapW = maxMapHeight * aspectRatio;
    }
    
    // Calculate CSS pixel positions (for click handler)
    const cssMarginX = Math.max(16, Math.round(cssWidth * 0.015));
    const cssMarginY = Math.max(16, Math.round(cssHeight * 0.015));
    const mapXCss = cssWidth - mapW - cssMarginX;
    const mapYCss = cssHeight - mapH - cssMarginY;
    
    // Convert to canvas internal coordinates for drawing (scale by DPR)
    const mapX = mapXCss * dpr;
    const mapY = mapYCss * dpr;
    const mapWCanvas = mapW * dpr;
    const mapHCanvas = mapH * dpr;
    const scaleX = mapW / world.width;
    const scaleY = mapH / world.height;
    // Store CSS coordinates for click handler
    this.lastMiniMap = {
      x: mapXCss,
      y: mapYCss,
      width: mapW,
      height: mapH,
      scaleX,
      scaleY,
      worldWidth: world.width,
      worldHeight: world.height
    };
    
    // Background (darker, less distracting) - use scaled coordinates for drawing
    ctx.fillStyle = 'rgba(8, 10, 14, 0.95)';
    ctx.fillRect(mapX, mapY, mapWCanvas, mapHCanvas);

    const activeDisaster = (this.miniMapSettings.disaster && typeof world.getActiveDisaster === 'function')
      ? world.getActiveDisaster()
      : null;
    if (activeDisaster) {
      const tint = this._getDisasterTint(activeDisaster.type);
      if (tint) {
        ctx.fillStyle = tint;
        ctx.fillRect(mapX, mapY, mapWCanvas, mapHCanvas);
      }
    }
    
    // Draw biomes (MUCH more subtle - just hints of color)
    const sampleSize = 100; // Larger samples = less detail, easier to read
    ctx.globalAlpha = 0.2; // Very faint biome colors
    for (let y = 0; y < world.height; y += sampleSize) {
      for (let x = 0; x < world.width; x += sampleSize) {
        const biome = world.getBiomeAt(x, y);
        // STABILITY: Guard against undefined biome
        ctx.fillStyle = this._getBiomeTint(biome?.type);
        ctx.fillRect(
          mapX + x * scaleX * dpr,
          mapY + y * scaleY * dpr,
          Math.max(1, sampleSize * scaleX * dpr),
          Math.max(1, sampleSize * scaleY * dpr)
        );
      }
    }
    ctx.globalAlpha = 1;
    
    if (this.miniMapSettings.heatmap) {
      // OPTIMIZED: Draw creature population as HEAT MAP with caching
      const heatmapSize = 100;
      const heatmapW = Math.floor(heatmapSize * aspectRatio);
      const heatmapH = heatmapSize;
      
      // Check if we need to update the heatmap cache
      const cache = this._heatmapCache;
      this.performance.frameCount = (this.performance.frameCount || 0) + 1;
      const shouldUpdate = !cache.data || 
                          cache.width !== heatmapW || 
                          cache.height !== heatmapH ||
                          (this.performance.frameCount - cache.lastUpdate) >= cache.updateInterval;
      
      if (shouldUpdate) {
        // Reuse or create heatmap array
        if (!cache.data || cache.data.length !== heatmapW * heatmapH) {
          cache.data = new Uint8Array(heatmapW * heatmapH);
        } else {
          cache.data.fill(0);
        }
        cache.width = heatmapW;
        cache.height = heatmapH;
        cache.lastUpdate = this.performance.frameCount;
        
        // Populate heatmap
        for (const c of world.creatures) {
          const hx = Math.floor((c.x / world.width) * heatmapW);
          const hy = Math.floor((c.y / world.height) * heatmapH);
          if (hx >= 0 && hx < heatmapW && hy >= 0 && hy < heatmapH) {
            cache.data[hy * heatmapW + hx]++;
          }
        }
      }
      
      // Render cached heatmap (bright spots = high population)
      const heatmap = cache.data;
      for (let hy = 0; hy < heatmapH; hy++) {
        for (let hx = 0; hx < heatmapW; hx++) {
          const count = heatmap[hy * heatmapW + hx];
          if (count > 0) {
            const intensity = Math.min(count / 3, 1);
            ctx.fillStyle = `rgba(123, 183, 255, ${intensity * 0.8})`;
            const px = mapX + (hx / heatmapW) * mapWCanvas;
            const py = mapY + (hy / heatmapH) * mapHCanvas;
            const cellW = (mapWCanvas / heatmapW) * 1.5;
            const cellH = (mapHCanvas / heatmapH) * 1.5;
            ctx.fillRect(px, py, cellW, cellH);
          }
        }
      }
    }

    if (this.miniMapSettings.territories && world.territories && world.territories.size) {
      ctx.save();
      const scaleAvg = (scaleX + scaleY) * 0.5;
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)';
      ctx.lineWidth = 1.6;
      for (const territory of world.territories.values()) {
        const cx = mapX + territory.x * scaleX * dpr;
        const cy = mapY + territory.y * scaleY * dpr;
        const radius = territory.radius * scaleAvg * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (world.territoryConflicts && world.territoryConflicts.length) {
        ctx.fillStyle = 'rgba(248, 113, 113, 0.7)';
        for (const conflict of world.territoryConflicts) {
          const cx = mapX + conflict.x * scaleX * dpr;
          const cy = mapY + conflict.y * scaleY * dpr;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    
    // Draw camera view rectangle (YOUR LOCATION)
    const viewW = opts.viewportWidth / camera.zoom;
    const viewH = opts.viewportHeight / camera.zoom;
    const viewX = camera.x - viewW / 2;
    const viewY = camera.y - viewH / 2;
    
    ctx.strokeStyle = 'rgba(255, 255, 100, 0.9)'; // Yellow = more visible
    ctx.lineWidth = 2;
    ctx.strokeRect(
      mapX + viewX * scaleX * dpr,
      mapY + viewY * scaleY * dpr,
      viewW * scaleX * dpr,
      viewH * scaleY * dpr
    );

    const drawCreatureMarker = (id, fillStyle, strokeStyle, icon=null) => {
      if (!id) return;
      const creature = typeof world.getAnyCreatureById === 'function' ? world.getAnyCreatureById(id) : null;
      if (!creature) return;
      const mx = mapX + creature.x * scaleX * dpr;
      const my = mapY + creature.y * scaleY * dpr;
      ctx.save();
      ctx.translate(mx, my);
      ctx.fillStyle = fillStyle;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (icon) {
        ctx.fillStyle = strokeStyle;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, 0, 0);
      }
      ctx.restore();
    };

    drawCreatureMarker(opts.selectedId, 'rgba(250, 204, 21, 0.9)', 'rgba(251, 191, 36, 1)', '●');
    if (opts.pinnedId && opts.pinnedId !== opts.selectedId) {
      drawCreatureMarker(opts.pinnedId, 'rgba(167, 139, 250, 0.9)', 'rgba(129, 140, 248, 1)', '★');
    }
    if (activeDisaster && this.miniMapSettings.disaster) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `bold ${10 * dpr}px sans-serif`;
      ctx.fillText(
        `${activeDisaster.name} · ${Math.ceil(activeDisaster.timeRemaining ?? 0)}s`,
        mapX + 6 * dpr,
        mapY + 14 * dpr
      );
    }
    
    // Border with slight glow
    ctx.shadowColor = 'rgba(123, 183, 255, 0.3)';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(123, 183, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX - dpr, mapY - dpr, mapWCanvas + 2*dpr, mapHCanvas + 2*dpr);
    ctx.shadowBlur = 0;
    
    // Label
    ctx.fillStyle = 'rgba(200, 200, 220, 0.8)';
    ctx.font = `bold ${10 * dpr}px sans-serif`;
    ctx.fillText('WORLD MAP', mapX + 5 * dpr, mapY - 5 * dpr);
    
    // NEW: Draw biome labels at key locations
    this._drawBiomeLabels(world, mapX, mapY, scaleX, scaleY, dpr);
    
    ctx.restore();
  }
  
  // NEW: Draw biome labels on mini-map
  _drawBiomeLabels(world, mapX, mapY, scaleX, scaleY, dpr=1) {
    const ctx = this.ctx;
    const scaleXPx = scaleX * dpr;
    const scaleYPx = scaleY * dpr;
    
    // Sample biomes at key locations
    const samplePoints = [
      { x: world.width * 0.15, y: world.height * 0.15 },
      { x: world.width * 0.85, y: world.height * 0.15 },
      { x: world.width * 0.5, y: world.height * 0.5 },
      { x: world.width * 0.15, y: world.height * 0.85 },
      { x: world.width * 0.85, y: world.height * 0.85 }
    ];
    
    const drawnBiomes = new Set();
    
    for (const point of samplePoints) {
      const biome = world.getBiomeAt(point.x, point.y);
      // STABILITY: Guard against undefined biome or type
      const biomeType = biome?.type;
      if (!biome || !biomeType || drawnBiomes.has(biomeType)) continue;
      
      drawnBiomes.add(biomeType);
      
      const mx = mapX + point.x * scaleXPx;
      const my = mapY + point.y * scaleYPx;
      
      ctx.save();
      ctx.font = `bold ${8 * dpr}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 2 * dpr;
      
      // biomeType already defined above with guard
      const label = (biomeType || 'unknown').charAt(0).toUpperCase() + (biomeType || 'unknown').slice(1);
      ctx.strokeText(label, mx, my);
      ctx.fillText(label, mx, my);
      ctx.restore();
    }
  }

  _getDisasterTint(type) {
    switch (type) {
      case 'meteorStorm': return 'rgba(248, 113, 113, 0.18)';
      case 'iceAge': return 'rgba(96, 165, 250, 0.18)';
      case 'plague': return 'rgba(192, 132, 252, 0.18)';
      case 'drought': return 'rgba(250, 204, 21, 0.16)';
      default: return null;
    }
  }
}
