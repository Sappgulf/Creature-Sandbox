# Balance Tuning (2026-02-07)

This document captures the current balance targets for Creature Sandbox’s final polish pass.

## Health & Damage
- **Default max health:** 40 (predators scale to 50 with the 1.25× multiplier).  
- **Combat max damage per hit:** 28% of max health.  
- **Impact damage clamp:** 8 max per hit.  
- **Collision threshold:** 0.82 normalized impact before damage applies.  
- **Impact i-frames:** 650ms (prevents rapid multi-hit damage).  
- **Combat i-frames:** 0.9s.  
- **Fall damage threshold:** 200 external speed before fall damage.  
- **Drowning damage:** 0–2.2 damage/sec in deep water for low aquatic affinity.  

## Needs & Recovery
- **Hunger rate:** 1.0 per second (day/night adjusted).  
- **Social rate:** 0.55 per second (day/night adjusted).  
- **Stress decay:** 7/sec while resting, 3.2/sec while calm.  
- **Overcrowd stress gain:** 3.8/sec (scaled by day/night and life stage).  
- **Hunger relief:** 1.6 per energy gained.  
- **Food bite energy:** 4.5 per bite.  
- **Rest zone recovery:** 7.5 energy/sec, 5.5 stress/sec.  
- **Mating cooldown:** 36 seconds.  

## Intent
- Creatures should survive casual play, with meaningful but readable consequences.
- Single impacts should never delete a healthy creature.
- Rest, calm zones, and food should clearly recover stress, hunger, and energy.
