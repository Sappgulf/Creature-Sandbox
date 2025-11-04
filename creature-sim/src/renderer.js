import { clamp } from './utils.js';

export class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;
    
    // Detect mobile for performance optimizations
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                    (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    
    // LEGENDARY OPTIMIZATION: Enable image smoothing for better quality
    // On mobile, use lower quality for better performance
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = this.isMobile ? 'medium' : 'high';
    
    // Mobile-optimized default settings
    this.enableTrails = !this.isMobile; // Trails disabled on mobile for performance
    this.enableVision = false;
    this.enableClustering = false;
    this.enableTerritories = false; // Feature 1
    this.enableMemory = false; // Feature 2
    this.enableSocialBonds = false; // Feature 4
    this.enableMigration = false; // Feature 9
    this.enableEmotions = false; // Advanced Feature 1
    this.enableSensoryViz = false; // Advanced Feature 2
    this.enableIntelligence = false; // Advanced Feature 3
    this.enableMating = false; // Advanced Feature 4
    this.enableMiniMap = !this.isMobile; // Mini-map disabled on mobile
    this.enableAtmosphere = !this.isMobile; // Atmospheric rendering disabled on mobile
    this.enableWeather = !this.isMobile; // Weather effects disabled on mobile
    this.enableDayNight = true; // Day/night cycle
    this.background = '#0b0c10';
    this.lastMiniMap = null; // Cache latest mini-map bounds for interaction
    this.miniMapSettings = {
      heatmap: true,
      disaster: true,
      territories: true
    };
    
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

  drawWorld(world, opts={}) {
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
    ctx.translate(opts.viewportWidth/2, opts.viewportHeight/2);
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
    
    // Draw mini-map overlay (top-right corner)
    if (this.enableMiniMap) {
      this.drawMiniMap(world, opts);
    } else {
      this.lastMiniMap = null;
    }
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
    
    // Base background (natural green/brown gradient)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, world.height);
    bgGradient.addColorStop(0, '#1a2520');
    bgGradient.addColorStop(0.5, '#15201a');
    bgGradient.addColorStop(1, '#0f1812');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, world.width, world.height);
    
    // SUBTLE biome tinting (like atmospheric fog, not solid colors!)
    ctx.globalCompositeOperation = 'overlay'; // Blend mode for subtle effect
    
    for (let y = Math.max(0, bounds.y1); y < Math.min(world.height, bounds.y2); y += sampleSize) {
      for (let x = Math.max(0, bounds.x1); x < Math.min(world.width, bounds.x2); x += sampleSize) {
        const biome = world.getBiomeAt(x, y);
        
        // Very subtle color tint based on biome (like ambient lighting)
        const tintColor = this._getBiomeTint(biome.type);
        ctx.fillStyle = tintColor;
        
        // Low opacity - just a hint of color
        const baseAlpha = 0.08;
        const moistureInfluence = biome.moisture * 0.03;
        ctx.globalAlpha = baseAlpha + moistureInfluence;
        
        // Draw with soft edges (larger tiles, subtle effect)
        ctx.fillRect(x, y, sampleSize + 1, sampleSize + 1);
      }
    }
    
    ctx.globalCompositeOperation = 'source-over'; // Reset blend mode
    ctx.globalAlpha = 1;
    
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
      case 'meadow': return 'rgba(154, 205, 50, 0.6)'; // Yellow-green
      case 'grassland':
      default: return 'rgba(107, 142, 35, 0.5)'; // Olive
    }
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
      ctx.fillStyle = `rgba(0, 10, 30, ${darkness})`;
      ctx.fillRect(0, 0, world.width, world.height);
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
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, world.width, world.height);
    }
  }
  
  _drawWeatherEffects(world) {
    // Placeholder for weather particles (rain, snow, dust)
    // Will be enhanced with particle system
  }

  drawFood(food) {
    if (food.length === 0) return;
    const ctx = this.ctx;
    
    // NEW: Group food by type for batched rendering
    const byType = { grass: [], berries: [], fruit: [] };
    for (let i = 0; i < food.length; i++) {
      const f = food[i];
      const type = f.type || 'grass';
      if (byType[type]) {
        byType[type].push(f);
      }
    }
    
    // Draw each vegetation type with its color
    for (const [type, items] of Object.entries(byType)) {
      if (items.length === 0) continue;
      
      // Set color based on type
      const firstItem = items[0];
      ctx.fillStyle = firstItem.color || 'rgba(126,210,120,0.85)';
      
      // Batch draw all items of this type
      ctx.beginPath();
      for (const f of items) {
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
      }
      ctx.fill();
      
      // Add visual distinction for rare types
      if (type === 'fruit') {
        // Draw stem/leaf for fruit trees
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const f of items) {
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
    
    // Compute clusters if clustering is enabled
    let clusterMap = null;
    if (this.enableClustering) {
      const currentFrame = Math.floor(worldTime);
      if (this._clusterCache.frame !== currentFrame) {
        this._clusterCache.clusters = this._computeClusters(creatures);
        this._clusterCache.frame = currentFrame;
      }
      clusterMap = this._clusterCache.clusters;
    }
    
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
      
      // IMPROVED VISIBILITY: Draw shadow first (depth & contrast)
      this._drawCreatureShadow(c);
      
      // Override hue if clustering is enabled
      const clusterHue = clusterMap ? clusterMap.get(c.id) : null;
      
      c.draw(ctx, {
        isSelected,
        isPinned,
        inLineage,
        showTrail: this.enableTrails,
        showVision: this.enableVision,
        clusterHue
      });
      
      // IMPROVED VISIBILITY: Subtle outline/glow for better contrast
      if (this.camera.zoom > 0.5) {
        this._drawCreatureOutline(c, isSelected);
      }
      
      // NEW: Draw name label above creature
      if (this.enableNameLabels && this.camera.zoom > 0.3) {
        this._drawCreatureName(c, isSelected, isPinned, opts);
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
  
  _drawCreatureName(creature, isSelected, isPinned, opts) {
    // Draw creature name/ID above it
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    
    // Only show names when zoomed in enough or for selected creatures
    if (zoom < 0.4 && !isSelected && !isPinned) return;
    
    // Get creature name (from lineage tracker if available)
    let name = `#${creature.id}`;
    if (opts.lineageTracker) {
      const rootId = opts.lineageTracker.getRoot(opts.world, creature.id);
      const familyName = opts.lineageTracker.names.get(rootId);
      if (familyName) {
        name = `${familyName} #${creature.id}`;
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
    
    // Color-code by family (use hue from root creature)
    let nameColor = '#ffffff';
    if (opts.lineageTracker) {
      const rootId = opts.lineageTracker.getRoot(opts.world, creature.id);
      const rootCreature = opts.world.getAnyCreatureById(rootId);
      if (rootCreature) {
        nameColor = `hsl(${rootCreature.genes.hue}, 70%, 70%)`;
      }
    }
    
    // Draw name
    ctx.fillStyle = isSelected || isPinned ? '#7bb7ff' : nameColor;
    ctx.fillText(name, creature.x, creature.y + offsetY);
    ctx.restore();
  }

  _computeClusters(creatures, k=5) {
    if (creatures.length < k) return new Map();
    
    // Simple k-means clustering on [speed, metabolism, sense, aggression]
    const features = creatures.map(c => [
      c.genes.speed / 2.0,
      c.genes.metabolism / 2.0,
      c.genes.sense / 200.0,
      (c.genes.aggression || 1.0) / 2.2
    ]);
    
    // Initialize centroids randomly
    const centroids = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(Math.random() * features.length);
      centroids.push([...features[idx]]);
    }
    
    // Run k-means for 3 iterations (fast, good enough)
    for (let iter = 0; iter < 3; iter++) {
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
    features.forEach((f, idx) => {
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
      clusterMap.set(creatures[idx].id, hue);
    });
    
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
    
    // Reset transform for overlay
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
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
    
    const mapX = opts.viewportWidth - mapW - 16;
    const mapY = opts.viewportHeight - mapH - 16;
    const scaleX = mapW / world.width;
    const scaleY = mapH / world.height;
    this.lastMiniMap = {
      x: mapX,
      y: mapY,
      width: mapW,
      height: mapH,
      scaleX,
      scaleY,
      worldWidth: world.width,
      worldHeight: world.height
    };
    
    // Background (darker, less distracting)
    ctx.fillStyle = 'rgba(8, 10, 14, 0.95)';
    ctx.fillRect(mapX, mapY, mapW, mapH);

    const activeDisaster = (this.miniMapSettings.disaster && typeof world.getActiveDisaster === 'function')
      ? world.getActiveDisaster()
      : null;
    if (activeDisaster) {
      const tint = this._getDisasterTint(activeDisaster.type);
      if (tint) {
        ctx.fillStyle = tint;
        ctx.fillRect(mapX, mapY, mapW, mapH);
      }
    }
    
    // Draw biomes (MUCH more subtle - just hints of color)
    const sampleSize = 100; // Larger samples = less detail, easier to read
    ctx.globalAlpha = 0.2; // Very faint biome colors
    for (let y = 0; y < world.height; y += sampleSize) {
      for (let x = 0; x < world.width; x += sampleSize) {
        const biome = world.getBiomeAt(x, y);
        ctx.fillStyle = this._getBiomeTint(biome.type);
        ctx.fillRect(
          mapX + x * scaleX,
          mapY + y * scaleY,
          Math.max(1, sampleSize * scaleX),
          Math.max(1, sampleSize * scaleY)
        );
      }
    }
    ctx.globalAlpha = 1;
    
    if (this.miniMapSettings.heatmap) {
      // Draw creature population as HEAT MAP (more readable!)
      const heatmapSize = 100; // Match world aspect ratio
      const heatmapW = Math.floor(heatmapSize * aspectRatio);
      const heatmapH = heatmapSize;
      const heatmap = new Uint8Array(heatmapW * heatmapH);
      
      for (const c of world.creatures) {
        const hx = Math.floor((c.x / world.width) * heatmapW);
        const hy = Math.floor((c.y / world.height) * heatmapH);
        if (hx >= 0 && hx < heatmapW && hy >= 0 && hy < heatmapH) {
          heatmap[hy * heatmapW + hx]++;
        }
      }
      
      // Render heatmap (bright spots = high population)
      for (let hy = 0; hy < heatmapH; hy++) {
        for (let hx = 0; hx < heatmapW; hx++) {
          const count = heatmap[hy * heatmapW + hx];
          if (count > 0) {
            const intensity = Math.min(count / 3, 1); // Cap intensity
            ctx.fillStyle = `rgba(123, 183, 255, ${intensity * 0.8})`;
            const px = mapX + (hx / heatmapW) * mapW;
            const py = mapY + (hy / heatmapH) * mapH;
            const cellW = (mapW / heatmapW) * 1.5;
            const cellH = (mapH / heatmapH) * 1.5;
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
        const cx = mapX + territory.x * scaleX;
        const cy = mapY + territory.y * scaleY;
        const radius = territory.radius * scaleAvg;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (world.territoryConflicts && world.territoryConflicts.length) {
        ctx.fillStyle = 'rgba(248, 113, 113, 0.7)';
        for (const conflict of world.territoryConflicts) {
          const cx = mapX + conflict.x * scaleX;
          const cy = mapY + conflict.y * scaleY;
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
      mapX + viewX * scaleX,
      mapY + viewY * scaleY,
      viewW * scaleX,
      viewH * scaleY
    );

    const drawCreatureMarker = (id, fillStyle, strokeStyle, icon=null) => {
      if (!id) return;
      const creature = typeof world.getAnyCreatureById === 'function' ? world.getAnyCreatureById(id) : null;
      if (!creature) return;
      const mx = mapX + creature.x * scaleX;
      const my = mapY + creature.y * scaleY;
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
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(
        `${activeDisaster.name} · ${Math.ceil(activeDisaster.timeRemaining ?? 0)}s`,
        mapX + 6,
        mapY + 14
      );
    }
    
    // Border with slight glow
    ctx.shadowColor = 'rgba(123, 183, 255, 0.3)';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(123, 183, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX - 1, mapY - 1, mapW + 2, mapH + 2);
    ctx.shadowBlur = 0;
    
    // Label
    ctx.fillStyle = 'rgba(200, 200, 220, 0.8)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('WORLD MAP', mapX + 5, mapY - 5);
    
    // NEW: Draw biome labels at key locations
    this._drawBiomeLabels(world, mapX, mapY, mapW, mapH, scaleX, scaleY);
    
    ctx.restore();
  }
  
  // NEW: Draw biome labels on mini-map
  _drawBiomeLabels(world, mapX, mapY, mapW, mapH, scaleX, scaleY) {
    const ctx = this.ctx;
    
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
      if (!biome || drawnBiomes.has(biome.type)) continue;
      
      drawnBiomes.add(biome.type);
      
      const mx = mapX + point.x * scaleX;
      const my = mapY + point.y * scaleY;
      
      ctx.save();
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      
      const label = biome.type.charAt(0).toUpperCase() + biome.type.slice(1);
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
