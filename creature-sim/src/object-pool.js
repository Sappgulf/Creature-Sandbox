/**
 * High-performance object pool system for minimizing garbage collection.
 * Provides reusable object instances to reduce allocation/deallocation overhead.
 *
 * Object pools are essential for high-frequency allocations like particles,
 * temporary vectors, and status effects. Instead of creating new objects
 * (which triggers GC), pools recycle existing objects.
 *
 * @example
 * const particlePool = new ObjectPool(
 *   () => ({ x: 0, y: 0, life: 0 }),  // Factory
 *   (p) => { p.x = 0; p.y = 0; },     // Reset
 *   100,                               // Initial size
 *   1000                               // Max size
 * );
 *
 * const particle = particlePool.get();
 * particle.x = 100;
 * // ... use particle ...
 * particlePool.release(particle);
 */

/**
 * Generic Object Pool class
 * @template T
 */
export class ObjectPool {
  /**
   * @param {Function} factory - Function that creates new objects
   * @param {Function} reset - Function that resets objects for reuse
   * @param {number} initialSize - Initial pool size
   * @param {number} maxSize - Maximum pool size (0 = unlimited)
   */
  constructor(factory, reset = null, initialSize = 10, maxSize = 1000) {
    this.factory = factory;
    this.reset = reset || this.defaultReset;
    this.maxSize = maxSize;
    this.pool = [];
    this.activeCount = 0;
    this.peakCount = 0;
    this.allocationCount = 0;
    this.hitCount = 0;
    this.missCount = 0;

    // Pre-populate pool
    this.expand(initialSize);
  }

  /**
   * Default reset function (does nothing)
   * @param {*} obj - Object to reset
   */
  defaultReset(_obj) {
    // Default: do nothing, let the user provide custom reset logic
  }

  /**
   * Expand pool by creating new objects
   * @param {number} count - Number of objects to add
   */
  expand(count) {
    for (let i = 0; i < count; i++) {
      if (this.maxSize > 0 && this.pool.length >= this.maxSize) break;

      const obj = this.factory();
      this.pool.push(obj);
      this.allocationCount++;
    }
  }

  /**
   * Get an object from the pool
   * @returns {*} Pooled object
   */
  get() {
    let obj;

    if (this.pool.length > 0) {
      // Reuse existing object
      obj = this.pool.pop();
      this.hitCount++;
    } else {
      // Create new object
      obj = this.factory();
      this.allocationCount++;
      this.missCount++;
    }

    this.activeCount++;
    this.peakCount = Math.max(this.peakCount, this.activeCount);

    return obj;
  }

  /**
   * Return an object to the pool
   * @param {*} obj - Object to return
   */
  release(obj) {
    if (!obj) return;

    // Reset object state
    this.reset(obj);

    // Add back to pool if not at capacity
    if (this.maxSize === 0 || this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }

    this.activeCount--;
  }

  /**
   * Release multiple objects at once
   * @param {Array} objects - Array of objects to release
   */
  releaseAll(objects) {
    for (let i = 0; i < objects.length; i++) {
      this.release(objects[i]);
    }
  }

  /**
   * Pre-warm the pool to a specific size
   * @param {number} targetSize - Target pool size
   */
  warm(targetSize) {
    const currentSize = this.pool.length;
    if (targetSize > currentSize) {
      this.expand(targetSize - currentSize);
    }
  }

  /**
   * Clear the pool (useful for cleanup)
   */
  clear() {
    this.pool.length = 0;
    this.activeCount = 0;
    this.peakCount = 0;
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get pool statistics
   * @returns {Object} Pool stats
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests * 100).toFixed(1) : '0.0';

    return {
      poolSize: this.pool.length,
      activeCount: this.activeCount,
      peakCount: this.peakCount,
      totalAllocations: this.allocationCount,
      hitRate: hitRate + '%',
      hitCount: this.hitCount,
      missCount: this.missCount,
      utilizationPercent: this.activeCount > 0 ? ((this.activeCount / (this.activeCount + this.pool.length)) * 100).toFixed(1) : '0.0'
    };
  }
}

/**
 * Vector2D pool for position/velocity vectors
 */
export class Vector2DPool extends ObjectPool {
  constructor(initialSize = 50, maxSize = 500) {
    super(
      () => ({ x: 0, y: 0 }),
      (vec) => { vec.x = 0; vec.y = 0; },
      initialSize,
      maxSize
    );
  }
}

/**
 * Array pool for temporary collections
 */
export class ArrayPool extends ObjectPool {
  constructor(initialSize = 20, maxSize = 200) {
    super(
      () => [],
      (arr) => { arr.length = 0; },
      initialSize,
      maxSize
    );
  }

  /**
   * Get an array with pre-allocated size hint
   * @param {number} sizeHint - Expected array size
   * @returns {Array} Pooled array
   */
  getWithSize(sizeHint = 0) {
    const arr = super.get();
    if (sizeHint > 0 && arr.length < sizeHint) {
      arr.length = sizeHint;
      arr.length = 0; // Reset after sizing
    }
    return arr;
  }
}

/**
 * Particle pool for visual effects
 */
export class ParticlePool extends ObjectPool {
  constructor(initialSize = 100, maxSize = 1000) {
    super(
      () => ({
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 0, maxLife: 0,
        color: '#ffffff',
        size: 1,
        alpha: 1
      }),
      (particle) => {
        particle.x = 0; particle.y = 0;
        particle.vx = 0; particle.vy = 0;
        particle.life = 0; particle.maxLife = 0;
        particle.color = '#ffffff';
        particle.size = 1;
        particle.alpha = 1;
      },
      initialSize,
      maxSize
    );
  }
}

/**
 * Status effect pool for creature status effects
 */
export class StatusEffectPool extends ObjectPool {
  constructor(initialSize = 30, maxSize = 300) {
    super(
      () => ({
        type: '',
        intensity: 0,
        duration: 0,
        maxDuration: 0,
        stacks: 0,
        source: null
      }),
      (effect) => {
        effect.type = '';
        effect.intensity = 0;
        effect.duration = 0;
        effect.maxDuration = 0;
        effect.stacks = 0;
        effect.source = null;
      },
      initialSize,
      maxSize
    );
  }
}

/**
 * Memory entry pool for creature AI memory
 */
export class MemoryPool extends ObjectPool {
  constructor(initialSize = 40, maxSize = 400) {
    super(
      () => ({
        type: '',
        data: null,
        timestamp: 0,
        importance: 0,
        decay: 0
      }),
      (memory) => {
        memory.type = '';
        memory.data = null;
        memory.timestamp = 0;
        memory.importance = 0;
        memory.decay = 0;
      },
      initialSize,
      maxSize
    );
  }
}

/**
 * Relationship pool for social creatures
 */
export class RelationshipPool extends ObjectPool {
  constructor(initialSize = 25, maxSize = 250) {
    super(
      () => ({
        targetId: 0,
        affinity: 0, // -1 to 1
        trust: 0,    // 0 to 1
        lastInteraction: 0,
        interactionCount: 0
      }),
      (rel) => {
        rel.targetId = 0;
        rel.affinity = 0;
        rel.trust = 0;
        rel.lastInteraction = 0;
        rel.interactionCount = 0;
      },
      initialSize,
      maxSize
    );
  }
}

/**
 * Master Object Pool Manager - coordinates all pools
 */
export class PoolManager {
  constructor() {
    this.pools = new Map();
    this.statsEnabled = true;

    // Initialize default pools
    this.registerPool('vectors', new Vector2DPool());
    this.registerPool('arrays', new ArrayPool());
    this.registerPool('particles', new ParticlePool());
    this.registerPool('statusEffects', new StatusEffectPool());
    this.registerPool('memories', new MemoryPool());
    this.registerPool('relationships', new RelationshipPool());

  }

  /**
   * Register a new pool
   * @param {string} name - Pool name
   * @param {ObjectPool} pool - Pool instance
   */
  registerPool(name, pool) {
    this.pools.set(name, pool);
  }

  /**
   * Get a pool by name
   * @param {string} name - Pool name
   * @returns {ObjectPool} Pool instance
   */
  getPool(name) {
    const pool = this.pools.get(name);
    if (!pool) {
      throw new Error(`Pool '${name}' not found`);
    }
    return pool;
  }

  /**
   * Get an object from a pool
   * @param {string} poolName - Pool name
   * @returns {*} Pooled object
   */
  get(poolName) {
    return this.getPool(poolName).get();
  }

  /**
   * Release an object back to its pool
   * @param {string} poolName - Pool name
   * @param {*} obj - Object to release
   */
  release(poolName, obj) {
    this.getPool(poolName).release(obj);
  }

  /**
   * Release multiple objects to a pool
   * @param {string} poolName - Pool name
   * @param {Array} objects - Objects to release
   */
  releaseAll(poolName, objects) {
    this.getPool(poolName).releaseAll(objects);
  }

  /**
   * Warm up all pools
   * @param {Object} sizes - Pool sizes to warm to
   */
  warm(sizes = {}) {
    for (const [name, size] of Object.entries(sizes)) {
      if (this.pools.has(name)) {
        this.pools.get(name).warm(size);
      }
    }
  }

  /**
   * Clear all pools
   */
  clear() {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
  }

  /**
   * Get statistics for all pools
   * @returns {Object} Combined pool statistics
   */
  getStats() {
    const stats = {};
    let totalActive = 0;
    let totalPeak = 0;
    let totalAllocations = 0;

    for (const [name, pool] of this.pools) {
      const poolStats = pool.getStats();
      stats[name] = poolStats;
      totalActive += poolStats.activeCount;
      totalPeak += poolStats.peakCount;
      totalAllocations += poolStats.totalAllocations;
    }

    stats._summary = {
      totalPools: this.pools.size,
      totalActiveObjects: totalActive,
      totalPeakObjects: totalPeak,
      totalAllocations: totalAllocations
    };

    return stats;
  }

  /**
   * Enable or disable statistics collection
   * @param {boolean} enabled - Whether to collect stats
   */
  setStatsEnabled(enabled) {
    this.statsEnabled = enabled;
  }

  /**
   * Convenience method for getting a vector
   * @returns {Object} Vector object {x, y}
   */
  getVector() {
    return this.get('vectors');
  }

  /**
   * Convenience method for releasing a vector
   * @param {*} vector - Vector to release
   */
  releaseVector(vector) {
    this.release('vectors', vector);
  }

  /**
   * Convenience method for getting an array
   * @param {number} sizeHint - Size hint for the array
   * @returns {Array} Array object
   */
  getArray(sizeHint = 0) {
    const pool = this.getPool('arrays');
    return sizeHint > 0 ? pool.getWithSize(sizeHint) : pool.get();
  }

  /**
   * Convenience method for releasing an array
   * @param {*} array - Array to release
   */
  releaseArray(array) {
    this.release('arrays', array);
  }

  /**
   * Convenience method for getting a particle
   * @returns {Object} Particle object
   */
  getParticle() {
    return this.get('particles');
  }

  /**
   * Convenience method for releasing a particle
   * @param {*} particle - Particle to release
   */
  releaseParticle(particle) {
    this.release('particles', particle);
  }
}

/**
 * Temporary object pool for reusable generic objects
 */
export class TempObjectPool extends ObjectPool {
  constructor(initialSize = 25) {
    super(
      () => ({}),
      (obj) => {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            delete obj[key];
          }
        }
      },
      initialSize
    );
  }
}

// Global pool manager instance
export const poolManager = new PoolManager();
