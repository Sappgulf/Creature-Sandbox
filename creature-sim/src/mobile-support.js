// Mobile Support & Touch Handling
export class MobileSupport {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.isMobile = this.detectMobile();
    this.touchHandlersAttached = false;
    this.touches = new Map();
    this.lastPinchDistance = null;
    this.lastPanCenter = null;
    this.doubleTapTimer = null;
    this.lastTapTime = 0;
    this.tapCount = 0;
    this.panSensitivity = 0.75;
    this.pinchSensitivity = 0.8;
    this.panThreshold = 1.2;
    this.compactBreakpoint = 430;
    this.landscapeBreakpoint = 900;
    this.cleanupCallbacks = [];

    this.init();
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
           ('ontouchstart' in window);
  }

  init() {
    this.applyMobileStyles();
  }

  registerListener(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    this.cleanupCallbacks.push(() => target.removeEventListener(eventName, handler, options));
  }

  ensureTouchHandlers() {
    if (this.touchHandlersAttached) return;
    this.touchHandlersAttached = true;
    this.registerListener(this.canvas, 'touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.registerListener(this.canvas, 'touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.registerListener(this.canvas, 'touchend', (e) => this.handleTouchEnd(e), { passive: false });
    this.registerListener(this.canvas, 'touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
  }

  applyMobileStyles() {
    // Adjust viewport for better mobile experience
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content';
    }

    // Stabilize viewport height to account for dynamic browser chrome
    const setViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const vh = viewportHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    const updateKeyboardOffset = () => {
      const visualViewport = window.visualViewport;
      const viewportHeight = visualViewport?.height || window.innerHeight;
      const viewportOffset = visualViewport?.offsetTop || 0;
      const offset = Math.max(0, window.innerHeight - viewportHeight - viewportOffset);
      document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
      document.body.classList.toggle('keyboard-open', offset > 0);
    };

    const syncMobileLayoutProfile = () => {
      const wasMobile = this.isMobile;
      this.isMobile = this.detectMobile();

      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const isCompact = this.isMobile && viewportWidth <= this.compactBreakpoint;
      const isLandscape = this.isMobile && viewportWidth > viewportHeight && viewportWidth <= this.landscapeBreakpoint;

      document.body.classList.toggle('mobile-device', this.isMobile);
      document.body.classList.toggle('mobile-compact-ui', isCompact);
      document.body.classList.toggle('mobile-landscape-ui', isLandscape);

      this.canvas.style.touchAction = this.isMobile ? 'none' : '';

      if (this.isMobile) {
        this.ensureTouchHandlers();
      } else {
        this.touches.clear();
        this.lastPinchDistance = null;
        this.lastPanCenter = null;
        document.body.classList.remove('keyboard-open');
      }

      if (!wasMobile && this.isMobile) {
        console.debug('📱 Mobile layout detected - enabling touch controls');
      }

      if (wasMobile !== this.isMobile) {
        window.dispatchEvent(new CustomEvent('creature:mobile-layout-change', {
          detail: { active: this.isMobile }
        }));
      }
    };

    setViewportHeight();
    updateKeyboardOffset();
    syncMobileLayoutProfile();
    this.registerListener(window, 'resize', setViewportHeight);
    this.registerListener(window, 'orientationchange', setViewportHeight);
    this.registerListener(window, 'resize', updateKeyboardOffset);
    this.registerListener(window, 'orientationchange', updateKeyboardOffset);
    this.registerListener(window, 'resize', syncMobileLayoutProfile);
    this.registerListener(window, 'orientationchange', syncMobileLayoutProfile);
    if (window.visualViewport) {
      this.registerListener(window.visualViewport, 'resize', setViewportHeight);
      this.registerListener(window.visualViewport, 'scroll', setViewportHeight);
      this.registerListener(window.visualViewport, 'resize', updateKeyboardOffset);
      this.registerListener(window.visualViewport, 'scroll', updateKeyboardOffset);
      this.registerListener(window.visualViewport, 'resize', syncMobileLayoutProfile);
    }

    this.registerListener(document, 'focusin', (event) => {
      if (!this.isMobile) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches('input, textarea, select')) return;
      setTimeout(() => {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        updateKeyboardOffset();
      }, 50);
    });

    this.registerListener(document, 'focusout', () => {
      if (!this.isMobile) return;
      setTimeout(() => updateKeyboardOffset(), 50);
    });
  }

  handleTouchStart(e) {
    e.preventDefault();

    // Store all touches
    for (const touch of e.changedTouches) {
      this.touches.set(touch.identifier, {
        id: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: Date.now()
      });
    }

    // Handle different gestures based on touch count
    if (e.touches.length === 1) {
      this.handleSingleTouchStart(e.touches[0]);
    } else if (e.touches.length === 2) {
      this.handlePinchStart(e.touches);
    }
  }

  handleTouchMove(e) {
    e.preventDefault();

    // Update touch positions
    for (const touch of e.changedTouches) {
      const stored = this.touches.get(touch.identifier);
      if (stored) {
        stored.currentX = touch.clientX;
        stored.currentY = touch.clientY;
      }
    }

    if (e.touches.length === 1) {
      this.handleSingleTouchMove(e.touches[0]);
    } else if (e.touches.length === 2) {
      this.handlePinchMove(e.touches);
    }
  }

  handleTouchEnd(e) {
    e.preventDefault();

    // Check for tap
    for (const touch of e.changedTouches) {
      const stored = this.touches.get(touch.identifier);
      if (stored) {
        const duration = Date.now() - stored.startTime;
        const distance = Math.hypot(
          stored.currentX - stored.startX,
          stored.currentY - stored.startY
        );

        // It's a tap if quick and not moved much
        if (duration < 300 && distance < 10) {
          this.handleTap(stored.currentX, stored.currentY);
        }

        this.touches.delete(touch.identifier);
      }
    }

    // Reset pinch/pan state
    if (e.touches.length < 2) {
      this.lastPinchDistance = null;
      this.lastPanCenter = null;
    }
  }

  handleSingleTouchStart(touch) {
    // Store for panning
    this.lastPanCenter = {
      x: touch.clientX,
      y: touch.clientY
    };
  }

  handleSingleTouchMove(touch) {
    if (!this.lastPanCenter) return;

    // Pan camera
    const dx = touch.clientX - this.lastPanCenter.x;
    const dy = touch.clientY - this.lastPanCenter.y;
    if (Math.abs(dx) + Math.abs(dy) < this.panThreshold) return;

    this.camera.targetX -= (dx * this.panSensitivity) / this.camera.zoom;
    this.camera.targetY -= (dy * this.panSensitivity) / this.camera.zoom;

    this.lastPanCenter = {
      x: touch.clientX,
      y: touch.clientY
    };
  }

  handlePinchStart(touches) {
    const distance = Math.hypot(
      touches[1].clientX - touches[0].clientX,
      touches[1].clientY - touches[0].clientY
    );
    this.lastPinchDistance = distance;

    const centerX = (touches[0].clientX + touches[1].clientX) / 2;
    const centerY = (touches[0].clientY + touches[1].clientY) / 2;
    this.lastPanCenter = { x: centerX, y: centerY };
  }

  handlePinchMove(touches) {
    const distance = Math.hypot(
      touches[1].clientX - touches[0].clientX,
      touches[1].clientY - touches[0].clientY
    );

    if (this.lastPinchDistance) {
      // Zoom
      const scale = distance / this.lastPinchDistance;
      const zoomFactor = 1 + (scale - 1) * this.pinchSensitivity;
      this.camera.targetZoom *= zoomFactor;
      const minZoom = this.camera.minZoom ?? 0.1;
      const maxZoom = this.camera.maxZoom ?? 3.0;
      this.camera.targetZoom = Math.max(minZoom, Math.min(maxZoom, this.camera.targetZoom));
    }

    // Pan (two-finger drag)
    const centerX = (touches[0].clientX + touches[1].clientX) / 2;
    const centerY = (touches[0].clientY + touches[1].clientY) / 2;

    if (this.lastPanCenter) {
      const dx = centerX - this.lastPanCenter.x;
      const dy = centerY - this.lastPanCenter.y;

      if (Math.abs(dx) + Math.abs(dy) >= this.panThreshold) {
        this.camera.targetX -= (dx * this.panSensitivity) / this.camera.zoom;
        this.camera.targetY -= (dy * this.panSensitivity) / this.camera.zoom;
      }
    }

    this.lastPinchDistance = distance;
    this.lastPanCenter = { x: centerX, y: centerY };
  }

  handleTap(x, y) {
    const now = Date.now();

    // Double tap detection
    if (now - this.lastTapTime < 300) {
      this.tapCount++;
      if (this.tapCount === 2) {
        // Double tap = zoom to location
        const rect = this.canvas.getBoundingClientRect();
        // Use rect dimensions (CSS size) not canvas dimensions (buffer size)
        const sx = x - rect.left - rect.width / 2;
        const sy = y - rect.top - rect.height / 2;
        const worldPos = this.camera.screenToWorld(sx, sy);

        this.camera.targetX = worldPos.x;
        this.camera.targetY = worldPos.y;
        this.camera.targetZoom = Math.min(this.camera.targetZoom * 1.5, 2.0);

        this.tapCount = 0;
      }
    } else {
      this.tapCount = 1;
    }

    this.lastTapTime = now;

    // Emit tap event for creature selection
    this.canvas.dispatchEvent(new CustomEvent('mobiletap', {
      detail: { x, y }
    }));
  }

  // Get world coordinates from touch
  getTouchWorldCoords(touch) {
    const rect = this.canvas.getBoundingClientRect();
    // Use rect dimensions (CSS size) not canvas dimensions (buffer size)
    const sx = touch.clientX - rect.left - rect.width / 2;
    const sy = touch.clientY - rect.top - rect.height / 2;
    return this.camera.screenToWorld(sx, sy);
  }

  destroy() {
    while (this.cleanupCallbacks.length > 0) {
      const cleanup = this.cleanupCallbacks.pop();
      cleanup?.();
    }
  }
}
