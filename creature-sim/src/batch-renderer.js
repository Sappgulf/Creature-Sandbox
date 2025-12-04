/**
 * Simple batch renderer stub that just provides the interface
 * This ensures the module loads without errors while batching can be implemented later
 */

const noopStats = {
  circles: { circlesInBatch: 0, maxCircles: 0, utilization: '0%' },
  rectangles: { rectsInBatch: 0, maxRects: 0, utilization: '0%' },
  lines: { linesInBatch: 0, maxLines: 0, utilization: '0%' },
  _summary: { totalBatchedPrimitives: 0, totalMaxCapacity: 0 }
};

// Simple batch renderer that provides the interface but does nothing
export const batchRenderer = {
  init: (ctx) => {
    console.log('🎨 Batch renderer stub initialized (no-op)');
    return { context: ctx, stub: true };
  },
  isReady: () => true,
  addCircle: () => {}, // No-op
  addRect: () => {}, // No-op
  addLine: () => {}, // No-op
  flush: () => {}, // No-op
  render: () => {}, // No-op
  clear: () => {}, // No-op
  getStats: () => noopStats,
  setAutoFlushThreshold: () => {}, // No-op
  setRenderOrder: () => {} // No-op
};

export default batchRenderer;