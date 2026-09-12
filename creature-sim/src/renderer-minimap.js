export function applyMinimapMethods(Renderer) {
  const numericDiet = value => {
    if (value && typeof value === 'object') {
      const expressed = Number(value.expressed ?? value.value ?? value.mean);
      return Number.isFinite(expressed) ? expressed : 0;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    return value ? 1 : 0;
  };

  const createLayerCanvas = (width, height) => {
    const safeWidth = Math.max(1, Math.ceil(width));
    const safeHeight = Math.max(1, Math.ceil(height));
    const canvas = document.createElement('canvas');
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    return canvas;
  };

  Renderer.prototype.drawMiniMap = function (world, opts = {}) {
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

    // Backing-store scale: derive it from the canvas instead of assuming
    // window.devicePixelRatio, because adaptive resolution can render at
    // 1/1.25/1.5/1.75/etc. A mismatched dpr offsets the minimap and breaks
    // its click mapping.
    const layoutWidth = Number(opts.viewportWidth || this._viewportWidth || 0);
    const dpr = layoutWidth > 0 ? this.ctx.canvas.width / layoutWidth : window.devicePixelRatio || 1;
    const layout = this._getMiniMapLayout(world, opts, dpr);
    const { mapXCss, mapYCss, mapX, mapY, mapW, mapH, mapWCanvas, mapHCanvas, scaleX, scaleY, aspectRatio } = layout;
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

    // Panel background: rounded, with a soft top-light so the map reads as a
    // framed instrument instead of a flat rectangle.
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(mapX, mapY, mapWCanvas, mapHCanvas, 8 * dpr);
    } else {
      ctx.rect(mapX, mapY, mapWCanvas, mapHCanvas);
    }
    const panelGradient = ctx.createLinearGradient(0, mapY, 0, mapY + mapHCanvas);
    panelGradient.addColorStop(0, 'rgba(14, 20, 30, 0.97)');
    panelGradient.addColorStop(1, 'rgba(6, 9, 14, 0.97)');
    ctx.fillStyle = panelGradient;
    ctx.fill();
    ctx.restore();

    const activeDisaster =
      this.miniMapSettings.disaster && typeof world.getActiveDisaster === 'function' ? world.getActiveDisaster() : null;
    if (activeDisaster) {
      const tint = this._getDisasterTint(activeDisaster.type);
      if (tint) {
        ctx.fillStyle = tint;
        ctx.fillRect(mapX, mapY, mapWCanvas, mapHCanvas);
      }
    }

    // Draw cached static biome layer. Biomes do not change during normal play,
    // so avoid resampling 1000+ cells every frame.
    const biomeLayer = this._getMiniMapBiomeLayer(world, layout);
    ctx.globalAlpha = 1;
    if (biomeLayer) {
      ctx.drawImage(biomeLayer, mapX, mapY, mapWCanvas, mapHCanvas);
    }

    // Region grid every 1000 world units for navigation reference.
    ctx.save();
    ctx.strokeStyle = 'rgba(150, 180, 220, 0.1)';
    ctx.lineWidth = Math.max(1, dpr * 0.75);
    ctx.beginPath();
    for (let gx = 1000; gx < world.width; gx += 1000) {
      const x = mapX + gx * scaleX * dpr;
      ctx.moveTo(x, mapY);
      ctx.lineTo(x, mapY + mapHCanvas);
    }
    for (let gy = 1000; gy < world.height; gy += 1000) {
      const y = mapY + gy * scaleY * dpr;
      ctx.moveTo(mapX, y);
      ctx.lineTo(mapX + mapWCanvas, y);
    }
    ctx.stroke();
    ctx.restore();

    if (this.miniMapSettings.heatmap) {
      // OPTIMIZED: Draw creature population as HEAT MAP with caching
      const heatmapSize = 100;
      const heatmapW = Math.floor(heatmapSize * aspectRatio);
      const heatmapH = heatmapSize;
      const heatmapCanvasW = Math.max(1, Math.ceil(mapWCanvas));
      const heatmapCanvasH = Math.max(1, Math.ceil(mapHCanvas));

      // Check if we need to update the heatmap cache
      const cache = this._heatmapCache;
      this.performance.frameCount = (this.performance.frameCount || 0) + 1;
      const shouldUpdate =
        !cache.data ||
        cache.width !== heatmapW ||
        cache.height !== heatmapH ||
        cache.canvasWidth !== heatmapCanvasW ||
        cache.canvasHeight !== heatmapCanvasH ||
        this.performance.frameCount - cache.lastUpdate >= cache.updateInterval;

      if (shouldUpdate) {
        // Reuse or create heatmap array
        if (!cache.data || cache.data.length !== heatmapW * heatmapH) {
          cache.data = new Uint8Array(heatmapW * heatmapH);
        } else {
          cache.data.fill(0);
        }
        cache.width = heatmapW;
        cache.height = heatmapH;
        cache.canvasWidth = heatmapCanvasW;
        cache.canvasHeight = heatmapCanvasH;
        cache.lastUpdate = this.performance.frameCount;

        // Populate heatmap
        for (const c of world.creatures) {
          const hx = Math.floor((c.x / world.width) * heatmapW);
          const hy = Math.floor((c.y / world.height) * heatmapH);
          if (hx >= 0 && hx < heatmapW && hy >= 0 && hy < heatmapH) {
            const index = hy * heatmapW + hx;
            cache.data[index] = Math.min(cache.data[index] + 1, 255);
          }
        }

        if (!cache.canvas || cache.canvas.width !== heatmapCanvasW || cache.canvas.height !== heatmapCanvasH) {
          cache.canvas = createLayerCanvas(heatmapCanvasW, heatmapCanvasH);
        }
        const heatmapCtx = cache.canvas.getContext('2d');
        if (heatmapCtx) {
          heatmapCtx.clearRect(0, 0, heatmapCanvasW, heatmapCanvasH);
          const heatmap = cache.data;
          const cellW = (heatmapCanvasW / heatmapW) * 1.5;
          const cellH = (heatmapCanvasH / heatmapH) * 1.5;
          for (let hy = 0; hy < heatmapH; hy++) {
            for (let hx = 0; hx < heatmapW; hx++) {
              const count = heatmap[hy * heatmapW + hx];
              if (count > 0) {
                const intensity = Math.min(count / 3, 1);
                heatmapCtx.fillStyle = `rgba(123, 183, 255, ${intensity * 0.5})`;
                heatmapCtx.fillRect((hx / heatmapW) * heatmapCanvasW, (hy / heatmapH) * heatmapCanvasH, cellW, cellH);
              }
            }
          }
        }
      }

      if (cache.canvas) {
        ctx.drawImage(cache.canvas, mapX, mapY, mapWCanvas, mapHCanvas);
      }
    }

    // Faction dots: predators red, herbivores green, omnivores amber. The
    // population heatmap shows density; these show where the actors are.
    ctx.save();
    const dotSize = Math.max(1.5, 1.7 * dpr);
    const creatures = Array.isArray(world.creatures) ? world.creatures : [];
    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i];
      if (!c || c.alive === false || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
      const predator = Boolean(c.genes?.predator) || numericDiet(c.genes?.diet) > 0.7;
      const omnivore = !predator && numericDiet(c.genes?.diet) > 0.3;
      ctx.fillStyle = predator
        ? 'rgba(255, 118, 118, 0.95)'
        : omnivore
          ? 'rgba(250, 204, 90, 0.9)'
          : 'rgba(126, 231, 135, 0.9)';
      ctx.fillRect(
        mapX + c.x * scaleX * dpr - dotSize * 0.5,
        mapY + c.y * scaleY * dpr - dotSize * 0.5,
        dotSize,
        dotSize
      );
    }
    ctx.restore();

    if (this.miniMapSettings.territories && world.territories && world.territories.size) {
      ctx.save();
      const scaleAvg = (scaleX + scaleY) * 0.5;
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)';
      ctx.lineWidth = 1.6;
      for (const territory of world.territories.values()) {
        const cx = mapX + territory.x * scaleX * dpr;
        const cy = mapY + territory.y * scaleY * dpr;
        const radius = Number.isFinite(territory.radius) ? territory.radius * scaleAvg * dpr : 0;
        if (!(radius > 0)) continue;
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

    const sandboxProps = world.sandbox?.props;
    if (Array.isArray(sandboxProps) && sandboxProps.length > 0) {
      ctx.save();
      for (const prop of sandboxProps) {
        if (!prop) continue;
        const px = mapX + prop.x * scaleX * dpr;
        const py = mapY + prop.y * scaleY * dpr;
        ctx.fillStyle = prop.color || 'rgba(196, 181, 253, 0.9)';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, 1.6 * dpr), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw camera view rectangle (YOUR LOCATION)
    const viewW = opts.viewportWidth / camera.zoom;
    const viewH = opts.viewportHeight / camera.zoom;
    const viewX = camera.x - viewW / 2;
    const viewY = camera.y - viewH / 2;

    ctx.strokeStyle = 'rgba(198, 220, 255, 0.82)';
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
      const label = `${activeDisaster.name} · ${Math.ceil(activeDisaster.timeRemaining ?? 0)}s`;
      ctx.save();
      ctx.font = `bold ${10 * dpr}px sans-serif`;
      ctx.textBaseline = 'middle';
      const labelWidth = ctx.measureText(label).width + 12 * dpr;
      ctx.fillStyle = 'rgba(20, 12, 12, 0.78)';
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(mapX + 6 * dpr, mapY + 6 * dpr, labelWidth, 18 * dpr, 5 * dpr);
      } else {
        ctx.rect(mapX + 6 * dpr, mapY + 6 * dpr, labelWidth, 18 * dpr);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 226, 226, 0.95)';
      ctx.fillText(label, mapX + 12 * dpr, mapY + 15 * dpr);
      ctx.restore();
    }

    // Compass marker (world north is up).
    ctx.save();
    ctx.fillStyle = 'rgba(216, 225, 239, 0.85)';
    ctx.font = `bold ${9 * dpr}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('N', mapX + mapWCanvas - 6 * dpr, mapY + 12 * dpr);
    ctx.strokeStyle = 'rgba(216, 225, 239, 0.6)';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.moveTo(mapX + mapWCanvas - 10 * dpr, mapY + 16 * dpr);
    ctx.lineTo(mapX + mapWCanvas - 10 * dpr, mapY + 22 * dpr);
    ctx.stroke();
    ctx.restore();

    // Border with slight glow
    ctx.shadowColor = 'rgba(146, 188, 255, 0.24)';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(153, 190, 244, 0.74)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(mapX - dpr, mapY - dpr, mapWCanvas + 2 * dpr, mapHCanvas + 2 * dpr, 9 * dpr);
    } else {
      ctx.rect(mapX - dpr, mapY - dpr, mapWCanvas + 2 * dpr, mapHCanvas + 2 * dpr);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = 'rgba(216, 225, 239, 0.8)';
    ctx.font = `bold ${10 * dpr}px sans-serif`;
    ctx.fillText('WORLD MAP', mapX + 5 * dpr, mapY - 5 * dpr);

    // NEW: Draw biome labels at key locations
    this._drawBiomeLabels(world, mapX, mapY, scaleX, scaleY, dpr);

    ctx.restore();
  };

  Renderer.prototype._getMiniMapLayout = function (world, opts = {}, dpr = 1) {
    const canvas = this.ctx.canvas;
    const cssWidth = Math.max(
      1,
      Number(this.camera?.viewportWidth) ||
        Number(opts.viewportCssWidth) ||
        Number(canvas.clientWidth) ||
        Number(opts.viewportWidth) / Math.max(1, dpr) ||
        1
    );
    const cssHeight = Math.max(
      1,
      Number(this.camera?.viewportHeight) ||
        Number(opts.viewportCssHeight) ||
        Number(canvas.clientHeight) ||
        Number(opts.viewportHeight) / Math.max(1, dpr) ||
        1
    );
    const key = [
      Math.round(cssWidth * 10),
      Math.round(cssHeight * 10),
      Math.round(dpr * 100),
      Math.round(world.width),
      Math.round(world.height),
      Math.round(Number(opts.hudBottomHeight) || 0)
    ].join('|');
    const cache = this._miniMapLayoutCache || (this._miniMapLayoutCache = { key: null, layout: null });
    if (cache.key === key && cache.layout) return cache.layout;

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
    const cssMarginY = Math.max(16, Math.round(cssHeight * 0.015)) + Math.max(0, Number(opts.hudBottomHeight) || 0);
    const mapXCss = cssWidth - mapW - cssMarginX;
    const mapYCss = cssHeight - mapH - cssMarginY;

    const layout = {
      mapXCss,
      mapYCss,
      mapX: mapXCss * dpr,
      mapY: mapYCss * dpr,
      mapW,
      mapH,
      mapWCanvas: mapW * dpr,
      mapHCanvas: mapH * dpr,
      scaleX: mapW / world.width,
      scaleY: mapH / world.height,
      aspectRatio,
      dpr
    };
    cache.key = key;
    cache.layout = layout;
    return layout;
  };

  Renderer.prototype._getMiniMapBiomeLayer = function (world, layout) {
    const sampleSize = 100; // Larger samples = less detail, easier to read
    const canvasWidth = Math.max(1, Math.ceil(layout.mapWCanvas));
    const canvasHeight = Math.max(1, Math.ceil(layout.mapHCanvas));
    const key = [Math.round(world.width), Math.round(world.height), canvasWidth, canvasHeight, sampleSize].join('|');
    const cache = this._miniMapBiomeCache || (this._miniMapBiomeCache = { key: null, canvas: null });
    if (cache.key === key && cache.canvas) return cache.canvas;

    const layer = createLayerCanvas(canvasWidth, canvasHeight);
    const layerCtx = layer.getContext('2d');
    if (!layerCtx) return null;

    layerCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    layerCtx.globalAlpha = 0.2; // Very faint biome colors
    const scaleXPx = layout.scaleX * layout.dpr;
    const scaleYPx = layout.scaleY * layout.dpr;
    for (let y = 0; y < world.height; y += sampleSize) {
      for (let x = 0; x < world.width; x += sampleSize) {
        const biome = world.getBiomeAt(x, y);
        // STABILITY: Guard against undefined biome
        layerCtx.fillStyle = this._getBiomeTint(biome?.type);
        layerCtx.fillRect(
          x * scaleXPx,
          y * scaleYPx,
          Math.max(1, sampleSize * scaleXPx),
          Math.max(1, sampleSize * scaleYPx)
        );
      }
    }
    layerCtx.globalAlpha = 1;

    cache.key = key;
    cache.canvas = layer;
    return layer;
  };

  // NEW: Draw biome labels on mini-map
  Renderer.prototype._drawBiomeLabels = function (world, mapX, mapY, scaleX, scaleY, dpr = 1) {
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

  Renderer.prototype._getDisasterTint = function (type) {
    switch (type) {
      case 'meteorStorm':
        return 'rgba(248, 113, 113, 0.18)';
      case 'iceAge':
        return 'rgba(96, 165, 250, 0.18)';
      case 'plague':
        return 'rgba(192, 132, 252, 0.18)';
      case 'drought':
        return 'rgba(250, 204, 21, 0.16)';
      default:
        return null;
    }
  };
}
