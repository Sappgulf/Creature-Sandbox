/**
 * Creature Configuration Constants
 * Centralized configuration for creature behavior, genetics, and lifecycle
 */
export const CreatureConfig = {
  // Physical constants
  TRAIL_INTERVAL: 0.12,
  TRAIL_MAX: 24,
  LOG_MAX: 12,
  TAU: Math.PI * 2,

  // Age stage thresholds (in seconds)
  AGE_STAGES: {
    BABY: { max: 30, sizeMultiplier: 0.6, icon: '🐣' },
    JUVENILE: { max: 120, sizeMultiplier: 0.85, icon: '🦌' },
    ADULT: { max: 240, sizeMultiplier: 1.0, icon: '🦌' },
    ELDER: { max: Infinity, sizeMultiplier: 0.9, icon: '👴' }
  },

  // Energy and health
  STARTING_ENERGY: { baby: 28, adult: 40 },
  BASE_HEALTH: { herbivore: 12, predator: 18 },
  ENERGY_DRAIN: {
    BASE: 0.8,
    ADRENALINE_MULTIPLIER: 2.6,
    BLEED_BASE: 0.35,
    PLAY_BURST: 0.45
  },

  // Movement and behavior
  MOVEMENT: {
    BASE_SPEED: 25,
    TURN_RATE: 3.0,
    WANDER_STRENGTH: 0.3,
    HERD_SEPARATION: 18,
    HERD_ALIGNMENT: 25
  },

  // Reproduction
  REPRODUCTION: {
    ENERGY_THRESHOLD: 36,
    AGE_MIN: 45,
    AGE_MAX: 180,
    COOLDOWN: 25,
    SUCCESS_CHANCE: 0.15
  },

  // Combat
  COMBAT: {
    ATTACK_RANGE: 8,
    DAMAGE_MULTIPLIER: 2.0,
    COUNTER_ATTACK_CHANCE: 0.3
  },

  // Status effects
  STATUS: {
    DISEASE_SPREAD_CHANCE: 0.6,
    VENOM_TICK_RATE: 1.2,
    ADRENALINE_COOLDOWN: 45,
    BLEED_DURATION: 10,
    PANIC_DURATION: 8
  },

  // Memory and learning
  MEMORY: {
    CAPACITY_BASE: 10,
    CAPACITY_MAX: 14,
    FORGET_CHANCE: 0.02
  },

  // Social behavior
  SOCIAL: {
    PLAY_COOLDOWN: { min: 6, max: 12 },
    ELDER_AID_COOLDOWN: { min: 5, max: 9 },
    FAMILY_CHECK_INTERVAL: { min: 2.5, max: 4.5 }
  },

  // Genetics
  GENETICS: {
    SIZE_MODIFIERS: {
      OMNIVORE: 4.0,
      HERBIVORE_BASE: 3.5,
      PREDATOR_BONUS: 1.5
    },
    PERSONALITY_DEFAULTS: {
      PACK_INSTINCT: { herbivore: 0, predator: 0.55 },
      AMBUSH_DELAY: { herbivore: 0.15, predator: 0.6 },
      AGGRESSION: { herbivore: 0.85, predator: 1.15 }
    },
    DIET_THRESHOLDS: {
      HERBIVORE_MAX: 0.3,
      OMNIVORE_MIN: 0.3,
      OMNIVORE_MAX: 0.7,
      PREDATOR_MIN: 0.7
    },
    SENSE_TYPE_THRESHOLDS: {
      NORMAL_MAX: 0.25,
      CHEMICAL_MAX: 0.5,
      THERMAL_MAX: 0.75
    }
  },

  // Memory and learning
  MEMORY: {
    CAPACITY_BASE: 10,
    CAPACITY_MAX: 14,
    CAPACITY_SENSE_RATIO: 50,
    DECAY_RATE: 0.05,
    LEARNING_RATE: 0.05
  },

  // Emotions and psychology
  EMOTIONS: {
    DEFAULT_CONFIDENCE: 0.5,
    DEFAULT_CONTENTMENT: 0.5,
    STRESS_DECAY: 0.1,
    HAPPINESS_BOOST: 0.3,
    FEAR_INCREASE: 0.1,
    SECURITY_BOOST: 0.2,
    HAPPINESS_DECAY: 0.05
  },

  // Intelligence
  INTELLIGENCE: {
    LEVEL_SENSE_RATIO: 100,
    LEVEL_METABOLISM_MULTIPLIER: 1,
    LEVEL_MAX: 2,
    PATTERN_LEARNING: 0.05
  },

  // Environmental adaptations
  ENVIRONMENT: {
    AQUATIC_THRESHOLD: 0.45,
    NOCTURNAL_THRESHOLD: 0.5,
    WETLAND_SPEED_MULTIPLIER: 0.7
  }
};

export default CreatureConfig;
