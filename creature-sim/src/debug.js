/**
 * Debug utilities - centralized logging that can be disabled in production
 * Set DEBUG = false for production builds to silence all debug output
 */

export const DEBUG = true; // Set to false for production

/**
 * Debug logger that respects DEBUG flag
 * @param {...any} args - Arguments to log
 */
export function debug(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

/**
 * Debug logger for initialization messages
 * @param {string} system - System name
 * @param {string} message - Message to log
 */
export function debugInit(system, message) {
  if (DEBUG) {
    console.log(`[${system}] ${message}`);
  }
}

/**
 * Always log errors regardless of DEBUG flag
 * @param {...any} args - Arguments to log
 */
export function error(...args) {
  console.error(...args);
}

/**
 * Always log warnings regardless of DEBUG flag  
 * @param {...any} args - Arguments to log
 */
export function warn(...args) {
  console.warn(...args);
}
