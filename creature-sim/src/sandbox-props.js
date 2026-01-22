import { clamp } from './utils.js';
import { eventSystem, GameEvents } from './event-system.js';

export const SANDBOX_PROP_TYPES = {
  bounce: {
    id: 'bounce',
    label: 'Bounce Pad',
    icon: '🟣',
    radius: 52,
    strength: 280,
    cooldown: 0.35,
    color: '#7c3aed'
  },
  spring: {
    id: 'spring',
    label: 'Spring Pad',
    icon: '🟢',
    radius: 58,
    strength: 360,
    cooldown: 0.4,
    color: '#22c55e'
  },
  spinner: {
    id: 'spinner',
    label: 'Spinner',
    icon: '🌀',
    radius: 64,
    strength: 190,
    cooldown: 0.25,
    color: '#38bdf8'
  },
  seesaw: {
    id: 'seesaw',
    label: 'See-Saw',
    icon: '🪜',
    radius: 56,
    strength: 200,
    cooldown: 0.35,
    color: '#f59e0b'
  },
  conveyor: {
    id: 'conveyor',
    label: 'Conveyor Belt',
    icon: '➡️',
    radius: 66,
    strength: 110,
    cooldown: 0,
    color: '#64748b',
    randomDirection: true
  },
  slope: {
    id: 'slope',
    label: 'Speed Slope',
    icon: '⛰️',
    radius: 60,
    strength: 150,
    cooldown: 0.2,
    color: '#60a5fa',
    randomDirection: true
  },
  fan: {
    id: 'fan',
    label: 'Wind Fan',
    icon: '🪭',
    radius: 90,
    strength: 120,
    cooldown: 0,
    color: '#38bdf8',
    randomDirection: true
  },
  sticky: {
    id: 'sticky',
    label: 'Sticky Zone',
    icon: '🫧',
    radius: 70,
    strength: 0.18,
    cooldown: 0,
    color: '#f472b6'
  },
  gravity: {
    id: 'gravity',
    label: 'Gravity Well',
    icon: '🕳️',
    radius: 140,
    strength: 70,
    cooldown: 0,
    color: '#6366f1'
  },
  button: {
    id: 'button',
    label: 'Food Button',
    icon: '🔘',
    radius: 34,
    strength: 1,
    cooldown: 1.4,
    color: '#f97316'
  },
  launch: {
    id: 'launch',
    label: 'Launch Button',
    icon: '🚀',
    radius: 36,
    strength: 360,
    cooldown: 0.8,
    color: '#ef4444'
  }
};

const PROP_TYPE_LIST = Object.values(SANDBOX_PROP_TYPES);

export class SandboxProps {
  constructor(world) {
    this.world = world;
    this.props = [];
    this.maxProps = 36;
    this._nextId = 1;
  }

  getTypes() {
    return PROP_TYPE_LIST;
  }

  getTypeConfig(type) {
    return SANDBOX_PROP_TYPES[type] || SANDBOX_PROP_TYPES.bounce;
  }

  addProp(type, x, y, options = {}) {
    const config = this.getTypeConfig(type);
    const clampedX = clamp(x, 0, this.world.width);
    const clampedY = clamp(y, 0, this.world.height);
    const id = options.id ?? this._nextId++;
    const dir = options.dir ?? (config.randomDirection ? Math.random() * Math.PI * 2 : (config.dir ?? 0));

    const prop = {
      id,
      type: config.id,
      x: clampedX,
      y: clampedY,
      radius: options.radius ?? config.radius,
      strength: options.strength ?? config.strength,
      dir,
      cooldown: 0,
      cooldownMax: config.cooldown,
      color: options.color ?? config.color
    };
    prop.radiusSq = prop.radius * prop.radius;

    if (this.props.length >= this.maxProps) {
      this.props.shift();
    }

    this.props.push(prop);
    this._nextId = Math.max(this._nextId, prop.id + 1);
    eventSystem.emit(GameEvents.SANDBOX_PROP_PLACED, { prop });
    return prop;
  }

  removePropById(id) {
    const idx = this.props.findIndex(p => p.id === id);
    if (idx === -1) return null;
    return this.props.splice(idx, 1)[0] || null;
  }

  removeNearestProp(x, y, radius = 48) {
    let nearest = null;
    let nearestIdx = -1;
    let bestDist = radius * radius;

    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i];
      const dx = prop.x - x;
      const dy = prop.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        nearest = prop;
        nearestIdx = i;
      }
    }

    if (nearestIdx >= 0) {
      this.props.splice(nearestIdx, 1);
      return nearest;
    }

    return null;
  }

  clear() {
    this.props = [];
    this._nextId = 1;
  }

  update(dt) {
    if (!this.props.length || !this.world) return;

    for (const prop of this.props) {
      if (prop.cooldown > 0) {
        prop.cooldown = Math.max(0, prop.cooldown - dt);
      }
    }

    const creatures = this.world.creatures;
    if (!creatures || creatures.length === 0) return;

    for (let i = 0; i < creatures.length; i++) {
      const creature = creatures[i];
      if (!creature || !creature.alive || creature.isGrabbed) continue;

      for (let j = 0; j < this.props.length; j++) {
        const prop = this.props[j];
        const dx = creature.x - prop.x;
        const dy = creature.y - prop.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > prop.radiusSq) continue;

        switch (prop.type) {
          case 'bounce':
            if (prop.cooldown > 0) break;
            this._applyBounce(prop, creature, dx, dy);
            break;
          case 'spring':
            if (prop.cooldown > 0) break;
            this._applySpring(prop, creature, dx, dy);
            break;
          case 'spinner':
            if (prop.cooldown > 0) break;
            this._applySpinner(prop, creature, dx, dy);
            break;
          case 'seesaw':
            if (prop.cooldown > 0) break;
            this._applySeeSaw(prop, creature, dx, dy);
            break;
          case 'conveyor':
            this._applyConveyor(prop, creature, dt);
            break;
          case 'slope':
            if (prop.cooldown > 0) break;
            this._applySlope(prop, creature, dx, dy);
            break;
          case 'fan':
            this._applyFan(prop, creature, dx, dy, dt);
            break;
          case 'sticky':
            this._applySticky(prop, creature, dx, dy, dt);
            break;
          case 'gravity':
            this._applyGravity(prop, creature, dx, dy, distSq, dt);
            break;
          case 'button':
            if (prop.cooldown > 0) break;
            this._applyButton(prop, creature);
            break;
          case 'launch':
            if (prop.cooldown > 0) break;
            this._applyLaunch(prop, creature, dx, dy);
            break;
          default:
            break;
        }
      }
    }
  }

  _applyBounce(prop, creature, dx, dy) {
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const nx = dx / dist;
    const ny = dy / dist;
    const chaosBoost = this.world.chaos?.bounceBoost ?? 1;
    const surpriseBoost = Math.random() < 0.04 ? 1.25 : 1;
    const strength = prop.strength * chaosBoost * surpriseBoost * clamp(1 - dist / prop.radius, 0.35, 1);

    creature.applyImpulse?.(nx * strength, ny * strength, { decay: 6, cap: 340 });
    creature.reactToCollision?.(0.7);
    creature.applyStatus?.('play-burst', { duration: 0.4, intensity: 0.25 });
    if (creature.funStats) creature.funStats.propBounces += 1;
    prop.cooldown = prop.cooldownMax;

    if (this.world.particles?.addPlayBurst) {
      this.world.particles.addPlayBurst(creature.x, creature.y);
    }
    eventSystem.emit(GameEvents.SANDBOX_PROP_TRIGGERED, { type: 'bounce', propId: prop.id, creatureId: creature.id });
  }

  _applySpring(prop, creature, dx, dy) {
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const nx = dx / dist;
    const ny = dy / dist;
    const chaosBoost = this.world.chaos?.bounceBoost ?? 1;
    const surpriseBoost = Math.random() < 0.04 ? 1.25 : 1;
    const strength = prop.strength * chaosBoost * surpriseBoost * clamp(1 - dist / prop.radius, 0.4, 1.2);

    creature.applyImpulse?.(nx * strength, ny * strength, { decay: 5.6, cap: 380 });
    creature.reactToCollision?.(0.9);
    creature.applyStatus?.('play-burst', { duration: 0.5, intensity: 0.35 });
    if (creature.funStats) creature.funStats.propBounces += 1;
    prop.cooldown = prop.cooldownMax;

    if (this.world.particles?.addImpactRing) {
      this.world.particles.addImpactRing(creature.x, creature.y, { color: prop.color, size: 14 });
    }
    if (this.world.audio?.playUISound) {
      this.world.audio.playUISound('success');
    }
    eventSystem.emit(GameEvents.SANDBOX_PROP_TRIGGERED, { type: 'spring', propId: prop.id, creatureId: creature.id });
  }

  _applySpinner(prop, creature, dx, dy) {
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const nx = dx / dist;
    const ny = dy / dist;
    const tangentX = -ny;
    const tangentY = nx;
    const strength = prop.strength * clamp(1 - dist / prop.radius, 0.2, 1);

    creature.applyImpulse?.(tangentX * strength, tangentY * strength, { decay: 6.8, cap: 320 });
    creature.dir += 0.6 * clamp(1 - dist / prop.radius, 0.2, 1);
    creature.reactToCollision?.(0.5);
    prop.cooldown = prop.cooldownMax;

    if (this.world.particles?.addImpactRing) {
      this.world.particles.addImpactRing(creature.x, creature.y, { color: prop.color });
    }
    eventSystem.emit(GameEvents.SANDBOX_PROP_TRIGGERED, { type: 'spinner', propId: prop.id, creatureId: creature.id });
  }

  _applySeeSaw(prop, creature, dx, dy) {
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const tilt = dx / Math.max(prop.radius, 1);
    const lift = clamp(1 - dist / prop.radius, 0.35, 1);
    const side = tilt >= 0 ? 1 : -1;
    const strength = prop.strength * lift;
    const pushX = side * strength * 0.6;
    const pushY = -strength * 0.45;

    creature.applyImpulse?.(pushX, pushY, { decay: 6.5, cap: 280 });
    creature.reactToCollision?.(0.5);
    prop.cooldown = prop.cooldownMax;

    if (this.world.particles?.addImpactRing) {
      this.world.particles.addImpactRing(creature.x, creature.y, { color: prop.color, size: 10 });
    }
    eventSystem.emit(GameEvents.SANDBOX_PROP_TRIGGERED, { type: 'seesaw', propId: prop.id, creatureId: creature.id });
  }

  _applyConveyor(prop, creature, dt) {
    const dir = prop.dir ?? 0;
    const strength = prop.strength * dt * 60;
    const vx = Math.cos(dir) * strength;
    const vy = Math.sin(dir) * strength;
    creature.applyImpulse?.(vx, vy, { decay: 12, cap: 200 });
  }

  _applySlope(prop, creature, dx, dy) {
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const slopeDir = prop.dir ?? 0;
    const lift = clamp(1 - dist / prop.radius, 0.2, 1);
    const strength = prop.strength * lift;
    const vx = Math.cos(slopeDir) * strength;
    const vy = Math.sin(slopeDir) * strength;
    creature.applyImpulse?.(vx, vy, { decay: 7.2, cap: 260 });
    creature.reactToCollision?.(0.35);
    prop.cooldown = prop.cooldownMax;

    if (this.world.particles?.addImpactRing) {
      this.world.particles.addImpactRing(creature.x, creature.y, { color: prop.color, size: 9 });
    }
    eventSystem.emit(GameEvents.SANDBOX_PROP_TRIGGERED, { type: 'slope', propId: prop.id, creatureId: creature.id });
  }

  _applyFan(prop, creature, dx, dy, dt) {
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const falloff = clamp(1 - dist / prop.radius, 0.1, 1);
    const dir = prop.dir ?? 0;
    const strength = prop.strength * falloff * dt * 60;
    creature.applyImpulse?.(Math.cos(dir) * strength, Math.sin(dir) * strength, { decay: 10, cap: 220 });
    creature.reactToCollision?.(0.15);
  }

  _applySticky(prop, creature, dx, dy, dt) {
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const falloff = clamp(1 - dist / prop.radius, 0.2, 1);
    const drag = prop.strength * falloff * dt * 60;
    const impulse = creature.externalImpulse;
    if (impulse) {
      impulse.vx *= clamp(1 - drag, 0.4, 0.98);
      impulse.vy *= clamp(1 - drag, 0.4, 0.98);
    }
    creature.reactToCollision?.(0.2);
  }

  _applyGravity(prop, creature, dx, dy, distSq, dt) {
    const dist = Math.max(12, Math.sqrt(distSq));
    const pull = prop.strength * clamp(1 - dist / prop.radius, 0.15, 1);
    const nx = -dx / dist;
    const ny = -dy / dist;

    creature.applyImpulse?.(nx * pull * dt * 60, ny * pull * dt * 60, { decay: 11, cap: 220 });
    creature.reactToCollision?.(0.2);
  }

  _applyButton(prop, creature) {
    prop.cooldown = prop.cooldownMax;

    const burstCount = 12;
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const radius = 24 + Math.random() * 28;
      const fx = prop.x + Math.cos(angle) * radius;
      const fy = prop.y + Math.sin(angle) * radius;
      this.world.addFood?.(fx, fy, 1.4);
    }

    if (this.world.particles?.addImpactRing) {
      this.world.particles.addImpactRing(prop.x, prop.y, { color: prop.color, size: 18 });
    }
    if (this.world.audio?.playUISound) {
      this.world.audio.playUISound('success');
    }

    eventSystem.emit(GameEvents.SANDBOX_PROP_TRIGGERED, { type: 'button', propId: prop.id, creatureId: creature.id });
  }

  _applyLaunch(prop, creature, dx, dy) {
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const nx = dx / dist;
    const ny = dy / dist;
    const chaosBoost = this.world.chaos?.bounceBoost ?? 1;
    const strength = prop.strength * chaosBoost * clamp(1 - dist / prop.radius, 0.4, 1.1);

    creature.applyImpulse?.(nx * strength, (ny - 0.6) * strength, { decay: 5.2, cap: 420 });
    creature.reactToCollision?.(1.0);
    if (creature.funStats) creature.funStats.propBounces += 1;
    prop.cooldown = prop.cooldownMax;

    if (this.world.particles?.addImpactRing) {
      this.world.particles.addImpactRing(creature.x, creature.y, { color: prop.color, size: 16 });
    }
    if (this.world.particles?.triggerShake) {
      this.world.particles.triggerShake(3);
    }
    if (this.world.audio?.playUISound) {
      this.world.audio.playUISound('toggle');
    }
    eventSystem.emit(GameEvents.SANDBOX_PROP_TRIGGERED, { type: 'launch', propId: prop.id, creatureId: creature.id });
  }

  serialize() {
    return this.props.map(prop => ({
      id: prop.id,
      type: prop.type,
      x: prop.x,
      y: prop.y,
      dir: prop.dir,
      radius: prop.radius,
      strength: prop.strength,
      color: prop.color
    }));
  }

  restore(items = []) {
    this.props = [];
    this._nextId = 1;

    for (const item of items) {
      if (!item || !item.type) continue;
      const config = this.getTypeConfig(item.type);
      const prop = {
        id: item.id ?? this._nextId++,
        type: item.type,
        x: clamp(item.x ?? 0, 0, this.world.width),
        y: clamp(item.y ?? 0, 0, this.world.height),
        dir: item.dir ?? (config.randomDirection ? Math.random() * Math.PI * 2 : (config.dir ?? 0)),
        radius: item.radius ?? config.radius,
        strength: item.strength ?? config.strength,
        cooldown: 0,
        cooldownMax: config.cooldown,
        color: item.color ?? config.color
      };
      prop.radiusSq = prop.radius * prop.radius;
      this.props.push(prop);
      this._nextId = Math.max(this._nextId, prop.id + 1);
    }
  }
}
