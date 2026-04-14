import { clamp } from './utils.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';

export function updateAgeStage(creature) {
  const stages = CreatureAgentTuning.LIFE_STAGE;
  if (creature.age < stages.BABY_END) {
    creature.ageStage = 'baby';
  } else if (creature.age < stages.JUVENILE_END) {
    creature.ageStage = 'juvenile';
  } else if (creature.age < stages.ADULT_END) {
    creature.ageStage = 'adult';
  } else {
    creature.ageStage = 'elder';
  }
  updateLifeStage(creature);
}

export function updateLifeStage(creature) {
  const stages = CreatureAgentTuning.LIFE_STAGE;
  if (creature.age < stages.BABY_END) {
    creature.lifeStage = 'baby';
  } else if (creature.age < stages.ADULT_END) {
    creature.lifeStage = 'adult';
  } else {
    creature.lifeStage = 'elder';
  }
}

export function getAgeSizeMultiplier(age, ageStage) {
  switch (ageStage) {
    case 'baby': return clamp(0.3 + (age / 30) * 0.4, 0.3, 0.7);
    case 'juvenile': return clamp(0.7 + ((age - 30) / 30) * 0.3, 0.7, 1.0);
    case 'adult': return 1.0;
    case 'elder': return clamp(1.0 - ((age - 240) / 60) * 0.1, 0.9, 1.0);
    default: return 1.0;
  }
}

export function getAgeSpeedMultiplier(age) {
  const stages = CreatureAgentTuning.LIFE_STAGE;
  if (age < stages.BABY_END) {
    return clamp(0.95 + (age / stages.BABY_END) * 0.1, 0.9, 1.05);
  }
  if (age < stages.JUVENILE_END) {
    const t = (age - stages.BABY_END) / (stages.JUVENILE_END - stages.BABY_END);
    return clamp(1.05 - t * 0.05, 0.95, 1.05);
  }
  if (age < stages.ADULT_END) {
    return 1.0;
  }
  if (age < stages.ELDER_FADE_START) {
    const t = (age - stages.ADULT_END) / (stages.ELDER_FADE_START - stages.ADULT_END);
    return clamp(1.0 - t * 0.1, 0.85, 1.0);
  }
  const t = (age - stages.ELDER_FADE_START) / (stages.ELDER_FADE_END - stages.ELDER_FADE_START);
  return clamp(0.9 - t * 0.15, 0.7, 0.9);
}

export function getAgeMetabolismMultiplier(age) {
  const stages = CreatureAgentTuning.LIFE_STAGE;
  if (age < stages.BABY_END) {
    return clamp(1.1 + (age / stages.BABY_END) * 0.05, 1.1, 1.2);
  }
  if (age < stages.JUVENILE_END) {
    const t = (age - stages.BABY_END) / (stages.JUVENILE_END - stages.BABY_END);
    return clamp(1.15 - t * 0.1, 1.05, 1.15);
  }
  if (age < stages.ADULT_END) {
    return 1.0;
  }
  if (age < stages.ELDER_FADE_START) {
    const t = (age - stages.ADULT_END) / (stages.ELDER_FADE_START - stages.ADULT_END);
    return clamp(1.0 + t * 0.1, 1.0, 1.1);
  }
  const t = (age - stages.ELDER_FADE_START) / (stages.ELDER_FADE_END - stages.ELDER_FADE_START);
  return clamp(1.1 + t * 0.1, 1.1, 1.2);
}

export function getElderFadeAlpha(age) {
  const stages = CreatureAgentTuning.LIFE_STAGE;
  if (age < stages.ELDER_FADE_START) return 1;
  const t = clamp((age - stages.ELDER_FADE_START) / (stages.ELDER_FADE_END - stages.ELDER_FADE_START), 0, 1);
  return clamp(1 - t * 0.4, 0.6, 1);
}

export function getAgeStageIcon(ageStage) {
  switch (ageStage) {
    case 'baby': return '🍼';
    case 'juvenile': return '🌱';
    case 'adult': return '⭐';
    case 'elder': return '👴';
    default: return '';
  }
}
