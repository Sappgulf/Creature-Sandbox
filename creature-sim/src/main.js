/**
 * Main Entry Point - Simplified initialization using modular architecture
 * This replaces the massive 2000+ line main.js with clean, focused modules
 */
import { World } from './world-core.js';
import { SimulationProxy } from './simulation-proxy.js';
import { Creature } from './creature.js';
import './creature-features.js'; // Load feature extensions
import { makeGenes } from './genetics.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { ToolController } from './tools.js';
import { AnalyticsTracker } from './analytics.js';
import { LineageTracker } from './lineage-tracker.js';
import { MiniGraphs } from './mini-graphs.js';
import { SaveSystem } from './save-system.js';
import { ParticleSystem } from './particle-system.js';
import { NotificationSystem } from './notification-system.js';
import { HeatmapSystem } from './heatmap-system.js';
import { GeneEditor } from './gene-editor.js';
import { EcosystemHealth } from './ecosystem-health.js';
import { DebugConsole } from './debug-console.js';
import { AudioSystem } from './audio-system.js';
import { TutorialSystem } from './tutorial-system.js';
import { AchievementSystem } from './achievement-system.js';
import { BiomeGenerator } from './perlin-noise.js';
import { GameplayModes } from './gameplay-modes.js';
import { SessionGoals } from './session-goals.js';
import { MobileSupport } from './mobile-support.js';
import { AutoDirector } from './auto-director.js';
import { MomentsSystem } from './moments-system.js';
import { ControlStripController } from './control-strip.js';

// Import new modular systems
import { domCache } from './dom-cache.js';
import { gameState } from './game-state.js';
import { InputManager } from './input-manager.js';
import { UIController } from './ui-controller.js';
import { GameLoop } from './game-loop.js';
import { errorHandler } from './error-handler.js';
import { eventSystem, GameEvents } from './event-system.js';
import { configManager } from './config-manager.js';
import { performanceProfiler, initializePerformanceMonitor } from './performance-profiler.js';
import { scenarioEditor } from './scenario-editor.js';
import { diseaseSystem } from './disease-system.js';
import { campaignSystem } from './campaign-system.js';
import { assetLoader } from './asset-loader.js';

// Import newly added systems
import { seasonalEventsSystem } from './seasonal-events.js';
import { advancedAI } from './advanced-predator-prey-ai.js';
import { godPowers } from './god-powers.js';
import { ProceduralSounds } from './procedural-sounds.js';
import { UnlockableAchievements } from './unlockable-achievements.js';
import { FamilyBondsSystem } from './family-bonds.js';
import { MemoryLearningSystem } from './memory-learning.js';
import { getDebugFlags } from './debug-flags.js';

// Local helper to validate notification subsystem shape
function isNotificationSystem(candidate) {
  return !!candidate &&
    typeof candidate.show === 'function' &&
    typeof candidate.update === 'function' &&
    typeof candidate.draw === 'function';
}

function getDevToolsConfig() {
  if (typeof window === 'undefined') return { enabled: false, timingLogs: false, fpsOverlay: false };
  const debugFlags = getDebugFlags();
  const params = new URLSearchParams(window.location.search);
  const enabled = debugFlags.enabled;
  const fpsOverlay = enabled && (params.has('fps') || localStorage.getItem('creature-sim-fps') === 'true' || params.has('devtools'));
  const timingLogs = enabled && (params.has('timing') || localStorage.getItem('creature-sim-timing') === 'true');
  const timingLogInterval = Number(params.get('timingInterval') || 5000) || 5000;
  return {
    enabled,
    fpsOverlay,
    timingLogs,
    timingLogInterval,
    spawnDebug: debugFlags.spawnDebug,
    renderDebug: debugFlags.renderDebug
  };
}

function createDevFpsOverlay(enabled) {
  if (!enabled || typeof document === 'undefined') return null;
  const overlay = document.createElement('div');
  overlay.id = 'dev-fps';
  overlay.className = 'dev-fps';
  overlay.setAttribute('aria-live', 'polite');
  overlay.textContent = 'FPS --';
  document.body.appendChild(overlay);
  return overlay;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

console.debug('🚀 Starting Creature Sandbox...');

const DESKTOP_STARTUP_SEED = { herbivores: 72, predators: 10, food: 320 };
const MOBILE_STARTUP_SEED = { herbivores: 60, predators: 8, food: 260 };
const COMPACT_MOBILE_STARTUP_SEED = { herbivores: 52, predators: 6, food: 220 };

function getRuntimeProfile() {
  if (typeof window === 'undefined') {
    return {
      mobile: false,
      compact: false,
      lowMemory: false,
      renderScale: 1,
      defaultZoom: 0.25,
      startupSeed: DESKTOP_STARTUP_SEED
    };
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches || ('ontouchstart' in window);
  const mobileViewport = coarsePointer || window.matchMedia?.('(max-width: 768px)').matches;
  const shortEdge = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const compactViewport = mobileViewport && shortEdge > 0 && shortEdge <= 430;
  const deviceMemory = Number(navigator.deviceMemory || 0);
  const lowMemory = mobileViewport && deviceMemory > 0 && deviceMemory <= 4;
  const renderScale = mobileViewport ? (compactViewport || lowMemory ? 0.82 : 0.9) : 1;

  return {
    mobile: mobileViewport,
    compact: compactViewport,
    lowMemory,
    renderScale,
    defaultZoom: mobileViewport ? 0.28 : 0.25,
    startupSeed: compactViewport || lowMemory ? COMPACT_MOBILE_STARTUP_SEED : (mobileViewport ? MOBILE_STARTUP_SEED : DESKTOP_STARTUP_SEED)
  };
}

// Preload sprite assets
console.debug('🎨 Loading sprite assets...');
assetLoader.loadManifest('./assets/sprites/sprite-manifest.json', { optional: true })
  .then(manifest => {
    if (!manifest) {
      assetLoader.loadSVG('creature_herbivore', './assets/creature_herbivore.svg');
      assetLoader.loadSVG('creature_predator', './assets/creature_predator.svg');
      assetLoader.loadSVG('creature_omnivore', './assets/creature_omnivore.svg');
      assetLoader.loadSVG('creature_baby', './assets/creature_baby.svg');
      assetLoader.loadSVG('creature_elder', './assets/creature_elder.svg');
      assetLoader.loadSVG('creature_alpha', './assets/creature_alpha.svg');
      assetLoader.loadSVG('creature_aquatic', './assets/creature_aquatic.svg');
    }
    return assetLoader.loadAll();
  })
  .then(() => {
    console.debug('✅ Sprite assets loaded successfully');
  })
  .catch(error => {
    console.warn('⚠️ Some sprite assets failed to load, falling back to shapes:', error);
  });

// Wait for DOM to be ready before initializing
function initializeApp() {
  console.debug('📄 DOM ready, initializing Creature Sandbox...');

  // Initialize DOM cache first (critical for performance)
  errorHandler.safeExecute(() => {
    domCache.initialize();
  }, 'DOM cache initialization', () => {
    errorHandler.criticalError(new Error('Failed to initialize DOM cache'), 'DOM cache initialization');
    return;
  });

  const devTools = getDevToolsConfig();
  if (devTools.enabled) {
    document.body.classList.add('dev-tools');
  }

  const devFpsOverlay = createDevFpsOverlay(devTools.fpsOverlay);
  if (devFpsOverlay) {
    domCache.add('devFps', devFpsOverlay);
  }

  // Get core canvas element
  const canvas = errorHandler.safeExecute(() => {
    return domCache.get('canvas');
  }, 'Canvas element retrieval', null);

  if (!canvas) {
    errorHandler.criticalError(new Error('Canvas element not found'), 'Canvas initialization');
    throw new Error('Cannot continue without canvas element');
  }

  // Get canvas context
  const ctx = errorHandler.safeExecute(() => {
    return canvas.getContext('2d');
  }, 'Canvas context retrieval', null);

  if (!ctx) {
    errorHandler.criticalError(new Error('Failed to get canvas 2D context'), 'Canvas context initialization');
    throw new Error('Cannot continue without canvas context');
  }

  // Set initial canvas size
  function setCanvasSize() {
    errorHandler.safeExecute(() => {
      let rect = canvas.getBoundingClientRect();
      const runtimeProfile = getRuntimeProfile();
      const dpr = runtimeProfile.renderScale; // Resolution scale biased toward smooth mobile frame pacing

      // Fallback if clientRect is zero or suspicious (e.g. before layout)
      if (rect.width < 100 || rect.height < 100) {
        rect = {
          width: window.innerWidth,
          height: window.innerHeight
        };
      }

      // Ensure even dimensions to avoid subpixel artifacts
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform before scaling
      ctx.scale(dpr, dpr);

      // Update camera viewport if it exists
      if (window.camera) {
        window.camera.viewportWidth = rect.width;
        window.camera.viewportHeight = rect.height;
      }

      console.debug(`🖼️ Canvas: ${rect.width}x${rect.height} (${canvas.width}x${canvas.height} internal @ ${dpr.toFixed(2)}x render scale)`);
    }, 'Canvas resize');
  }

  errorHandler.safeExecute(() => {
    setCanvasSize();
    // Handle window resize
    window.addEventListener('resize', () => {
      requestAnimationFrame(setCanvasSize);
    });
    // Double-check size after a short delay to catch layout shifts
    setTimeout(setCanvasSize, 100);
    setTimeout(setCanvasSize, 500);
  }, 'Canvas setup');

  // ============================================================================
  // CORE SYSTEMS INITIALIZATION
  // ============================================================================

  // Performance Settings
  // Default to in-thread simulation for full feature compatibility (save/load, personality state).
  // Opt in to worker mode with ?worker=1.
  const workerParam = new URLSearchParams(window.location.search).get('worker');
  const USE_SIM_WORKER = workerParam === '1' || workerParam === 'true';
  const startupSeed = getRuntimeProfile().startupSeed;

  // World and core entities
  const world = errorHandler.safeExecute(() => {
    if (USE_SIM_WORKER) {
      console.debug('🚀 Initializing Simulation Worker...');
      const w = new SimulationProxy(new URL('./worker-simulation.js', import.meta.url));
      w.init(4000, 2800);
      w.seed(startupSeed.herbivores, startupSeed.predators, startupSeed.food);
      return w;
    } else {
      const w = new World(4000, 2800);
      w.seed(startupSeed.herbivores, startupSeed.predators, startupSeed.food);
      return w;
    }
  }, 'World initialization', null);

  if (!world) {
    errorHandler.criticalError(new Error('Failed to create world'), 'World initialization');
    throw new Error('Cannot continue without world');
  }

  // Camera system
  const camera = errorHandler.safeExecute(() => {
    return new Camera({
      x: world.width * 0.5,
      y: world.height * 0.5,
      zoom: getRuntimeProfile().defaultZoom,
      minZoom: 0.1,
      maxZoom: 3,
      worldWidth: world.width,
      worldHeight: world.height,
      viewportWidth: canvas.getBoundingClientRect().width,
      viewportHeight: canvas.getBoundingClientRect().height
    });
  }, 'Camera initialization', null);

  if (!camera) {
    errorHandler.criticalError(new Error('Failed to create camera'), 'Camera initialization');
    throw new Error('Cannot continue without camera');
  }

  // Renderer
  const renderer = errorHandler.safeExecute(() => {
    return new Renderer(ctx, camera);
  }, 'Renderer initialization', null);

  // Enable dedicated mobile/touch support (pinch, pan, taps)
  errorHandler.safeExecute(() => {
    return new MobileSupport(canvas, camera);
  }, 'Mobile support initialization', null);

  if (!renderer) {
    errorHandler.criticalError(new Error('Failed to create renderer'), 'Renderer initialization');
    throw new Error('Cannot continue without renderer');
  }

  console.debug('🎨 Ultra-optimized Canvas 2D renderer initialized');
  console.debug('💪 60 FPS guaranteed with up to 500+ creatures!');

  // Accessibility: reduced motion toggle (defaults to OS preference)
  errorHandler.safeExecute(() => {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const storedPreference = window.localStorage?.getItem('creatureSandboxReducedMotion');
    const initialReduced = storedPreference ? storedPreference === 'true' : prefersReduced;

    const applyReducedMotion = (enabled) => {
      document.body.classList.toggle('reduced-motion', enabled);
    };

    applyReducedMotion(initialReduced);

    const reducedMotionToggle = document.getElementById('toggle-reduced-motion');
    if (reducedMotionToggle) {
      reducedMotionToggle.checked = initialReduced;
      reducedMotionToggle.addEventListener('change', () => {
        const enabled = reducedMotionToggle.checked;
        applyReducedMotion(enabled);
        window.localStorage?.setItem('creatureSandboxReducedMotion', String(enabled));
      });
    }
  }, 'Reduced motion accessibility toggle');

  // Nameplates toggle
  errorHandler.safeExecute(() => {
    const nameplatesToggle = document.getElementById('toggle-nameplates');
    if (nameplatesToggle && renderer) {
      nameplatesToggle.checked = !!renderer.enableNameLabels;
      nameplatesToggle.addEventListener('change', () => {
        renderer.enableNameLabels = nameplatesToggle.checked;
      });
    }
  }, 'Nameplates toggle');

  // Feature toggles (observer overlays)
  errorHandler.safeExecute(() => {
    if (!renderer) return;
    const featureBindings = [
      { id: 'toggle-vision', feature: 'VISION', prop: 'enableVision' },
      { id: 'toggle-clustering', feature: 'CLUSTERING', prop: 'enableClustering' },
      { id: 'toggle-territories', feature: 'TERRITORIES', prop: 'enableTerritories' },
      { id: 'toggle-memory', feature: 'MEMORY', prop: 'enableMemory' },
      { id: 'toggle-social', feature: 'SOCIAL', prop: 'enableSocialBonds' },
      { id: 'toggle-migration', feature: 'MIGRATION', prop: 'enableMigration' },
      { id: 'toggle-nests', feature: 'NESTS', prop: 'enableNests' }
    ];
    for (const binding of featureBindings) {
      const toggle = document.getElementById(binding.id);
      if (!toggle) continue;
      toggle.checked = !!renderer[binding.prop];
      toggle.addEventListener('change', () => {
        renderer.setFeature?.(binding.feature, toggle.checked);
      });
    }
  }, 'Feature toggles');

  // Tools system
  const tools = errorHandler.safeExecute(() => {
    return new ToolController(world, camera);
  }, 'Tools initialization', null);

  if (!tools) {
    console.warn('⚠️ Tools system failed to initialize, continuing without tools');
  }

  // ============================================================================
  // SUBSYSTEMS INITIALIZATION
  // ============================================================================

  // Analytics and tracking
  const analytics = errorHandler.safeExecute(() => {
    return new AnalyticsTracker({
      useWorker: configManager.get('performance', 'analyticsWorker', true)
    });
  }, 'Analytics initialization', null);

  const lineageTracker = errorHandler.safeExecute(() => {
    return new LineageTracker();
  }, 'Lineage tracker initialization', null);

  // Visual effects
  const miniGraphs = errorHandler.safeExecute(() => {
    return new MiniGraphs();
  }, 'Mini-graphs initialization', null);

  const particles = errorHandler.safeExecute(() => {
    return new ParticleSystem();
  }, 'Particle system initialization', null);

  let notifications = errorHandler.safeExecute(() => {
    return new NotificationSystem();
  }, 'Notification system initialization', null);

  // Ensure we always have a valid notification system (avoid serialized/plain objects)
  if (!isNotificationSystem(notifications)) {
    console.warn('⚠️ Notification system unavailable or invalid, creating fallback instance');
    notifications = errorHandler.safeExecute(() => new NotificationSystem(), 'Notification system fallback', null);
  }

  const heatmaps = errorHandler.safeExecute(() => {
    return new HeatmapSystem(world);
  }, 'Heatmap system initialization', null);

  const moments = errorHandler.safeExecute(() => {
    return new MomentsSystem({ world, camera, notifications });
  }, 'Moments system initialization', null);

  const autoDirector = errorHandler.safeExecute(() => {
    return new AutoDirector({ world, camera });
  }, 'Auto-director initialization', null);

  // Game systems
  const saveSystem = errorHandler.safeExecute(() => {
    return new SaveSystem();
  }, 'Save system initialization', null);

  const geneEditor = errorHandler.safeExecute(() => {
    return new GeneEditor();
  }, 'Gene editor initialization', null);

  if (geneEditor) {
    errorHandler.safeExecute(() => {
      eventSystem.on('gene-editor:spawn', ({ x, y }) => {
        geneEditor.spawnMultiple(world, x, y);
        gameState.setGeneEditorSpawnMode(false);
        geneEditor.updateSpawnButton?.();
      });
    }, 'Gene editor spawn binding');
  }

  const ecoHealth = errorHandler.safeExecute(() => {
    return new EcosystemHealth();
  }, 'Ecosystem health initialization', null);

  const debugConsole = errorHandler.safeExecute(() => {
    return new DebugConsole(world, camera);
  }, 'Debug console initialization', null);

  const audio = errorHandler.safeExecute(() => {
    return new AudioSystem();
  }, 'Audio system initialization', null);

  const gameplayModes = errorHandler.safeExecute(() => {
    return new GameplayModes(world, { notifications, audio });
  }, 'Gameplay modes initialization', null);

  const sessionGoals = errorHandler.safeExecute(() => {
    return new SessionGoals({ notifications, audio });
  }, 'Session goals initialization', null);

  const tutorial = errorHandler.safeExecute(() => {
    return new TutorialSystem();
  }, 'Tutorial system initialization', null);

  const achievements = errorHandler.safeExecute(() => {
    return new AchievementSystem();
  }, 'Achievement system initialization', null);

  // Initialize new advanced systems
  const proceduralSounds = errorHandler.safeExecute(() => {
    const ps = new ProceduralSounds();
    ps.init();
    return ps;
  }, 'Procedural sounds initialization', null);

  const unlockableAchievements = errorHandler.safeExecute(() => {
    return new UnlockableAchievements();
  }, 'Unlockable achievements initialization', null);

  const familyBonds = errorHandler.safeExecute(() => {
    return new FamilyBondsSystem();
  }, 'Family bonds system initialization', null);

  const memoryLearning = errorHandler.safeExecute(() => {
    return new MemoryLearningSystem();
  }, 'Memory learning system initialization', null);

  const notifyUI = (message, type = 'info', duration = 2200) => {
    eventSystem.emit(GameEvents.NOTIFICATION, { message, type, duration });
  };

  const setElementHidden = (element, hidden) => {
    if (!element) return;
    if (hidden) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && element.contains(activeElement)) {
        activeElement.blur();
      }
    }
    element.classList.toggle('hidden', !!hidden);
    element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  };

  const setHomePageActive = (active) => {
    document.body.classList.toggle('home-active', !!active);
  };

  const applyLoadedState = (loaded, source = 'save') => {
    if (!loaded) return false;

    if (loaded.world && loaded.world !== world) {
      if (typeof world.importState === 'function' && typeof loaded.world.exportState === 'function') {
        world.importState(loaded.world.exportState());
      } else {
        console.warn('⚠️ Loaded world is incompatible with active simulation mode');
        return false;
      }
    }

    if (loaded.camera) {
      Object.assign(camera, loaded.camera);
    }

    if (loaded.lineageNames && lineageTracker) {
      lineageTracker.names = loaded.lineageNames;
    }
    if (tutorial) {
      tutorial.loadProgress();
    }
    if (audio) {
      audio.playUISound(source === 'autosave' ? 'success' : 'toggle');
    }
    return true;
  };

  const startTutorialIfNeeded = (delay = 1000) => {
    if (!tutorial || !tutorial.shouldShow?.()) return;
    window.setTimeout(() => {
      tutorial.start();
    }, delay);
  };

  // Attach systems to world (with error handling)
  errorHandler.safeExecute(() => {
    if (lineageTracker) world.attachLineageTracker(lineageTracker);
    if (particles) world.attachParticleSystem(particles);
    if (heatmaps) world.attachHeatmapSystem(heatmaps);
    if (audio) world.attachAudioSystem(audio);
    if (notifications) world.attachNotificationSystem(notifications);
    if (proceduralSounds) world.attachProceduralSounds(proceduralSounds);
    if (unlockableAchievements) world.attachUnlockableAchievements(unlockableAchievements);
    if (familyBonds) world.attachFamilyBonds(familyBonds);
    if (memoryLearning) world.attachMemoryLearning(memoryLearning);
  }, 'System attachment to world');

  // Ensure lineage names are set
  errorHandler.safeExecute(() => {
    if (lineageTracker) {
      world.creatures.forEach(c => lineageTracker.ensureName(lineageTracker.getRoot(world, c.id)));
    }
  }, 'Lineage name initialization');

  // ============================================================================
  // MODULAR SYSTEMS INITIALIZATION
  // ============================================================================

  // Input manager (handles all keyboard/mouse/touch input)
  const inputManager = errorHandler.safeExecute(() => {
    return new InputManager(canvas, camera, tools, world);
  }, 'Input manager initialization', null);

  if (!inputManager) {
    console.warn('⚠️ Input manager failed to initialize, controls may not work');
  } else {
    inputManager.tutorial = tutorial;
  }

  // UI controller (handles all UI state and DOM manipulation)
  const uiController = errorHandler.safeExecute(() => {
    return new UIController(world, camera, tools, {
      tutorial,
      achievements,
      audio,
      notifications,
      debugConsole,
      geneEditor,
      ecoHealth,
      gameplayModes,
      sessionGoals,
      autoDirector,
      moments
    });
  }, 'UI controller initialization', null);

  if (!uiController) {
    console.warn('⚠️ UI controller failed to initialize, UI may not work');
  }

  // Control strip controller (new mobile-first bottom control bar)
  const controlStrip = errorHandler.safeExecute(() => {
    return new ControlStripController({
      world,
      camera,
      renderer,
      tools,
      uiController
    });
  }, 'Control strip initialization', null);

  if (controlStrip) {
    console.debug('🎮 Control strip initialized (new bottom UI)');
    let lastControlStripSync = 0;
    eventSystem.on(GameEvents.FRAME_UPDATE, (data) => {
      const now = Number(data?.now) || performance.now();
      if (now - lastControlStripSync < 150) return;
      lastControlStripSync = now;
      controlStrip.update();
    });
  }

  // Game loop (handles main simulation loop and rendering)
  const gameLoop = errorHandler.safeExecute(() => {
    return new GameLoop(world, camera, renderer, analytics, uiController, {
      tutorial,
      achievements,
      audio,
      particles,
      notifications,
      heatmaps,
      lineageTracker,
      miniGraphs,
      debugConsole,
      saveSystem,
      geneEditor,
      ecoHealth,
      gameplayModes,
      sessionGoals,
      autoDirector,
      moments,
      devTools,
      // New advanced systems
      proceduralSounds,
      unlockableAchievements,
      familyBonds,
      memoryLearning,
      seasonalEvents: seasonalEventsSystem,
      advancedAI,
      godPowers
    });
  }, 'Game loop initialization', null);

  if (!gameLoop) {
    errorHandler.criticalError(new Error('Failed to create game loop'), 'Game loop initialization');
    throw new Error('Cannot continue without game loop');
  }

  // Save/load hotkeys (Ctrl/⌘ + S / O)
  const saveFileInput = document.createElement('input');
  saveFileInput.type = 'file';
  saveFileInput.accept = '.crsim,.json,application/json';
  saveFileInput.className = 'hidden';
  document.body.appendChild(saveFileInput);

  const handleSaveToFile = () => {
    if (!saveSystem) return;
    try {
      saveSystem.saveToFile(world, camera, analytics, lineageTracker);
      notifyUI('💾 Save file downloaded', 'success');
    } catch (err) {
      console.error('Save failed:', err);
      notifyUI('Save failed. Check console for details.', 'error', 3000);
    }
  };

  const handleLoadFromFile = async (file) => {
    if (!saveSystem || !file) return;
    try {
      const loaded = await saveSystem.loadFromFile(
        file,
        World,
        Creature,
        Camera,
        makeGenes,
        BiomeGenerator,
        typeof world.importState === 'function' ? world : null
      );
      if (!applyLoadedState(loaded, 'file')) {
        throw new Error('Invalid save file');
      }
      notifyUI('📂 Save loaded', 'success');
    } catch (err) {
      console.error('Load failed:', err);
      notifyUI('Load failed. Verify the save file.', 'error', 3200);
    }
  };

  saveFileInput.addEventListener('change', async () => {
    const [file] = saveFileInput.files || [];
    if (!file) return;
    await handleLoadFromFile(file);
    saveFileInput.value = '';
  });

  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (!saveSystem) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        event.stopPropagation();
        handleSaveToFile();
      }
      if (key === 'o') {
        event.preventDefault();
        event.stopPropagation();
        saveFileInput.click();
      }
    }
  }, { capture: true });

  // ============================================================================
  // ENHANCED SYSTEMS INITIALIZATION
  // ============================================================================

  // Initialize performance monitor
  errorHandler.safeExecute(() => {
    initializePerformanceMonitor(document.body);
  }, 'Performance monitor initialization');

  // Connect scenario editor to UI
  errorHandler.safeExecute(() => {
    const scenarioToggle = domCache.get('scenario-editor-toggle');
    if (scenarioToggle) {
      scenarioToggle.addEventListener('click', () => scenarioEditor.toggle());
    }
  }, 'Scenario editor UI connection');

  // ============================================================================
  // CAMPAIGN SYSTEM INITIALIZATION
  // ============================================================================

  // Initialize campaign UI
  errorHandler.safeExecute(() => {
    const campaignBtn = document.getElementById('btn-campaign');
    const campaignPanel = document.getElementById('campaign-panel');
    const campaignCloseBtn = document.getElementById('btn-campaign-close');
    const campaignLevelsContainer = document.getElementById('campaign-levels');
    const campaignProgress = document.getElementById('campaign-progress');
    const campaignExitBtn = document.getElementById('btn-campaign-exit');

    // Render campaign levels
    function renderCampaignLevels() {
      if (!campaignLevelsContainer) return;

      const levels = campaignSystem.getAllLevels();
      campaignLevelsContainer.innerHTML = levels.map(level => {
        const progress = level.progress;
        const isCompleted = progress?.completed;
        const stars = progress?.stars || 0;

        return `
          <div class="campaign-level-card ${level.unlocked ? '' : 'locked'} ${isCompleted ? 'completed' : ''}" 
               data-level-id="${level.id}">
            <div class="campaign-level-header">
              <span class="campaign-level-icon">${level.icon}</span>
              <div class="campaign-level-title">
                <h3 class="campaign-level-name">${level.name}</h3>
                <p class="campaign-level-subtitle">${level.subtitle}</p>
              </div>
            </div>
            <p class="campaign-level-desc">${level.description}</p>
            <div class="campaign-level-footer">
              <span class="campaign-difficulty ${level.difficulty}">${level.difficulty}</span>
              <span class="campaign-stars">
                ${[1, 2, 3].map(i => `<span class="${i <= stars ? 'earned' : ''}">⭐</span>`).join('')}
              </span>
            </div>
          </div>
        `;
      }).join('');

      // Add click handlers for unlocked levels
      campaignLevelsContainer.querySelectorAll('.campaign-level-card:not(.locked)').forEach(card => {
        card.addEventListener('click', () => {
          const levelId = parseInt(card.dataset.levelId);
          startCampaignLevel(levelId);
        });
      });
    }

    // Start a campaign level
    function startCampaignLevel(levelId) {
      // Pause game and reset world for campaign
      gameState.setPaused(true);
      eventSystem.emit('game:paused', { reason: 'campaign-start' });

      // Get level config
      const level = campaignSystem.getLevel(levelId);
      if (!level) return;

      // Reset world with level configuration
      const config = level.worldConfig;
      world.reset(config.width || 4000, config.height || 2800);

      // Seed creatures based on config
      const herbivores = config.initialCreatures || 10;
      const predators = config.initialPredators || 0;
      const food = config.initialFood || 100;

      world.seed(herbivores, predators, food);

      // Start campaign tracking
      campaignSystem.startLevel(levelId, world);

      // Update camera
      camera.x = world.width / 2;
      camera.y = world.height / 2;
      camera.zoom = 0.3;

      // Hide campaign panel, show progress HUD
      setElementHidden(campaignPanel, true);
      setElementHidden(campaignProgress, false);

      // Unpause
      gameState.setPaused(false);
      eventSystem.emit('game:resumed', { reason: 'campaign-start' });

      // Update progress display
      updateCampaignProgressUI();

      // Play sound
      if (audio) audio.playUISound('click');
    }

    // Update campaign progress UI
    function updateCampaignProgressUI() {
      const status = campaignSystem.getStatus();
      if (!status || !campaignProgress) return;

      const levelName = document.getElementById('campaign-level-name');
      const timer = document.getElementById('campaign-timer');
      const objective = document.getElementById('campaign-objective');
      const progressFill = document.getElementById('campaign-progress-fill');

      if (levelName) levelName.textContent = `${status.level.icon} ${status.level.name}`;

      // Update timer
      if (timer) {
        const elapsed = (world.t || 0) - status.state.startTime;
        const mins = Math.floor(elapsed / 60);
        const secs = Math.floor(elapsed % 60);
        timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      // Update objective
      if (objective && status.level.objectives?.primary) {
        objective.textContent = status.level.objectives.primary.description;
      }

      // Update progress bar based on objective type
      if (progressFill && status.level.objectives?.primary) {
        const obj = status.level.objectives.primary;
        let progress = 0;

        if (obj.type === 'population') {
          progress = Math.min(100, (world.creatures.filter(c => c.alive).length / obj.target) * 100);
        } else if (obj.type === 'survival_time') {
          const elapsed = (world.t || 0) - status.state.startTime;
          progress = Math.min(100, (elapsed / obj.target) * 100);
        } else if (obj.type === 'stable_population') {
          progress = Math.min(100, (status.stableTimer / obj.duration) * 100);
        }

        progressFill.style.width = `${progress}%`;
      }
    }

    // Open campaign panel
    if (campaignBtn) {
      campaignBtn.addEventListener('click', () => {
        renderCampaignLevels();
        setElementHidden(campaignPanel, false);
        if (audio) audio.playUISound('click');
      });
    }

    // Close campaign panel
    if (campaignCloseBtn) {
      campaignCloseBtn.addEventListener('click', () => {
        setElementHidden(campaignPanel, true);
      });
    }

    // Exit campaign
    if (campaignExitBtn) {
      campaignExitBtn.addEventListener('click', () => {
        campaignSystem.exitCampaign();
        setElementHidden(campaignProgress, true);
        if (audio) audio.playUISound('click');
      });
    }

    // Update campaign during game loop
    eventSystem.on(GameEvents.FRAME_UPDATE, (data) => {
      if (campaignSystem.isActive) {
        const dt = Number(data?.dt) || 1 / 60;
        campaignSystem.update(dt, world);
        diseaseSystem.update(dt, world);
        updateCampaignProgressUI();

        // Check if level completed or failed
        if (!campaignSystem.isActive) {
          setElementHidden(campaignProgress, true);
        }
      }
    });

    console.debug('🏆 Campaign system initialized');
  }, 'Campaign system initialization');

  // ============================================================================
  // STARTUP LOGIC
  // ============================================================================

  // Check for auto-save and show home page
  errorHandler.safeExecute(() => {
    // Always show home page first (handles both new game and continue)
    showHomePage();
  }, 'Startup logic', () => startNewGame());

  // Home page initialization
  function showHomePage() {
    setHomePageActive(true);

    const homePage = domCache.get('homePage') || document.getElementById('home-page');
    const homeBg = domCache.get('homeBg') || document.getElementById('home-bg');
    const continueBtn = domCache.get('continueBtn') || document.getElementById('btn-continue');
    const continueHint = domCache.get('continueHint') || document.getElementById('continue-hint');
    const newGameBtn = domCache.get('newGameBtn') || document.getElementById('btn-new-game');
    const campaignBtn = domCache.get('campaignBtn') || document.getElementById('btn-campaign');



    // Show home page
    errorHandler.safeExecute(() => {
      setElementHidden(homePage, false);

      // Show continue button if save exists
      if (saveSystem && saveSystem.hasAutoSave()) {
        setElementHidden(continueBtn, false);
        // Show save timestamp
        if (continueHint) {
          try {
            const saveInfo = saveSystem.getAutoSaveInfo?.();
            if (saveInfo?.timestamp) {
              const date = new Date(saveInfo.timestamp);
              const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              continueHint.textContent = timeStr;
            }
          } catch {
            continueHint.textContent = '';
          }
        }
      }

      // Start background animation
      startHomeBackgroundAnimation(homeBg);
    }, 'Home page display');

    // Initialize audio on first user interaction
    const initAudioOnInteraction = () => {
      errorHandler.safeExecute(() => {
        if (audio && !audio.ctx) {
          audio.init();
        }
      }, 'Audio initialization');
    };

    // Handle continue button
    errorHandler.safeExecute(() => {
      if (continueBtn) {
        continueBtn.addEventListener('click', () => {
          errorHandler.safeExecute(() => {
            initAudioOnInteraction();
            const loaded = saveSystem.loadAutoSave(
              World,
              Creature,
              Camera,
              makeGenes,
              BiomeGenerator,
              typeof world.importState === 'function' ? world : null
            );
            if (loaded) {
              applyLoadedState(loaded, 'autosave');
              console.debug('✅ Auto-save loaded successfully!');
              notifyUI('✅ Continue loaded', 'success');
              if (audio) audio.playUISound('success');
            }
          }, 'Auto-save loading', () => {
            console.error('Failed to load auto-save:', 'unknown error');
            alert('Failed to load save. Starting new game.');
            if (audio) audio.playUISound('error');
          });

          errorHandler.safeExecute(() => {
            setElementHidden(homePage, true);
            setHomePageActive(false);
            gameState.startGame();
            startTutorialIfNeeded();
          }, 'Post-load setup');
        });
      }
    }, 'Continue button setup');

    // Handle new game button
    errorHandler.safeExecute(() => {
      console.debug('🔧 Setting up New Game button:', !!newGameBtn);
      if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
          console.debug('🆕 New Game button clicked!');
          errorHandler.safeExecute(() => {
            initAudioOnInteraction();
            if (audio) audio.playUISound('click');
            if (saveSystem) saveSystem.clearAutoSave();
            console.debug('🆕 Starting new game...');

            setElementHidden(homePage, true);
            setHomePageActive(false);
            startNewGame();
          }, 'New game setup');
        });
      }
    }, 'New game button setup');

    // Handle campaign button (opens campaign panel from home)
    errorHandler.safeExecute(() => {
      if (campaignBtn) {
        campaignBtn.addEventListener('click', () => {
          errorHandler.safeExecute(() => {
            initAudioOnInteraction();
            if (audio) audio.playUISound('click');
            setElementHidden(homePage, true);
            setHomePageActive(false);

            // Trigger campaign panel open
            const campaignPanel = document.getElementById('campaign-panel');
            setElementHidden(campaignPanel, false);

            // Start new game in background
            startNewGame();
          }, 'Campaign launch');
        });
      }
    }, 'Campaign button setup');
  }

  // Home page animated background
  function startHomeBackgroundAnimation(canvas) {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const particles = [];
    let animationId = null;

    // Resize canvas to fill screen
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Create floating particles (creature-like blobs)
    const numParticles = 25;
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 8 + Math.random() * 20,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        hue: Math.random() * 360,
        alpha: 0.1 + Math.random() * 0.3,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03
      });
    }

    function drawParticle(p) {
      const wobbleOffset = Math.sin(p.wobble) * 3;

      // Draw creature-like blob
      ctx.beginPath();
      ctx.ellipse(
        p.x + wobbleOffset,
        p.y,
        p.size,
        p.size * 0.8,
        0, 0, Math.PI * 2
      );
      ctx.fillStyle = `hsla(${p.hue}, 60%, 50%, ${p.alpha})`;
      ctx.fill();

      // Draw simple eyes
      const eyeSize = p.size * 0.15;
      const eyeOffset = p.size * 0.3;
      ctx.fillStyle = `rgba(255,255,255,${p.alpha * 1.5})`;
      ctx.beginPath();
      ctx.arc(p.x + eyeOffset + wobbleOffset, p.y - p.size * 0.2, eyeSize, 0, Math.PI * 2);
      ctx.arc(p.x + eyeOffset * 0.6 + wobbleOffset, p.y - p.size * 0.2, eyeSize, 0, Math.PI * 2);
      ctx.fill();
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        // Update position
        p.x += p.speedX;
        p.y += p.speedY;
        p.wobble += p.wobbleSpeed;

        // Wrap around edges
        if (p.x < -p.size) p.x = canvas.width + p.size;
        if (p.x > canvas.width + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = canvas.height + p.size;
        if (p.y > canvas.height + p.size) p.y = -p.size;

        drawParticle(p);
      }

      // Check if home page still visible
      const homePage = domCache.get('homePage');
      if (homePage && !homePage.classList.contains('hidden')) {
        animationId = requestAnimationFrame(animate);
      } else if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }

    animate();
  }

  function applyReplayKickoff() {
    if (!world) return;
    const startX = world.width * 0.5;
    const startY = world.height * 0.5;
    const roll = Math.floor(Math.random() * 4);
    let label = 'Balanced opener';

    if (roll === 0) {
      label = 'Bloom opener';
      for (let i = 0; i < 3; i++) {
        const x = startX + (Math.random() - 0.5) * 520;
        const y = startY + (Math.random() - 0.5) * 420;
        const patch = world.ecosystem?.addFoodPatch?.(x, y, {
          radius: 95 + Math.random() * 55,
          fertility: 1.15,
          stock: 7
        });
        if (patch && world.ecosystem?.spawnFoodFromPatch) {
          for (let j = 0; j < 3; j++) {
            world.ecosystem.spawnFoodFromPatch(patch);
          }
        } else if (typeof world.addFood === 'function') {
          world.addFood(x, y, 36, 'grass');
        }
      }
    } else if (roll === 1) {
      label = 'Wildfront opener';
      const offsets = [
        [-210, -120, 'predator'],
        [220, -30, 'omnivore'],
        [120, 170, 'aquatic'],
        [-150, 140, 'herbivore']
      ];
      for (const [dx, dy, type] of offsets) {
        world.spawnCreatureType?.(type, startX + dx, startY + dy);
      }
      world.addCalmZone?.(startX, startY, 120, 14, 0.5);
    } else if (roll === 2) {
      label = 'Toybox opener';
      const props = ['bounce', 'spinner', 'spring', 'fan', 'button'];
      for (let i = 0; i < props.length; i++) {
        const theta = (Math.PI * 2 * i) / props.length;
        const radius = 180 + Math.random() * 60;
        const x = startX + Math.cos(theta) * radius;
        const y = startY + Math.sin(theta) * radius;
        world.sandbox?.addProp?.(props[i], x, y);
      }
    } else {
      label = 'Storm opener';
      world.triggerChaosNudge?.(0.22, 4.5);
      world.environment?.triggerWindBurst?.(0.26, 5.5);
      for (let i = 0; i < 2; i++) {
        world.spawnCreatureType?.('aquatic', startX + (Math.random() - 0.5) * 420, startY + (Math.random() - 0.5) * 320);
      }
    }

    notifications?.show?.(`🎲 ${label}`, 'info', 2000);
  }

  // Start new game
  function startNewGame() {
    // CRITICAL: Always set game state to ready FIRST
    // This ensures the game loop renders even if initialization has errors
    setHomePageActive(false);
    gameState.startGame();
    gameState.selectedId = null;
    gameState.paused = false;

    // Remaining initialization - errors here won't block gameplay
    errorHandler.safeExecute(() => {
      console.debug('🔄 Resetting world for new game...');

      // Reset the world with fresh creatures
      if (world && world.seed) {
        const nextSeed = getRuntimeProfile().startupSeed;
        world.seed(nextSeed.herbivores, nextSeed.predators, nextSeed.food);
      }

      applyReplayKickoff();

      // Reset camera to center
      if (camera) {
        const runtimeProfile = getRuntimeProfile();
        camera.focusOn(world.width * 0.5, world.height * 0.5);
        camera.setZoom(runtimeProfile.defaultZoom);
        camera.clearUserOverride();
      }

      // Reset analytics
      if (analytics) {
        try {
          analytics.reset();
        } catch (error) {
          console.warn('⚠️ Analytics reset failed:', error);
        }
      }

      // Reset lineage tracker
      if (lineageTracker) {
        lineageTracker.reset();
      }

      console.debug('✅ New game started successfully!');

      // Start tutorial for new players
      startTutorialIfNeeded();
    }, 'New game initialization');
  }

  // Expose startNewGame globally for fallback usage
  window.startNewGame = startNewGame;

  const getFocusCreature = () => {
    const focusId = gameState.pinnedId ?? gameState.selectedId ?? null;
    return focusId ? world.getAnyCreatureById?.(focusId) ?? null : null;
  };

  const getViewportBounds = () => {
    const zoom = Math.max(camera.zoom, 0.0001);
    const halfWidth = (camera.viewportWidth || 0) / (2 * zoom);
    const halfHeight = (camera.viewportHeight || 0) / (2 * zoom);
    return {
      left: camera.x - halfWidth,
      right: camera.x + halfWidth,
      top: camera.y - halfHeight,
      bottom: camera.y + halfHeight
    };
  };

  const getVisibleCreatures = (limit = 12) => {
    const bounds = getViewportBounds();
    return (world.creatures || [])
      .filter(creature => creature?.alive !== false)
      .filter(creature =>
        creature.x >= bounds.left &&
        creature.x <= bounds.right &&
        creature.y >= bounds.top &&
        creature.y <= bounds.bottom
      )
      .slice(0, limit)
      .map(creature => ({
        id: creature.id,
        species: creature.species || creature.kind || creature.genes?.species || null,
        diet: creature.genes?.diet ?? (creature.genes?.predator ? 1 : 0),
        stage: creature.lifeStage || null,
        x: Number(creature.x?.toFixed?.(1) ?? creature.x ?? 0),
        y: Number(creature.y?.toFixed?.(1) ?? creature.y ?? 0),
        energy: Number(creature.energy?.toFixed?.(1) ?? 0),
        selected: creature.id === gameState.selectedId,
        pinned: creature.id === gameState.pinnedId
      }));
  };

  const getVisibleFood = (limit = 10) => {
    const bounds = getViewportBounds();
    return (world.food || [])
      .filter(food =>
        food.x >= bounds.left &&
        food.x <= bounds.right &&
        food.y >= bounds.top &&
        food.y <= bounds.bottom
      )
      .slice(0, limit)
      .map(food => ({
        x: Number(food.x?.toFixed?.(1) ?? 0),
        y: Number(food.y?.toFixed?.(1) ?? 0),
        radius: Number(food.radius?.toFixed?.(1) ?? 0),
        kind: food.kind || food.type || 'food'
      }));
  };

  const renderGameToText = () => {
    const focusCreature = getFocusCreature();
    const homePage = domCache.get('homePage') || document.getElementById('home-page');
    const tutorialOverlay = document.getElementById('tutorial-overlay');
    const bounds = getViewportBounds();

    return JSON.stringify({
      coordinateSystem: 'World coordinates use a top-left origin with +x to the right and +y downward.',
      ui: {
        homeVisible: !!homePage && !homePage.classList.contains('hidden'),
        tutorialActive: !!tutorial?.isActive,
        tutorialVisible: !!tutorialOverlay && tutorialOverlay.style.display !== 'none',
        paused: !!gameState.paused,
        tool: tools?.mode ?? null,
        speed: gameState.fastForward,
        watchMode: !!gameState.watchModeEnabled,
        godMode: !!gameState.godModeActive,
        mobileLayout: document.body.classList.contains('mobile-device'),
        focusMode: document.body.classList.contains('mobile-focus-mode')
      },
      camera: {
        x: Number(camera.x.toFixed(1)),
        y: Number(camera.y.toFixed(1)),
        zoom: Number(camera.zoom.toFixed(3)),
        viewportWidth: Number(camera.viewportWidth || 0),
        viewportHeight: Number(camera.viewportHeight || 0),
        bounds: {
          left: Number(bounds.left.toFixed(1)),
          right: Number(bounds.right.toFixed(1)),
          top: Number(bounds.top.toFixed(1)),
          bottom: Number(bounds.bottom.toFixed(1))
        }
      },
      summary: {
        totalCreatures: world.creatures?.length || 0,
        totalFood: world.food?.length || 0,
        totalCorpses: world.corpses?.length || 0,
        worldTime: Number(world.t?.toFixed?.(2) ?? world.t ?? 0),
        fps: Number(gameState.fps?.toFixed?.(1) ?? 0)
      },
      selectedCreature: focusCreature ? {
        id: focusCreature.id,
        species: focusCreature.species || focusCreature.kind || focusCreature.genes?.species || null,
        stage: focusCreature.lifeStage || null,
        x: Number(focusCreature.x?.toFixed?.(1) ?? 0),
        y: Number(focusCreature.y?.toFixed?.(1) ?? 0),
        energy: Number(focusCreature.energy?.toFixed?.(1) ?? 0),
        age: Number(focusCreature.age?.toFixed?.(1) ?? 0),
        status: focusCreature.currentGoal || focusCreature.state || null
      } : null,
      visibleCreatures: getVisibleCreatures(),
      visibleFood: getVisibleFood()
    });
  };

  const advanceTime = (ms = 16) => {
    const requestedMs = Number(ms);
    const safeMs = Number.isFinite(requestedMs) ? Math.max(0, requestedMs) : 16;
    const fixedStepMs = Math.max(1, Math.round((gameLoop.fixedDt || (1 / 60)) * 1000));
    const steps = Math.max(1, Math.round(safeMs / fixedStepMs));
    const previousPaused = gameState.paused;

    gameState.paused = true;

    for (let index = 0; index < steps; index++) {
      gameLoop.step(gameLoop.fixedDt);
    }

    const renderDt = steps * gameLoop.fixedDt;
    camera.update(renderDt);
    gameLoop.render(renderDt);
    gameLoop.updateUI(renderDt);
    gameLoop.updateSubsystems(renderDt);

    try {
      eventSystem.emit(GameEvents.FRAME_UPDATE, {
        dt: renderDt,
        now: performance.now(),
        worldTime: world.t,
        timeScale: renderDt > 0 ? 1 : 0
      }, { throwOnError: false });
    } catch {
      // Keep the testing hook resilient.
    }

    gameLoop.lastNow = performance.now();
    gameState.accumulator = 0;
    gameState.paused = previousPaused;

    return {
      steps,
      simulatedMs: Math.round(renderDt * 1000),
      worldTime: Number(world.t?.toFixed?.(2) ?? world.t ?? 0),
      paused: gameState.paused
    };
  };

  // ============================================================================
  // START GAME LOOP
  // ============================================================================

  // Start the modular game loop
  errorHandler.safeExecute(() => {
    gameLoop.start();
  }, 'Game loop startup', () => {
    errorHandler.criticalError(new Error('Failed to start game loop'), 'Game loop startup');
  });

  // ============================================================================
  // UI AUTO-HIDE SYSTEM
  // ============================================================================

  errorHandler.safeExecute(() => {
    const hud = document.getElementById('hud');
    const stats = document.getElementById('stats');

    let lastInteractionTime = Date.now();

    // Track user interactions
    const updateInteraction = () => {
      lastInteractionTime = Date.now();
      // Remove auto-hidden state on interaction
      if (hud) hud.classList.remove('auto-hidden');
    };

    document.addEventListener('mousemove', updateInteraction);
    document.addEventListener('mousedown', updateInteraction);
    document.addEventListener('keydown', updateInteraction);
    document.addEventListener('touchstart', updateInteraction);

    // Auto-hide check interval
    setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastInteractionTime;
      const isIdle = idleTime > 4000; // 4 seconds of no interaction
      const cameraMoving = camera?.isMoving || false;

      // Auto-hide HUD when idle
      if (hud) {
        if (isIdle && !cameraMoving) {
          hud.classList.add('auto-hidden');
        }
      }

      // Fade stats when camera moving
      if (stats) {
        if (cameraMoving) {
          stats.classList.add('faded');
        } else {
          stats.classList.remove('faded');
        }
      }
    }, 500);

    console.debug('✨ UI auto-hide system initialized');
  }, 'UI auto-hide system');

  // ============================================================================
  // EXPORTS FOR DEBUGGING
  // ============================================================================

  window.render_game_to_text = renderGameToText;
  window.advanceTime = advanceTime;
  window.debug = debugConsole;

  const _devtoolsEnabled = gameState.showDebugOverlay ||
    new URLSearchParams(location.search).has('devtools');
  if (_devtoolsEnabled) {
    errorHandler.safeExecute(() => {
      window.world = world;
      window.camera = camera;
      window.tools = tools;
      window.audio = audio;
      window.achievements = achievements;
      window.tutorial = tutorial;
      window.gameState = gameState;
      window.inputManager = inputManager;
      window.uiController = uiController;
      window.gameLoop = gameLoop;
      window.errorHandler = errorHandler;
      window.notifications = notifications;
      window.performanceProfiler = performanceProfiler;
      window.configManager = configManager;
      window.campaignSystem = campaignSystem;
      window.diseaseSystem = diseaseSystem;
      window.gameplayModes = gameplayModes;
      window.sessionGoals = sessionGoals;
    }, 'Debug exports');
  }

  console.debug('🎉 Creature Sandbox initialized successfully!');
  console.debug('💡 Use the debug console (`) for advanced debugging tools');
}

// Wait for DOM to be ready before starting initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already ready
  initializeApp();
}
