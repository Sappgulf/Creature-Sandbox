/**
 * Entity Component System (ECS) - Flexible entity management
 * Provides composition-based architecture for better performance and modularity
 */

// ============================================================================
// CORE ECS TYPES
// ============================================================================

/**
 * Unique entity identifier
 * @typedef {number} EntityId
 */

/**
 * Component type identifier
 * @typedef {string} ComponentType
 */

/**
 * System update function
 * @callback SystemUpdateFunction
 * @param {number} dt - Delta time
 * @param {EntityId[]} entities - Entities with required components
 */

// ============================================================================
// ENTITY MANAGEMENT
// ============================================================================

/**
 * Entity Manager - Manages entity lifecycle and component storage
 */
export class EntityManager {
  constructor() {
    this.entities = new Map();
    this.components = new Map(); // componentType -> Map<entityId, componentData>
    this.nextEntityId = 1;
    this.entityMasks = new Map(); // entityId -> bitmask of component types
    this.componentTypes = new Map(); // componentType -> bitmask
    this.nextComponentBit = 1;
  }

  /**
   * Create a new entity
   * @returns {EntityId} The new entity ID
   */
  createEntity() {
    const entityId = this.nextEntityId++;
    this.entities.set(entityId, true);
    this.entityMasks.set(entityId, 0);
    return entityId;
  }

  /**
   * Destroy an entity and remove all its components
   * @param {EntityId} entityId - Entity to destroy
   */
  destroyEntity(entityId) {
    if (!this.entities.has(entityId)) return;

    // Remove from all component stores
    for (const [componentType, entityMap] of this.components) {
      entityMap.delete(entityId);
    }

    this.entities.delete(entityId);
    this.entityMasks.delete(entityId);
  }

  /**
   * Check if entity exists
   * @param {EntityId} entityId - Entity ID to check
   * @returns {boolean} True if entity exists
   */
  hasEntity(entityId) {
    return this.entities.has(entityId);
  }

  /**
   * Get all entity IDs
   * @returns {EntityId[]} Array of all entity IDs
   */
  getAllEntities() {
    return Array.from(this.entities.keys());
  }

  /**
   * Add a component to an entity
   * @param {EntityId} entityId - Entity ID
   * @param {ComponentType} componentType - Component type
   * @param {*} componentData - Component data
   */
  addComponent(entityId, componentType, componentData) {
    if (!this.entities.has(entityId)) {
      console.warn(`Entity ${entityId} does not exist`);
      return;
    }

    // Register component type if new
    if (!this.componentTypes.has(componentType)) {
      this.componentTypes.set(componentType, this.nextComponentBit);
      this.nextComponentBit <<= 1;
    }

    // Create component store if needed
    if (!this.components.has(componentType)) {
      this.components.set(componentType, new Map());
    }

    // Add component
    this.components.get(componentType).set(entityId, componentData);

    // Update entity mask
    const mask = this.entityMasks.get(entityId);
    this.entityMasks.set(entityId, mask | this.componentTypes.get(componentType));
  }

  /**
   * Remove a component from an entity
   * @param {EntityId} entityId - Entity ID
   * @param {ComponentType} componentType - Component type
   */
  removeComponent(entityId, componentType) {
    if (!this.entities.has(entityId) || !this.components.has(componentType)) return;

    const entityMap = this.components.get(componentType);
    entityMap.delete(entityId);

    // Update entity mask
    const mask = this.entityMasks.get(entityId);
    const componentBit = this.componentTypes.get(componentType);
    this.entityMasks.set(entityId, mask & ~componentBit);
  }

  /**
   * Get component data for an entity
   * @param {EntityId} entityId - Entity ID
   * @param {ComponentType} componentType - Component type
   * @returns {*} Component data or undefined
   */
  getComponent(entityId, componentType) {
    const entityMap = this.components.get(componentType);
    return entityMap ? entityMap.get(entityId) : undefined;
  }

  /**
   * Check if entity has a component
   * @param {EntityId} entityId - Entity ID
   * @param {ComponentType} componentType - Component type
   * @returns {boolean} True if entity has component
   */
  hasComponent(entityId, componentType) {
    const entityMap = this.components.get(componentType);
    return entityMap ? entityMap.has(entityId) : false;
  }

  /**
   * Get all entities with specific components (using bitmask for performance)
   * @param {...ComponentType} componentTypes - Required component types
   * @returns {EntityId[]} Array of entity IDs
   */
  queryEntities(...componentTypes) {
    if (componentTypes.length === 0) return this.getAllEntities();

    // Calculate required mask
    let requiredMask = 0;
    for (const componentType of componentTypes) {
      if (this.componentTypes.has(componentType)) {
        requiredMask |= this.componentTypes.get(componentType);
      } else {
        return []; // No entities can have a non-existent component type
      }
    }

    // Find entities with all required components
    const result = [];
    for (const [entityId, entityMask] of this.entityMasks) {
      if ((entityMask & requiredMask) === requiredMask) {
        result.push(entityId);
      }
    }

    return result;
  }

  /**
   * Get component data for multiple entities at once
   * @param {EntityId[]} entityIds - Entity IDs
   * @param {ComponentType} componentType - Component type
   * @returns {Map<EntityId, *>} Map of entity ID to component data
   */
  getComponentsBatch(entityIds, componentType) {
    const result = new Map();
    const entityMap = this.components.get(componentType);

    if (entityMap) {
      for (const entityId of entityIds) {
        const componentData = entityMap.get(entityId);
        if (componentData !== undefined) {
          result.set(entityId, componentData);
        }
      }
    }

    return result;
  }

  /**
   * Get statistics about the ECS state
   * @returns {Object} Statistics
   */
  getStats() {
    const stats = {
      entities: this.entities.size,
      componentTypes: this.components.size,
      components: {}
    };

    for (const [componentType, entityMap] of this.components) {
      stats.components[componentType] = entityMap.size;
    }

    return stats;
  }
}

// ============================================================================
// COMPONENT DEFINITIONS
// ============================================================================

/**
 * Position component
 */
export const COMPONENT_POSITION = 'position';
export function createPositionComponent(x = 0, y = 0) {
  return { x, y };
}

/**
 * Velocity component
 */
export const COMPONENT_VELOCITY = 'velocity';
export function createVelocityComponent(vx = 0, vy = 0) {
  return { vx, vy };
}

/**
 * Render component
 */
export const COMPONENT_RENDER = 'render';
export function createRenderComponent(type = 'circle', color = '#ffffff', size = 1) {
  return { type, color, size };
}

/**
 * Health component
 */
export const COMPONENT_HEALTH = 'health';
export function createHealthComponent(maxHealth = 100, currentHealth = 100) {
  return { maxHealth, currentHealth };
}

/**
 * Energy component
 */
export const COMPONENT_ENERGY = 'energy';
export function createEnergyComponent(maxEnergy = 100, currentEnergy = 100) {
  return { maxEnergy, currentEnergy };
}

/**
 * Genetics component
 */
export const COMPONENT_GENETICS = 'genetics';
export function createGeneticsComponent(genes = {}) {
  return { genes, age: 0, generation: 1 };
}

/**
 * AI component
 */
export const COMPONENT_AI = 'ai';
export function createAIComponent(behavior = 'wander') {
  return {
    behavior,
    target: null,
    state: 'idle',
    lastDecision: 0
  };
}

/**
 * Social component
 */
export const COMPONENT_SOCIAL = 'social';
export function createSocialComponent() {
  return {
    relationships: new Map(),
    groupId: null,
    leadership: 0
  };
}

/**
 * Memory component
 */
export const COMPONENT_MEMORY = 'memory';
export function createMemoryComponent(capacity = 50) {
  return {
    memories: [],
    capacity,
    lastMemoryTime: 0
  };
}

// ============================================================================
// SYSTEM MANAGEMENT
// ============================================================================

/**
 * System Manager - Manages ECS systems and their execution order
 */
export class SystemManager {
  constructor(entityManager) {
    this.entityManager = entityManager;
    this.systems = [];
    this.systemMap = new Map();
    this.executionOrder = [];
  }

  /**
   * Register a system
   * @param {string} name - System name
   * @param {SystemUpdateFunction} updateFunction - Update function
   * @param {ComponentType[]} requiredComponents - Required components
   * @param {number} priority - Execution priority (higher = later)
   */
  registerSystem(name, updateFunction, requiredComponents = [], priority = 0) {
    const system = {
      name,
      updateFunction,
      requiredComponents,
      priority,
      enabled: true,
      lastExecutionTime: 0,
      executionCount: 0,
      averageExecutionTime: 0
    };

    this.systems.push(system);
    this.systemMap.set(name, system);

    // Update execution order
    this.updateExecutionOrder();

    console.log(`🔧 Registered system: ${name} (${requiredComponents.join(', ')})`);
  }

  /**
   * Unregister a system
   * @param {string} name - System name
   */
  unregisterSystem(name) {
    const index = this.systems.findIndex(s => s.name === name);
    if (index >= 0) {
      this.systems.splice(index, 1);
      this.systemMap.delete(name);
      this.updateExecutionOrder();
      console.log(`🔧 Unregistered system: ${name}`);
    }
  }

  /**
   * Enable or disable a system
   * @param {string} name - System name
   * @param {boolean} enabled - Whether to enable the system
   */
  setSystemEnabled(name, enabled) {
    const system = this.systemMap.get(name);
    if (system) {
      system.enabled = enabled;
      console.log(`${enabled ? '▶️' : '⏸️'} System ${name} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Update all systems
   * @param {number} dt - Delta time
   */
  update(dt) {
    const startTime = performance.now();

    for (const system of this.systems) {
      if (!system.enabled) continue;

      const systemStartTime = performance.now();

      try {
        // Get entities with required components
        const entities = this.entityManager.queryEntities(...system.requiredComponents);

        // Update system
        system.updateFunction(dt, entities);

        // Update profiling data
        const executionTime = performance.now() - systemStartTime;
        system.lastExecutionTime = executionTime;
        system.executionCount++;
        system.averageExecutionTime =
          (system.averageExecutionTime * (system.executionCount - 1) + executionTime) / system.executionCount;

      } catch (error) {
        console.error(`System ${system.name} failed:`, error);
        // Disable failing system to prevent spam
        system.enabled = false;
      }
    }

    const totalExecutionTime = performance.now() - startTime;
    if (totalExecutionTime > 16.67) { // Over 1 frame at 60fps
      console.warn(`⚠️ System update took ${totalExecutionTime.toFixed(2)}ms (${this.systems.length} systems)`);
    }
  }

  /**
   * Update execution order based on priorities
   * @private
   */
  updateExecutionOrder() {
    this.systems.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get system profiling information
   * @returns {Object} Profiling data
   */
  getSystemStats() {
    const stats = {};

    for (const system of this.systems) {
      stats[system.name] = {
        enabled: system.enabled,
        priority: system.priority,
        requiredComponents: system.requiredComponents,
        executionCount: system.executionCount,
        averageExecutionTime: system.averageExecutionTime,
        lastExecutionTime: system.lastExecutionTime
      };
    }

    return stats;
  }
}

// ============================================================================
// PREDEFINED SYSTEMS
// ============================================================================

/**
 * Physics system - handles position and velocity updates
 */
export function createPhysicsSystem(entityManager) {
  return function physicsUpdate(dt, entities) {
    const positions = entityManager.getComponentsBatch(entities, COMPONENT_POSITION);
    const velocities = entityManager.getComponentsBatch(entities, COMPONENT_VELOCITY);

    for (const entityId of entities) {
      const position = positions.get(entityId);
      const velocity = velocities.get(entityId);

      if (position && velocity) {
        // Update position based on velocity
        position.x += velocity.vx * dt;
        position.y += velocity.vy * dt;

        // Simple friction
        velocity.vx *= 0.98;
        velocity.vy *= 0.98;
      }
    }
  };
}

/**
 * Health system - handles health regeneration and death
 */
export function createHealthSystem(entityManager) {
  return function healthUpdate(dt, entities) {
    const healthComponents = entityManager.getComponentsBatch(entities, COMPONENT_HEALTH);

    for (const entityId of entities) {
      const health = healthComponents.get(entityId);
      if (!health) continue;

      // Simple health regeneration
      if (health.currentHealth < health.maxHealth) {
        health.currentHealth = Math.min(health.maxHealth, health.currentHealth + dt * 5);
      }

      // Check for death
      if (health.currentHealth <= 0) {
        // Emit death event
        if (window.eventSystem) {
          window.eventSystem.emit('entity:death', { entityId, cause: 'health' });
        }
        // Mark for removal (handled by cleanup system)
        entityManager.addComponent(entityId, 'marked_for_removal', true);
      }
    }
  };
}

/**
 * AI system - handles basic AI behavior
 */
export function createAISystem(entityManager) {
  return function aiUpdate(dt, entities) {
    const aiComponents = entityManager.getComponentsBatch(entities, COMPONENT_AI);
    const positions = entityManager.getComponentsBatch(entities, COMPONENT_POSITION);
    const velocities = entityManager.getComponentsBatch(entities, COMPONENT_VELOCITY);

    for (const entityId of entities) {
      const ai = aiComponents.get(entityId);
      const position = positions.get(entityId);
      const velocity = velocities.get(entityId);

      if (!ai || !position || !velocity) continue;

      // Simple wander behavior
      if (ai.behavior === 'wander') {
        // Random movement
        if (Math.random() < 0.02) { // 2% chance per frame
          const angle = Math.random() * Math.PI * 2;
          const speed = 50;
          velocity.vx = Math.cos(angle) * speed;
          velocity.vy = Math.sin(angle) * speed;
        }
      }
    }
  };
}

// ============================================================================
// ECS WORLD - Convenience wrapper
// ============================================================================

/**
 * ECS World - Complete ECS environment
 */
export class ECSWorld {
  constructor() {
    this.entityManager = new EntityManager();
    this.systemManager = new SystemManager(this.entityManager);

    // Register built-in systems
    this.systemManager.registerSystem('physics', createPhysicsSystem(this.entityManager), [COMPONENT_POSITION, COMPONENT_VELOCITY], 0);
    this.systemManager.registerSystem('health', createHealthSystem(this.entityManager), [COMPONENT_HEALTH], 1);
    this.systemManager.registerSystem('ai', createAISystem(this.entityManager), [COMPONENT_AI, COMPONENT_POSITION, COMPONENT_VELOCITY], 2);
  }

  /**
   * Create a new entity
   * @returns {EntityId} Entity ID
   */
  createEntity() {
    return this.entityManager.createEntity();
  }

  /**
   * Destroy an entity
   * @param {EntityId} entityId - Entity to destroy
   */
  destroyEntity(entityId) {
    this.entityManager.destroyEntity(entityId);
  }

  /**
   * Add component to entity
   * @param {EntityId} entityId - Entity ID
   * @param {ComponentType} componentType - Component type
   * @param {*} componentData - Component data
   */
  addComponent(entityId, componentType, componentData) {
    this.entityManager.addComponent(entityId, componentType, componentData);
  }

  /**
   * Update all systems
   * @param {number} dt - Delta time
   */
  update(dt) {
    this.systemManager.update(dt);
  }

  /**
   * Get world statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      entities: this.entityManager.getStats(),
      systems: this.systemManager.getSystemStats()
    };
  }
}

// Global ECS world instance (can be used alongside existing Creature system)
export const ecsWorld = new ECSWorld();
