// Mobile Support & Touch Handling
export class MobileSupport {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.isMobile = this.detectMobile();
    this.touches = new Map();
    this.lastPinchDistance = null;
    this.lastPanCenter = null;
    this.doubleTapTimer = null;
    this.lastTapTime = 0;
    this.tapCount = 0;
    this.panSensitivity = 0.75;
    this.pinchSensitivity = 0.8;
    this.panThreshold = 1.2;

    this.init();
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
           ('ontouchstart' in window);
  }

  init() {
    if (!this.isMobile) return;

    console.debug('📱 Mobile device detected - enabling touch controls');

    // Prevent default touch behaviors
    this.canvas.style.touchAction = 'none';

    // Touch event listeners
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

    // Apply mobile-specific styles
    this.applyMobileStyles();
  }

  applyMobileStyles() {
    // Add mobile class to body
    document.body.classList.add('mobile-device');

    // Adjust viewport for better mobile experience
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
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

    setViewportHeight();
    updateKeyboardOffset();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    window.addEventListener('resize', updateKeyboardOffset);
    window.addEventListener('orientationchange', updateKeyboardOffset);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setViewportHeight);
      window.visualViewport.addEventListener('scroll', setViewportHeight);
      window.visualViewport.addEventListener('resize', updateKeyboardOffset);
      window.visualViewport.addEventListener('scroll', updateKeyboardOffset);
    }

    document.addEventListener('focusin', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches('input, textarea, select')) return;
      setTimeout(() => {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        updateKeyboardOffset();
      }, 50);
    });

    document.addEventListener('focusout', () => {
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
}
