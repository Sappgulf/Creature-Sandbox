import { collectGameplayMetrics } from '../gameplay-objectives.js';

function centerOfWorld(world) {
  return {
    x: (world?.width || 0) * 0.5,
    y: (world?.height || 0) * 0.5
  };
}

function creaturePosition(creature, world) {
  if (creature) return { x: creature.x, y: creature.y };
  return centerOfWorld(world);
}

export class StoryDirector {
  constructor({ world = null, moments = null, notifications = null } = {}) {
    this.world = world;
    this.moments = moments;
    this.notifications = notifications;
    this.seen = new Set();
    this.lastSnapshot = { entries: [], summary: null };
    this.hadActiveDisaster = false;
  }

  update(world = this.world, playableSnapshot = null) {
    if (!world) return this.lastSnapshot;
    const metrics = collectGameplayMetrics(world);
    const creatures = (world.creatures || []).filter(creature => creature?.alive !== false);

    if ((this.moments?.summary?.births || metrics.births) > 0) {
      this.emitOnce('first_birth', {
        icon: '🐣',
        text: 'The first new generation hatched',
        ...centerOfWorld(world)
      });
    }

    const alpha = creatures.reduce((best, creature) => {
      const kills = Number(creature.stats?.kills || 0);
      return kills > Number(best?.stats?.kills || 0) ? creature : best;
    }, null);
    if (alpha && Number(alpha.stats?.kills || 0) >= 3) {
      this.emitOnce(`alpha_${alpha.id}`, {
        icon: '🦁',
        text: `Alpha predator #${alpha.id} is shaping the food web`,
        ...creaturePosition(alpha, world)
      });
    }

    if (metrics.population > 0 && metrics.population <= Math.max(6, Math.floor((metrics.totalCreatures || 20) * 0.22))) {
      this.emitOnce('extinction_risk', {
        icon: '⚠️',
        text: 'Extinction risk: the population is near collapse',
        ...centerOfWorld(world)
      });
    }

    const mutant = creatures.find(creature => creature.rareMutations?.length || creature.mutations?.length);
    if (mutant) {
      this.emitOnce(`rare_mutation_${mutant.id}`, {
        icon: '✨',
        text: `Rare mutation discovered in creature #${mutant.id}`,
        ...creaturePosition(mutant, world)
      });
    }

    if (metrics.maxGeneration >= 5) {
      this.emitOnce(`lineage_${metrics.maxGeneration}`, {
        icon: '🌳',
        text: `A family line reached generation ${metrics.maxGeneration}`,
        ...centerOfWorld(world)
      });
    }

    if ((this.moments?.summary?.migrations || 0) > 0) {
      this.emitOnce('first_migration', {
        icon: '🧭',
        text: 'A herd migration reshaped the map',
        ...centerOfWorld(world)
      });
    }

    const activeDisaster = !!world.disaster?.activeDisaster || !!world.events?.activeEvent;
    if (this.hadActiveDisaster && !activeDisaster && metrics.population > 0) {
      this.emitOnce(`survived_disaster_${Math.floor(world.t || 0)}`, {
        icon: '🌦️',
        text: 'The ecosystem survived a disaster',
        ...centerOfWorld(world)
      });
    }
    this.hadActiveDisaster = activeDisaster;

    this.lastSnapshot = {
      entries: this.moments?.moments?.slice?.(0, 8) || [],
      summary: this.moments?.summary || null,
      activeScenario: playableSnapshot?.scenario?.id || null
    };
    return this.lastSnapshot;
  }

  emitOnce(key, payload) {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.moments?.logMoment?.({
      type: key,
      icon: payload.icon,
      text: payload.text,
      x: payload.x,
      y: payload.y,
      worldTime: this.world?.t
    });
    if (payload.notify) {
      this.notifications?.show?.(payload.text, 'info', 1800);
    }
    return true;
  }

  getSnapshot() {
    return this.lastSnapshot;
  }

  serialize() {
    return { seen: Array.from(this.seen), hadActiveDisaster: this.hadActiveDisaster };
  }

  restore(data = {}) {
    if (!data || typeof data !== 'object') return false;
    this.seen = new Set(Array.isArray(data.seen) ? data.seen : []);
    this.hadActiveDisaster = !!data.hadActiveDisaster;
    return true;
  }
}
