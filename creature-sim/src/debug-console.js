import { gameState } from './game-state.js';
import { takeSnapshot, diffSnapshots, serializeSnapshot, parseSnapshot } from './snapshot-tools.js';

export class DebugConsole {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.visible = false;
    /** @type {Map<string, Object>} Named snapshot store. */
    this.snapshots = new Map();
    this.commands = {
      help: () => this.showHelp(),
      spawn: count => this.spawnCreatures(count),
      food: count => this.spawnFood(count),
      clear: () => this.clearAll(),
      killall: () => this.killAll(),
      boost: () => this.boostAll(),
      heal: () => this.healAll(),
      speed: multiplier => this.setSpeed(multiplier),
      zoom: level => this.setZoom(level),
      goto: (x, y) => this.gotoPosition(x, y),
      pause: () => this.togglePause(),
      stats: () => this.showStats(),
      export: () => this.exportState(),
      nofood: () => this.removeAllFood(),
      god: () => this.godMode(),
      chaos: () => this.chaosMode(),
      goals: () => this.toggleGoalDebug(),
      observe: () => this.toggleObserverDebug(),
      snapshot: name => this.snapshotState(name),
      diff: (nameA, nameB) => this.diffSnapshotsCommand(nameA, nameB),
      exportSnapshot: name => this.exportSnapshot(name),
      importSnapshot: (json, name) => this.importSnapshot(json, name),
      listSnapshots: () => this.listSnapshots()
    };
  }

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      console.clear();
      console.log('%c🎮 DEBUG CONSOLE ACTIVATED', 'color: #4ade80; font-size: 16px; font-weight: bold;');
      this.showHelp();
    }
  }

  showHelp() {
    console.log('%c📜 Available Commands:', 'color: #7bb7ff; font-weight: bold;');
    console.log('%c  debug.spawn(count)     %c- Spawn N random creatures', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.food(count)      %c- Spawn N food pieces', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.clear()          %c- Clear all creatures', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.killall()        %c- Kill all creatures', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.boost()          %c- Boost all creature energy', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.heal()           %c- Heal all creatures to full', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.speed(mult)      %c- Set game speed (1-10)', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.zoom(level)      %c- Set camera zoom (0.1-3)', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.goto(x, y)       %c- Move camera to position', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.pause()          %c- Toggle pause', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.stats()          %c- Show detailed stats', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.nofood()         %c- Remove all food', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.god()            %c- God mode: immortal creatures', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.chaos()          %c- Chaos mode: random events', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log(
      '%c  debug.goals()          %c- Toggle goal/target debug overlays',
      'color: #ffc800;',
      'color: #c3c6e4;'
    );
    console.log(
      '%c  debug.observe()        %c- Toggle life-stage + memory observer overlays',
      'color: #ffc800;',
      'color: #c3c6e4;'
    );
    console.log('%c  debug.export()         %c- Export world state to console', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.snapshot(name?)  %c- Capture a named world snapshot', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.diff(a?, b?)     %c- Diff two named snapshots', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.exportSnapshot() %c- Serialize a snapshot to JSON', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.importSnapshot() %c- Parse and store a snapshot JSON', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('%c  debug.listSnapshots()  %c- List all stored snapshot names', 'color: #ffc800;', 'color: #c3c6e4;');
    console.log('\n%c💡 Tip: Type "debug" to access the console object', 'color: #9aa0c6; font-style: italic;');
  }

  spawnCreatures(count = 10) {
    for (let i = 0; i < count; i++) {
      this.world.spawnManual(Math.random() * this.world.width, Math.random() * this.world.height, Math.random() > 0.8);
    }
    console.log(`✅ Spawned ${count} creatures`);
  }

  spawnFood(count = 50) {
    for (let i = 0; i < count; i++) {
      this.world.addFood(Math.random() * this.world.width, Math.random() * this.world.height);
    }
    console.log(`✅ Spawned ${count} food pieces`);
  }

  clearAll() {
    this.world.creatures = [];
    console.log('✅ All creatures removed');
  }

  killAll() {
    for (const c of this.world.creatures) {
      c.alive = false;
    }
    console.log(`✅ Killed ${this.world.creatures.length} creatures`);
  }

  boostAll() {
    for (const c of this.world.creatures) {
      c.energy = 100;
    }
    console.log(`✅ Boosted ${this.world.creatures.length} creatures`);
  }

  healAll() {
    for (const c of this.world.creatures) {
      c.health = c.maxHealth;
    }
    console.log(`✅ Healed ${this.world.creatures.length} creatures`);
  }

  setSpeed(multiplier = 1) {
    window.debugSpeed = multiplier;
    console.log(`✅ Speed set to ${multiplier}x`);
  }

  setZoom(level = 1) {
    this.camera.zoom = level;
    this.camera.targetZoom = level;
    console.log(`✅ Zoom set to ${level}`);
  }

  gotoPosition(x, y) {
    this.camera.targetX = x;
    this.camera.targetY = y;
    console.log(`✅ Moving camera to (${x}, ${y})`);
  }

  togglePause() {
    window.debugPause = !window.debugPause;
    console.log(`✅ Game ${window.debugPause ? 'paused' : 'unpaused'}`);
  }

  showStats() {
    console.log('%c📊 World Statistics:', 'color: #7bb7ff; font-weight: bold;');
    console.log(`  Population: ${this.world.creatures.length}`);
    console.log(`  Food: ${this.world.food.length}`);
    console.log(`  Corpses: ${this.world.corpses?.length || 0}`);
    console.log(`  Time: ${this.world.t.toFixed(1)}s`);
    console.log(`  World Size: ${this.world.width} × ${this.world.height}`);

    let herbs = 0,
      omnis = 0,
      preds = 0;
    let totalEnergy = 0,
      totalHealth = 0;
    for (const c of this.world.creatures) {
      const diet = c.genes.diet ?? (c.genes.predator ? 1 : 0);
      if (diet > 0.7) preds++;
      else if (diet > 0.3) omnis++;
      else herbs++;
      totalEnergy += c.energy;
      totalHealth += c.health;
    }

    console.log(`  Herbivores: ${herbs}`);
    console.log(`  Omnivores: ${omnis}`);
    console.log(`  Predators: ${preds}`);
    const creatureCount = this.world.creatures.length;
    const avgEnergy = creatureCount ? (totalEnergy / creatureCount).toFixed(1) : '0.0';
    const avgHealth = creatureCount ? (totalHealth / creatureCount).toFixed(1) : '0.0';
    console.log(`  Avg Energy: ${avgEnergy}`);
    console.log(`  Avg Health: ${avgHealth}`);
  }

  exportState() {
    const state = {
      population: this.world.creatures.length,
      food: this.world.food.length,
      time: this.world.t,
      creatures: this.world.creatures.slice(0, 5).map(c => ({
        id: c.id,
        age: c.age,
        energy: c.energy,
        genes: c.genes
      }))
    };
    console.log('%c📤 World State:', 'color: #7bb7ff; font-weight: bold;');
    console.log(state);
    return state;
  }

  removeAllFood() {
    this.world.food = [];
    console.log('✅ All food removed');
  }

  godMode() {
    for (const c of this.world.creatures) {
      c.energy = 999;
      c.health = c.maxHealth * 10;
      c.maxHealth = c.maxHealth * 10;
    }
    console.log('✅ GOD MODE ACTIVATED - Creatures are now immortal!');
  }

  chaosMode() {
    console.log('✅ CHAOS MODE - Random mutations incoming!');
    for (const c of this.world.creatures) {
      c.genes.speed *= 0.5 + Math.random();
      c.genes.sense *= 0.5 + Math.random();
      c.genes.metabolism *= 0.5 + Math.random();
    }
    // Spawn random disasters
    if (this.world.triggerDisaster) {
      const disasters = ['meteorStorm', 'iceAge', 'plague', 'drought'];
      const random = disasters[Math.floor(Math.random() * disasters.length)];
      this.world.triggerDisaster(random);
    }
  }

  toggleGoalDebug() {
    gameState.showGoalDebug = !gameState.showGoalDebug;
    console.log(`✅ Goal debug ${gameState.showGoalDebug ? 'enabled' : 'disabled'}`);
  }

  toggleObserverDebug() {
    gameState.showObserverDebug = !gameState.showObserverDebug;
    console.log(`✅ Observer overlays ${gameState.showObserverDebug ? 'enabled' : 'disabled'}`);
  }

  /**
   * Capture a snapshot of the current world state and store it under `name`.
   * @param {string} [name='current'] Snapshot name. Replaces any existing entry.
   * @returns {Object|null} The captured snapshot, or null on error.
   */
  snapshotState(name = 'current') {
    if (!this.world) {
      console.warn('⚠️ No world attached to DebugConsole; cannot snapshot.');
      return null;
    }
    try {
      const snap = takeSnapshot(this.world, this.camera);
      this.snapshots.set(name, snap);
      console.log(
        `📸 Snapshot "${name}" captured (t=${snap.world.t.toFixed(2)}s, pop=${snap.population.alive}, lineages=${snap.lineages.length}).`
      );
      return snap;
    } catch (error) {
      console.warn('⚠️ Failed to capture snapshot:', error);
      return null;
    }
  }

  /**
   * Diff two named snapshots and log the result.
   * @param {string} [nameA='current']
   * @param {string} [nameB='previous']
   * @returns {Object|null} The diff object, or null if a snapshot is missing.
   */
  diffSnapshotsCommand(nameA = 'current', nameB = 'previous') {
    const a = this.snapshots.get(nameA);
    const b = this.snapshots.get(nameB);
    if (!a || !b) {
      console.warn(
        `⚠️ Cannot diff: missing snapshot(s). Have: ${Array.from(this.snapshots.keys()).join(', ') || '(none)'}`
      );
      return null;
    }
    const diff = diffSnapshots(a, b);
    this._logDiff(diff, nameA, nameB);
    return diff;
  }

  /**
   * Pretty-print a diff object to the console.
   * @param {Object} diff
   * @param {string} nameA
   * @param {string} nameB
   * @private
   */
  _logDiff(diff, nameA, nameB) {
    if (!diff || diff.error) {
      console.warn(`⚠️ Diff error: ${diff?.error || 'unknown'}`);
      return;
    }
    console.log(`%c🔍 Diff: "${nameA}" → "${nameB}"`, 'color: #7bb7ff; font-weight: bold;');
    console.log(`  timeDelta: ${diff.timeDelta.toFixed(2)}s`);
    console.log('  populationDelta:');
    for (const [key, value] of Object.entries(diff.populationDelta || {})) {
      if (value !== 0) {
        const sign = value > 0 ? '+' : '';
        console.log(`    ${key}: ${sign}${value}`);
      }
    }
    if (diff.newlyBorn.length > 0) {
      console.log(`  newlyBorn (${diff.newlyBorn.length}):`);
      for (const c of diff.newlyBorn) {
        console.log(`    #${c.id}${c.name ? ` (${c.name})` : ''} energy=${c.energy.toFixed(1)}`);
      }
    }
    if (diff.newlyDead.length > 0) {
      console.log(`  newlyDead (${diff.newlyDead.length}):`);
      for (const c of diff.newlyDead) {
        console.log(`    #${c.id}${c.name ? ` (${c.name})` : ''} lastEnergy=${c.energy.toFixed(1)}`);
      }
    }
    if (diff.lineageChanges.length > 0) {
      console.log(`  lineageChanges (${diff.lineageChanges.length}):`);
      for (const change of diff.lineageChanges) {
        const sign = change.delta > 0 ? '+' : '';
        console.log(
          `    lineage ${change.id}${change.name ? ` (${change.name})` : ''}: ${change.aliveBefore} → ${change.aliveAfter} (${sign}${change.delta})`
        );
      }
    }
  }

  /**
   * Export a named snapshot as a JSON string.
   * @param {string} [name='current']
   * @returns {string|null} Serialized snapshot, or null if not found.
   */
  exportSnapshot(name = 'current') {
    const snap = this.snapshots.get(name);
    if (!snap) {
      console.warn(`⚠️ No snapshot named "${name}".`);
      return null;
    }
    const json = serializeSnapshot(snap);
    console.log(`📤 Snapshot "${name}" exported (${json.length} bytes).`);
    return json;
  }

  /**
   * Parse and store a snapshot from a JSON string.
   * @param {string} json
   * @param {string} [name='imported']
   * @returns {Object|null} The parsed snapshot, or null on failure.
   */
  importSnapshot(json, name = 'imported') {
    const snap = parseSnapshot(json);
    if (!snap) {
      console.warn('⚠️ Failed to parse snapshot JSON.');
      return null;
    }
    this.snapshots.set(name, snap);
    console.log(
      `📥 Snapshot imported as "${name}" (t=${snap.world?.t?.toFixed?.(2) ?? '?'}s, pop=${snap.population?.alive ?? '?'}).`
    );
    return snap;
  }

  /**
   * List all stored snapshot names with their capture timestamps.
   * @returns {Array<{name: string, timestamp: number}>}
   */
  listSnapshots() {
    const entries = [];
    for (const [name, snap] of this.snapshots.entries()) {
      entries.push({ name, timestamp: snap?.timestamp ?? 0 });
    }
    if (entries.length === 0) {
      console.log('📂 No snapshots stored. Use debug.snapshot("name") to capture one.');
    } else {
      console.log(`%c📂 Snapshots (${entries.length})`, 'color: #7bb7ff; font-weight: bold;');
      for (const entry of entries) {
        const t = entry.timestamp ? new Date(entry.timestamp).toISOString() : 'unknown';
        console.log(`  - ${entry.name} @ ${t}`);
      }
    }
    return entries;
  }

  /**
   * Update method called each frame (for interface compatibility)
   * @param {number} dt - Delta time
   */
  update(_dt) {
    // Debug console is primarily reactive (responds to user commands)
    // No per-frame updates needed currently
  }

  /**
   * Check if debug console is active
   */
  get isActive() {
    return this.visible;
  }
}
