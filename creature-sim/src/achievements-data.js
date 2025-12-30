// Centralized achievement definitions.
// This file is intended to be mostly data so achievements can be tuned/extended easily.

export const ACHIEVEMENTS_DATA_VERSION = 1;

export const ACHIEVEMENTS_DATA = [
  {
    id: 'first_predator',
    name: 'Apex Predator',
    description: 'Witness a predator successfully hunt prey',
    icon: '🦁',
    xp: 10,
    type: 'discovery',
    trigger: 'kill',
    goal: 1,
    eventPredicate: (event) => {
      const attacker = event?.attacker;
      if (!attacker?.genes) return false;
      const diet = attacker.genes.diet ?? (attacker.genes.predator ? 1.0 : 0.0);
      return diet > 0.7;
    }
  },

  {
    id: 'speciation',
    name: 'New Species',
    description: 'See genetic clustering create distinct groups',
    icon: '🧬',
    xp: 15,
    type: 'discovery',
    check: (world, tracker, ctx) => {
      const groups = ctx?.analytics?.speciesGroups;
      return Array.isArray(groups) && groups.length >= 2;
    }
  },

  {
    id: 'extinction',
    name: 'Mass Extinction',
    description: 'All creatures die (natural selection)',
    icon: '☠️',
    xp: 5,
    type: 'discovery',
    check: (world) => world && world.creatures && world.creatures.length === 0 && world.t > 30
  },

  {
    id: 'super_lineage',
    name: 'Dynasty',
    description: 'One family reaches 50+ descendants',
    icon: '👑',
    xp: 25,
    type: 'milestone',
    check: (world, tracker) => {
      if (!tracker || !world || !world.creatures) return false;
      try {
        let maxDescendants = 0;
        for (const creature of world.creatures) {
          if (!creature || !creature.id) continue;
          try {
            const root = tracker.getRoot(world, creature.id);
            if (root && world.descendantsOf) {
              const descendants = world.descendantsOf(root);
              if (descendants && descendants.size > maxDescendants) {
                maxDescendants = descendants.size;
              }
            }
          } catch {
            continue;
          }
        }
        return maxDescendants >= 50;
      } catch {
        return false;
      }
    }
  },

  {
    id: 'ancient_one',
    name: 'Ancient',
    description: 'A creature survives 200+ seconds',
    icon: '🦕',
    xp: 20,
    type: 'milestone',
    check: (world) => world && world.creatures && world.creatures.some(c => c && c.age >= 200)
  },

  // Population milestones as tiers (keeps existing IDs)
  {
    id: 'population',
    type: 'milestone',
    trigger: 'population',
    tiers: [
      {
        id: 'population_100',
        name: 'Thriving Ecosystem',
        description: 'Population reaches 100 creatures',
        icon: '🌿',
        goal: 100,
        xp: 15
      },
      {
        id: 'population_500',
        name: 'Population Explosion',
        description: 'Population reaches 500 creatures',
        icon: '💥',
        goal: 500,
        xp: 30
      }
    ]
  },

  {
    id: 'balanced_ecosystem',
    name: 'Perfect Balance',
    description: 'Maintain 3+ species types for 5 minutes',
    icon: '⚖️',
    xp: 25,
    type: 'challenge',
    sustain: {
      key: 'speciesTypes',
      min: 3,
      duration: 300 // seconds
    }
  },

  {
    id: 'tutorial_complete',
    name: 'Learned the Ropes',
    description: 'Complete the tutorial',
    icon: '🎓',
    xp: 10,
    type: 'discovery'
  },

  {
    id: 'god_intervention',
    name: 'Divine Intervention',
    description: 'Use god mode tools 10 times',
    icon: '⚡',
    xp: 10,
    type: 'milestone',
    trigger: 'god_action',
    goal: 10
  },

  // Multi-tier / repeatable kill milestones for predators
  {
    id: 'predator_kills',
    name: 'Seasoned Hunter',
    description: 'Rack up predator kills',
    icon: '🦷',
    type: 'milestone',
    trigger: 'kill',
    eventPredicate: (event) => {
      const attacker = event?.attacker;
      if (!attacker?.genes) return false;
      const diet = attacker.genes.diet ?? (attacker.genes.predator ? 1.0 : 0.0);
      return diet > 0.7;
    },
    tiers: [
      { id: 'predator_kills_5', name: 'Hunter', description: 'Predators get 5 kills', goal: 5, xp: 10 },
      { id: 'predator_kills_25', name: 'Slayer', description: 'Predators get 25 kills', goal: 25, xp: 20 },
      { id: 'predator_kills_100', name: 'Legendary Beast', description: 'Predators get 100 kills', goal: 100, xp: 40, secret: true }
    ]
  }
];
