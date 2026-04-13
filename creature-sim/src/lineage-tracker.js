const NAMES = [
  'Aurora', 'Zephyr', 'Nimbus', 'Marrow', 'Sylph', 'Ember', 'Quartz', 'Halcyon', 'Vanta', 'Caldera',
  'Mistral', 'Solace', 'Echo', 'Tundra', 'Nova', 'Beryl', 'Thorne', 'Juniper', 'Fable', 'Lumen'
];

export class LineageTracker {
  constructor() {
    this.names = new Map();
    this.events = [];
    this.heroGenerations = new Map();
    this.rootCache = new Map(); // Cache root lookups
    this.generationCache = new Map(); // Cache generation depths
  }

  reset() {
    this.names.clear();
    this.events.length = 0;
    this.heroGenerations.clear();
    this.rootCache.clear();
    this.generationCache.clear();
  }

  /**
   * Compatibility wrapper: invoked by world/creature manager when a creature is born.
   * Accepts either (creature, world) or (creature, world, parent).
   */
  onCreatureBorn(creature, world, parent = null) {
    const parentCreature =
      parent ||
      (creature?.parentId != null ? world?.getAnyCreatureById(creature.parentId) : null) ||
      null;
    // Reuse existing noteBirth logic
    this.noteBirth(world, parentCreature, creature);
  }

  /**
   * Compatibility wrapper for death events. Currently just trims caches and records a simple event.
   */
  onCreatureDied(creature, world = null) {
    if (!creature) return;
    // Clear cached lineage/generation for this creature to avoid stale references
    this.rootCache.delete(creature.id);
    this.generationCache.delete(creature.id);
    // Optional: record a short death event
    if (world) {
      const rootId = this.getRoot(world, creature.id);
      const name = this.ensureName(rootId);
      this.events.unshift({ time: world.t, rootId, title: `${name}: died` });
      this.trim();
    }
  }

  ensureName(rootId) {
    if (this.names.has(rootId)) return this.names.get(rootId);
    const name = NAMES[(this.names.size + rootId) % NAMES.length] + '-' + rootId;
    this.names.set(rootId, name);
    return name;
  }

  noteBirth(world, parent, child) {
    const rootId = this.getRoot(world, child.id);
    const name = this.ensureName(rootId);
    const gen = this.generation(world, child.id);
    if (gen >= 5 && !this.heroGenerations.has(rootId)) {
      this.heroGenerations.set(rootId, gen);
      this.events.unshift({
        time: world.t,
        rootId,
        title: `${name} lineage reaches generation ${gen}`
      });
      this.trim();
    }
  }

  noteMilestone(world, creature, message) {
    const rootId = this.getRoot(world, creature.id);
    const name = this.ensureName(rootId);
    this.events.unshift({ time: world.t, rootId, title: `${name}: ${message}` });
    this.trim();

    // Visual feedback: evolution particles for milestone achievement
    if (world.particles && typeof world.particles.addEvolutionEffect === 'function') {
      world.particles.addEvolutionEffect(creature.x, creature.y);
    }

    // Audio feedback for milestone
    if (world.audio && typeof world.audio.playUISound === 'function') {
      world.audio.playUISound('success');
    }
  }

  recordEvent(event, world = null) {
    if (!event || typeof event !== 'object') return;

    const time = Number(event.time ?? world?.t ?? 0);
    const rootId = event.rootId ?? event.root ?? event.creatureId ?? event.creature?.id ?? null;
    const title =
      typeof event.title === 'string' && event.title.trim()
        ? event.title
        : this._formatEventTitle(event);

    this.events.unshift({
      ...event,
      type: event.type || 'event',
      time: Number.isFinite(time) ? time : 0,
      rootId,
      title
    });
    this.trim();
  }

  _formatEventTitle(event) {
    switch (event?.type) {
      case 'disaster_start':
        return `Disaster started: ${event.disaster || 'unknown'}`;
      case 'disaster_end':
        return `Disaster ended: ${event.disaster || 'unknown'}`;
      case 'season_change':
        return `Season changed: ${event.season || 'unknown'}`;
      default:
        return event?.message || String(event?.type || 'event').replace(/_/g, ' ');
    }
  }

  getRoot(world, id) {
    // Check cache first
    if (this.rootCache.has(id)) {
      return this.rootCache.get(id);
    }

    let current = world.getAnyCreatureById(id);
    let last = current;
    const path = [id]; // Track path to cache all intermediate nodes

    while (current && current.parentId) {
      // Check if we've already cached the parent's root
      if (this.rootCache.has(current.parentId)) {
        const rootId = this.rootCache.get(current.parentId);
        // Cache all nodes in path
        for (const nodeId of path) {
          this.rootCache.set(nodeId, rootId);
        }
        return rootId;
      }

      path.push(current.parentId);
      last = world.getAnyCreatureById(current.parentId) || last;
      current = last;
      if (!current) break;
      if (!current.parentId) {
        const rootId = current.id;
        // Cache all nodes in path
        for (const nodeId of path) {
          this.rootCache.set(nodeId, rootId);
        }
        return rootId;
      }
    }

    const rootId = last?.id ?? id;
    // Cache all nodes in path
    for (const nodeId of path) {
      this.rootCache.set(nodeId, rootId);
    }
    return rootId;
  }

  generation(world, id) {
    // Check cache first
    if (this.generationCache.has(id)) {
      return this.generationCache.get(id);
    }

    let depth = 0;
    let node = world.getAnyCreatureById(id);
    const path = [id];

    while (node && node.parentId) {
      // Check if parent's generation is cached
      if (this.generationCache.has(node.parentId)) {
        depth = this.generationCache.get(node.parentId) + 1;
        break;
      }
      path.push(node.parentId);
      node = world.getAnyCreatureById(node.parentId);
      if (node && node.parentId) depth++;
      else { depth++; break; }
    }

    // Cache generation for all nodes in path (backfill)
    for (let i = path.length - 1; i >= 0; i--) {
      this.generationCache.set(path[i], depth - i);
    }

    return this.generationCache.get(id) || depth;
  }

  trim(limit = 12) {
    if (this.events.length > limit) this.events.length = limit;
  }

  getStories() {
    return this.events.slice(0, 8);
  }
}
