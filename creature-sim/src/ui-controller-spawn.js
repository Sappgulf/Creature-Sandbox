import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { SANDBOX_PROP_TYPES } from './sandbox-props.js';
import { getDebugFlags } from './debug-flags.js';

export const CREATURE_SPAWN_TYPES = {
  herbivore: { icon: '🦌', label: 'Herbivore' },
  omnivore: { icon: '🦡', label: 'Omnivore' },
  predator: { icon: '🦁', label: 'Predator' },
  aquatic: { icon: '🐠', label: 'Aquatic' }
};
export const DEFAULT_SPAWN_TYPE = 'herbivore';

export function applyUiSpawnMethods(UIController) {
  UIController.prototype.bindPropControls = function() {
    const propToolBtn = domCache.get('propToolBtn');
    const propDropdown = domCache.get('propDropdown');

    if (propToolBtn && propDropdown) {
      // Toggle dropdown on button click
      propToolBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !propDropdown.classList.contains('hidden');
        // Close other dropdowns first
        this.closeAllDropdowns();
        if (!isOpen) {
          propDropdown.classList.remove('hidden');
        }
      });

      // Handle dropdown item clicks
      const dropdownItems = propDropdown.querySelectorAll('.dropdown-item');
      dropdownItems.forEach(item => {
        item.addEventListener('click', (event) => {
          event.stopPropagation();
          const propType = item.dataset.prop;
          this.setPropType(propType);
          this.onPropTool();
          propDropdown.classList.add('hidden');
        });
      });
    }
  };

  UIController.prototype.closeAllDropdowns = function() {
    const creatureDropdown = domCache.get('creatureDropdown');
    const propDropdown = domCache.get('propDropdown');
    if (creatureDropdown) creatureDropdown.classList.add('hidden');
    if (propDropdown) propDropdown.classList.add('hidden');
  };

  UIController.prototype.setPropType = function(type) {
    if (!type) return;
    const safeType = SANDBOX_PROP_TYPES[type] ? type : 'bounce';
    gameState.selectedPropType = safeType;
    this.tools?.setPropType?.(safeType);
    this.updatePropButton(safeType);

    const propDropdown = domCache.get('propDropdown');
    if (propDropdown) {
      propDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.prop === safeType);
      });
    }
  };

  UIController.prototype.cyclePropType = function(direction = 1) {
    const current = gameState.selectedPropType || 'bounce';
    const idx = this.propTypeOrder.indexOf(current);
    const nextIdx = (idx + direction + this.propTypeOrder.length) % this.propTypeOrder.length;
    this.setPropType(this.propTypeOrder[nextIdx]);
  };

  UIController.prototype.updatePropButton = function(type) {
    const propToolBtn = domCache.get('propToolBtn');

    const meta = SANDBOX_PROP_TYPES[type] || SANDBOX_PROP_TYPES.bounce;
    if (propToolBtn) {
      propToolBtn.textContent = meta.icon;
      propToolBtn.title = `${meta.label} (P)`;
    }

  };

  UIController.prototype.bindSpawnCreatureControls = function() {
    const spawnCreatureBtn = domCache.get('spawnCreatureBtn');
    const creatureDropdown = domCache.get('creatureDropdown');

    if (spawnCreatureBtn && creatureDropdown) {
      // Toggle dropdown on button click
      spawnCreatureBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !creatureDropdown.classList.contains('hidden');
        // Close other dropdowns first
        this.closeAllDropdowns();
        if (!isOpen) {
          creatureDropdown.classList.remove('hidden');
        }
      });

      // Handle dropdown item clicks
      const dropdownItems = creatureDropdown.querySelectorAll('.dropdown-item');
      dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const creatureType = item.dataset.creature;
          this.applySpawnSelection(creatureType);
          this.onSpawnCreature(creatureType);
          creatureDropdown.classList.add('hidden');
        });
      });


    }

    // Global click handler to close dropdowns
    document.addEventListener('click', (e) => {
      // Don't close if clicking inside a dropdown
      if (e.target.closest('.dropdown-menu') || e.target.closest('.spawn-dropdown')) {
        return;
      }
      this.closeAllDropdowns();
    });
  };

  UIController.prototype.onSpawnCreature = function(type) {
    const safeType = this.resolveSpawnType(type, { notifyOnFallback: true });
    if (!safeType) return;
    const x = this.world.width / 2 + (Math.random() - 0.5) * 200;
    const y = this.world.height / 2 + (Math.random() - 0.5) * 200;

    // Use world helper so genetics and bookkeeping stay centralized
    const debugFlags = getDebugFlags();
    if (debugFlags.spawnDebug) {
      console.debug('[Spawn][ui]', {
        requestedType: type,
        resolvedType: safeType,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2))
      });
    }
    const creature = this.world.spawnCreatureType(safeType, x, y);
    this.applySpawnSelection(safeType, { silent: true });
    this.dismissInteractionHint();
    if (creature && this.hasNotifications()) {
      this.notifications.show(`Spawned ${safeType}!`, 'info', 1500);
    }
    console.debug(`🦌 Spawned ${safeType} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  };

  UIController.prototype.updateSpawnButton = function(type) {
    const spawnCreatureBtn = domCache.get('spawnCreatureBtn');
    if (!spawnCreatureBtn) return;

    const meta = CREATURE_SPAWN_TYPES[type] || CREATURE_SPAWN_TYPES[DEFAULT_SPAWN_TYPE];
    const icon = meta.icon;
    const label = meta.label;
    spawnCreatureBtn.textContent = icon;
    spawnCreatureBtn.title = `Spawn ${label}`;
  };

  UIController.prototype.updateSpawnDropdownSelection = function(type) {
    const creatureDropdown = domCache.get('creatureDropdown');
    if (!creatureDropdown) return;
    creatureDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.creature === type);
    });
  };

  UIController.prototype.applySpawnSelection = function(type, { silent = false } = {}) {
    const safeType = CREATURE_SPAWN_TYPES[type] ? type : DEFAULT_SPAWN_TYPE;
    if (!CREATURE_SPAWN_TYPES[type] && !silent && this.hasNotifications()) {
      this.notifications.show('Unknown creature type. Defaulting to herbivore.', 'warning', 2000);
    }
    this.lastSpawnType = safeType;
    gameState.selectedCreatureType = safeType;
    this.updateSpawnButton(safeType);
    this.updateSpawnDropdownSelection(safeType);

    return safeType;
  };

  UIController.prototype.resolveSpawnType = function(type, { notifyOnFallback = false } = {}) {
    const directType = CREATURE_SPAWN_TYPES[type] ? type : null;
    if (directType) return directType;

    const fallback = CREATURE_SPAWN_TYPES[this.lastSpawnType]
      ? this.lastSpawnType
      : DEFAULT_SPAWN_TYPE;

    if (notifyOnFallback && this.hasNotifications()) {
      const message = type
        ? 'Selected creature missing. Spawning last used.'
        : 'No creature selected — spawning last used.';
      this.notifications.show(message, 'warning', 2200);
    }
    return fallback;
  };

  UIController.prototype.onPropTool = function() {
    this.tools?.setMode?.('prop');
    if (!gameState.selectedPropType) {
      this.setPropType('bounce');
    }
    this.updateToolIndicator('prop');
  };
}
