// Audio System - Procedural sound generation using Web Audio API
// Zero dependencies, lightweight, efficient

import { geneValue, isPredatorFromGenes } from './creature-genetics-helpers.js';

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
      effects: 0.3 // New category for special effects
    };

    // Sound queues (limit simultaneous sounds)
    this.playingSounds = new Set();
    this.maxConcurrent = 15; // Reduced from 20 to prevent audio chaos

    // Music state
    this.currentMusicType = null;
    this.musicOscillator = null;
    this.musicGain = null;

    // Dynamic music layers
    this.musicLayers = {
      ambience: { gain: null, osc: null, active: false, targetVol: 0 },
      rhythm: { gain: null, osc: null, active: false, targetVol: 0 },
      tension: { gain: null, osc: null, active: false, targetVol: 0 }
    };
    this.musicLayerUpdateInterval = 2; // seconds
    this.musicLayerTimer = 0;

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
      // Master effects chain: compressor -> destination
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.value = -24;
      this.masterCompressor.knee.value = 12;
      this.masterCompressor.ratio.value = 6;
      this.masterCompressor.attack.value = 0.003;
      this.masterCompressor.release.value = 0.1;
      this.masterCompressor.connect(this.ctx.destination);
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
    gain.gain.linearRampToValueAtTime(volume * this.volumes[category] * this.masterVolume, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterCompressor || this.ctx.destination);

    const soundId = Math.random();
    this.playingSounds.add(soundId);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);

    osc.onended = () => {
      this.playingSounds.delete(soundId);
    };
  }

  // Play a tone with spatial panning
  playSpatialTone(frequency, duration, type = 'sine', volume = 1.0, category = 'ui', pan = 0) {
    if (!this.soundsEnabled || !this.ctx) return;
    if (this.playingSounds.size >= this.maxConcurrent) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * this.volumes[category] * this.masterVolume, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    const dest = this._spatialNode(gain, pan) || this.masterCompressor || this.ctx.destination;
    if (!dest) gain.connect(this.masterCompressor || this.ctx.destination);

    const soundId = Math.random();
    this.playingSounds.add(soundId);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);

    osc.onended = () => {
      this.playingSounds.delete(soundId);
    };
  }

  /**
   * Play a tone with spatial panning AND a distance-based low-pass filter
   * (muffles the sound as if it were heard from far away).
   * Optionally applies a simplified Doppler shift when `velocity` is provided
   * (in source units per second along the source→camera axis). Positive
   * values mean the source is moving toward the camera (pitch up).
   * @param {number} frequency
   * @param {number} duration
   * @param {string} type
   * @param {number} volume
   * @param {string} category
   * @param {number} pan
   * @param {number} filterCutoff - low-pass cutoff in Hz
   * @param {number} [velocity=0] - relative velocity in source units/sec (positive = approaching)
   * @param {number} [dopplerStrength=0.002] - scaling for doppler shift (small to avoid jarring changes)
   */
  playSpatialFilteredTone(
    frequency,
    duration,
    type = 'sine',
    volume = 1.0,
    category = 'ui',
    pan = 0,
    filterCutoff = 8000,
    velocity = 0,
    dopplerStrength = 0.002
  ) {
    if (!this.soundsEnabled || !this.ctx) return;
    if (this.playingSounds.size >= this.maxConcurrent) return;
    if (typeof this.ctx.createBiquadFilter !== 'function') {
      // Fall back to plain spatial tone if biquad unavailable
      this.playSpatialTone(frequency, duration, type, volume, category, pan);
      return;
    }

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = type;
      osc.frequency.value = frequency;

      filter.type = 'lowpass';
      const cutoff = Math.max(80, Math.min(20000, filterCutoff | 0));
      filter.frequency.value = cutoff;
      filter.Q.value = 0.7;

      // Simple Doppler: detune proportional to relative velocity
      // Capped to a sane range so the pitch never gets comical.
      if (Number.isFinite(velocity) && velocity !== 0) {
        const cents = Math.max(-400, Math.min(400, velocity * dopplerStrength * 1200));
        osc.detune.value = cents;
      }

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(
        volume * this.volumes[category] * this.masterVolume,
        this.ctx.currentTime + 0.01
      );
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(filter);
      filter.connect(gain);
      const dest = this._spatialNode(gain, pan) || this.masterCompressor || this.ctx.destination;
      if (!dest) gain.connect(this.masterCompressor || this.ctx.destination);

      const soundId = Math.random();
      this.playingSounds.add(soundId);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + duration);
      osc.onended = () => {
        this.playingSounds.delete(soundId);
      };
    } catch {
      // Fall back to plain spatial tone on any error
      this.playSpatialTone(frequency, duration, type, volume, category, pan);
    }
  }

  // Create a spatial panner node chain; returns the last node to connect to master
  _spatialNode(sourceGain, pan) {
    if (!this.ctx || typeof this.ctx.createStereoPanner !== 'function') return null;
    try {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      sourceGain.connect(panner);
      panner.connect(this.masterCompressor || this.ctx.destination);
      return panner;
    } catch {
      return null;
    }
  }

  /**
   * Compute a spatial pan and attenuated volume for a sound at world position
   * (x, y) relative to the camera. Uses an inverse-square-ish rolloff curve
   * for a more natural distance attenuation than a linear 1 - d/max.
   * @param {number} x - source x
   * @param {number} y - source y
   * @param {object} camera - must expose x, y, and viewportWidth
   * @param {number} [falloff=240] - distance at which attenuation = 0.5
   * @returns {{pan:number, spatialVolume:number, distance:number}}
   */
  computeSpatialAttenuation(x, y, camera, falloff = 240) {
    if (!camera) return { pan: 0, spatialVolume: 1, distance: 0 };
    const dx = x - camera.x;
    const dy = y - camera.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const halfW = Math.max((camera.viewportWidth || 800) / 2, 1);
    const pan = Math.max(-1, Math.min(1, dx / halfW));
    // Inverse-square-ish rolloff: volume / (1 + (d / falloff)^2)
    // Clamp to a small floor so very distant sounds don't vanish entirely.
    const ratio = distance / Math.max(1, falloff);
    const spatialVolume = Math.max(0.08, 1 / (1 + ratio * ratio));
    return { pan, spatialVolume, distance };
  }

  // Generate creature sound based on genes
  playCreatureSound(creature, event = 'idle', camera = null) {
    if (!this.soundsEnabled || !this.ctx) return;
    if (!creature || !creature.genes) return; // Safety check

    try {
      const genes = creature.genes;
      const size = creature.size || 4;
      const sense = geneValue(genes, 'sense', 80);
      const isPredator = isPredatorFromGenes(genes);

      // Base pitch based on size (smaller = higher pitch)
      const basePitch = 300 - size * 20; // 220-400 Hz range

      // Sense affects pitch modulation (higher sense = more variation)
      const pitchVariation = sense / 200;
      const pitch = basePitch * (1 + (Math.random() - 0.5) * pitchVariation * 0.3);

      // Volume based on size (larger = louder)
      const volume = Math.min(1.0, 0.3 + size / 15);

      // Spatial attenuation and panning (inverse-square-ish rolloff)
      let spatialVolume = 1;
      let pan = 0;
      let distance = 0;
      if (camera && typeof creature.x === 'number') {
        const atten = this.computeSpatialAttenuation(creature.x, creature.y, camera);
        pan = atten.pan;
        spatialVolume = atten.spatialVolume;
        distance = atten.distance;
      }

      // Compute a low-pass cutoff that drops with distance (muffles far-away
      // sounds). Closer than 80 units stays bright; beyond that it tapers
      // toward a muffled 400Hz minimum.
      const filterCutoff = Math.max(400, Math.min(12000, 12000 - distance * 18));

      // Radial velocity for a tiny Doppler effect on noisy events. vx/vy are
      // optional; default to 0 (no shift) so callers without velocity still
      // work as before.
      const vx = Number.isFinite(creature.vx) ? creature.vx : 0;
      const vy = Number.isFinite(creature.vy) ? creature.vy : 0;
      let radialVelocity = 0;
      if (distance > 0) {
        // Approach speed along the camera→source axis. Positive = approaching.
        radialVelocity = -((vx * (creature.x - camera.x) + vy * (creature.y - camera.y)) / distance);
      }

      const _duration = 0.1;
      const _type = 'sine';

      switch (event) {
        case 'impact':
          this.playSpatialFilteredTone(
            pitch * 1.8,
            0.06,
            'triangle',
            volume * 0.45 * spatialVolume,
            'creatures',
            pan,
            filterCutoff,
            radialVelocity
          );
          break;
        case 'birth':
          // Cute high-pitched chirp
          this.playSpatialFilteredTone(
            pitch * 1.5,
            0.15,
            'sine',
            volume * 0.6 * spatialVolume,
            'creatures',
            pan,
            filterCutoff,
            radialVelocity
          );
          break;

        case 'death':
          // Descending sad tone
          if (this.playingSounds.size >= this.maxConcurrent) break;
          try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(pitch, now);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.3, now + 0.4);
            gain.gain.setValueAtTime(volume * 0.4 * this.volumes.creatures * this.masterVolume * spatialVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.connect(gain);
            const dest = this._spatialNode(gain, pan) || this.masterCompressor || this.ctx.destination;
            if (!dest) gain.connect(this.masterCompressor || this.ctx.destination);
            osc.start();
            osc.stop(now + 0.4);
          } catch {
            // Ignore audio errors
          }
          break;

        case 'eat':
          // Quick nom sound (low frequency crunch)
          this.playSpatialFilteredTone(
            pitch * 0.6,
            0.08,
            'square',
            volume * 0.5 * spatialVolume,
            'creatures',
            pan,
            filterCutoff,
            radialVelocity
          );
          break;

        case 'attack':
          // Aggressive growl/roar
          if (this.playingSounds.size >= this.maxConcurrent) break;
          try {
            const attackOsc = this.ctx.createOscillator();
            const attackGain = this.ctx.createGain();
            attackOsc.type = isPredator ? 'sawtooth' : 'square';
            const now = this.ctx.currentTime;
            attackOsc.frequency.setValueAtTime(pitch * 0.7, now);
            attackOsc.frequency.linearRampToValueAtTime(pitch * 0.5, now + 0.1);
            attackGain.gain.setValueAtTime(
              volume * 0.7 * this.volumes.creatures * this.masterVolume * spatialVolume,
              now
            );
            attackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            attackOsc.connect(attackGain);
            const dest = this._spatialNode(attackGain, pan) || this.masterCompressor || this.ctx.destination;
            if (!dest) attackGain.connect(this.masterCompressor || this.ctx.destination);
            attackOsc.start();
            attackOsc.stop(now + 0.15);
          } catch {
            // Ignore audio errors
          }
          break;

        case 'mating':
          // Love chime (harmonic tones)
          if (this.playingSounds.size >= this.maxConcurrent) break;
          try {
            this.playTone(pitch * 1.2, 0.2, 'sine', volume * 0.5, 'creatures');
            setTimeout(() => {
              if (this.soundsEnabled && this.ctx) {
                this.playTone(pitch * 1.5, 0.2, 'sine', volume * 0.4, 'creatures');
              }
            }, 100);
          } catch {
            // Ignore audio errors
          }
          break;

        case 'play':
          this.playTone(pitch * 1.4, 0.12, 'sine', volume * 0.5, 'creatures');
          break;

        case 'idle':
        default:
          // Occasional ambient chirp/growl (rare)
          if (Math.random() < 0.01) {
            // 1% chance
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
    if (Math.random() > 0.95) {
      // 5% chance per call
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
      const predatorCount = world.creatures.filter(c => c && c.alive && c.genes && isPredatorFromGenes(c.genes)).length;
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

    // Rich ambient drone with multiple oscillators
    const baseFreq =
      {
        peaceful: 220, // A3
        tension: 185, // F#3
        lonely: 165, // E3
        thriving: 247 // B3
      }[type] || 220;

    // Main drone
    this.musicOscillator = this.ctx.createOscillator();
    this.musicGain = this.ctx.createGain();
    this.musicOscillator.type = 'sine';
    this.musicOscillator.frequency.value = baseFreq;
    this.musicGain.gain.value = this.volumes.music * this.masterVolume * 0.1;
    this.musicOscillator.connect(this.musicGain);
    this.musicGain.connect(this.masterCompressor || this.ctx.destination);

    // Detuned second oscillator for beating/warmth
    this.musicOscillator2 = this.ctx.createOscillator();
    this.musicGain2 = this.ctx.createGain();
    this.musicOscillator2.type = 'sine';
    this.musicOscillator2.frequency.value = baseFreq * 1.003; // ~3Hz beating at 220Hz
    this.musicGain2.gain.value = this.volumes.music * this.masterVolume * 0.06;
    this.musicOscillator2.connect(this.musicGain2);
    this.musicGain2.connect(this.masterCompressor || this.ctx.destination);

    // Fifth interval for harmonic context
    this.musicOscillator3 = this.ctx.createOscillator();
    this.musicGain3 = this.ctx.createGain();
    this.musicOscillator3.type = 'triangle';
    this.musicOscillator3.frequency.value = baseFreq * 1.5; // Perfect fifth
    this.musicGain3.gain.value = this.volumes.music * this.masterVolume * 0.04;
    this.musicOscillator3.connect(this.musicGain3);
    this.musicGain3.connect(this.masterCompressor || this.ctx.destination);

    // Subtle variation
    const now = this.ctx.currentTime;
    this.musicOscillator.frequency.setValueAtTime(baseFreq, now);
    this.musicOscillator.frequency.linearRampToValueAtTime(baseFreq * 1.02, now + 2);
    this.musicOscillator.frequency.linearRampToValueAtTime(baseFreq, now + 4);

    this.musicOscillator.start();
    this.musicOscillator2.start();
    this.musicOscillator3.start();
  }

  stopMusic() {
    const stopOsc = osc => {
      if (osc) {
        try {
          osc.stop();
        } catch {}
      }
    };
    stopOsc(this.musicOscillator);
    stopOsc(this.musicOscillator2);
    stopOsc(this.musicOscillator3);
    this.musicOscillator = null;
    this.musicGain = null;
    this.musicOscillator2 = null;
    this.musicGain2 = null;
    this.musicOscillator3 = null;
    this.musicGain3 = null;
  }

  // Play weather sounds
  playWeatherSound(type, intensity = 0.5) {
    if (!this.soundsEnabled || !this.ctx) return;
    if (this.playingSounds.size >= this.maxConcurrent) return;

    try {
      const now = this.ctx.currentTime;
      const vol = intensity * 0.3 * this.volumes.effects * this.masterVolume;

      switch (type) {
        case 'rain': {
          // White noise burst for rain
          const bufferSize = this.ctx.sampleRate * 0.1;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5;
          }
          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(vol * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 800 + intensity * 1200;
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterCompressor || this.ctx.destination);
          noise.start();
          noise.stop(now + 0.1);
          break;
        }
        case 'snow': {
          // Soft filtered noise for snow
          this.playTone(200 + Math.random() * 100, 0.15, 'sine', vol * 0.3, 'effects');
          break;
        }
        case 'wind': {
          // Sweeping tone for wind
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150 + Math.random() * 80, now);
          osc.frequency.linearRampToValueAtTime(120 + Math.random() * 60, now + 0.3);
          gain.gain.setValueAtTime(vol * 0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain);
          gain.connect(this.masterCompressor || this.ctx.destination);
          osc.start();
          osc.stop(now + 0.4);
          break;
        }
      }
    } catch {
      // Ignore weather audio errors
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
      case 'disease':
        this.playUISound('error');
        break;
      case 'play':
        this.playUISound('click');
        break;
      case 'seasonChange':
        this.playUISound('toggle');
        break;
      default:
        if (soundName.startsWith('disaster_')) {
          this.playDisasterSound(soundName);
        } else {
          this.playUISound('click');
        }
    }
  }

  // Play disaster-specific sounds
  playDisasterSound(soundName) {
    if (!this.soundsEnabled || !this.ctx) return;
    if (this.playingSounds.size >= this.maxConcurrent) return;

    try {
      const type = soundName.replace('disaster_', '');
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      switch (type) {
        case 'fire':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          break;
        case 'flood':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(60, now);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          break;
        case 'plague':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.linearRampToValueAtTime(660, now + 0.15);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          break;
        default:
          osc.type = 'square';
          osc.frequency.setValueAtTime(300, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      }

      osc.connect(gain);
      gain.connect(this.masterCompressor || this.ctx.destination);
      const soundId = Math.random();
      this.playingSounds.add(soundId);
      osc.start(now);
      osc.stop(now + 0.6);
      osc.onended = () => this.playingSounds.delete(soundId);
    } catch {
      // Ignore audio errors
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

  // Play ecosystem health-based ambient sounds
  playEcosystemAmbient(world) {
    if (!this.soundsEnabled || !this.ctx || !this.musicEnabled) return;

    const now = this.ctx.currentTime;
    if (now - this.lastAmbientTime < this.ambientInterval) return;
    this.lastAmbientTime = now;

    try {
      const population = world?.creatures?.length || 0;
      if (population === 0) return;

      const health = world?.ecoHealth?.metrics?.overall ?? 50;
      const dayNight = world?.dayNightState || world?.environment?.getDayNightState?.();
      const isNight = dayNight?.phase === 'night' || (dayNight?.light ?? 1) < 0.4;

      let predators = 0;
      for (const c of world.creatures) {
        if (!c || c.alive === false) continue;
        if (isPredatorFromGenes(c.genes)) predators++;
      }
      const predatorRatio = predators / population;
      const tension = predatorRatio;

      let ambientType = 'peaceful';
      let volume = 0.15;

      if (health >= 70 && tension < 0.2) {
        ambientType = isNight ? 'peacefulNight' : 'peacefulDay';
        volume = 0.2;
      } else if (health >= 40 && tension < 0.35) {
        ambientType = isNight ? 'calmNight' : 'calmDay';
        volume = 0.15;
      } else if (tension >= 0.35 || health < 30) {
        ambientType = 'tense';
        volume = 0.08;
      } else {
        ambientType = isNight ? 'neutralNight' : 'neutralDay';
        volume = 0.12;
      }

      this.playEcosystemSound(ambientType, volume);
    } catch (e) {
      console.warn('Ecosystem ambient error:', e);
    }
  }

  /**
   * Play an ambient ecosystem sound whose spatial position is biased toward
   * high-traffic areas (creature density hotspots). Falls back to the global
   * ecosystem ambient if no creatures are present.
   * @param {object} world - simulation world (must expose creatures + camera bounds)
   * @param {object} camera - active camera
   */
  playSpatialAmbient(world, camera) {
    if (!this.soundsEnabled || !this.ctx || !this.musicEnabled) return;

    const now = this.ctx.currentTime;
    if (now - this.lastAmbientTime < this.ambientInterval) return;
    this.lastAmbientTime = now;

    try {
      const population = world?.creatures?.length || 0;

      // Default to the global ambient call if we can't do spatial analysis.
      if (population === 0 || !camera) {
        this.playEcosystemAmbient(world);
        return;
      }

      // Bucket creatures into a coarse grid and pick the densest cell near
      // the camera. That gives a hotspot for the ambient sound to come from.
      const halfW = Math.max((camera.viewportWidth || 800) / 2, 1);
      const halfH = Math.max((camera.viewportHeight || 600) / 2, 1);
      const left = camera.x - halfW;
      const top = camera.y - halfH;
      const cellSize = 240;
      const cols = Math.max(1, Math.ceil((halfW * 2) / cellSize));
      const rows = Math.max(1, Math.ceil((halfH * 2) / cellSize));
      const buckets = new Map();

      for (const c of world.creatures) {
        if (!c || c.alive === false) continue;
        const cx = Math.min(cols - 1, Math.max(0, Math.floor((c.x - left) / cellSize)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor((c.y - top) / cellSize)));
        const key = cx + ',' + cy;
        const existing = buckets.get(key);
        if (existing) {
          existing.count += 1;
          existing.sumX += c.x;
          existing.sumY += c.y;
        } else {
          buckets.set(key, { count: 1, sumX: c.x, sumY: c.y });
        }
      }

      if (buckets.size === 0) {
        this.playEcosystemAmbient(world);
        return;
      }

      let hotspot = null;
      for (const entry of buckets.values()) {
        if (!hotspot || entry.count > hotspot.count) {
          hotspot = entry;
        }
      }

      const hotspotX = hotspot.sumX / hotspot.count;
      const hotspotY = hotspot.sumY / hotspot.count;

      // Build a synthetic "biome" at the hotspot by looking up the world's
      // biome helper if available, otherwise default to grassland.
      const biome = world.getBiomeAt?.(hotspotX, hotspotY)?.type || 'grassland';

      // Drive spatial panning + attenuation from the hotspot vs the camera.
      const atten = this.computeSpatialAttenuation(hotspotX, hotspotY, camera, 360);
      const filterCutoff = Math.max(500, Math.min(8000, 8000 - atten.distance * 6));
      const ambientVolume = Math.min(0.18, 0.1 + Math.min(0.08, hotspot.count * 0.004));

      // Use the existing ecosystem sound as the palette, scaled down and
      // spatially placed.
      const dayNight = world?.dayNightState || world?.environment?.getDayNightState?.();
      const isNight = dayNight?.phase === 'night' || (dayNight?.light ?? 1) < 0.4;
      let ambientType = isNight ? 'neutralNight' : 'neutralDay';
      const health = world?.ecoHealth?.metrics?.overall ?? 50;
      if (health >= 70) ambientType = isNight ? 'peacefulNight' : 'peacefulDay';
      else if (health >= 40) ambientType = isNight ? 'calmNight' : 'calmDay';

      this._playSpatiallyPlacedAmbient(ambientType, ambientVolume, atten.pan, filterCutoff, biome);
    } catch (e) {
      console.warn('Spatial ambient error:', e);
      // Soft-fall back to the regular ambient path
      this.playEcosystemAmbient(world);
    }
  }

  /**
   * Internal helper: play a chosen ecosystem ambient as a spatial tone in a
   * specific panning/distance/filter slot. Falls back to the non-spatial
   * helper if a biquad filter isn't available.
   * @private
   */
  _playSpatiallyPlacedAmbient(ambientType, volume, pan, filterCutoff, _biome) {
    if (!this.soundsEnabled || !this.ctx) return;
    if (typeof this.ctx.createBiquadFilter !== 'function') {
      this.playEcosystemSound(ambientType, volume);
      return;
    }
    // Use a single short tone rather than the multi-tap pattern so the
    // spatial placement stays coherent.
    const baseFreq = 600 + Math.random() * 400;
    this.playSpatialFilteredTone(baseFreq, 0.18, 'sine', volume, 'ambient', pan, filterCutoff);
  }

  // Play specific ecosystem ambient sound
  playEcosystemSound(type, volume) {
    if (!this.soundsEnabled || !this.ctx) return;

    try {
      switch (type) {
        case 'peacefulDay':
          // Happy birds chirping
          this.playTone(1200 + Math.random() * 300, 0.1, 'sine', volume * 0.6, 'ambient');
          setTimeout(() => {
            if (this.soundsEnabled && this.ctx) {
              this.playTone(1400 + Math.random() * 400, 0.08, 'sine', volume * 0.4, 'ambient');
            }
          }, 120);
          setTimeout(() => {
            if (this.soundsEnabled && this.ctx) {
              this.playTone(1100 + Math.random() * 200, 0.12, 'sine', volume * 0.5, 'ambient');
            }
          }, 250);
          break;

        case 'peacefulNight':
          // Gentle crickets and night sounds
          this.playTone(1800 + Math.random() * 200, 0.08, 'sine', volume * 0.5, 'ambient');
          this.playTone(2200 + Math.random() * 150, 0.06, 'triangle', volume * 0.3, 'ambient');
          setTimeout(() => {
            if (this.soundsEnabled && this.ctx) {
              this.playTone(1900 + Math.random() * 100, 0.1, 'sine', volume * 0.4, 'ambient');
            }
          }, 180);
          break;

        case 'calmDay':
          // Occasional birds
          if (Math.random() < 0.7) {
            this.playTone(900 + Math.random() * 300, 0.1, 'sine', volume * 0.5, 'ambient');
            setTimeout(() => {
              if (this.soundsEnabled && this.ctx) {
                this.playTone(1000 + Math.random() * 200, 0.08, 'sine', volume * 0.35, 'ambient');
              }
            }, 100);
          }
          break;

        case 'calmNight':
          // Soft crickets
          this.playTone(2000 + Math.random() * 200, 0.06, 'sine', volume * 0.4, 'ambient');
          break;

        case 'tense':
          // Sparse, unsettling sounds - low frequency rumble or high pitch警觉
          if (Math.random() < 0.5) {
            this.playTone(80 + Math.random() * 40, 0.4, 'sine', volume * 0.6, 'ambient');
          } else {
            this.playTone(3000 + Math.random() * 500, 0.05, 'sine', volume * 0.3, 'ambient');
          }
          break;

        case 'neutralDay':
        case 'neutralNight':
        default:
          // Minimal ambient
          this.playTone(400 + Math.random() * 200, 0.15, 'sine', volume * 0.4, 'ambient');
          break;
      }
    } catch (e) {
      console.warn('Ecosystem sound error:', e);
    }
  }

  // Update method - adaptive music, ambient biome sounds, and dynamic music layers
  update(dt, world = null) {
    if (!this.ctx || !world) return;

    if (this.musicEnabled) {
      this.playAdaptiveMusic(world);
    }

    if (this.soundsEnabled) {
      const biome = world.getBiomeAt?.(world.width / 2, world.height / 2)?.type || 'grassland';
      this.playAmbientSound(biome, 0.3);

      this.ambientTimer += dt;
      this.musicLayerTimer += dt;

      if (this.ambientTimer >= this.ambientInterval) {
        this.ambientTimer = 0;
        this.playEcosystemAmbient(world);
      }

      if (this.musicLayerTimer >= this.musicLayerUpdateInterval) {
        this.musicLayerTimer = 0;
        this._updateMusicLayers(world);
      }
    }
  }

  /**
   * Crossfade music layers based on ecosystem tension (predator density, disasters, health)
   */
  _updateMusicLayers(world) {
    if (!this.ctx || !this.musicEnabled) return;
    const population = world?.creatures?.length || 0;
    if (population === 0) return;

    let predators = 0;
    for (const c of world.creatures) {
      if (!c || c.alive === false) continue;
      if (isPredatorFromGenes(c.genes)) predators++;
    }
    const predatorRatio = predators / population;
    const health = world?.ecoHealth?.metrics?.overall ?? 50;
    const disasterActive = world?.getActiveEvents?.().length > 0 || world?.environment?.weatherIntensity > 0.5;

    // Compute target volumes for each layer
    const targets = {
      ambience: 0.6,
      rhythm: 0,
      tension: 0
    };
    if (predatorRatio > 0.15 || disasterActive) {
      targets.rhythm = Math.min(0.5, predatorRatio * 2);
      targets.tension = disasterActive ? 0.6 : Math.min(0.4, predatorRatio * 1.5);
      targets.ambience = Math.max(0.2, 0.6 - targets.tension * 0.5);
    } else if (population > 50) {
      targets.rhythm = 0.2;
    }
    if (health < 30) {
      targets.tension = Math.max(targets.tension, 0.4);
      targets.ambience = Math.max(0.15, targets.ambience - 0.2);
    }

    const now = this.ctx.currentTime;
    for (const [key, layer] of Object.entries(this.musicLayers)) {
      const target = targets[key] || 0;
      // If target > 0 but layer not active, spawn oscillator
      if (target > 0.05 && !layer.osc) {
        try {
          layer.osc = this.ctx.createOscillator();
          layer.gain = this.ctx.createGain();
          const freqs = { ambience: 220, rhythm: 110, tension: 55 };
          layer.osc.frequency.value = freqs[key];
          layer.osc.type = key === 'tension' ? 'sawtooth' : key === 'rhythm' ? 'triangle' : 'sine';
          layer.gain.gain.value = 0;
          layer.osc.connect(layer.gain);
          layer.gain.connect(this.masterCompressor || this.ctx.destination);
          layer.osc.start();
          layer.active = true;
        } catch {
          layer.osc = null;
          layer.gain = null;
        }
      }
      // Crossfade volume toward target
      if (layer.gain) {
        const rampTime = 1.5;
        layer.gain.gain.linearRampToValueAtTime(target * this.volumes.music * this.masterVolume * 0.5, now + rampTime);
      }
      // If target is near zero and volume is low, stop oscillator
      if (target <= 0.05 && layer.osc && layer.gain && layer.gain.gain.value < 0.001) {
        try {
          layer.osc.stop();
        } catch {
          // Ignore
        }
        layer.osc = null;
        layer.gain = null;
        layer.active = false;
      }
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
