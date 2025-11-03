const NAMES = [
  'Aurora','Zephyr','Nimbus','Marrow','Sylph','Ember','Quartz','Halcyon','Vanta','Caldera',
  'Mistral','Solace','Echo','Tundra','Nova','Beryl','Thorne','Juniper','Fable','Lumen'
];

export class LineageTracker {
  constructor() {
    this.names = new Map();
    this.events = [];
    this.heroGenerations = new Map();
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
  }

  getRoot(world, id) {
    let current = world.getAnyCreatureById(id);
    let last = current;
    while (current && current.parentId) {
      last = world.getAnyCreatureById(current.parentId) || last;
      current = last;
      if (!current) break;
      if (!current.parentId) return current.id;
    }
    return last?.id ?? id;
  }

  generation(world, id) {
    let depth = 0;
    let node = world.getAnyCreatureById(id);
    while (node && node.parentId) {
      node = world.getAnyCreatureById(node.parentId);
      depth++;
    }
    return depth;
  }

  trim(limit=12) {
    if (this.events.length > limit) this.events.length = limit;
  }

  getStories() {
    return this.events.slice(0, 8);
  }
}
