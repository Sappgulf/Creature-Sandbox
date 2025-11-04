// Save/Load system for world state persistence
// Handles serialization, compression, and file I/O

export class SaveSystem {
  constructor() {
    this.autoSaveEnabled = true;
    this.autoSaveInterval = 60; // seconds
    this.lastAutoSave = 0;
    this.saveSlots = 3;
  }
  
  /**
   * Serialize world state to JSON
   */
  serialize(world, camera, analytics, lineageTracker, additionalData = {}) {
    const saveData = {
      version: '2.0',
      timestamp: Date.now(),
      savedAt: new Date().toISOString(),
      
      // World state
      world: {
        width: world.width,
        height: world.height,
        t: world.t,
        seasonPhase: world.seasonPhase,
        _nextId: world._nextId,
        
        // Time system
        timeOfDay: world.timeOfDay || 12,
        dayLength: world.dayLength || 120,
        
        // Creatures
        creatures: world.creatures.map(c => ({
          id: c.id,
          parentId: c.parentId,
          x: c.x,
          y: c.y,
          vx: c.vx,
          vy: c.vy,
          dir: c.dir,
          energy: c.energy,
          age: c.age,
          health: c.health,
          maxHealth: c.maxHealth,
          genes: { ...c.genes },
          stats: { ...c.stats },
          // Advanced features
          emotions: c.emotions ? { ...c.emotions } : null,
          intelligence: c.intelligence ? {
            level: c.intelligence.level,
            experiencePoints: c.intelligence.experiencePoints
          } : null,
          sexuality: c.sexuality ? {
            lastMated: c.sexuality.lastMated,
            attractiveness: c.sexuality.attractiveness
          } : null,
          migration: c.migration ? {
            lastMigration: c.migration.lastMigration,
            targetBiome: c.migration.targetBiome,
            settled: c.migration.settled
          } : null
        })),
        
        // Food
        food: world.food.map(f => ({ x: f.x, y: f.y, energy: f.energy })),
        
        // Corpses
        corpses: world.corpses ? world.corpses.map(c => ({
          x: c.x,
          y: c.y,
          energy: c.energy,
          age: c.age,
          isPredator: c.isPredator
        })) : [],
        
        // Lineage tracking
        childrenOf: Array.from(world.childrenOf.entries()).map(([parentId, childIds]) => ({
          parentId,
          childIds: Array.from(childIds)
        })),
        
        // Biome seed (for reproducibility)
        biomeSeed: world.biomeGenerator ? world.biomeGenerator.seed : Math.random(),
        
        // Disasters
        activeDisaster: world.activeDisaster,
        disasterDuration: world.disasterDuration,
        disasterIntensity: world.disasterIntensity
      },
      
      // Camera state
      camera: {
        x: camera.x,
        y: camera.y,
        zoom: camera.zoom,
        followMode: camera.followMode || 'free',
        followTarget: camera.followTarget || null
      },
      
      // Analytics (condensed)
      analytics: analytics ? {
        dataPoints: analytics.data ? analytics.data.slice(-300) : [], // Last 300 points
        totalGenerations: analytics.totalGenerations || 0
      } : null,
      
      // Lineage names
      lineageNames: lineageTracker ? Array.from(lineageTracker.names.entries()) : [],
      
      // Additional metadata
      metadata: {
        populationSize: world.creatures.length,
        timeElapsed: world.t,
        generationsElapsed: Math.floor(world.t / 30), // Rough estimate
        ...additionalData
      }
    };
    
    return saveData;
  }
  
  /**
   * Deserialize JSON to world state
   */
  deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator) {
    if (!saveData || saveData.version !== '2.0') {
      throw new Error('Invalid or incompatible save file');
    }
    
    const data = saveData.world;
    
    // Create new world
    const world = new World(data.width, data.height);
    world.reset();
    
    // Restore basic state
    world.t = data.t || 0;
    world.seasonPhase = data.seasonPhase || 0;
    world._nextId = data._nextId || 1;
    world.timeOfDay = data.timeOfDay || 12;
    world.dayLength = data.dayLength || 120;
    
    // Restore biome with same seed
    if (data.biomeSeed && BiomeGenerator) {
      world.biomeGenerator = new BiomeGenerator(data.biomeSeed);
      world.biomeMap = world.biomeGenerator.generateBiomeMap(data.width, data.height, 50);
    }
    
    // Restore creatures
    world.creatures = [];
    world.registry.clear();
    for (const cData of data.creatures) {
      const creature = new Creature(cData.x, cData.y, cData.genes || makeGenes(), false);
      creature.id = cData.id;
      creature.parentId = cData.parentId || null;
      creature.vx = cData.vx || 0;
      creature.vy = cData.vy || 0;
      creature.dir = cData.dir || 0;
      creature.energy = cData.energy || 24;
      creature.age = cData.age || 0;
      creature.health = cData.health || creature.maxHealth;
      creature.maxHealth = cData.maxHealth || creature.maxHealth;
      creature.stats = cData.stats || { food: 0, kills: 0, births: 0, damageTaken: 0, damageDealt: 0 };
      
      // Restore advanced features
      if (cData.emotions && creature.emotions) {
        Object.assign(creature.emotions, cData.emotions);
      }
      if (cData.intelligence && creature.intelligence) {
        creature.intelligence.level = cData.intelligence.level;
        creature.intelligence.experiencePoints = cData.intelligence.experiencePoints;
      }
      if (cData.sexuality && creature.sexuality) {
        creature.sexuality.lastMated = cData.sexuality.lastMated;
        creature.sexuality.attractiveness = cData.sexuality.attractiveness;
      }
      if (cData.migration && creature.migration) {
        creature.migration.lastMigration = cData.migration.lastMigration;
        creature.migration.targetBiome = cData.migration.targetBiome;
        creature.migration.settled = cData.migration.settled;
      }
      
      world.creatures.push(creature);
      world.registry.set(creature.id, creature);
    }
    
    // Restore food
    world.food = (data.food || []).map(f => ({ x: f.x, y: f.y, energy: f.energy || 1.0 }));
    
    // Restore corpses
    world.corpses = (data.corpses || []).map(c => ({
      x: c.x,
      y: c.y,
      energy: c.energy || 5,
      age: c.age || 0,
      isPredator: c.isPredator || false
    }));
    
    // Restore lineage relationships
    world.childrenOf.clear();
    for (const entry of data.childrenOf || []) {
      world.childrenOf.set(entry.parentId, new Set(entry.childIds));
    }
    
    // Restore disasters
    world.activeDisaster = data.activeDisaster || null;
    world.disasterDuration = data.disasterDuration || 0;
    world.disasterIntensity = data.disasterIntensity || 1;
    
    // Mark spatial grid as dirty
    world.gridDirty = true;
    
    // Restore camera
    let camera = null;
    if (saveData.camera && Camera) {
      camera = new Camera({
        x: saveData.camera.x,
        y: saveData.camera.y,
        zoom: saveData.camera.zoom,
        minZoom: 0.1,
        maxZoom: 3,
        worldWidth: world.width,
        worldHeight: world.height,
        viewportWidth: 1200,
        viewportHeight: 800
      });
      camera.followMode = saveData.camera.followMode || 'free';
      camera.followTarget = saveData.camera.followTarget || null;
    }
    
    // Restore lineage names
    const lineageNames = new Map();
    if (saveData.lineageNames) {
      for (const [id, name] of saveData.lineageNames) {
        lineageNames.set(id, name);
      }
    }
    
    return {
      world,
      camera,
      lineageNames,
      metadata: saveData.metadata,
      analytics: saveData.analytics
    };
  }
  
  /**
   * Save to file (download)
   */
  saveToFile(world, camera, analytics, lineageTracker, filename = null) {
    const saveData = this.serialize(world, camera, analytics, lineageTracker, {
      saveName: filename || `save_${Date.now()}`
    });
    
    const json = JSON.stringify(saveData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename || `creature-sim-${Date.now()}`) + '.crsim';
    a.click();
    
    URL.revokeObjectURL(url);
    
    console.log(`✅ Saved to ${a.download} (${(json.length / 1024).toFixed(1)} KB)`);
  }
  
  /**
   * Load from file (upload)
   */
  async loadFromFile(file, World, Creature, Camera, makeGenes, BiomeGenerator) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const json = e.target.result;
          const saveData = JSON.parse(json);
          const result = this.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator);
          console.log(`✅ Loaded ${file.name} - ${saveData.metadata.populationSize} creatures`);
          resolve(result);
        } catch (err) {
          console.error('❌ Failed to load save file:', err);
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  /**
   * Auto-save to localStorage
   */
  autoSave(world, camera, analytics, lineageTracker, dt) {
    if (!this.autoSaveEnabled) return;
    
    this.lastAutoSave += dt;
    if (this.lastAutoSave < this.autoSaveInterval) return;
    this.lastAutoSave = 0;
    
    try {
      const saveData = this.serialize(world, camera, analytics, lineageTracker, {
        isAutoSave: true
      });
      const json = JSON.stringify(saveData);
      localStorage.setItem('creature-sim-autosave', json);
      console.log(`💾 Auto-saved (${(json.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.warn('⚠️ Auto-save failed:', err);
    }
  }
  
  /**
   * Load from localStorage
   */
  loadAutoSave(World, Creature, Camera, makeGenes, BiomeGenerator) {
    try {
      const json = localStorage.getItem('creature-sim-autosave');
      if (!json) return null;
      
      const saveData = JSON.parse(json);
      const result = this.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator);
      console.log(`✅ Loaded auto-save from ${new Date(saveData.timestamp).toLocaleString()}`);
      return result;
    } catch (err) {
      console.error('❌ Failed to load auto-save:', err);
      return null;
    }
  }
  
  /**
   * Check if auto-save exists
   */
  hasAutoSave() {
    return !!localStorage.getItem('creature-sim-autosave');
  }
  
  /**
   * Clear auto-save
   */
  clearAutoSave() {
    localStorage.removeItem('creature-sim-autosave');
    console.log('🗑️ Auto-save cleared');
  }
  
  /**
   * Save to slot (localStorage)
   */
  saveToSlot(slotNumber, world, camera, analytics, lineageTracker, name = '') {
    if (slotNumber < 1 || slotNumber > this.saveSlots) {
      throw new Error(`Invalid slot number: ${slotNumber}`);
    }
    
    const saveData = this.serialize(world, camera, analytics, lineageTracker, {
      slotNumber,
      saveName: name || `Save ${slotNumber}`,
      isManualSave: true
    });
    
    const json = JSON.stringify(saveData);
    localStorage.setItem(`creature-sim-slot-${slotNumber}`, json);
    console.log(`💾 Saved to slot ${slotNumber}: "${name}" (${(json.length / 1024).toFixed(1)} KB)`);
  }
  
  /**
   * Load from slot
   */
  loadFromSlot(slotNumber, World, Creature, Camera, makeGenes, BiomeGenerator) {
    if (slotNumber < 1 || slotNumber > this.saveSlots) {
      throw new Error(`Invalid slot number: ${slotNumber}`);
    }
    
    const json = localStorage.getItem(`creature-sim-slot-${slotNumber}`);
    if (!json) return null;
    
    const saveData = JSON.parse(json);
    const result = this.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator);
    console.log(`✅ Loaded slot ${slotNumber}: "${saveData.metadata.saveName}"`);
    return result;
  }
  
  /**
   * Get all save slot info
   */
  getSaveSlots() {
    const slots = [];
    for (let i = 1; i <= this.saveSlots; i++) {
      const json = localStorage.getItem(`creature-sim-slot-${i}`);
      if (json) {
        try {
          const data = JSON.parse(json);
          slots.push({
            slot: i,
            name: data.metadata.saveName || `Save ${i}`,
            timestamp: data.timestamp,
            savedAt: data.savedAt,
            population: data.metadata.populationSize,
            timeElapsed: data.metadata.timeElapsed
          });
        } catch (err) {
          slots.push({ slot: i, error: true });
        }
      } else {
        slots.push({ slot: i, empty: true });
      }
    }
    return slots;
  }
}

