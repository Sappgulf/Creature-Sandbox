/**
 * World Creature Manager - Handles creature lifecycle, spawning, and lineage
 */
import { rand, clamp } from './utils.js';
import { makeGenes, mutateGenes, breedGenes } from './genetics.js';
import { Creature } from './creature.js';
import { SpatialGrid } from './spatial-grid.js';
import { eventSystem, GameEvents } from './event-system.js';

export class WorldCreatureManager {
  constructor(world) {
    this.world = world;
    this.initialize();
  }

  initialize() {
    // Lineage and registry
    this._nextId = 1;
    this.childrenOf = new Map(); // id -> Set(childIds)
    this.registry = new Map();
    this.creatureGrid = new SpatialGrid(48);
    this.gridDirty = true;
    this.lineageTracker = null;

    console.debug('🧬 World creature manager initialized');
  }

  // Add creature to world
  addCreature(creature, parentId = null) {
    creature.id = this._nextId++;
    this.world.creatures.push(creature);
    this.registry.set(creature.id, creature);

    // Update lineage tracking
    if (parentId !== null) {
      if (!this.childrenOf.has(parentId)) {
        this.childrenOf.set(parentId, new Set());
      }
      this.childrenOf.get(parentId).add(creature.id);
    }

    creature.parentId = parentId;

    // Update spatial grid
    this.creatureGrid.add(creature);
    this.gridDirty = true;

    // Notify lineage tracker
    if (this.lineageTracker) {
      this.lineageTracker.onCreatureBorn(creature, this.world);
    }

    // Emit creature born event for other systems (achievements, audio, etc.)
    try {
      eventSystem.emit(GameEvents.CREATURE_BORN, {
        creature,
        parentId,
        worldTime: this.world.t
      });
      if (parentId !== null) {
        eventSystem.emit(GameEvents.CREATURE_REPRODUCE, {
          creature,
          parentId,
          worldTime: this.world.t
        });
      }
    } catch (e) {
      console.warn('Failed to emit creature born/reproduce event:', e);
    }

    return creature;
  }

  // Remove creature from world
  removeCreature(creature) {
    const index = this.world.creatures.indexOf(creature);
    if (index >= 0) {
      this.world.creatures.splice(index, 1);
      this.creatureGrid.remove(creature);
      this.registry.delete(creature.id);
      this.gridDirty = true;
    }
  }

  // Get creature by ID
  getCreatureById(id) {
    return this.registry.get(id) ?? this.world.creatures.find(c => c.id === id) ?? null;
  }

  getAnyCreatureById(id) {
    return this.registry.get(id) ?? null;
  }

  // Spawn child from parents
  spawnChild(parent1, parent2 = null) {
    if (!parent1.alive) return null;

    const x = parent1.x + (rand() - 0.5) * 60;
    const y = parent1.y + (rand() - 0.5) * 60;

    // Constrain to world bounds
    const margin = 20;
    const clampedX = clamp(x, margin, this.world.width - margin);
    const clampedY = clamp(y, margin, this.world.height - margin);

    // Breed genes
    let childGenes;
    if (parent2 && parent2.alive) {
      childGenes = breedGenes(parent1.genesRaw || parent1.genes, parent2.genesRaw || parent2.genes);
    } else {
      childGenes = mutateGenes(parent1.genesRaw || parent1.genes);
    }

    // Apply environmental mutations
    if (this.world.environment) {
      const seasonModifier = this.world.environment.getSeasonModifier('reproduction');
      if (rand() < 0.1 * seasonModifier) { // 10% mutation rate, modified by season
        childGenes = mutateGenes(childGenes);
      }
    }

    const child = new Creature(clampedX, clampedY, childGenes, true);

    // Set parent relationships
    child.parents = [parent1.id];
    if (parent2) {
      child.parents.push(parent2.id);
    }

    // Add to world
    this.addCreature(child, parent1.id);

    // Update parent stats
    parent1.stats.births++;
    if (parent2) {
      parent2.stats.births++;
    }

    return child;
  }

  // Spawn manual creature (for testing/debugging)
  spawnManual(x, y, predator = false) {
    const genes = makeGenes(predator);
    const creature = new Creature(x, y, genes);
    return this.addCreature(creature);
  }

  // Spawn creature with provided gene set (used for undo/redo restores)
  spawnManualWithGenes(x, y, genes) {
    if (!genes) return null;

    const safeGenes = { ...(genes.genesRaw || genes) };
    const clampedX = clamp(x, 0, this.world.width);
    const clampedY = clamp(y, 0, this.world.height);
    const creature = new Creature(clampedX, clampedY, safeGenes, true);
    return this.addCreature(creature);
  }

  // Clone an existing creature (shallow gene copy + small offset)
  cloneCreature(source) {
    if (!source) return null;
    const genes = { ...(source.genesRaw || source.genes) };
    const offset = 20;
    const nx = clamp(source.x + (Math.random() - 0.5) * offset, 0, this.world.width);
    const ny = clamp(source.y + (Math.random() - 0.5) * offset, 0, this.world.height);
    const clone = new Creature(nx, ny, genes, true);
    // Parent linkage for lineage
    clone.parents = [source.id];
    return this.addCreature(clone, source.id);
  }

  // Spawn omnivore creature
  spawnOmnivore(x, y) {
    const genes = makeGenes(false);
    genes.diet = 0.5; // Omnivore diet
    const creature = new Creature(x, y, genes);
    return this.addCreature(creature);
  }

  // Find nearest creature
  nearestCreature(x, y, maxDistPx = 30) {
    let nearest = null;
    let nearestDist = maxDistPx * maxDistPx;

    for (const c of this.world.creatures) {
      if (!c.alive) continue;
      const dist = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = c;
      }
    }

    return nearest;
  }

  // Query creatures in radius
  queryCreatures(x, y, radius) {
    const r2 = radius * radius;
    return this.world.creatures.filter(c =>
      c.alive && (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y) <= r2
    );
  }

  // Get ancestors of a creature
  getAncestors(id, maxDepth = 12) {
    const result = [];
    const visited = new Set();
    const queue = [{ id, depth: 0 }];

    while (queue.length > 0) {
      const { id: currentId, depth } = queue.shift();

      if (depth >= maxDepth || visited.has(currentId)) continue;
      visited.add(currentId);

      const creature = this.getAnyCreatureById(currentId);
      if (creature && creature.parentId) {
        const parent = this.getAnyCreatureById(creature.parentId);
        if (parent) {
          result.push({ creature: parent, depth });
          queue.push({ id: creature.parentId, depth: depth + 1 });
        }
      }
    }

    return result;
  }

  // Build lineage overview
  buildLineageOverview(rootId, maxDepth = 6) {
    const overview = {
      root: null,
      descendants: [],
      maxDepth: 0,
      totalDescendants: 0,
      livingDescendants: 0,
      extinctBranches: 0
    };

    const root = this.getAnyCreatureById(rootId);
    if (!root) return overview;

    overview.root = root;

    const visited = new Set();
    const queue = [{ id: rootId, depth: 0, parent: null }];

    while (queue.length > 0) {
      const { id: currentId, depth, parent } = queue.shift();

      if (depth > maxDepth || visited.has(currentId)) continue;
      visited.add(currentId);

      const creature = this.getAnyCreatureById(currentId);
      if (!creature) continue;

      overview.totalDescendants++;

      if (creature.alive) {
        overview.livingDescendants++;
      }

      overview.maxDepth = Math.max(overview.maxDepth, depth);

      if (depth > 0) {
        overview.descendants.push({
          creature,
          depth,
          parentId: parent,
          alive: creature.alive,
          children: []
        });
      }

      // Add children to queue
      const children = this.childrenOf.get(currentId);
      if (children) {
        for (const childId of children) {
          queue.push({ id: childId, depth: depth + 1, parent: currentId });
        }
      } else if (depth > 0 && !creature.alive) {
        overview.extinctBranches++;
      }
    }

    return overview;
  }

  // Get all descendants of a creature
  descendantsOf(rootId) {
    const result = [];
    const visited = new Set();
    const queue = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift();

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = this.childrenOf.get(currentId);
      if (children) {
        for (const childId of children) {
          const child = this.getAnyCreatureById(childId);
          if (child) {
            result.push(child);
            queue.push(childId);
          }
        }
      }
    }

    return result;
  }

  // Rebuild family links (for save/load)
  rebuildFamilyLinks() {
    this.childrenOf.clear();

    for (const creature of this.registry.values()) {
      if (creature.parentId) {
        if (!this.childrenOf.has(creature.parentId)) {
          this.childrenOf.set(creature.parentId, new Set());
        }
        this.childrenOf.get(creature.parentId).add(creature.id);
      }
    }
  }

  // Attach lineage tracker
  attachLineageTracker(tracker) {
    this.lineageTracker = tracker;
  }

  // Ensure spatial grid is up to date
  ensureSpatial() {
    if (this.gridDirty) {
      this.creatureGrid.clear();
      for (const c of this.world.creatures) {
        if (c.alive) {
          this.creatureGrid.add(c);
        }
      }
      this.gridDirty = false;
    }
  }

  // Get population statistics
  getPopulationStats() {
    const stats = {
      total: this.world.creatures.length,
      alive: 0,
      dead: 0,
      herbivores: 0,
      predators: 0,
      omnivores: 0,
      averageAge: 0,
      averageEnergy: 0
    };

    let totalAge = 0;
    let totalEnergy = 0;

    for (const c of this.world.creatures) {
      if (c.alive) {
        stats.alive++;
        totalAge += c.age;
        totalEnergy += c.energy;

        const diet = c.genes.diet ?? (c.genes.predator ? 1.0 : 0.0);
        if (diet < 0.3) stats.herbivores++;
        else if (diet > 0.7) stats.predators++;
        else stats.omnivores++;
      } else {
        stats.dead++;
      }
    }

    if (stats.alive > 0) {
      stats.averageAge = totalAge / stats.alive;
      stats.averageEnergy = totalEnergy / stats.alive;
    }

    return stats;
  }
}
