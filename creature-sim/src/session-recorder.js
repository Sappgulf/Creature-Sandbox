/**
 * Session Recorder (Lightweight foundation for item 11)
 * Records key moments + seed so interesting runs can be shared and later replayed.
 * Full deterministic replay is complex; this gives a solid, immediately useful base.
 */

export class SessionRecorder {
  constructor() {
    this.recording = false;
    this.events = [];
    this.seed = null;
    this.startedAt = 0;
  }

  start(seedSnapshot) {
    this.recording = true;
    this.events = [];
    this.seed = seedSnapshot || null;
    this.startedAt = Date.now();
    this.events.push({ t: 0, type: 'session_start', seed: this.seed });
  }

  recordEvent(type, payload = {}) {
    if (!this.recording) return;
    this.events.push({
      t: Date.now() - this.startedAt,
      type,
      ...payload
    });
  }

  stop() {
    if (!this.recording) return null;
    this.recording = false;
    const result = {
      version: 1,
      startedAt: this.startedAt,
      durationMs: Date.now() - this.startedAt,
      seed: this.seed,
      eventCount: this.events.length,
      events: this.events.slice(0, 500) // cap for size
    };
    this.events = [];
    return result;
  }

  getSummary() {
    return {
      recording: this.recording,
      eventCount: this.events.length,
      seed: this.seed
    };
  }
}

export const sessionRecorder = new SessionRecorder();
