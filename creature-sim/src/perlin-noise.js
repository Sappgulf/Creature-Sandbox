/**
 * Perlin Noise Generator for Organic Terrain
 *
 * Creates smooth, natural-looking noise patterns for biome generation.
 * Based on Ken Perlin's improved noise algorithm.
 */

export class PerlinNoise {
  constructor(seed = Math.random()) {
    this.seed = seed;
    this.permutation = this._generatePermutation(seed);
  }

  _generatePermutation(seed) {
    // Create deterministic random permutation from seed
    const p = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Fisher-Yates shuffle with seed
    const random = this._seededRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate for overflow
    return [...p, ...p];
  }

  _seededRandom(seed) {
    let s = seed;
    return () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }

  _fade(t) {
    // 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  _lerp(a, b, t) {
    return a + t * (b - a);
  }

  _grad(hash, x, y) {
    // Convert low 4 bits of hash into 12 gradient directions
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /**
   * Get 2D Perlin noise value at coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {number} Noise value between -1 and 1
   */
  noise2D(x, y) {
    // Find unit square that contains point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Find relative x, y in square
    x -= Math.floor(x);
    y -= Math.floor(y);

    // Compute fade curves
    const u = this._fade(x);
    const v = this._fade(y);

    // Hash coordinates of square corners
    const p = this.permutation;
    const a = p[X] + Y;
    const aa = p[a];
    const ab = p[a + 1];
    const b = p[X + 1] + Y;
    const ba = p[b];
    const bb = p[b + 1];

    // Blend results from corners
    return this._lerp(
      this._lerp(this._grad(p[aa], x, y), this._grad(p[ba], x - 1, y), u),
      this._lerp(this._grad(p[ab], x, y - 1), this._grad(p[bb], x - 1, y - 1), u),
      v
    );
  }

  /**
   * Get octave noise (multiple frequencies combined)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} octaves - Number of octaves (detail levels)
   * @param {number} persistence - Amplitude decrease per octave
   * @param {number} lacunarity - Frequency increase per octave
   * @returns {number} Combined noise value
   */
  octaveNoise(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Generate 2D noise map
   * @param {number} width - Map width
   * @param {number} height - Map height
   * @param {number} scale - Noise scale (smaller = more zoomed in)
   * @param {number} octaves - Detail levels
   * @returns {Float32Array} 2D array of noise values
   */
  generateMap(width, height, scale = 100, octaves = 4) {
    const map = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / scale;
        const ny = y / scale;
        const value = this.octaveNoise(nx, ny, octaves);
        // Normalize to 0-1
        map[y * width + x] = (value + 1) / 2;
      }
    }

    return map;
  }
}

/**
 * Biome Generator using multiple noise layers
 */
export class BiomeGenerator {
  constructor(seed = Math.random()) {
    this.seed = seed;
    this.moistureNoise = new PerlinNoise(seed);
    this.temperatureNoise = new PerlinNoise(seed * 1.618);
    this.elevationNoise = new PerlinNoise(seed * 2.718);
  }

  /**
   * Get biome type at world coordinates
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @param {number} worldWidth - Total world width
   * @param {number} worldHeight - Total world height
   * @returns {object} Biome information
   */
  getBiomeAt(x, y, _worldWidth, _worldHeight) {
    const scale = 0.001; // Adjust for biome size

    // Get noise values (0-1 range)
    const moisture = (this.moistureNoise.octaveNoise(x * scale, y * scale, 3) + 1) / 2;
    const temperature = (this.temperatureNoise.octaveNoise(x * scale * 0.8, y * scale * 0.8, 3) + 1) / 2;
    const elevation = (this.elevationNoise.octaveNoise(x * scale * 1.2, y * scale * 1.2, 4) + 1) / 2;

    // Determine biome based on moisture, temperature, and elevation
    return this._classifyBiome(moisture, temperature, elevation);
  }

  _classifyBiome(moisture, temperature, elevation) {
    // High elevation = Mountains
    if (elevation > 0.7) {
      return {
        type: 'mountain',
        name: 'Mountain',
        color: '#6b7280',
        foodRate: 0.4,
        movementSpeed: 0.85,
        moisture,
        temperature,
        elevation
      };
    }

    // Very low elevation + very high moisture = Deep Water
    if (elevation < 0.2 && moisture > 0.8) {
      return {
        type: 'water',
        name: 'Deep Water',
        color: '#1e40af',
        foodRate: 0.6, // Fish spawn here
        movementSpeed: 0.3, // Very slow for non-aquatic
        aquaticSpeed: 1.4, // Fast for aquatic creatures
        moisture,
        temperature,
        elevation,
        isWater: true,
        depth: 1.0 // Deep water
      };
    }

    // Low elevation + very high moisture = Shallow Water
    if (elevation < 0.3 && moisture > 0.75) {
      return {
        type: 'water',
        name: 'Shallow Water',
        color: '#3b82f6',
        foodRate: 0.7,
        movementSpeed: 0.5,
        aquaticSpeed: 1.2,
        moisture,
        temperature,
        elevation,
        isWater: true,
        depth: 0.5 // Shallow water
      };
    }

    // Low elevation + high moisture = Wetland
    if (elevation < 0.35 && moisture > 0.6) {
      return {
        type: 'wetland',
        name: 'Wetland',
        color: '#059669',
        foodRate: 0.9,
        movementSpeed: 0.75,
        moisture,
        temperature,
        elevation
      };
    }

    // High temperature + low moisture = Desert
    if (temperature > 0.65 && moisture < 0.35) {
      return {
        type: 'desert',
        name: 'Desert',
        color: '#d97706',
        foodRate: 0.3,
        movementSpeed: 1.0,
        moisture,
        temperature,
        elevation
      };
    }

    // Low temperature + high moisture = Dense Forest
    if (temperature < 0.4 && moisture > 0.5) {
      return {
        type: 'forest',
        name: 'Forest',
        color: '#065f46',
        foodRate: 1.2,
        movementSpeed: 0.8,
        moisture,
        temperature,
        elevation
      };
    }

    // High temperature + high moisture = Meadow
    if (temperature > 0.55 && moisture > 0.5) {
      return {
        type: 'meadow',
        name: 'Meadow',
        color: '#84cc16',
        foodRate: 1.4,
        movementSpeed: 1.05,
        moisture,
        temperature,
        elevation
      };
    }

    // Default = Grassland
    return {
      type: 'grassland',
      name: 'Grassland',
      color: '#4d7c0f',
      foodRate: 1.0,
      movementSpeed: 1.0,
      moisture,
      temperature,
      elevation
    };
  }

  /**
   * Pre-generate biome map for entire world (for performance)
   * @param {number} width - World width
   * @param {number} height - World height
   * @param {number} resolution - Sample resolution (lower = faster)
   * @returns {Array} Grid of biome data
   */
  generateBiomeMap(width, height, resolution = 50) {
    const gridW = Math.ceil(width / resolution);
    const gridH = Math.ceil(height / resolution);
    const biomeGrid = [];

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const x = gx * resolution + resolution / 2;
        const y = gy * resolution + resolution / 2;
        biomeGrid.push({
          x: gx,
          y: gy,
          worldX: x,
          worldY: y,
          ...this.getBiomeAt(x, y, width, height)
        });
      }
    }

    return { grid: biomeGrid, gridW, gridH, resolution };
  }
}

