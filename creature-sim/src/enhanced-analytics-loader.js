let enhancedAnalyticsModule = null;
let enhancedAnalyticsPromise = null;

export function getEnhancedAnalyticsModule() {
  return enhancedAnalyticsModule;
}

export async function loadEnhancedAnalyticsModule() {
  if (enhancedAnalyticsModule) {
    return enhancedAnalyticsModule;
  }

  if (!enhancedAnalyticsPromise) {
    enhancedAnalyticsPromise = import('./enhanced-analytics.js')
      .then((module) => {
        enhancedAnalyticsModule = module;
        return module;
      })
      .catch((error) => {
        enhancedAnalyticsPromise = null;
        throw error;
      });
  }

  return enhancedAnalyticsPromise;
}
