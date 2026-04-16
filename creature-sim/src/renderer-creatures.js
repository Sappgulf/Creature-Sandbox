import { clamp } from './utils.js';

export function applyCreatureMethods(Renderer) {
  Renderer.prototype.drawCreatures = function(world, opts) {
    if (!world || !world.creatures) return;
    const ctx = this.ctx;
    const { worldTime = 0 } = opts;
    const creatures = world.creatures;

    // Support either spatial grid query or direct array access (fallback)
    let visibleCreatures;
    if (world.creatureManager?.creatureGrid) {
      visibleCreatures = world.creatureManager.creatureGrid.queryRect(
        this._viewBounds.x1,
        this._viewBounds.y1,
        this._viewBounds.x2,
        this._viewBounds.y2
      );
    } else {
      // Proxy mode or world without grid
      visibleCreatures = this._visibleCreatures;
      visibleCreatures.length = 0;
      for (let i = 0; i < creatures.length; i++) {
        const c = creatures[i];
        if (c.x >= this._viewBounds.x1 && c.x <= this._viewBounds.x2 &&
            c.y >= this._viewBounds.y1 && c.y <= this._viewBounds.y2) {
          visibleCreatures.push(c);
        }
      }
    }

    // Reset local counts (for legacy debug or internal tracking)
    this.renderedCount = 0;
    this.culledCount = 0;

    // OPTIMIZATION: Cache zoom first (used by multiple checks below)
    const zoom = this.camera.zoom;

    // Update performance stats
    this.performance.stats.totalObjects += creatures.length;
    // (Actual rendered/culled will be updated in the loop below)

    // Ensure selected/pinned creatures are rendered even if results are truncated or edge-cases
    // (queryRect usually handles this but we want to be safe for UI consistency)
    let finalRenderList = visibleCreatures;
    if (opts.selectedId || opts.pinnedId) {
      const renderList = this._renderList;
      renderList.length = 0;
      for (let i = 0; i < visibleCreatures.length; i++) {
        renderList.push(visibleCreatures[i]);
      }

      const appendIfMissing = (candidate) => {
        if (!candidate || !candidate.alive) return;
        for (let i = 0; i < renderList.length; i++) {
          if (renderList[i].id === candidate.id) return;
        }
        renderList.push(candidate);
      };

      if (opts.selectedId) {
        appendIfMissing(world.getAnyCreatureById(opts.selectedId));
      }
      if (opts.pinnedId) {
        appendIfMissing(world.getAnyCreatureById(opts.pinnedId));
      }

      finalRenderList = renderList;
    }

    // OPTIMIZATION: Throttle clustering - only compute every 60 frames (~1Hz)
    let clusterMap = null;
    if (this.enableClustering && zoom > 0.3) {
      const currentFrame = Math.floor(worldTime * 0.25);
      if (this._clusterCache.frame !== currentFrame) {
        this._clusterCache.clusters = this._computeClusters(creatures);
        this._clusterCache.frame = currentFrame;
      }
      clusterMap = this._clusterCache.clusters;
    }

    const showShadows = zoom > 0.4;
    const showOutlines = zoom > 0.5;
    const showTrails = this.enableTrails && zoom > 0.6;
    const showNames = this.enableNameLabels && zoom > 0.5;

    const nameCacheKey = `${opts.selectedId}-${opts.pinnedId}-${Math.floor(zoom * 10)}`;
    if (!this._nameCache || this._nameCache.key !== nameCacheKey) {
      this._nameCache = { key: nameCacheKey, map: new Map() };
    }
    const nameCache = this._nameCache.map;

    for (let i = 0; i < finalRenderList.length; i++) {
      const c = finalRenderList[i];

      const isSelected = opts.selectedId === c.id;
      const isPinned = opts.pinnedId === c.id;
      const isHovered = opts.hoveredId === c.id;
      const isGrabbed = Boolean(c.isGrabbed);

      this.renderedCount++;

      const inLineage = opts.lineageSet ? opts.lineageSet.has(c.id) : false;
      const alpha = clamp((c.energy || 40) / 40, 0.25, 1);

      if (alpha < 0.99) {
        ctx.save();
        ctx.globalAlpha = alpha;
      }

      const clusterHue = clusterMap ? clusterMap.get(c.id) : null;

      // Get day/night light level for creature lighting
      const dayNight = world?.dayNightState || world?.environment?.getDayNightState?.();
      const dayLight = dayNight?.light ?? 1;

      const renderOpts = {
        isSelected,
        isPinned,
        inLineage,
        showTrail: showTrails,
        showVision: this.enableVision,
        clusterHue,
        zoom,
        worldTime,
        dayLight
      };

      // PERFORMANCE: Level of Detail (LOD) handling
      if (zoom < 0.25 && !isSelected && !isPinned) {
        // ULTRA LOW LOD: Just a tiny dot
        ctx.fillStyle = `hsl(${clusterHue ?? c.genes?.hue ?? 0}, 80%, 60%)`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (zoom < 0.6 && !isSelected && !isPinned) {
        // MEDIUM LOD: Simplified shape (Triangle)
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.dir || 0);
        ctx.fillStyle = `hsl(${clusterHue ?? c.genes?.hue ?? 0}, 85%, 60%)`;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, 3.5);
        ctx.lineTo(-4, -3.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // HIGH LOD: Full rendering
        if (showShadows && (isSelected || isPinned || zoom > 0.6)) {
          this._drawCreatureShadow(c);
        }

        if (c.draw) {
          c.draw(ctx, renderOpts);
        } else {
          // Fallback if creature is just a data object (Proxy Mode)
          this._drawExplicit(ctx, c, renderOpts);
        }

        if (c.statuses?.has?.('disease') && zoom > 0.3) {
          this._drawDiseaseEffect(c, worldTime);
        }
      }

      if (showOutlines && (isSelected || isPinned || isHovered || isGrabbed)) {
        if (isSelected || isPinned) {
          this._drawCreatureOutline(c, isSelected, opts.selectionPulseUntil);
        } else if (isGrabbed) {
          this._drawCreatureGrabbedOutline(c);
        } else if (isHovered) {
          this._drawCreatureHoverOutline(c);
        }
      }

      if (showNames && (isSelected || isPinned || zoom > 1.2)) {
        this._drawCreatureName(c, isSelected, isPinned, opts, nameCache);
      }

      if (alpha < 0.99) {
        ctx.restore();
      }
    }

    this.culledCount = creatures.length - this.renderedCount;
    this.performance.stats.rendered += this.renderedCount;
    this.performance.stats.culled += this.culledCount;
  };

  /**
   * Data-driven creature drawing for Proxy Mode / Fallback
   */
  Renderer.prototype._drawExplicit = function(ctx, c, opts) {
    const { isSelected, isPinned, clusterHue, zoom: _zoom } = opts;
    const g = c.genes || {};
    const hue = clusterHue !== null ? clusterHue : g.hue || 0;

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.dir || 0);

    const r = ((c.energy || 40) / 40) * (3 + (c.size || 5));

    // Draw simple triangle as high-detail fallback
    ctx.fillStyle = `hsl(${hue}, 85%, ${g.predator ? 45 : 60}%)`;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, r * 0.6);
    ctx.lineTo(-r * 0.8, -r * 0.6);
    ctx.closePath();
    ctx.fill();

    if (isSelected || isPinned) {
      ctx.strokeStyle = isSelected ? 'white' : 'skyblue';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  };

  Renderer.prototype._drawCreatureShadow = function(creature) {
    // Enhanced dynamic shadow with biome/time-of-day awareness
    const ctx = this.ctx;
    const r = creature.size || creature.genes?.size || 5;
    const g = creature.genes;

    ctx.save();

    // Shadow opacity varies by time of day and creature
    let shadowAlpha = 0.25;
    let shadowColor = 'rgba(0, 0, 0';

    // Adjust shadow based on creature hue (lighter creatures have lighter shadows)
    if (g) {
      const lightness = g.lightness || 50;
      // Creatures with high lightness have softer shadows
      if (lightness > 60) {
        shadowAlpha = 0.15;
        shadowColor = 'rgba(30, 30, 40';
      } else if (lightness < 35) {
        shadowAlpha = 0.35;
        shadowColor = 'rgba(0, 0, 0';
      }
    }

    // Elemental creatures have colored shadows
    if (g?.elementalAffinity) {
      switch (g.elementalAffinity) {
        case 'fire': shadowColor = 'rgba(80, 20, 0'; break;
        case 'ice': shadowColor = 'rgba(40, 80, 120'; break;
        case 'electric': shadowColor = 'rgba(100, 100, 0'; break;
        case 'earth': shadowColor = 'rgba(60, 40, 20'; break;
      }
    }

    // Bioluminescent creatures have ethereal shadows
    const rareMutations = creature.rareMutations || creature.mutations || [];
    const hasBioGlow = rareMutations.some(m => m.name === 'Bioluminescence');
    if (hasBioGlow) {
      shadowAlpha = 0.12;
      shadowColor = 'rgba(0, 80, 60';
    }

    ctx.globalAlpha = shadowAlpha;
    ctx.fillStyle = `${shadowColor}, ${shadowAlpha})`;

    // Dynamic shadow offset based on creature velocity (shadow stretches when moving)
    const speed = Math.sqrt((creature.vx || 0) ** 2 + (creature.vy || 0) ** 2);
    const stretchFactor = Math.min(speed / 100, 0.5);
    const offsetX = 2 + stretchFactor * 2;
    const offsetY = 3 + stretchFactor * 1;

    // Shadow scale based on creature height (larger = more prominent shadow)
    const heightFactor = creature.baseSize ? creature.baseSize / 10 : 1;

    ctx.beginPath();
    ctx.ellipse(
      creature.x + offsetX,
      creature.y + offsetY,
      r * 1.1 * (1 + stretchFactor * 0.3),
      r * 0.6 * (1 - stretchFactor * 0.15) * heightFactor,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  };

  Renderer.prototype._drawCreatureOutline = function(creature, isSelected, selectionPulseUntil = null) {
    // Subtle outline for contrast (not too thick!)
    const ctx = this.ctx;
    const r = creature.size || creature.genes?.size || 5;
    const now = performance.now();
    const pulseActive = isSelected && typeof selectionPulseUntil === 'number' && now < selectionPulseUntil;
    const pulseProgress = pulseActive
      ? 1 - (selectionPulseUntil - now) / 400
      : 0;
    const pulseScale = pulseActive ? 1 + Math.sin(pulseProgress * Math.PI) * 0.25 : 1;

    ctx.save();
    ctx.strokeStyle = isSelected ? 'rgba(123, 183, 255, 0.75)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = isSelected ? 2.2 : 1;
    if (isSelected) {
      ctx.shadowColor = 'rgba(123, 183, 255, 0.45)';
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.arc(creature.x, creature.y, (r + 1) * pulseScale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype._drawCreatureHoverOutline = function(creature) {
    const ctx = this.ctx;
    const r = creature.size || creature.genes?.size || 5;
    const now = performance.now();
    const pulse = 0.6 + Math.sin(now * 0.006) * 0.15;

    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(creature.x, creature.y, r + 2.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype._drawCreatureGrabbedOutline = function(creature) {
    const ctx = this.ctx;
    const r = creature.size || creature.genes?.size || 5;
    const now = performance.now();
    const pulse = 0.7 + Math.sin(now * 0.01) * 0.2;

    ctx.save();
    ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
    ctx.lineWidth = 2.1;
    ctx.shadowColor = 'rgba(250, 204, 21, 0.45)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(creature.x, creature.y, r + 2.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  /**
   * Draw disease visual effect for sick creatures
   * @param {object} creature - The creature to draw effect for
   * @param {number} worldTime - Current world time for animation
   */
  Renderer.prototype._drawDiseaseEffect = function(creature, worldTime) {
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
  };

  Renderer.prototype._drawCreatureName = function(creature, isSelected, isPinned, opts, nameCache = null) {
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
  };

  Renderer.prototype._computeClusters = function(creatures, k = 5) {
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
  };

  Renderer.prototype._euclidean = function(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
  };

  Renderer.prototype._mean = function(points) {
    const dims = points[0].length;
    const mean = new Array(dims).fill(0);
    for (const p of points) {
      for (let i = 0; i < dims; i++) {
        mean[i] += p[i];
      }
    }
    return mean.map(v => v / points.length);
  };
}
