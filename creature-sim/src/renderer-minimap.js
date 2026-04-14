export function applyMinimapMethods(Renderer) {
  Renderer.prototype.drawMiniMap = function(world, opts) {
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

    const drawCreatureMarker = (id, fillStyle, strokeStyle, icon = null) => {
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
    ctx.strokeRect(mapX - dpr, mapY - dpr, mapWCanvas + 2 * dpr, mapHCanvas + 2 * dpr);
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = 'rgba(200, 200, 220, 0.8)';
    ctx.font = `bold ${10 * dpr}px sans-serif`;
    ctx.fillText('WORLD MAP', mapX + 5 * dpr, mapY - 5 * dpr);

    // NEW: Draw biome labels at key locations
    this._drawBiomeLabels(world, mapX, mapY, scaleX, scaleY, dpr);

    ctx.restore();
  };

  // NEW: Draw biome labels on mini-map
  Renderer.prototype._drawBiomeLabels = function(world, mapX, mapY, scaleX, scaleY, dpr = 1) {
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
  };

  Renderer.prototype._getDisasterTint = function(type) {
    switch (type) {
      case 'meteorStorm': return 'rgba(248, 113, 113, 0.18)';
      case 'iceAge': return 'rgba(96, 165, 250, 0.18)';
      case 'plague': return 'rgba(192, 132, 252, 0.18)';
      case 'drought': return 'rgba(250, 204, 21, 0.16)';
      default: return null;
    }
  };
}
