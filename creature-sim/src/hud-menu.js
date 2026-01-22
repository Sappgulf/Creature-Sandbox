import { HUD_MENU_GROUPS, createHudMenuActions } from './menu-model.js';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
}

export class HudMenu {
  constructor({ handlers = {} } = {}) {
    this.actions = createHudMenuActions(handlers);
    this.groups = HUD_MENU_GROUPS;

    this.primaryContainer = document.getElementById('hud-primary');
    this.overflowTrigger = document.getElementById('hud-overflow-trigger');
    this.overflowMenu = document.getElementById('hud-overflow-menu');
    this.overflowBackdrop = document.getElementById('hud-overflow-backdrop');
    this.overflowSheet = document.getElementById('hud-overflow-sheet');
    this.overflowSheetContent = document.getElementById('hud-overflow-sheet-content');
    this.overflowClose = document.getElementById('hud-overflow-close');

    this.isOpen = false;
    this.openMode = null;
    this.lastFocusedElement = null;
  }

  initialize() {
    this.render();
    this.bindActionHandlers();
    this.bindOverflowControls();
    this.updateActionStates();
  }

  render() {
    if (this.primaryContainer) {
      this.primaryContainer.innerHTML = '';
    }
    if (this.overflowMenu) {
      this.overflowMenu.innerHTML = '';
    }
    if (this.overflowSheetContent) {
      this.overflowSheetContent.innerHTML = '';
    }

    this.actions.forEach((action) => {
      const button = document.getElementById(action.id);
      if (!button) return;

      button.type = 'button';
      button.dataset.menuAction = action.id;
      button.setAttribute('aria-label', action.label);
      button.title = action.shortcut ? `${action.label} (${action.shortcut})` : action.label;
      if (action.shortcut) {
        button.setAttribute('aria-keyshortcuts', action.shortcut);
      }

      if (action.primary && this.primaryContainer) {
        button.classList.remove('hud-menu-item');
        button.classList.add('hud-primary-btn');
        button.textContent = `${action.icon} ${action.label}`.trim();
        this.primaryContainer.appendChild(button);
      }
    });

    this.renderOverflowContent(this.overflowMenu, { variant: 'menu' });
    this.renderOverflowContent(this.overflowSheetContent, { variant: 'sheet' });
  }

  bindActionHandlers() {
    this.actions.forEach((action) => {
      const button = document.getElementById(action.id);
      if (!button || button.dataset.hudBound === 'true') return;

      if (typeof action.handler === 'function') {
        button.addEventListener('click', action.handler);
      }

      button.dataset.hudBound = 'true';
    });
  }

  renderOverflowContent(container, { variant }) {
    if (!container) return;

    const groupedActions = this.groups
      .map((group) => ({
        group,
        actions: this.actions.filter((action) => action.group === group.id && !action.primary)
      }))
      .filter((entry) => entry.actions.length > 0);

    groupedActions.forEach((entry) => {
      const groupWrapper = document.createElement('div');
      groupWrapper.className = `hud-menu-group hud-menu-group-${variant}`;
      groupWrapper.setAttribute('role', 'presentation');

      const groupTitle = document.createElement('div');
      groupTitle.className = 'hud-menu-group-title';
      groupTitle.textContent = entry.group.label;

      const groupItems = document.createElement('div');
      groupItems.className = 'hud-menu-group-items';
      groupItems.setAttribute('role', 'group');
      groupItems.setAttribute('aria-label', entry.group.label);

      entry.actions.forEach((action) => {
        const button = document.getElementById(action.id);
        if (!button) return;

        button.classList.remove('hud-primary-btn');
        button.classList.add('hud-menu-item');
        button.tabIndex = -1;

        const label = document.createElement('span');
        label.className = 'hud-menu-label';
        label.textContent = `${action.icon} ${action.label}`.trim();

        button.textContent = '';
        button.appendChild(label);

        if (action.shortcut) {
          const shortcut = document.createElement('span');
          shortcut.className = 'hud-menu-shortcut';
          shortcut.textContent = action.shortcut;
          button.appendChild(shortcut);
        }

        groupItems.appendChild(button);
      });

      groupWrapper.appendChild(groupTitle);
      groupWrapper.appendChild(groupItems);
      container.appendChild(groupWrapper);
    });

    this.appendHelpSection(container, variant);
  }

  appendHelpSection(container, variant) {
    if (!container) return;

    const helpWrapper = document.createElement('div');
    helpWrapper.className = `hud-help hud-help-${variant}`;
    helpWrapper.setAttribute('role', 'note');
    helpWrapper.setAttribute('aria-label', 'Help and controls');

    helpWrapper.innerHTML = `
      <div class="hud-help-title">Help</div>
      <div class="hud-help-grid">
        <div>
          <div class="hud-help-subtitle">Controls</div>
          <ul class="hud-help-list">
            <li>Desktop: drag to pan, scroll to zoom, <span class="hud-help-key">Alt</span> + drag to glide.</li>
            <li>Mobile: drag to pan, pinch to zoom, double-tap to zoom in.</li>
            <li>Tap a creature to inspect; Shift+Click sets a lineage root.</li>
          </ul>
        </div>
        <div>
          <div class="hud-help-subtitle">Shortcuts</div>
          <ul class="hud-help-list">
            <li><span class="hud-help-key">Space</span> pause, <span class="hud-help-key">F/S/E/X</span> tools.</li>
            <li><span class="hud-help-key">[</span>/<span class="hud-help-key">]</span> brush size, <span class="hud-help-key">?</span> help overlay.</li>
            <li><span class="hud-help-key">Ctrl/⌘ + S</span> save, <span class="hud-help-key">Ctrl/⌘ + O</span> load.</li>
          </ul>
        </div>
      </div>
      <div class="hud-help-subtitle">Menu map</div>
      <ul class="hud-help-list">
        <li><strong>Modes &amp; Goals</strong> shows game mode + session goals.</li>
        <li>Find Tools, Insights, and Progress in <strong>⋯ More Actions</strong>.</li>
      </ul>
    `;

    container.appendChild(helpWrapper);
  }

  updateActionStates() {
    this.actions.forEach((action) => {
      const button = document.getElementById(action.id);
      if (!button || typeof action.enabledWhen !== 'function') return;

      const enabled = action.enabledWhen();
      button.disabled = !enabled;
      button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    });
  }

  bindOverflowControls() {
    if (this.overflowTrigger) {
      this.overflowTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        this.toggleMenu();
      });
    }

    if (this.overflowClose) {
      this.overflowClose.addEventListener('click', () => this.closeMenu());
    }

    if (this.overflowBackdrop) {
      this.overflowBackdrop.addEventListener('click', () => this.closeMenu());
    }

    if (this.overflowMenu) {
      this.overflowMenu.addEventListener('keydown', (event) => this.handleMenuKeydown(event));
      this.overflowMenu.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (target) this.closeMenu();
      });
    }

    if (this.overflowSheet) {
      this.overflowSheet.addEventListener('keydown', (event) => this.handleSheetKeydown(event));
      this.overflowSheet.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (target && target.id !== 'hud-overflow-close') this.closeMenu();
      });
    }

    document.addEventListener('click', (event) => {
      if (!this.isOpen) return;
      const isTrigger = this.overflowTrigger && this.overflowTrigger.contains(event.target);
      const isMenu = this.overflowMenu && this.overflowMenu.contains(event.target);
      const isSheet = this.overflowSheet && this.overflowSheet.contains(event.target);
      if (!isTrigger && !isMenu && !isSheet) {
        this.closeMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!this.isOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeMenu();
      }
    });
  }

  toggleMenu() {
    if (this.isOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    if (this.isOpen) return;

    this.lastFocusedElement = document.activeElement;
    const useSheet = document.body.classList.contains('mobile-device');

    this.isOpen = true;
    this.openMode = useSheet ? 'sheet' : 'menu';

    if (this.overflowTrigger) {
      this.overflowTrigger.setAttribute('aria-expanded', 'true');
    }

    if (useSheet) {
      if (this.overflowSheet) {
        this.overflowSheet.classList.remove('hidden');
        this.overflowSheet.setAttribute('aria-hidden', 'false');
      }
      if (this.overflowBackdrop) {
        this.overflowBackdrop.classList.remove('hidden');
        this.overflowBackdrop.setAttribute('aria-hidden', 'false');
      }
      this.focusFirstMenuItem(this.overflowSheetContent);
    } else {
      if (this.overflowMenu) {
        this.overflowMenu.classList.remove('hidden');
        this.overflowMenu.setAttribute('aria-hidden', 'false');
      }
      this.focusFirstMenuItem(this.overflowMenu);
    }
  }

  closeMenu() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.openMode = null;

    if (this.overflowTrigger) {
      this.overflowTrigger.setAttribute('aria-expanded', 'false');
    }

    if (this.overflowMenu) {
      this.overflowMenu.classList.add('hidden');
      this.overflowMenu.setAttribute('aria-hidden', 'true');
    }

    if (this.overflowSheet) {
      this.overflowSheet.classList.add('hidden');
      this.overflowSheet.setAttribute('aria-hidden', 'true');
    }

    if (this.overflowBackdrop) {
      this.overflowBackdrop.classList.add('hidden');
      this.overflowBackdrop.setAttribute('aria-hidden', 'true');
    }

    if (this.lastFocusedElement instanceof HTMLElement) {
      this.lastFocusedElement.focus();
    }
  }

  focusFirstMenuItem(container) {
    const menuItems = getFocusableElements(container);
    if (menuItems.length > 0) {
      menuItems.forEach((item) => {
        if (item.classList.contains('hud-menu-item')) {
          item.tabIndex = -1;
        }
      });
      menuItems[0].tabIndex = 0;
      menuItems[0].focus();
    }
  }

  handleMenuKeydown(event, container = this.overflowMenu) {
    const menuItems = getFocusableElements(container);
    if (!menuItems.length) return;

    const currentIndex = menuItems.indexOf(document.activeElement);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        nextIndex = currentIndex + 1;
        break;
      case 'ArrowUp':
        event.preventDefault();
        nextIndex = currentIndex - 1;
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = menuItems.length - 1;
        break;
      case 'Enter':
      case ' ':
        if (document.activeElement instanceof HTMLElement) {
          event.preventDefault();
          document.activeElement.click();
        }
        return;
      default:
        return;
    }

    if (nextIndex < 0) nextIndex = menuItems.length - 1;
    if (nextIndex >= menuItems.length) nextIndex = 0;

    menuItems[nextIndex].focus();
  }

  handleSheetKeydown(event) {
    if (event.key === 'Tab') {
      const focusable = getFocusableElements(this.overflowSheet);
      if (!focusable.length) return;

      const currentIndex = focusable.indexOf(document.activeElement);
      let nextIndex = currentIndex;

      if (event.shiftKey) {
        nextIndex = currentIndex - 1;
      } else {
        nextIndex = currentIndex + 1;
      }

      if (nextIndex < 0) nextIndex = focusable.length - 1;
      if (nextIndex >= focusable.length) nextIndex = 0;

      event.preventDefault();
      focusable[nextIndex].focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      this.handleMenuKeydown(event, this.overflowSheetContent);
    }
  }
}
