/**
 * Procedural Sound Effects System - Generate sounds for creature actions
 */

export class ProceduralSounds {
  constructor() {
    this.audioContext = null;
    this.enabled = false;
    this.volume = 0.3;
    this.soundQueue = [];
    this.maxConcurrentSounds = 8;
  }

  /**
   * Initialize audio context
   */
  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
      console.log('🔊 Procedural sound system initialized');
    } catch (e) {
      console.warn('Audio context not supported:', e);
      this.enabled = false;
    }
  }

  /**
   * Play a creature birth sound
   */
  playBirthSound(creature) {
    if (!this.enabled) return;
    
    const hue = creature.genes?.hue ?? 120;
    const frequency = 400 + (hue / 360) * 200; // Vary by color
    
    this.playTone({
      frequency,
      duration: 0.3,
      type: 'sine',
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
      volume: 0.2
    });
    
    // Add sparkle sound
    setTimeout(() => {
      this.playTone({
        frequency: frequency * 2,
        duration: 0.15,
        type: 'triangle',
        volume: 0.15
      });
    }, 100);
  }

  /**
   * Play a creature death sound
   */
  playDeathSound(creature) {
    if (!this.enabled) return;
    
    const isPredator = creature.genes?.predator;
    
    // Descending tone
    this.playSweep({
      startFreq: isPredator ? 300 : 400,
      endFreq: isPredator ? 100 : 150,
      duration: 0.6,
      type: 'sawtooth',
      volume: 0.25
    });
  }

  /**
   * Play eating/feeding sound
   */
  playEatSound(creature, foodType) {
    if (!this.enabled) return;
    
    const baseFreq = foodType === 'meat' ? 200 : 350;
    
    // Chomp sound
    this.playNoise({
      duration: 0.08,
      frequency: baseFreq,
      volume: 0.15,
      type: 'pink'
    });
  }

  /**
   * Play mating sound
   */
  playMatingSound(creature) {
    if (!this.enabled) return;
    
    const hue = creature.genes?.hue ?? 180;
    
    // Rising chirp
    this.playSweep({
      startFreq: 300 + (hue / 360) * 150,
      endFreq: 600 + (hue / 360) * 200,
      duration: 0.4,
      type: 'sine',
      volume: 0.2
    });
    
    // Echo
    setTimeout(() => {
      this.playSweep({
        startFreq: 350 + (hue / 360) * 150,
        endFreq: 650 + (hue / 360) * 200,
        duration: 0.3,
        type: 'sine',
        volume: 0.1
      });
    }, 200);
  }

  /**
   * Play attack/combat sound
   */
  playAttackSound(attacker, impact = false) {
    if (!this.enabled) return;
    
    if (impact) {
      // Impact noise
      this.playNoise({
        duration: 0.1,
        frequency: 150,
        volume: 0.25,
        type: 'white'
      });
    } else {
      // Whoosh sound
      this.playSweep({
        startFreq: 400,
        endFreq: 200,
        duration: 0.15,
        type: 'square',
        volume: 0.2
      });
    }
  }

  /**
   * Play movement sound (subtle)
   */
  playMovementSound(creature, intensity) {
    if (!this.enabled || Math.random() > 0.1) return; // Only 10% chance
    
    const speed = creature.genes?.speed ?? 1;
    const frequency = 100 + speed * 50;
    
    this.playNoise({
      duration: 0.05,
      frequency,
      volume: 0.05 * intensity,
      type: 'brown'
    });
  }

  /**
   * Play ambient biome sounds
   */
  playBiomeAmbience(biomeType) {
    if (!this.enabled) return;
    
    const ambience = {
      forest: { freq: 200, mod: 0.3, type: 'sine' },
      desert: { freq: 150, mod: 0.1, type: 'triangle' },
      ocean: { freq: 100, mod: 0.5, type: 'sine' },
      mountain: { freq: 180, mod: 0.2, type: 'triangle' }
    };
    
    const settings = ambience[biomeType];
    if (!settings) return;
    
    // Subtle background tone
    this.playTone({
      frequency: settings.freq,
      duration: 2,
      type: settings.type,
      volume: 0.03,
      modulation: settings.mod
    });
  }

  /**
   * Play weather sound
   */
  playWeatherSound(weatherType, intensity) {
    if (!this.enabled) return;
    
    if (weatherType === 'rain') {
      // Rain noise
      this.playNoise({
        duration: 0.5,
        frequency: 8000,
        volume: 0.1 * intensity,
        type: 'white',
        highpass: 2000
      });
    } else if (weatherType === 'storm') {
      // Thunder rumble
      this.playNoise({
        duration: 1.5,
        frequency: 100,
        volume: 0.3 * intensity,
        type: 'brown'
      });
    }
  }

  /**
   * Core tone generator
   */
  playTone(options) {
    if (!this.audioContext || this.soundQueue.length >= this.maxConcurrentSounds) return;
    
    const {
      frequency = 440,
      duration = 0.5,
      type = 'sine',
      volume = 0.3,
      envelope = null,
      modulation = 0
    } = options;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    // Add modulation if specified
    if (modulation > 0) {
      const modOsc = this.audioContext.createOscillator();
      const modGain = this.audioContext.createGain();
      modOsc.frequency.value = 5;
      modGain.gain.value = frequency * modulation;
      modOsc.connect(modGain);
      modGain.connect(oscillator.frequency);
      modOsc.start();
      modOsc.stop(this.audioContext.currentTime + duration);
    }
    
    // Apply envelope
    if (envelope) {
      const { attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.3 } = envelope;
      const now = this.audioContext.currentTime;
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + attack);
      gainNode.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);
      gainNode.gain.setValueAtTime(volume * sustain, now + duration - release);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);
    } else {
      gainNode.gain.setValueAtTime(volume * this.volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    }
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
    
    this.soundQueue.push(oscillator);
    setTimeout(() => {
      this.soundQueue = this.soundQueue.filter(s => s !== oscillator);
    }, duration * 1000);
  }

  /**
   * Frequency sweep generator
   */
  playSweep(options) {
    if (!this.audioContext || this.soundQueue.length >= this.maxConcurrentSounds) return;
    
    const {
      startFreq = 200,
      endFreq = 600,
      duration = 0.5,
      type = 'sine',
      volume = 0.3
    } = options;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + duration);
    
    gainNode.gain.setValueAtTime(volume * this.volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
    
    this.soundQueue.push(oscillator);
    setTimeout(() => {
      this.soundQueue = this.soundQueue.filter(s => s !== oscillator);
    }, duration * 1000);
  }

  /**
   * Noise generator
   */
  playNoise(options) {
    if (!this.audioContext || this.soundQueue.length >= this.maxConcurrentSounds) return;
    
    const {
      duration = 0.1,
      frequency = 1000,
      volume = 0.2,
      type = 'white',
      highpass = null
    } = options;
    
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate noise
    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink' || type === 'brown') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(volume * this.volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    // Optional highpass filter
    if (highpass) {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      source.connect(filter);
      filter.connect(gainNode);
    } else {
      source.connect(gainNode);
    }
    
    gainNode.connect(this.audioContext.destination);
    
    source.start();
    
    this.soundQueue.push(source);
    setTimeout(() => {
      this.soundQueue = this.soundQueue.filter(s => s !== source);
    }, duration * 1000);
  }

  /**
   * Set master volume
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Enable/disable sounds
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.audioContext) {
      // Stop all sounds
      this.soundQueue.forEach(source => {
        try {
          source.stop();
        } catch (e) {
          // Already stopped
        }
      });
      this.soundQueue = [];
    }
  }
}

export const proceduralSounds = new ProceduralSounds();
