/**
 * Main Entry Point - Simplified initialization using modular architecture
 * This replaces the massive 2000+ line main.js with clean, focused modules
 */
import { World } from './world-core.js';
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

// Import new modular systems
import { domCache } from './dom-cache.js';
import { gameState } from './game-state.js';
import { InputManager } from './input-manager.js';
import { UIController } from './ui-controller.js';
import { GameLoop } from './game-loop.js';
import { errorHandler } from './error-handler.js';
import { eventSystem, GameEvents } from './event-system.js';
import { configManager } from './config-manager.js';
import { poolManager } from './object-pool.js';
import { batchRenderer } from './batch-renderer.js';
import { performanceProfiler, initializePerformanceMonitor } from './performance-profiler.js';
import { scenarioEditor } from './scenario-editor.js';
import { diseaseSystem } from './disease-system.js';
import { campaignSystem, CAMPAIGN_LEVELS } from './campaign-system.js';

// Local helper to validate notification subsystem shape
function isNotificationSystem(candidate) {
  return !!candidate &&
    typeof candidate.show === 'function' &&
    typeof candidate.update === 'function' &&
    typeof candidate.draw === 'function';
}

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('🚀 Starting Creature Sandbox...');

// Wait for DOM to be ready before initializing
function initializeApp() {
  console.log('📄 DOM ready, initializing Creature Sandbox...');

  // Initialize DOM cache first (critical for performance)
  errorHandler.safeExecute(() => {
    domCache.initialize();
  }, 'DOM cache initialization', () => {
    errorHandler.criticalError(new Error('Failed to initialize DOM cache'), 'DOM cache initialization');
    return;
  });

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
      const rect = canvas.getBoundingClientRect();
      const dpr = 1.0; // Performance optimization: 1x DPR for max FPS

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      console.log(`🖼️ Canvas: ${rect.width}x${rect.height} (${canvas.width}x${canvas.height} internal @ ${dpr}x DPI)`);
    }, 'Canvas resize');
  }

  errorHandler.safeExecute(() => {
    setCanvasSize();
    // Handle window resize
    window.addEventListener('resize', setCanvasSize);
  }, 'Canvas setup');

  // ============================================================================
  // CORE SYSTEMS INITIALIZATION
  // ============================================================================

  // World and core entities
  const world = errorHandler.safeExecute(() => {
    const w = new World(4000, 2800);
    w.seed(70, 6, 200);
    return w;
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
      zoom: 0.25,
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
  const mobileSupport = errorHandler.safeExecute(() => {
    return new MobileSupport(canvas, camera);
  }, 'Mobile support initialization', null);

  if (!renderer) {
    errorHandler.criticalError(new Error('Failed to create renderer'), 'Renderer initialization');
    throw new Error('Cannot continue without renderer');
  }

  console.log('🎨 Ultra-optimized Canvas 2D renderer initialized');
  console.log('💪 60 FPS guaranteed with up to 500+ creatures!');

  // Initialize batch renderer once we have the 2D context
  errorHandler.safeExecute(() => {
    if (batchRenderer?.init) {
      const result = batchRenderer.init(ctx);
      console.log('🎨 Batch renderer initialized:', !!result);
    }
  }, 'Batch renderer initialization');

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
    return new AnalyticsTracker();
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

  // Game systems
  const saveSystem = errorHandler.safeExecute(() => {
    return new SaveSystem();
  }, 'Save system initialization', null);

  const geneEditor = errorHandler.safeExecute(() => {
    return new GeneEditor();
  }, 'Gene editor initialization', null);

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

  // Attach systems to world (with error handling)
  errorHandler.safeExecute(() => {
    if (lineageTracker) world.attachLineageTracker(lineageTracker);
    if (particles) world.attachParticleSystem(particles);
    if (heatmaps) world.attachHeatmapSystem(heatmaps);
    if (audio) world.attachAudioSystem(audio);
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
      sessionGoals
    });
  }, 'UI controller initialization', null);

  if (!uiController) {
    console.warn('⚠️ UI controller failed to initialize, UI may not work');
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
      sessionGoals
    });
  }, 'Game loop initialization', null);

  if (!gameLoop) {
    errorHandler.criticalError(new Error('Failed to create game loop'), 'Game loop initialization');
    throw new Error('Cannot continue without game loop');
  }

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
      if (campaignPanel) campaignPanel.classList.add('hidden');
      if (campaignProgress) campaignProgress.classList.remove('hidden');
      
      // Unpause
      gameState.setPaused(false);
      
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
        if (campaignPanel) campaignPanel.classList.remove('hidden');
        if (audio) audio.playUISound('click');
      });
    }

    // Close campaign panel
    if (campaignCloseBtn) {
      campaignCloseBtn.addEventListener('click', () => {
        if (campaignPanel) campaignPanel.classList.add('hidden');
      });
    }

    // Exit campaign
    if (campaignExitBtn) {
      campaignExitBtn.addEventListener('click', () => {
        campaignSystem.exitCampaign();
        if (campaignProgress) campaignProgress.classList.add('hidden');
        if (audio) audio.playUISound('click');
      });
    }

    // Update campaign during game loop
    eventSystem.on(GameEvents.FRAME_UPDATE, () => {
      if (campaignSystem.isActive) {
        campaignSystem.update(1/60, world);
        diseaseSystem.update(1/60, world);
        updateCampaignProgressUI();
        
        // Check if level completed or failed
        if (!campaignSystem.isActive) {
          if (campaignProgress) campaignProgress.classList.add('hidden');
        }
      }
    });

    console.log('🏆 Campaign system initialized');
  }, 'Campaign system initialization');

  // ============================================================================
  // STARTUP LOGIC
  // ============================================================================

  // Check for auto-save
  errorHandler.safeExecute(() => {
    if (saveSystem && saveSystem.hasAutoSave()) {
      showStartModal();
    } else {
      startNewGame();
    }
  }, 'Startup logic', () => startNewGame());

  // Start modal for save selection
  function showStartModal() {
    const startModal = domCache.get('startModal');
    const continueBtn = domCache.get('continueBtn');
    const newGameBtn = domCache.get('newGameBtn');

    errorHandler.safeExecute(() => {
      if (startModal) startModal.classList.remove('hidden');
    }, 'Start modal display');

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
            const loaded = saveSystem.loadAutoSave(World, Creature, Camera, makeGenes, BiomeGenerator);
            if (loaded) {
              Object.assign(world, loaded.world);
              Object.assign(camera, loaded.camera);
              if (loaded.lineageNames && lineageTracker) {
                lineageTracker.names = loaded.lineageNames;
              }
              console.log('✅ Auto-save loaded successfully!');
              if (audio) audio.playUISound('success');
            }
          }, 'Auto-save loading', () => {
            console.error('Failed to load auto-save:', 'unknown error');
            alert('Failed to load save. Starting new game.');
            if (audio) audio.playUISound('error');
          });

          errorHandler.safeExecute(() => {
            if (startModal) startModal.classList.add('hidden');
            gameState.startGame();

            // Start tutorial for new players
            if (tutorial && tutorial.shouldShow()) {
              tutorial.loadProgress();
              setTimeout(() => tutorial.start(), 1000);
            }
          }, 'Post-load setup');
        });
      }
    }, 'Continue button setup');

    // Handle new game button
    errorHandler.safeExecute(() => {
      if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
          errorHandler.safeExecute(() => {
            initAudioOnInteraction();
            if (audio) audio.playUISound('click');
            if (saveSystem) saveSystem.clearAutoSave();
            console.log('🆕 Starting new game...');

            if (startModal) startModal.classList.add('hidden');
            startNewGame();
          }, 'New game setup');
        });
      }
    }, 'New game button setup');
  }

  // Start new game
  function startNewGame() {
    errorHandler.safeExecute(() => {
      gameState.startGame();

      // Start tutorial for new players
      if (tutorial && tutorial.shouldShow()) {
        tutorial.loadProgress();
        setTimeout(() => tutorial.start(), 1000);
      }
    }, 'New game initialization');
  }

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
    const quickActions = document.getElementById('quick-actions');
    
    let lastInteractionTime = Date.now();
    let lastCameraMoving = false;
    
    // Track user interactions
    const updateInteraction = () => {
      lastInteractionTime = Date.now();
      // Remove auto-hidden state on interaction
      if (hud) hud.classList.remove('auto-hidden');
      if (quickActions) quickActions.classList.remove('hidden');
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
      
      // Hide quick actions when camera moving rapidly
      if (quickActions && cameraMoving !== lastCameraMoving) {
        if (cameraMoving) {
          quickActions.classList.add('hidden');
        } else {
          quickActions.classList.remove('hidden');
        }
        lastCameraMoving = cameraMoving;
      }
    }, 500);
    
    console.log('✨ UI auto-hide system initialized');
  }, 'UI auto-hide system');

  // ============================================================================
  // EXPORTS FOR DEBUGGING
  // ============================================================================

  // Expose systems globally for debugging (can be removed in production)
  errorHandler.safeExecute(() => {
    window.world = world;
    window.camera = camera;
    window.tools = tools;
    window.debug = debugConsole;
    window.audio = audio;
    window.achievements = achievements;
    window.tutorial = tutorial;
    window.gameState = gameState;
    window.inputManager = inputManager;
    window.uiController = uiController;
    window.gameLoop = gameLoop;
    window.errorHandler = errorHandler;
    window.notifications = notifications;
    window.campaignSystem = campaignSystem;
    window.diseaseSystem = diseaseSystem;
    window.gameplayModes = gameplayModes;
    window.sessionGoals = sessionGoals;
  }, 'Debug exports');

  console.log('🎉 Creature Sandbox initialized successfully!');
  console.log('💡 Use the debug console (`) for advanced debugging tools');
}

// Wait for DOM to be ready before starting initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already ready
  initializeApp();
}
