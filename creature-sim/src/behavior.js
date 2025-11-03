export const BehaviorConfig = {
  forageWeight: 1,
  wanderWeight: 1,
  restWeight: 0.6
};

export function setBehaviorWeights({ forage, wander, rest }) {
  if (forage != null) BehaviorConfig.forageWeight = forage;
  if (wander != null) BehaviorConfig.wanderWeight = wander;
  if (rest != null) BehaviorConfig.restWeight = rest;
}
