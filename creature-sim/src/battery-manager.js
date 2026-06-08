/**
 * Battery Manager
 *
 * Wraps the (Chromium-only) `navigator.getBattery()` API so the rest of the
 * app can react to the device's battery state without caring about browser
 * support. Auto-enables the existing "battery saver" preference when the
 * device drops below a low-water mark and disables it once the device is
 * comfortably charged again, emitting notifications along the way.
 *
 * Public API (singleton `batteryManager`):
 *   - `init({ getPrefs, setPrefs, notifications } = {})`  wire up listeners
 *   - `getState()`  returns `{ supported, level, charging, low, restored }`
 *   - `onChange(callback)`  subscribe to state changes
 *   - `dispose()`  tear down listeners
 *   - `getBatteryIndicatorData()`  returns `{ supported, level, charging, saverOn }`
 *     for HUD rendering
 */
import { eventSystem } from './event-system.js';

const LOW_THRESHOLD = 0.2; // 20% — auto-enable saver
const RESTORE_THRESHOLD = 0.3; // 30% — auto-disable saver once recovered
const POLL_INTERVAL_MS = 60_000; // safety-net poll in case the BatteryManager
// stops emitting `levelchange` events

class BatteryManager {
  constructor() {
    this.supported = false;
    this.battery = null;
    this.level = 1;
    this.charging = true;
    this.saverOn = false;
    this._listeners = new Set();
    this._disposed = false;
    this._getPrefs = null;
    this._setPrefs = null;
    this._notifications = null;
    this._pollTimer = null;
    this._userOverridden = false;
  }

  /**
   * Wire the manager up to the rest of the app.
   * @param {object} [opts]
   * @param {() => {batterySaver: boolean}} [opts.getPrefs]  Returns current
   *   battery saver preference (used to detect user overrides).
   * @param {(next: {batterySaver: boolean}) => void} [opts.setPrefs]  Called
   *   when the manager auto-toggles the saver.
   * @param {{show?: Function}} [opts.notifications]  Notification system
   *   (the toast API). Optional.
   * @returns {Promise<{supported: boolean}>}
   */
  async init({ getPrefs, setPrefs, notifications } = {}) {
    this._getPrefs = typeof getPrefs === 'function' ? getPrefs : null;
    this._setPrefs = typeof setPrefs === 'function' ? setPrefs : null;
    this._notifications = notifications || null;

    if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') {
      this.supported = false;
      this._emit();
      return { supported: false };
    }

    try {
      this.battery = await navigator.getBattery();
    } catch (error) {
      console.warn('BatteryManager: getBattery() failed:', error);
      this.supported = false;
      this._emit();
      return { supported: false };
    }

    this.supported = true;
    this._syncFromBattery();

    this.battery.addEventListener('levelchange', this._handleLevelChange);
    this.battery.addEventListener('chargingchange', this._handleChargingChange);

    // Periodic poll — some browsers (and certainly all non-Chromium
    // browsers) will silently stop firing these events after a while. A
    // cheap read every minute is enough to keep the indicator accurate.
    this._pollTimer = setInterval(() => {
      if (this._disposed) return;
      this._syncFromBattery();
    }, POLL_INTERVAL_MS);

    this._emit();
    return { supported: true };
  }

  /**
   * Get the current state.
   * @returns {{supported: boolean, level: number, charging: boolean, saverOn: boolean, low: boolean, restored: boolean}}
   */
  getState() {
    return {
      supported: this.supported,
      level: this.level,
      charging: this.charging,
      saverOn: this.saverOn,
      low: this.supported && !this.charging && this.level < LOW_THRESHOLD,
      restored: this.supported && (this.charging || this.level > RESTORE_THRESHOLD)
    };
  }

  /**
   * Subscribe to state changes.
   * @param {(state: object) => void} callback
   * @returns {() => void}  unsubscribe
   */
  onChange(callback) {
    if (typeof callback !== 'function') return () => {};
    this._listeners.add(callback);
    // Fire immediately with current state so the caller can render
    try {
      callback(this.getState());
    } catch (error) {
      console.warn('BatteryManager listener threw:', error);
    }
    return () => this._listeners.delete(callback);
  }

  /**
   * Compact snapshot used by the HUD battery indicator.
   * @returns {{supported: boolean, level: number, charging: boolean, saverOn: boolean}}
   */
  getBatteryIndicatorData() {
    const { supported, level, charging, saverOn } = this.getState();
    return { supported, level, charging, saverOn };
  }

  /**
   * Inform the manager that the user manually changed the saver preference,
   * so we don't immediately overwrite their choice.
   */
  notifyUserOverride() {
    this._userOverridden = true;
    // Clear the override after a delay so future auto-bumps can still kick
    // in (e.g. the user went from "auto-off" to "I turned it off" then the
    // battery drops even further).
    setTimeout(() => {
      this._userOverridden = false;
    }, 30_000);
  }

  /**
   * Tear down all listeners and timers.
   */
  dispose() {
    this._disposed = true;
    if (this.battery) {
      try {
        this.battery.removeEventListener('levelchange', this._handleLevelChange);
        this.battery.removeEventListener('chargingchange', this._handleChargingChange);
      } catch {
        // Ignore
      }
      this.battery = null;
    }
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._listeners.clear();
  }

  // === private ===

  _handleLevelChange = () => {
    this._syncFromBattery();
  };

  _handleChargingChange = () => {
    this._syncFromBattery();
  };

  _syncFromBattery() {
    if (!this.battery) return;
    const newLevel = Number(this.battery.level);
    const newCharging = !!this.battery.charging;
    const levelChanged = Math.abs(newLevel - this.level) > 0.005;
    const chargingChanged = newCharging !== this.charging;
    this.level = Number.isFinite(newLevel) ? newLevel : 1;
    this.charging = newCharging;
    if (levelChanged || chargingChanged) {
      this._evaluateAutoSaver();
    }
    this._emit();
  }

  _evaluateAutoSaver() {
    if (!this.supported) return;
    if (this._userOverridden) return;
    const low = !this.charging && this.level < LOW_THRESHOLD;
    const restored = this.charging || this.level > RESTORE_THRESHOLD;

    if (low && !this.saverOn) {
      this._applyAutoSaver(true, 'low');
    } else if (restored && this.saverOn) {
      this._applyAutoSaver(false, 'restored');
    }
  }

  _applyAutoSaver(enable, reason) {
    this.saverOn = enable;
    if (this._setPrefs) {
      try {
        this._setPrefs({ batterySaver: enable });
      } catch (error) {
        console.warn('BatteryManager: setPrefs threw:', error);
      }
    }
    if (this._notifications?.show) {
      const message = enable
        ? '🔋 Battery low — Battery Saver auto-enabled'
        : '🔌 Battery restored — Battery Saver auto-disabled';
      this._notifications.show(message, 'info', 2800);
    }
    eventSystem.emit('battery:saver-auto-changed', { enabled: enable, reason });
    this._emit();
  }

  _emit() {
    const state = this.getState();
    for (const cb of this._listeners) {
      try {
        cb(state);
      } catch (error) {
        console.warn('BatteryManager listener threw:', error);
      }
    }
  }
}

export const batteryManager = new BatteryManager();
export { LOW_THRESHOLD, RESTORE_THRESHOLD };
export default batteryManager;
