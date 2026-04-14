/**
 * Scenario Editor - Create and manage custom simulation challenges
 * Provides tools for designing scenarios with specific conditions, objectives, and challenges
 */

import { eventSystem } from './event-system.js';

/**
 * Scenario Template
 */
class ScenarioTemplate {
  constructor() {
    this.id = '';
    this.name = '';
    this.description = '';
    this.difficulty = 'normal'; // easy, normal, hard, expert
    this.category = 'survival'; // survival, evolution, ecology, challenge

    // Initial world conditions
    this.world = {
      width: 4000,
      height: 2800,
      temperature: { enabled: true, baseTemp: 0.7, tempGradient: 0.3 },
      seasonSpeed: 0.015,
      dayLength: 120
    };

    // Initial creatures
    this.creatures = {
      initialCount: 10,
      species: [{
        name: 'Starter Species',
        count: 10,
        genes: {
          speed: { min: 0.5, max: 1.5, default: 0.8 },
          sense: { min: 50, max: 150, default: 90 },
          metabolism: { min: 0.8, max: 1.2, default: 1.0 },
          size: { min: 2.5, max: 5.0, default: 3.5 }
        }
      }]
    };

    // Food and resources
    this.resources = {
      initialFood: 50,
      foodRespawnRate: 1.0,
      maxFood: 500,
      specialResources: [] // { type, x, y, amount, respawnTime }
    };

    // Environmental events and challenges
    this.events = {
      disasters: [],
      weather: [],
      migrations: [],
      timedEvents: [] // { time, type, parameters }
    };

    // Objectives and win conditions
    this.objectives = {
      primary: {
        type: 'population', // population, diversity, survival, time
        target: 100,
        timeLimit: 0, // 0 = no limit
        description: 'Reach a population of 100 creatures'
      },
      secondary: [],
      failureConditions: []
    };

    // Special rules and modifiers
    this.rules = {
      mutationRate: 0.05,
      sexualSelection: true,
      geneticDisorders: true,
      predatorPressure: 0,
      foodScarcity: 1.0,
      environmentalHazards: []
    };

    // UI and tutorial hints
    this.tutorial = {
      enabled: false,
      hints: [],
      objectives: []
    };

    this.version = '1.0';
    this.created = new Date().toISOString();
    this.modified = new Date().toISOString();
  }

  /**
   * Validate scenario data
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.name.trim()) errors.push('Scenario name is required');
    if (!this.description.trim()) errors.push('Scenario description is required');

    if (this.creatures.initialCount < 1) errors.push('Must have at least 1 initial creature');
    if (this.resources.initialFood < 0) errors.push('Initial food cannot be negative');

    if (this.objectives.primary.target <= 0) errors.push('Primary objective must have a valid target');

    const validDifficulties = ['easy', 'normal', 'hard', 'expert'];
    if (!validDifficulties.includes(this.difficulty)) {
      errors.push('Invalid difficulty level');
    }

    const validCategories = ['survival', 'evolution', 'ecology', 'challenge'];
    if (!validCategories.includes(this.category)) {
      errors.push('Invalid category');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Clone this scenario template
   * @returns {ScenarioTemplate} Cloned scenario
   */
  clone() {
    return ScenarioTemplate.fromJSON(this.toJSON());
  }

  /**
   * Export to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return { ...this };
  }

  /**
   * Import from JSON
   * @param {Object} data - JSON data
   * @returns {ScenarioTemplate} Scenario instance
   */
  static fromJSON(data) {
    const scenario = new ScenarioTemplate();
    Object.assign(scenario, data);
    return scenario;
  }
}

/**
 * Scenario Editor UI
 */
export class ScenarioEditor {
  constructor(container) {
    this.container = container;
    this.currentScenario = new ScenarioTemplate();
    this.isVisible = false;
    this.selectedTab = 'basic';
    this.templates = this.loadTemplates();

    this.createUI();
    this.setupEventListeners();
    this.loadDefaultTemplates();

    console.debug('🎭 Scenario editor initialized');
  }

  createUI() {
    this.panel = document.createElement('div');
    this.panel.id = 'scenario-editor';
    this.panel.style.cssText = `
      position: fixed;
      top: 60px;
      left: 20px;
      width: 900px;
      height: 700px;
      background: rgba(15, 15, 15, 0.95);
      border: 2px solid #00ff00;
      border-radius: 8px;
      display: none;
      z-index: 9998;
      font-family: monospace;
      color: #00ff00;
      backdrop-filter: blur(15px);
      overflow: hidden;
    `;

    this.panel.innerHTML = `
      <div style="padding: 15px; height: 100%; display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2 style="margin: 0; color: #00ff00;">Scenario Editor</h2>
          <div>
            <button id="scenario-save" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 4px 12px; margin-right: 8px;">Save</button>
            <button id="scenario-load" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 4px 12px; margin-right: 8px;">Load</button>
            <button id="scenario-test" style="background: #2a5; border: 1px solid #0f0; color: #0f0; cursor: pointer; padding: 4px 12px; margin-right: 8px;">Test</button>
            <button id="scenario-close" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 4px 12px;">×</button>
          </div>
        </div>

        <!-- Tabs -->
        <div id="scenario-tabs" style="display: flex; margin-bottom: 15px; border-bottom: 1px solid #444;">
          <button class="tab-button active" data-tab="basic">Basic</button>
          <button class="tab-button" data-tab="creatures">Creatures</button>
          <button class="tab-button" data-tab="environment">Environment</button>
          <button class="tab-button" data-tab="objectives">Objectives</button>
          <button class="tab-button" data-tab="events">Events</button>
          <button class="tab-button" data-tab="rules">Rules</button>
        </div>

        <!-- Content Area -->
        <div id="scenario-content" style="flex: 1; overflow-y: auto; padding-right: 10px;">
          ${this.createBasicTab()}
          ${this.createCreaturesTab()}
          ${this.createEnvironmentTab()}
          ${this.createObjectivesTab()}
          ${this.createEventsTab()}
          ${this.createRulesTab()}
        </div>

        <!-- Status Bar -->
        <div id="scenario-status" style="margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.5); border-radius: 4px; font-size: 12px;">
          <span id="status-text">Ready</span>
          <span style="float: right;">
            <span id="validation-status" style="color: #ffa500;">○ Not validated</span>
          </span>
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);

    // Add tab styles
    const style = document.createElement('style');
    style.textContent = `
      .tab-button {
        background: #222;
        border: 1px solid #444;
        color: #888;
        cursor: pointer;
        padding: 8px 16px;
        margin-right: 2px;
        border-bottom: none;
        border-radius: 4px 4px 0 0;
      }
      .tab-button.active {
        background: #333;
        color: #00ff00;
        border-color: #00ff00;
      }
      .tab-button:hover {
        background: #444;
        color: #fff;
      }
      .tab-content {
        display: none;
      }
      .tab-content.active {
        display: block;
      }
      .form-group {
        margin-bottom: 15px;
      }
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
        color: #00ff00;
      }
      .form-group input, .form-group select, .form-group textarea {
        width: 100%;
        padding: 6px;
        background: #222;
        border: 1px solid #555;
        color: #fff;
        font-family: monospace;
        border-radius: 3px;
      }
      .form-group textarea {
        resize: vertical;
        min-height: 60px;
      }
      .form-row {
        display: flex;
        gap: 10px;
        align-items: end;
      }
      .form-row > * {
        flex: 1;
      }
      .array-editor {
        border: 1px solid #555;
        border-radius: 4px;
        padding: 10px;
        margin-top: 5px;
        background: rgba(30, 30, 30, 0.5);
      }
      .array-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        padding: 8px;
        background: rgba(40, 40, 40, 0.8);
        border-radius: 3px;
      }
      .array-item:last-child {
        margin-bottom: 0;
      }
      .remove-item {
        background: #a00;
        border: none;
        color: white;
        cursor: pointer;
        padding: 2px 8px;
        margin-left: 8px;
        border-radius: 2px;
      }
      .add-item {
        background: #0a0;
        border: 1px solid #0f0;
        color: #0f0;
        cursor: pointer;
        padding: 4px 12px;
        margin-top: 8px;
        border-radius: 3px;
      }
      .slider-container {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .slider-container input[type="range"] {
        flex: 1;
      }
      .slider-value {
        min-width: 40px;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  createBasicTab() {
    return `
      <div id="tab-basic" class="tab-content active">
        <div class="form-group">
          <label for="scenario-name">Scenario Name</label>
          <input type="text" id="scenario-name" placeholder="Enter scenario name">
        </div>

        <div class="form-group">
          <label for="scenario-description">Description</label>
          <textarea id="scenario-description" placeholder="Describe your scenario..."></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="scenario-difficulty">Difficulty</label>
            <select id="scenario-difficulty">
              <option value="easy">Easy</option>
              <option value="normal" selected>Normal</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div class="form-group">
            <label for="scenario-category">Category</label>
            <select id="scenario-category">
              <option value="survival" selected>Survival</option>
              <option value="evolution">Evolution</option>
              <option value="ecology">Ecology</option>
              <option value="challenge">Challenge</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Tutorial Mode</label>
          <label style="display: inline-flex; align-items: center; margin-right: 20px;">
            <input type="checkbox" id="scenario-tutorial" style="margin-right: 8px;">
            Enable tutorial hints
          </label>
        </div>
      </div>
    `;
  }

  createCreaturesTab() {
    return `
      <div id="tab-creatures" class="tab-content">
        <div class="form-group">
          <label for="initial-count">Initial Creature Count</label>
          <div class="slider-container">
            <input type="range" id="initial-count" min="1" max="100" value="10" step="1">
            <span class="slider-value" id="initial-count-value">10</span>
          </div>
        </div>

        <div class="form-group">
          <label>Species Configuration</label>
          <div id="species-list" class="array-editor">
            <!-- Species items will be added here -->
          </div>
          <button class="add-item" id="add-species">Add Species</button>
        </div>
      </div>
    `;
  }

  createEnvironmentTab() {
    return `
      <div id="tab-environment" class="tab-content">
        <div class="form-row">
          <div class="form-group">
            <label for="world-width">World Width</label>
            <input type="number" id="world-width" value="4000" min="1000" max="10000">
          </div>
          <div class="form-group">
            <label for="world-height">World Height</label>
            <input type="number" id="world-height" value="2800" min="1000" max="10000">
          </div>
        </div>

        <div class="form-group">
          <label>Temperature System</label>
          <label style="display: inline-flex; align-items: center; margin-right: 20px;">
            <input type="checkbox" id="temp-enabled" checked style="margin-right: 8px;">
            Enable temperature effects
          </label>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="base-temp">Base Temperature</label>
            <div class="slider-container">
              <input type="range" id="base-temp" min="0" max="1" value="0.7" step="0.1">
              <span class="slider-value" id="base-temp-value">0.7</span>
            </div>
          </div>
          <div class="form-group">
            <label for="temp-gradient">Temperature Gradient</label>
            <div class="slider-container">
              <input type="range" id="temp-gradient" min="0" max="1" value="0.3" step="0.1">
              <span class="slider-value" id="temp-gradient-value">0.3</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="season-speed">Season Speed</label>
          <div class="slider-container">
            <input type="range" id="season-speed" min="0" max="0.1" value="0.015" step="0.001">
            <span class="slider-value" id="season-speed-value">0.015</span>
          </div>
        </div>

        <div class="form-group">
          <label for="day-length">Day Length (seconds)</label>
          <input type="number" id="day-length" value="120" min="10" max="1000">
        </div>
      </div>
    `;
  }

  createObjectivesTab() {
    return `
      <div id="tab-objectives" class="tab-content">
        <div class="form-group">
          <label>Primary Objective</label>
          <div class="form-row">
            <div class="form-group">
              <label for="objective-type">Type</label>
              <select id="objective-type">
                <option value="population" selected>Population Target</option>
                <option value="diversity">Genetic Diversity</option>
                <option value="survival">Survival Time</option>
                <option value="time">Time Limit</option>
              </select>
            </div>
            <div class="form-group">
              <label for="objective-target">Target Value</label>
              <input type="number" id="objective-target" value="100" min="1">
            </div>
          </div>
          <div class="form-group">
            <label for="objective-description">Description</label>
            <input type="text" id="objective-description" value="Reach a population of 100 creatures">
          </div>
          <div class="form-group">
            <label for="time-limit">Time Limit (seconds, 0 = no limit)</label>
            <input type="number" id="time-limit" value="0" min="0">
          </div>
        </div>

        <div class="form-group">
          <label>Secondary Objectives</label>
          <div id="secondary-objectives" class="array-editor">
            <!-- Secondary objectives will be added here -->
          </div>
          <button class="add-item" id="add-secondary-objective">Add Secondary Objective</button>
        </div>

        <div class="form-group">
          <label>Failure Conditions</label>
          <div id="failure-conditions" class="array-editor">
            <!-- Failure conditions will be added here -->
          </div>
          <button class="add-item" id="add-failure-condition">Add Failure Condition</button>
        </div>
      </div>
    `;
  }

  createEventsTab() {
    return `
      <div id="tab-events" class="tab-content">
        <div class="form-group">
          <label>Timed Events</label>
          <div id="timed-events" class="array-editor">
            <!-- Timed events will be added here -->
          </div>
          <button class="add-item" id="add-timed-event">Add Timed Event</button>
        </div>

        <div class="form-group">
          <label>Environmental Events</label>
          <div class="form-row">
            <label style="display: inline-flex; align-items: center; margin-right: 20px;">
              <input type="checkbox" id="enable-disasters" style="margin-right: 8px;">
              Random disasters
            </label>
            <label style="display: inline-flex; align-items: center; margin-right: 20px;">
              <input type="checkbox" id="enable-weather" style="margin-right: 8px;">
              Dynamic weather
            </label>
            <label style="display: inline-flex; align-items: center;">
              <input type="checkbox" id="enable-migration" style="margin-right: 8px;">
              Creature migration
            </label>
          </div>
        </div>
      </div>
    `;
  }

  createRulesTab() {
    return `
      <div id="tab-rules" class="tab-content">
        <div class="form-group">
          <label for="mutation-rate">Mutation Rate</label>
          <div class="slider-container">
            <input type="range" id="mutation-rate" min="0" max="0.5" value="0.05" step="0.01">
            <span class="slider-value" id="mutation-rate-value">0.05</span>
          </div>
        </div>

        <div class="form-group">
          <label>Genetic Features</label>
          <div class="form-row">
            <label style="display: inline-flex; align-items: center; margin-right: 20px;">
              <input type="checkbox" id="sexual-selection" checked style="margin-right: 8px;">
              Sexual selection
            </label>
            <label style="display: inline-flex; align-items: center; margin-right: 20px;">
              <input type="checkbox" id="genetic-disorders" checked style="margin-right: 8px;">
              Genetic disorders
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="predator-pressure">Predator Pressure</label>
          <div class="slider-container">
            <input type="range" id="predator-pressure" min="0" max="5" value="0" step="0.1">
            <span class="slider-value" id="predator-pressure-value">0.0</span>
          </div>
        </div>

        <div class="form-group">
          <label for="food-scarcity">Food Scarcity Multiplier</label>
          <div class="slider-container">
            <input type="range" id="food-scarcity" min="0.1" max="5" value="1" step="0.1">
            <span class="slider-value" id="food-scarcity-value">1.0</span>
          </div>
        </div>

        <div class="form-group">
          <label>Environmental Hazards</label>
          <div id="environmental-hazards" class="array-editor">
            <!-- Hazards will be added here -->
          </div>
          <button class="add-item" id="add-hazard">Add Hazard</button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Close button
    this.panel.querySelector('#scenario-close').addEventListener('click', () => this.hide());

    // Tab switching
    const tabButtons = this.panel.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => this.switchTab(button.dataset.tab));
    });

    // Save/Load/Test buttons
    this.panel.querySelector('#scenario-save').addEventListener('click', () => this.saveScenario());
    this.panel.querySelector('#scenario-load').addEventListener('click', () => this.showLoadDialog());
    this.panel.querySelector('#scenario-test').addEventListener('click', () => this.testScenario());

    // Slider value updates
    this.setupSliderListeners();

    // Keyboard shortcut (Ctrl+Shift+S)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Make panel draggable
    this.makeDraggable();
  }

  setupSliderListeners() {
    const sliders = [
      { id: 'initial-count', valueId: 'initial-count-value', multiplier: 1 },
      { id: 'base-temp', valueId: 'base-temp-value', multiplier: 0.1 },
      { id: 'temp-gradient', valueId: 'temp-gradient-value', multiplier: 0.1 },
      { id: 'season-speed', valueId: 'season-speed-value', multiplier: 0.001 },
      { id: 'mutation-rate', valueId: 'mutation-rate-value', multiplier: 0.01 },
      { id: 'predator-pressure', valueId: 'predator-pressure-value', multiplier: 0.1 },
      { id: 'food-scarcity', valueId: 'food-scarcity-value', multiplier: 0.1 }
    ];

    sliders.forEach(({ id, valueId, multiplier }) => {
      const slider = this.panel.querySelector(`#${id}`);
      const valueElement = this.panel.querySelector(`#${valueId}`);

      if (slider && valueElement) {
        slider.addEventListener('input', () => {
          const value = parseFloat(slider.value) * (multiplier || 1);
          valueElement.textContent = value.toFixed(multiplier === 0.001 ? 3 : 1);
          this.updateScenarioFromUI();
        });
      }
    });
  }

  makeDraggable() {
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const header = this.panel.querySelector('h2');

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragOffsetX = e.clientX - this.panel.offsetLeft;
      dragOffsetY = e.clientY - this.panel.offsetTop;
      this.panel.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        this.panel.style.left = (e.clientX - dragOffsetX) + 'px';
        this.panel.style.top = (e.clientY - dragOffsetY) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      this.panel.style.cursor = 'grab';
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    const tabButtons = this.panel.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update tab content
    const tabContents = this.panel.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    this.selectedTab = tabName;
  }

  updateUIFromScenario() {
    const s = this.currentScenario;

    // Basic tab
    this.panel.querySelector('#scenario-name').value = s.name;
    this.panel.querySelector('#scenario-description').value = s.description;
    this.panel.querySelector('#scenario-difficulty').value = s.difficulty;
    this.panel.querySelector('#scenario-category').value = s.category;
    this.panel.querySelector('#scenario-tutorial').checked = s.tutorial.enabled;

    // Creatures tab
    this.panel.querySelector('#initial-count').value = s.creatures.initialCount;
    this.panel.querySelector('#initial-count-value').textContent = s.creatures.initialCount;

    // Environment tab
    this.panel.querySelector('#world-width').value = s.world.width;
    this.panel.querySelector('#world-height').value = s.world.height;
    this.panel.querySelector('#temp-enabled').checked = s.world.temperature.enabled;
    this.panel.querySelector('#base-temp').value = s.world.temperature.baseTemp / 0.1;
    this.panel.querySelector('#base-temp-value').textContent = s.world.temperature.baseTemp;
    this.panel.querySelector('#temp-gradient').value = s.world.temperature.tempGradient / 0.1;
    this.panel.querySelector('#temp-gradient-value').textContent = s.world.temperature.tempGradient;
    this.panel.querySelector('#season-speed').value = s.world.seasonSpeed / 0.001;
    this.panel.querySelector('#season-speed-value').textContent = s.world.seasonSpeed;
    this.panel.querySelector('#day-length').value = s.world.dayLength;

    // Objectives tab
    this.panel.querySelector('#objective-type').value = s.objectives.primary.type;
    this.panel.querySelector('#objective-target').value = s.objectives.primary.target;
    this.panel.querySelector('#objective-description').value = s.objectives.primary.description;
    this.panel.querySelector('#time-limit').value = s.objectives.primary.timeLimit;

    // Rules tab
    this.panel.querySelector('#mutation-rate').value = s.rules.mutationRate / 0.01;
    this.panel.querySelector('#mutation-rate-value').textContent = s.rules.mutationRate;
    this.panel.querySelector('#sexual-selection').checked = s.rules.sexualSelection;
    this.panel.querySelector('#genetic-disorders').checked = s.rules.geneticDisorders;
    this.panel.querySelector('#predator-pressure').value = s.rules.predatorPressure / 0.1;
    this.panel.querySelector('#predator-pressure-value').textContent = s.rules.predatorPressure;
    this.panel.querySelector('#food-scarcity').value = s.rules.foodScarcity / 0.1;
    this.panel.querySelector('#food-scarcity-value').textContent = s.rules.foodScarcity;

    this.validateAndUpdateStatus();
  }

  updateScenarioFromUI() {
    const s = this.currentScenario;

    // Basic tab
    s.name = this.panel.querySelector('#scenario-name').value;
    s.description = this.panel.querySelector('#scenario-description').value;
    s.difficulty = this.panel.querySelector('#scenario-difficulty').value;
    s.category = this.panel.querySelector('#scenario-category').value;
    s.tutorial.enabled = this.panel.querySelector('#scenario-tutorial').checked;

    // Creatures tab
    s.creatures.initialCount = parseInt(this.panel.querySelector('#initial-count').value);

    // Environment tab
    s.world.width = parseInt(this.panel.querySelector('#world-width').value);
    s.world.height = parseInt(this.panel.querySelector('#world-height').value);
    s.world.temperature.enabled = this.panel.querySelector('#temp-enabled').checked;
    s.world.temperature.baseTemp = parseFloat(this.panel.querySelector('#base-temp-value').textContent);
    s.world.temperature.tempGradient = parseFloat(this.panel.querySelector('#temp-gradient-value').textContent);
    s.world.seasonSpeed = parseFloat(this.panel.querySelector('#season-speed-value').textContent);
    s.world.dayLength = parseInt(this.panel.querySelector('#day-length').value);

    // Objectives tab
    s.objectives.primary.type = this.panel.querySelector('#objective-type').value;
    s.objectives.primary.target = parseInt(this.panel.querySelector('#objective-target').value);
    s.objectives.primary.description = this.panel.querySelector('#objective-description').value;
    s.objectives.primary.timeLimit = parseInt(this.panel.querySelector('#time-limit').value);

    // Rules tab
    s.rules.mutationRate = parseFloat(this.panel.querySelector('#mutation-rate-value').textContent);
    s.rules.sexualSelection = this.panel.querySelector('#sexual-selection').checked;
    s.rules.geneticDisorders = this.panel.querySelector('#genetic-disorders').checked;
    s.rules.predatorPressure = parseFloat(this.panel.querySelector('#predator-pressure-value').textContent);
    s.rules.foodScarcity = parseFloat(this.panel.querySelector('#food-scarcity-value').textContent);

    s.modified = new Date().toISOString();
  }

  validateAndUpdateStatus() {
    const validation = this.currentScenario.validate();
    const statusElement = this.panel.querySelector('#validation-status');
    const statusText = this.panel.querySelector('#status-text');

    if (validation.valid) {
      statusElement.textContent = '✓ Valid';
      statusElement.style.color = '#0f0';
      statusText.textContent = 'Ready to save';
    } else {
      statusElement.textContent = '✗ Invalid';
      statusElement.style.color = '#f00';
      statusText.textContent = `Errors: ${validation.errors.join(', ')}`;
    }
  }

  saveScenario() {
    this.updateScenarioFromUI();

    const validation = this.currentScenario.validate();
    if (!validation.valid) {
      alert('Cannot save: ' + validation.errors.join('\n'));
      return;
    }

    const scenarioData = this.currentScenario.toJSON();
    const filename = `scenario-${this.currentScenario.id || Date.now()}.json`;

    const blob = new Blob([JSON.stringify(scenarioData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.debug('🎭 Scenario saved:', filename);
    this.updateStatus('Scenario saved successfully');
  }

  showLoadDialog() {
    // Create file input for loading
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const scenarioData = JSON.parse(event.target.result);
            this.currentScenario = ScenarioTemplate.fromJSON(scenarioData);
            this.updateUIFromScenario();
            this.updateStatus('Scenario loaded successfully');
            console.debug('🎭 Scenario loaded:', file.name);
          } catch (error) {
            alert('Error loading scenario: ' + error.message);
          }
        };
        reader.readAsText(file);
      }
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  testScenario() {
    this.updateScenarioFromUI();

    const validation = this.currentScenario.validate();
    if (!validation.valid) {
      alert('Cannot test invalid scenario:\n' + validation.errors.join('\n'));
      return;
    }

    // Emit event to start the scenario
    if (eventSystem) {
      eventSystem.emit('scenario:test', this.currentScenario.toJSON());
    }

    this.updateStatus('Testing scenario...');
    console.debug('🎭 Testing scenario:', this.currentScenario.name);
  }

  loadTemplates() {
    // Load built-in scenario templates
    return {
      'survival-basic': {
        name: 'Basic Survival',
        description: 'A simple survival challenge with basic conditions.',
        difficulty: 'easy',
        category: 'survival'
      },
      'evolution-pressure': {
        name: 'Evolution Under Pressure',
        description: 'High mutation rates and environmental stress drive rapid evolution.',
        difficulty: 'hard',
        category: 'evolution'
      },
      'ecology-balance': {
        name: 'Ecological Balance',
        description: 'Maintain ecosystem stability while growing population.',
        difficulty: 'normal',
        category: 'ecology'
      }
    };
  }

  loadDefaultTemplates() {
    // This would load default templates from storage
    this.updateStatus('Default templates loaded');
  }

  updateStatus(message) {
    const statusText = this.panel.querySelector('#status-text');
    statusText.textContent = message;

    // Clear status after 3 seconds
    setTimeout(() => {
      if (statusText.textContent === message) {
        statusText.textContent = 'Ready';
      }
    }, 3000);
  }

  show() {
    this.panel.style.display = 'block';
    this.isVisible = true;
    this.updateUIFromScenario();
    console.debug('🎭 Scenario editor opened');
  }

  hide() {
    this.panel.style.display = 'none';
    this.isVisible = false;
    console.debug('🎭 Scenario editor closed');
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Get the current scenario data
   * @returns {Object} Scenario data
   */
  getCurrentScenario() {
    this.updateScenarioFromUI();
    return this.currentScenario.toJSON();
  }

  /**
   * Load a scenario from data
   * @param {Object} scenarioData - Scenario data
   */
  loadScenario(scenarioData) {
    this.currentScenario = ScenarioTemplate.fromJSON(scenarioData);
    this.updateUIFromScenario();
    this.updateStatus('Scenario loaded');
  }
}

// Global scenario editor instance
export const scenarioEditor = new ScenarioEditor(document.body);

// Note: Initialization is handled by UI controller, not auto-initialized here

// Built-in scenario templates
export const builtInScenarios = {
  'ice-age': {
    id: 'ice-age',
    name: 'Ice Age Survival',
    description: 'Survive in freezing temperatures with scarce food resources.',
    difficulty: 'hard',
    category: 'survival',
    world: {
      temperature: { enabled: true, baseTemp: 0.1, tempGradient: 0.8 },
      seasonSpeed: 0.005
    },
    resources: {
      foodRespawnRate: 0.3,
      maxFood: 200
    },
    objectives: {
      primary: {
        type: 'survival',
        target: 300,
        timeLimit: 1800,
        description: 'Survive for 30 minutes in freezing conditions'
      }
    },
    rules: {
      foodScarcity: 2.5,
      predatorPressure: 1.5
    }
  },

  'population-explosion': {
    id: 'population-explosion',
    name: 'Population Explosion',
    description: 'Rapid population growth with limited resources creates intense competition.',
    difficulty: 'expert',
    category: 'challenge',
    creatures: {
      initialCount: 50
    },
    resources: {
      initialFood: 100,
      maxFood: 300,
      foodRespawnRate: 0.5
    },
    objectives: {
      primary: {
        type: 'population',
        target: 1000,
        timeLimit: 1200,
        description: 'Reach 1000 creatures in 20 minutes'
      }
    },
    rules: {
      mutationRate: 0.1,
      foodScarcity: 1.8
    }
  },

  'genetic-paradise': {
    id: 'genetic-paradise',
    name: 'Genetic Paradise',
    description: 'Optimal conditions for studying genetic diversity and evolution.',
    difficulty: 'normal',
    category: 'evolution',
    resources: {
      initialFood: 200,
      maxFood: 800,
      foodRespawnRate: 2.0
    },
    objectives: {
      primary: {
        type: 'diversity',
        target: 0.8,
        description: 'Achieve high genetic diversity (80%+)'
      }
    },
    rules: {
      mutationRate: 0.08,
      sexualSelection: true,
      geneticDisorders: false
    }
  }
};

console.debug('🎭 Scenario system initialized with', Object.keys(builtInScenarios).length, 'built-in scenarios');
