// Audio System - Procedural sound generation using Web Audio API
// Zero dependencies, lightweight, efficient

export class AudioSystem {
  constructor() {
    // Initialize AudioContext (requires user interaction first)
    this.ctx = null;
    this.masterVolume = 0.25; // Reduced from 0.3 for better balance
    this.soundsEnabled = true;
    this.musicEnabled = true;

    // Volume settings per category (better balanced)
    this.volumes = {
      ui: 0.35, // Reduced from 0.4
      creatures: 0.25, // Reduced from 0.3
      ambient: 0.15, // Reduced from 0.2
      music: 0.18, // Reduced from 0.25
      effects: 0.30 // New category for special effects
    };

    // Sound queues (limit simultaneous sounds)
    this.playingSounds = new Set();
    this.maxConcurrent = 15; // Reduced from 20 to prevent audio chaos

    // Music state
    this.currentMusicType = null;
    this.musicOscillator = null;
    this.musicGain = null;

    // Ambient sound state
    this.ambientTimer = 0;
    this.ambientInterval = 8; // Play ambient sound every 8 seconds
    this.lastAmbientTime = 0;

    // Cache for common sounds
    this.soundCache = new Map();
  }

  // Initialize audio context (must be called after user interaction)
  init() {
    if (this.ctx) return; // Already initialized

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Audio system initialized
    } catch (e) {
      console.warn('Audio not supported:', e);
      this.soundsEnabled = false;
    }
  }

  // Play a simple tone/procedural sound
  playTone(frequency, duration, type = 'sine', volume = 1.0, category = 'ui') {
    if (!this.soundsEnabled || !this.ctx) return;

    // Limit concurrent sounds
    if (this.playingSounds.size >= this.maxConcurrent) {
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(
      volume * this.volumes[category] * this.masterVolume,
      this.ctx.currentTime + 0.01
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + duration
    );

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const soundId = Math.random();
    this.playingSounds.add(soundId);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);

    osc.onended = () => {
      this.playingSounds.delete(soundId);
    };
  }

  // Generate creature sound based on genes
  playCreatureSound(creature, event = 'idle') {
    if (!this.soundsEnabled || !this.ctx) return;
    if (!creature || !creature.genes) return; // Safety check

    try {
      const genes = creature.genes;
      const size = creature.size || 4;
      const sense = genes.sense || 80;
      const isPredator = genes.predator || (genes.diet && genes.diet > 0.7);

      // Base pitch based on size (smaller = higher pitch)
      const basePitch = 300 - (size * 20); // 220-400 Hz range

      // Sense affects pitch modulation (higher sense = more variation)
      const pitchVariation = sense / 200;
      const pitch = basePitch * (1 + (Math.random() - 0.5) * pitchVariation * 0.3);

      // Volume based on size (larger = louder)
      const volume = Math.min(1.0, 0.3 + size / 15);

      const duration = 0.1;
      const type = 'sine';

      switch (event) {
        case 'impact':
          this.playTone(pitch * 1.8, 0.06, 'triangle', volume * 0.45, 'creatures');
          break;
        case 'birth':
        // Cute high-pitched chirp
          this.playTone(pitch * 1.5, 0.15, 'sine', volume * 0.6, 'creatures');
          break;

        case 'death':
        // Descending sad tone
          try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(pitch, now);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, now + 0.4);
            gain.gain.setValueAtTime(volume * 0.4 * this.volumes.creatures * this.masterVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(now + 0.4);
          } catch (e) {
          // Ignore audio errors
          }
          break;

        case 'eat':
        // Quick nom sound (low frequency crunch)
          this.playTone(pitch * 0.6, 0.08, 'square', volume * 0.5, 'creatures');
          break;

        case 'attack':
        // Aggressive growl/roar
          try {
            const attackOsc = this.ctx.createOscillator();
            const attackGain = this.ctx.createGain();
            attackOsc.type = isPredator ? 'sawtooth' : 'square';
            const now = this.ctx.currentTime;
            attackOsc.frequency.setValueAtTime(pitch * 0.7, now);
            attackOsc.frequency.linearRampToValueAtTime(pitch * 0.5, now + 0.1);
            attackGain.gain.setValueAtTime(volume * 0.7 * this.volumes.creatures * this.masterVolume, now);
            attackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            attackOsc.connect(attackGain);
            attackGain.connect(this.ctx.destination);
            attackOsc.start();
            attackOsc.stop(now + 0.15);
          } catch (e) {
          // Ignore audio errors
          }
          break;

        case 'mating':
        // Love chime (harmonic tones)
          try {
            this.playTone(pitch * 1.2, 0.2, 'sine', volume * 0.5, 'creatures');
            setTimeout(() => {
              if (this.soundsEnabled && this.ctx) {
                this.playTone(pitch * 1.5, 0.2, 'sine', volume * 0.4, 'creatures');
              }
            }, 100);
          } catch (e) {
          // Ignore audio errors
          }
          break;

        case 'play':
          this.playTone(pitch * 1.4, 0.12, 'sine', volume * 0.5, 'creatures');
          break;

        case 'idle':
        default:
        // Occasional ambient chirp/growl (rare)
          if (Math.random() < 0.01) { // 1% chance
            this.playTone(pitch, 0.05, 'sine', volume * 0.2, 'creatures');
          }
          break;
      }
    } catch (e) {
      // Ignore audio errors (non-critical)
      console.warn('Creature sound error:', e);
    }
  }

  // UI feedback sounds
  playUISound(type) {
    if (!this.soundsEnabled || !this.ctx) return;

    const sounds = {
      click: { freq: 800, dur: 0.05, vol: 0.3 },
      toggle: { freq: 600, dur: 0.08, vol: 0.25 },
      success: { freq: 1000, dur: 0.15, vol: 0.4 },
      error: { freq: 300, dur: 0.2, vol: 0.3 },
      spawn: { freq: 700, dur: 0.1, vol: 0.35 },
      heal: { freq: 900, dur: 0.12, vol: 0.3 },
      kill: { freq: 200, dur: 0.25, vol: 0.4 },
      clone: { freq: 850, dur: 0.1, vol: 0.3 }
    };

    const sound = sounds[type] || sounds.click;
    this.playTone(sound.freq, sound.dur, 'square', sound.vol, 'ui');
  }

  // Ambient biome sounds (subtle background)
  playBiomeAmbient(biomeType) {
    if (!this.soundsEnabled || !this.ctx || !this.musicEnabled) return;

    // Very subtle, occasional ambient sounds
    if (Math.random() > 0.95) { // 5% chance per call
      const ambients = {
        forest: { freq: 400 + Math.random() * 100, dur: 0.5 },
        grassland: { freq: 450 + Math.random() * 50, dur: 0.3 },
        desert: { freq: 300 + Math.random() * 50, dur: 0.4 },
        wetland: { freq: 350 + Math.random() * 100, dur: 0.6 },
        mountain: { freq: 500 + Math.random() * 100, dur: 0.4 },
        meadow: { freq: 480 + Math.random() * 80, dur: 0.5 }
      };

      const ambient = ambients[biomeType] || ambients.grassland;
      this.playTone(ambient.freq, ambient.dur, 'sine', 0.15, 'ambient');
    }
  }

  // Adaptive music (responds to population/tension)
  playAdaptiveMusic(world) {
    if (!this.musicEnabled || !this.ctx) return;
    if (!world || !world.creatures) return; // Safety check

    try {
      const pop = world.creatures.length;
      const predatorCount = world.creatures.filter(c => c && c.alive && c.genes && (c.genes.predator || (c.genes.diet && c.genes.diet > 0.7))).length;
      const tension = predatorCount / Math.max(1, pop); // 0-1 scale

      // Determine music type based on state
      let musicType = 'peaceful';
      if (tension > 0.3) musicType = 'tension';
      if (pop < 20) musicType = 'lonely';
      if (pop > 200) musicType = 'thriving';

      // Only change if different
      if (musicType !== this.currentMusicType) {
        this.stopMusic();
        this.startMusic(musicType);
        this.currentMusicType = musicType;
      }
    } catch (e) {
      // Ignore errors in music system (non-critical)
      console.warn('Music system error:', e);
    }
  }

  startMusic(type) {
    if (!this.musicEnabled || !this.ctx) return;

    // Simple drone music using oscillators
    const baseFreq = {
      peaceful: 220, // A3
      tension: 185,  // F#3
      lonely: 165,   // E3
      thriving: 247  // B3
    }[type] || 220;

    // Create subtle ambient drone
    this.musicOscillator = this.ctx.createOscillator();
    this.musicGain = this.ctx.createGain();

    this.musicOscillator.type = 'sine';
    this.musicOscillator.frequency.value = baseFreq;

    this.musicGain.gain.value = this.volumes.music * this.masterVolume * 0.15; // Very subtle

    this.musicOscillator.connect(this.musicGain);
    this.musicGain.connect(this.ctx.destination);

    // Add subtle variation
    this.musicOscillator.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    this.musicOscillator.frequency.linearRampToValueAtTime(baseFreq * 1.02, this.ctx.currentTime + 2);
    this.musicOscillator.frequency.linearRampToValueAtTime(baseFreq, this.ctx.currentTime + 4);

    this.musicOscillator.start();
  }

  stopMusic() {
    if (this.musicOscillator) {
      try {
        this.musicOscillator.stop();
      } catch (e) {}
      this.musicOscillator = null;
      this.musicGain = null;
    }
  }

  // Settings
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  setCategoryVolume(category, volume) {
    if (this.volumes[category] !== undefined) {
      this.volumes[category] = Math.max(0, Math.min(1, volume));
    }
  }

  toggleSounds(enabled) {
    this.soundsEnabled = enabled;
  }

  toggleMusic(enabled) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    }
  }

  /**
   * Update method called each frame - currently handles adaptive music
   * @param {number} dt - Delta time (unused but kept for interface consistency)
   */
  update(dt) {
    // Audio system doesn't need per-frame updates
    // Adaptive music is handled via playAdaptiveMusic() when called explicitly
  }

  /**
   * Play a named sound effect (convenience method for game-loop compatibility)
   * @param {string} soundName - Name of the sound to play
   */
  playSound(soundName) {
    if (!this.soundsEnabled || !this.ctx) return;

    // Map sound names to appropriate methods
    switch (soundName) {
      case 'creatureBorn':
      case 'birth':
        this.playUISound('spawn');
        break;
      case 'creatureDied':
      case 'death':
        this.playUISound('kill');
        break;
      case 'achievement':
        this.playUISound('success');
        break;
      case 'disaster':
        this.playUISound('error');
        break;
      case 'seasonChange':
        this.playUISound('toggle');
        break;
      default:
        this.playUISound('click');
    }
  }

  // Play ambient environmental sounds
  playAmbientSound(biome = 'forest', intensity = 0.5) {
    if (!this.soundsEnabled || !this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Limit ambient sound frequency
    if (now - this.lastAmbientTime < this.ambientInterval) return;
    this.lastAmbientTime = now;

    try {
      const baseVolume = intensity * 0.4;

      switch (biome) {
        case 'forest':
          // Bird chirp
          this.playTone(800 + Math.random() * 400, 0.15, 'sine', baseVolume * 0.7, 'ambient');
          setTimeout(() => {
            if (this.soundsEnabled && this.ctx) {
              this.playTone(900 + Math.random() * 400, 0.12, 'sine', baseVolume * 0.5, 'ambient');
            }
          }, 150);
          break;

        case 'wetland':
          // Water ripple / frog croak
          this.playTone(220 + Math.random() * 80, 0.25, 'square', baseVolume * 0.6, 'ambient');
          break;

        case 'desert':
          // Wind whistle
          this.playTone(150 + Math.random() * 100, 0.4, 'sine', baseVolume * 0.4, 'ambient');
          break;

        case 'mountain':
          // Wind howl
          this.playTone(100 + Math.random() * 50, 0.5, 'sawtooth', baseVolume * 0.35, 'ambient');
          break;

        default:
          // Generic nature sound
          this.playTone(400 + Math.random() * 400, 0.2, 'sine', baseVolume * 0.5, 'ambient');
      }
    } catch (e) {
      console.warn('Ambient sound error:', e);
    }
  }

  // Update method - call this regularly to trigger ambient sounds
  update(dt, world) {
    if (!this.soundsEnabled || !this.ctx) return;

    this.ambientTimer += dt;

    // Play ambient sounds periodically
    if (this.ambientTimer >= this.ambientInterval) {
      this.ambientTimer = 0;

      // Determine biome based on world state (simplified)
      const biomes = ['forest', 'wetland', 'desert', 'mountain'];
      const randomBiome = biomes[Math.floor(Math.random() * biomes.length)];
      
      // Vary intensity based on population and activity
      const population = world?.creatures?.length || 0;
      const intensity = Math.min(1.0, 0.3 + population / 200);

      this.playAmbientSound(randomBiome, intensity);
    }
  }

  // Cleanup
  destroy() {
    this.stopMusic();
    this.playingSounds.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
  }
}
