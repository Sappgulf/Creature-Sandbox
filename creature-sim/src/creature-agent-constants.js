/**
 * Creature Agent Tuning Constants
 * Centralized values for needs, sensing, goals, steering, and reproduction.
 */
export const CreatureAgentTuning = {
  NEEDS: {
    MIN: 0,
    MAX: 100,
    UPDATE_INTERVAL: 0.25,
    HUNGER_RATE: 1.2,
    SOCIAL_RATE: 0.6,
    STRESS_REST_DECAY: 6,
    STRESS_CALM_DECAY: 2.5,
    STRESS_OVERCROWD_GAIN: 4.5,
    START: {
      hunger: 22,
      energy: 65,
      socialDrive: 35,
      stress: 18
    },
    HUNGER_RELIEF_PER_ENERGY: 1.4
  },
  SENSES: {
    FOOD_RADIUS_MULT: 1.05,
    FOOD_RADIUS_MIN: 60,
    FOOD_RADIUS_MAX: 220,
    MATE_RADIUS_MULT: 1.1,
    REST_RADIUS: 200,
    OVERCROWD_RADIUS: 70,
    OVERCROWD_COUNT: 6
  },
  GOALS: {
    UPDATE_INTERVAL: 0.25,
    MIN_DURATION: 1.2,
    SWITCH_HYSTERESIS: 0.12,
    SCORE_BIAS: {
      EAT: 1.0,
      REST: 0.95,
      SEEK_MATE: 0.85,
      WANDER: 0.2
    }
  },
  MOVEMENT: {
    ARRIVE_RADIUS: 60,
    SLOW_RADIUS: 130,
    MIN_ARRIVE_SPEED: 0.35,
    REST_SPEED_MULT: 0.55,
    SEEK_MATE_SPEED_MULT: 1.05,
    SEPARATION_RADIUS: 18,
    SEPARATION_STRENGTH: 0.45,
    STEERING_INTERVAL: 0.2,
    EDGE_AVOID_MARGIN: 120,
    EDGE_AVOID_FORCE: 0.3
  },
  FOOD: {
    BITE_INTERVAL: 0.6,
    BITE_ENERGY: 4,
    SCENT_RADIUS: 180,
    CONSUME_RANGE: 8
  },
  REST_ZONES: {
    COUNT: 5,
    RADIUS: 90,
    DETECT_RADIUS: 200,
    ENERGY_RECOVERY: 6,
    STRESS_RECOVERY: 4.5
  },
  MATING: {
    SOCIAL_THRESHOLD: 65,
    STRESS_MAX: 45,
    COOLDOWN: 32,
    RANGE: 18,
    BOND_TIME: 1.15,
    ENERGY_COST_MULT: 0.7,
    POPULATION_SOFT_CAP: 140,
    POPULATION_HARD_CAP: 190,
    OVERCROWD_COOLDOWN_MULT: 1.8,
    OVERCROWD_BOND_MULT: 1.6
  }
};

export default CreatureAgentTuning;
