/**
 * Error Handler - Centralized error handling and logging system
 * Provides structured error handling with recovery strategies
 */

export class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10; // Prevent error spam
    this.lastErrorTime = 0;
    this.errorCooldown = 5000; // 5 second cooldown between similar errors
  }

  /**
   * Handle an error with appropriate logging and recovery
   */
  handleError(error, context = '', severity = 'error') {
    // Prevent error spam
    const now = Date.now();
    if (now - this.lastErrorTime < this.errorCooldown && this.errorCount > this.maxErrors) {
      return; // Silently drop repeated errors
    }

    this.errorCount++;
    this.lastErrorTime = now;

    // Log error with context
    const message = `[${severity.toUpperCase()}] ${context}: ${error.message || error}`;
    console.error(message, error);

    // Add visual notification for critical errors
    if (severity === 'critical') {
      this.showErrorNotification(error, context);
    }

    // Log to analytics if available
    if (window.analytics && typeof window.analytics.logError === 'function') {
      window.analytics.logError(error, context, severity);
    }

    return error;
  }

  /**
   * Handle async errors with recovery
   */
  async handleAsync(fn, context = '', fallback = null) {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error, `Async operation in ${context}`, 'error');
      return fallback;
    }
  }

  /**
   * Safe execution wrapper
   */
  safeExecute(fn, context = '', fallback = null) {
    try {
      return fn();
    } catch (error) {
      return this.handleError(error, context, 'error') ? fallback : fallback;
    }
  }

  /**
   * Critical error handler - for system-breaking errors
   */
  criticalError(error, context = '') {
    this.handleError(error, context, 'critical');

    // For critical errors, we might want to pause the game
    if (window.gameState) {
      window.gameState.paused = true;
    }

    // Show user-friendly error message
    this.showCriticalErrorDialog(error, context);
  }

  /**
   * Show error notification to user
   */
  showErrorNotification(error, context) {
    try {
      // Create notification element
      const notification = document.createElement('div');
      notification.className = 'error-notification';
      notification.innerHTML = `
        <div class="error-icon">⚠️</div>
        <div class="error-content">
          <div class="error-title">Something went wrong</div>
          <div class="error-message">${context || 'An unexpected error occurred'}</div>
        </div>
        <button class="error-dismiss">×</button>
      `;

      // Style the notification
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 15px;
        min-width: 300px;
        animation: slideInRight 0.3s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      `;

      // Icon styling
      const icon = notification.querySelector('.error-icon');
      icon.style.cssText = 'font-size: 24px; line-height: 1;';

      // Content styling
      const title = notification.querySelector('.error-title');
      title.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 5px;';

      const message = notification.querySelector('.error-message');
      message.style.cssText = 'font-size: 14px; opacity: 0.9; line-height: 1.4;';

      // Dismiss button
      const dismissBtn = notification.querySelector('.error-dismiss');
      dismissBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
        opacity: 0.7;
      `;
      dismissBtn.onmouseover = () => dismissBtn.style.opacity = '1';
      dismissBtn.onmouseout = () => dismissBtn.style.opacity = '0.7';

      dismissBtn.onclick = () => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
      };

      // Add animation styles
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);

      document.body.appendChild(notification);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOutRight 0.3s ease-out';
          setTimeout(() => notification.remove(), 300);
        }
      }, 10000);

    } catch (notificationError) {
      // Fallback to console if notification creation fails
      console.error('Failed to show error notification:', notificationError);
    }
  }

  /**
   * Show critical error dialog
   */
  showCriticalErrorDialog(error, context) {
    try {
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div class="critical-error-overlay">
          <div class="critical-error-dialog">
            <h2>🚨 Critical Error</h2>
            <p>The simulation encountered a critical error and has been paused.</p>
            <p class="error-context">${context}</p>
            <div class="error-actions">
              <button id="reload-btn">Reload Page</button>
              <button id="continue-btn">Try to Continue</button>
            </div>
            <details class="error-details">
              <summary>Technical Details</summary>
              <pre>${error.stack || error.message || error}</pre>
            </details>
          </div>
        </div>
      `;

      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10002;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      `;

      const overlay = dialog.querySelector('.critical-error-overlay');
      overlay.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
      `;

      const dialogEl = dialog.querySelector('.critical-error-dialog');
      dialogEl.style.cssText = 'text-align: center;';

      // Button styling
      const buttons = dialog.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.style.cssText = `
          padding: 10px 20px;
          margin: 5px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        `;
      });

      const reloadBtn = dialog.querySelector('#reload-btn');
      reloadBtn.style.background = '#ef4444';
      reloadBtn.style.color = 'white';
      reloadBtn.onclick = () => window.location.reload();

      const continueBtn = dialog.querySelector('#continue-btn');
      continueBtn.style.background = '#10b981';
      continueBtn.style.color = 'white';
      continueBtn.onclick = () => dialog.remove();

      document.body.appendChild(dialog);

    } catch (dialogError) {
      console.error('Failed to show critical error dialog:', dialogError);
      // Fallback: simple alert
      alert(`Critical Error: ${context}\n\nThe page will reload to recover.`);
      window.location.reload();
    }
  }

  /**
   * Reset error counter (for testing)
   */
  reset() {
    this.errorCount = 0;
    this.lastErrorTime = 0;
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      errorCount: this.errorCount,
      lastErrorTime: this.lastErrorTime,
      timeSinceLastError: Date.now() - this.lastErrorTime
    };
  }
}

// Global error handler instance
export const errorHandler = new ErrorHandler();

// Global error handlers for unhandled errors
window.addEventListener('error', (event) => {
  errorHandler.handleError(event.error, 'Unhandled JavaScript error', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  errorHandler.handleError(event.reason, 'Unhandled promise rejection', 'error');
});
