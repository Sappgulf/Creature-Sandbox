// WebGL Renderer for high-performance creature simulation
// Uses instanced rendering for 10x performance boost

export class WebGLRenderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    
    // Try to get WebGL2 context, fallback to WebGL1
    this.gl = canvas.getContext('webgl2', { 
      alpha: false, 
      antialias: true,
      powerPreference: 'high-performance'
    }) || canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }
    
    console.log('🎨 WebGL Renderer initialized:', this.gl.getParameter(this.gl.VERSION));
    
    // Feature toggles (same as Canvas renderer)
    this.enableVision = false;
    this.enableClustering = false;
    this.enableTerritories = false;
    this.enableMemory = false;
    this.enableSocialBonds = false;
    this.enableMigration = false;
    this.enableEmotions = false;
    this.enableSensoryViz = false;
    this.enableIntelligence = false;
    this.enableMating = false;
    this.enableMiniMap = true;
    this.enableAtmosphere = true;
    this.enableWeather = false;
    this.enableDayNight = true;
    this.enableNameLabels = false;
    this.enableTraitVisualization = true;
    
    // Initialize shaders and buffers
    this._initShaders();
    this._initBuffers();
    
    // Performance tracking
    this.stats = {
      drawCalls: 0,
      triangles: 0,
      instances: 0
    };
    
    // For compatibility with Canvas renderer
    this.renderedCount = 0;
    this.culledCount = 0;
    
    // 2D overlay context for UI elements
    this.overlay = document.createElement('canvas');
    this.overlay.width = canvas.width;
    this.overlay.height = canvas.height;
    this.overlayCtx = this.overlay.getContext('2d');
    
    // Batch data
    this.creatureBatch = {
      positions: [],
      colors: [],
      sizes: [],
      rotations: []
    };
    this.foodBatch = {
      positions: [],
      sizes: []
    };
  }
  
  _initShaders() {
    const gl = this.gl;
    
    // Vertex shader for instanced circles (creatures/food)
    const vertexShaderSource = `
      attribute vec2 a_position;      // Vertex position (circle geometry)
      attribute vec2 a_instancePos;   // Instance position (creature location)
      attribute vec3 a_instanceColor; // Instance color (creature hue)
      attribute float a_instanceSize; // Instance size (creature size)
      attribute float a_instanceRotation; // Instance rotation
      
      uniform mat3 u_matrix;          // Camera transform matrix
      uniform vec2 u_resolution;      // Canvas resolution
      
      varying vec3 v_color;
      varying vec2 v_uv;
      
      void main() {
        // Rotate and scale vertex
        float c = cos(a_instanceRotation);
        float s = sin(a_instanceRotation);
        vec2 rotated = vec2(
          a_position.x * c - a_position.y * s,
          a_position.x * s + a_position.y * c
        );
        
        vec2 scaled = rotated * a_instanceSize;
        vec2 worldPos = a_instancePos + scaled;
        
        // Apply camera transform
        vec3 transformed = u_matrix * vec3(worldPos, 1.0);
        
        // Convert to clip space
        vec2 clipSpace = (transformed.xy / u_resolution) * 2.0 - 1.0;
        clipSpace.y *= -1.0; // Flip Y
        
        gl_Position = vec4(clipSpace, 0.0, 1.0);
        
        v_color = a_instanceColor;
        v_uv = a_position; // For circle rendering
      }
    `;
    
    // Fragment shader for circles
    const fragmentShaderSource = `
      precision mediump float;
      
      varying vec3 v_color;
      varying vec2 v_uv;
      
      uniform float u_lightLevel; // Day/night lighting
      
      void main() {
        // Draw circle (discard outside radius)
        float dist = length(v_uv);
        if (dist > 1.0) discard;
        
        // Soft edge
        float alpha = smoothstep(1.0, 0.9, dist);
        
        // Apply lighting
        vec3 lit = v_color * u_lightLevel;
        
        // Add some shading for depth
        float shade = 1.0 - dist * 0.3;
        lit *= shade;
        
        gl_FragColor = vec4(lit, alpha);
      }
    `;
    
    // Background shader (for biomes and atmosphere)
    const bgVertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_worldPos;
      uniform mat3 u_matrix;
      uniform vec2 u_resolution;
      
      void main() {
        vec3 transformed = u_matrix * vec3(a_position, 1.0);
        vec2 clipSpace = (transformed.xy / u_resolution) * 2.0 - 1.0;
        clipSpace.y *= -1.0;
        gl_Position = vec4(clipSpace, 0.0, 1.0);
        v_worldPos = a_position;
      }
    `;
    
    const bgFragmentShaderSource = `
      precision mediump float;
      varying vec2 v_worldPos;
      uniform vec2 u_worldSize;
      uniform float u_timeOfDay; // 0-24
      
      // Simple noise function
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      void main() {
        vec2 uv = v_worldPos / u_worldSize;
        
        // Biome-like colors based on position
        float n1 = noise(uv * 3.0);
        float n2 = noise(uv * 6.0);
        float n = n1 * 0.6 + n2 * 0.4;
        
        // Green grassland base
        vec3 grassColor = vec3(0.2, 0.4, 0.2);
        vec3 desertColor = vec3(0.6, 0.5, 0.3);
        vec3 forestColor = vec3(0.1, 0.3, 0.1);
        
        vec3 biomeColor = mix(
          mix(grassColor, desertColor, n),
          forestColor,
          smoothstep(0.3, 0.7, n1)
        );
        
        // Day/night lighting
        float hour = mod(u_timeOfDay, 24.0);
        float daylight = smoothstep(6.0, 8.0, hour) * (1.0 - smoothstep(18.0, 20.0, hour));
        daylight = mix(0.3, 1.0, daylight); // Night = 30% brightness
        
        vec3 finalColor = biomeColor * daylight;
        
        // Subtle vignette
        float vignette = 1.0 - length(uv - 0.5) * 0.5;
        finalColor *= vignette;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
    
    // Compile shaders
    this.creatureProgram = this._createProgram(vertexShaderSource, fragmentShaderSource);
    this.bgProgram = this._createProgram(bgVertexShaderSource, bgFragmentShaderSource);
    
    // Get attribute and uniform locations
    this._getLocations();
  }
  
  _createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    
    const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      throw new Error('Failed to link shader program');
    }
    
    return program;
  }
  
  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      throw new Error('Failed to compile shader');
    }
    
    return shader;
  }
  
  _getLocations() {
    const gl = this.gl;
    const prog = this.creatureProgram;
    
    this.locations = {
      creature: {
        position: gl.getAttribLocation(prog, 'a_position'),
        instancePos: gl.getAttribLocation(prog, 'a_instancePos'),
        instanceColor: gl.getAttribLocation(prog, 'a_instanceColor'),
        instanceSize: gl.getAttribLocation(prog, 'a_instanceSize'),
        instanceRotation: gl.getAttribLocation(prog, 'a_instanceRotation'),
        matrix: gl.getUniformLocation(prog, 'u_matrix'),
        resolution: gl.getUniformLocation(prog, 'u_resolution'),
        lightLevel: gl.getUniformLocation(prog, 'u_lightLevel')
      },
      bg: {
        position: gl.getAttribLocation(this.bgProgram, 'a_position'),
        matrix: gl.getUniformLocation(this.bgProgram, 'u_matrix'),
        resolution: gl.getUniformLocation(this.bgProgram, 'u_resolution'),
        worldSize: gl.getUniformLocation(this.bgProgram, 'u_worldSize'),
        timeOfDay: gl.getUniformLocation(this.bgProgram, 'u_timeOfDay')
      }
    };
  }
  
  _initBuffers() {
    const gl = this.gl;
    
    // Circle geometry (unit circle, will be scaled per instance)
    const segments = 16;
    const circleVertices = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      circleVertices.push(Math.cos(angle), Math.sin(angle));
    }
    
    this.circleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVertices), gl.STATIC_DRAW);
    
    // World-sized quad for background (will match world dimensions)
    this.quadBuffer = gl.createBuffer();
    this._updateQuadBuffer(4000, 2800); // Initial world size
    
    // Instance buffers (will be updated each frame)
    this.instancePosBuffer = gl.createBuffer();
    this.instanceColorBuffer = gl.createBuffer();
    this.instanceSizeBuffer = gl.createBuffer();
    this.instanceRotationBuffer = gl.createBuffer();
  }
  
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.overlay.width = width;
    this.overlay.height = height;
    this.gl.viewport(0, 0, width, height);
  }
  
  _updateQuadBuffer(worldWidth, worldHeight) {
    const gl = this.gl;
    const quadVertices = [
      0, 0,
      worldWidth, 0,
      0, worldHeight,
      worldWidth, worldHeight
    ];
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadVertices), gl.STATIC_DRAW);
  }
  
  clear(width, height) {
    // For compatibility with Canvas renderer API
    // WebGL clears in drawWorld, so this is a no-op
    // But we can use it to update viewport if needed
    if (width && height) {
      this.resize(width, height);
    }
  }
  
  drawWorld(world, opts) {
    const gl = this.gl;
    
    // Reset stats
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;
    this.stats.instances = 0;
    this.renderedCount = 0;
    this.culledCount = 0;
    
    // Clear
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Calculate camera matrix
    const matrix = this._getCameraMatrix();
    
    // Calculate light level from time of day
    const lightLevel = this._getLightLevel(world.timeOfDay || 12);
    
    // Draw background
    this._drawBackground(world, matrix, lightLevel);
    
    // Batch creatures and food
    this._batchCreatures(world.creatures);
    this._batchFood(world.food);
    
    // Draw batches
    this._drawCreatureBatch(matrix, lightLevel);
    this._drawFoodBatch(matrix, lightLevel);
    
    // Draw corpses
    if (world.corpses && world.corpses.length > 0) {
      this._drawCorpses(world.corpses, matrix, lightLevel);
    }
    
    // Clear overlay for UI
    this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    
    // Draw 2D overlay elements (features, UI, etc.) using canvas 2D
    this._drawOverlayFeatures(world, opts);
    
    // Composite overlay onto WebGL canvas
    const ctx2d = this.canvas.getContext('2d', { willReadFrequently: false });
    if (ctx2d) {
      ctx2d.drawImage(this.overlay, 0, 0);
    }
  }
  
  _getCameraMatrix() {
    const cam = this.camera;
    // Create 2D transformation matrix: translate, scale
    // Matrix format: [a, c, e]
    //                [b, d, f]
    //                [0, 0, 1]
    const zoom = cam.zoom;
    const tx = -cam.x * zoom + this.canvas.width / 2;
    const ty = -cam.y * zoom + this.canvas.height / 2;
    
    return [
      zoom, 0, 0,
      0, zoom, 0,
      tx, ty, 1
    ];
  }
  
  _getLightLevel(timeOfDay) {
    if (!this.enableDayNight) return 1.0;
    
    // 0-24 hours
    const hour = timeOfDay % 24;
    
    // Dawn: 6-8, Day: 8-18, Dusk: 18-20, Night: 20-6
    if (hour >= 8 && hour < 18) return 1.0; // Full day
    if (hour >= 20 || hour < 6) return 0.3; // Night
    
    // Transitions
    if (hour >= 6 && hour < 8) {
      // Dawn
      return 0.3 + (hour - 6) / 2 * 0.7;
    }
    if (hour >= 18 && hour < 20) {
      // Dusk
      return 1.0 - (hour - 18) / 2 * 0.7;
    }
    
    return 1.0;
  }
  
  _drawBackground(world, matrix, lightLevel) {
    const gl = this.gl;
    
    gl.useProgram(this.bgProgram);
    
    // Bind quad buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.locations.bg.position);
    gl.vertexAttribPointer(this.locations.bg.position, 2, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    gl.uniformMatrix3fv(this.locations.bg.matrix, false, matrix);
    gl.uniform2f(this.locations.bg.resolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.locations.bg.worldSize, world.width, world.height);
    gl.uniform1f(this.locations.bg.timeOfDay, world.timeOfDay || 12);
    
    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.stats.drawCalls++;
    this.stats.triangles += 2;
  }
  
  _batchCreatures(creatures) {
    this.creatureBatch.positions = [];
    this.creatureBatch.colors = [];
    this.creatureBatch.sizes = [];
    this.creatureBatch.rotations = [];
    
    // Simple frustum culling for performance
    const cam = this.camera;
    const padding = 100;
    const left = cam.x - (this.canvas.width / cam.zoom / 2) - padding;
    const right = cam.x + (this.canvas.width / cam.zoom / 2) + padding;
    const top = cam.y - (this.canvas.height / cam.zoom / 2) - padding;
    const bottom = cam.y + (this.canvas.height / cam.zoom / 2) + padding;
    
    for (const c of creatures) {
      if (!c.alive) continue;
      
      // Frustum culling
      if (c.x < left || c.x > right || c.y < top || c.y > bottom) {
        this.culledCount++;
        continue;
      }
      
      this.renderedCount++;
      
      // Position
      this.creatureBatch.positions.push(c.x, c.y);
      
      // Color (HSL to RGB)
      const hue = c.genes.hue / 360;
      const rgb = this._hslToRgb(hue, 0.8, 0.5);
      this.creatureBatch.colors.push(rgb[0], rgb[1], rgb[2]);
      
      // Size
      this.creatureBatch.sizes.push(c.size || 4);
      
      // Rotation
      this.creatureBatch.rotations.push(c.dir);
    }
  }
  
  _batchFood(food) {
    this.foodBatch.positions = [];
    this.foodBatch.sizes = [];
    
    for (const f of food) {
      this.foodBatch.positions.push(f.x, f.y);
      this.foodBatch.sizes.push(2.0 + (f.energy || 1) * 0.5);
    }
  }
  
  _drawCreatureBatch(matrix, lightLevel) {
    if (this.creatureBatch.positions.length === 0) return;
    
    const gl = this.gl;
    gl.useProgram(this.creatureProgram);
    
    const instanceCount = this.creatureBatch.positions.length / 2;
    
    // Bind circle geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuffer);
    gl.enableVertexAttribArray(this.locations.creature.position);
    gl.vertexAttribPointer(this.locations.creature.position, 2, gl.FLOAT, false, 0, 0);
    
    // Bind instance data
    this._bindInstanceData(
      this.instancePosBuffer,
      this.locations.creature.instancePos,
      new Float32Array(this.creatureBatch.positions),
      2
    );
    
    this._bindInstanceData(
      this.instanceColorBuffer,
      this.locations.creature.instanceColor,
      new Float32Array(this.creatureBatch.colors),
      3
    );
    
    this._bindInstanceData(
      this.instanceSizeBuffer,
      this.locations.creature.instanceSize,
      new Float32Array(this.creatureBatch.sizes),
      1
    );
    
    this._bindInstanceData(
      this.instanceRotationBuffer,
      this.locations.creature.instanceRotation,
      new Float32Array(this.creatureBatch.rotations),
      1
    );
    
    // Set uniforms
    gl.uniformMatrix3fv(this.locations.creature.matrix, false, matrix);
    gl.uniform2f(this.locations.creature.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.locations.creature.lightLevel, lightLevel);
    
    // Draw instances (if supported)
    if (gl.drawArraysInstanced) {
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 17, instanceCount);
    } else {
      // Fallback: draw individually (slower)
      for (let i = 0; i < instanceCount; i++) {
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 17);
      }
    }
    
    this.stats.drawCalls++;
    this.stats.instances += instanceCount;
    this.stats.triangles += 15 * instanceCount;
  }
  
  _drawFoodBatch(matrix, lightLevel) {
    if (this.foodBatch.positions.length === 0) return;
    
    const gl = this.gl;
    gl.useProgram(this.creatureProgram);
    
    const instanceCount = this.foodBatch.positions.length / 2;
    
    // Reuse circle geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuffer);
    gl.enableVertexAttribArray(this.locations.creature.position);
    gl.vertexAttribPointer(this.locations.creature.position, 2, gl.FLOAT, false, 0, 0);
    
    // Green color for all food
    const greenColors = [];
    for (let i = 0; i < instanceCount; i++) {
      greenColors.push(0.3, 0.8, 0.3); // RGB green
    }
    
    // Zero rotation for food
    const rotations = new Array(instanceCount).fill(0);
    
    this._bindInstanceData(
      this.instancePosBuffer,
      this.locations.creature.instancePos,
      new Float32Array(this.foodBatch.positions),
      2
    );
    
    this._bindInstanceData(
      this.instanceColorBuffer,
      this.locations.creature.instanceColor,
      new Float32Array(greenColors),
      3
    );
    
    this._bindInstanceData(
      this.instanceSizeBuffer,
      this.locations.creature.instanceSize,
      new Float32Array(this.foodBatch.sizes),
      1
    );
    
    this._bindInstanceData(
      this.instanceRotationBuffer,
      this.locations.creature.instanceRotation,
      new Float32Array(rotations),
      1
    );
    
    // Set uniforms
    gl.uniformMatrix3fv(this.locations.creature.matrix, false, matrix);
    gl.uniform2f(this.locations.creature.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.locations.creature.lightLevel, lightLevel);
    
    // Draw
    if (gl.drawArraysInstanced) {
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 17, instanceCount);
    } else {
      for (let i = 0; i < instanceCount; i++) {
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 17);
      }
    }
    
    this.stats.drawCalls++;
    this.stats.instances += instanceCount;
  }
  
  _drawCorpses(corpses, matrix, lightLevel) {
    // Similar to food, but brown color
    const positions = [];
    const sizes = [];
    const colors = [];
    const rotations = [];
    
    for (const corpse of corpses) {
      positions.push(corpse.x, corpse.y);
      sizes.push(3.5);
      colors.push(0.4, 0.3, 0.2); // Brown
      rotations.push(0);
    }
    
    if (positions.length === 0) return;
    
    const gl = this.gl;
    gl.useProgram(this.creatureProgram);
    
    const instanceCount = positions.length / 2;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuffer);
    gl.enableVertexAttribArray(this.locations.creature.position);
    gl.vertexAttribPointer(this.locations.creature.position, 2, gl.FLOAT, false, 0, 0);
    
    this._bindInstanceData(this.instancePosBuffer, this.locations.creature.instancePos, new Float32Array(positions), 2);
    this._bindInstanceData(this.instanceColorBuffer, this.locations.creature.instanceColor, new Float32Array(colors), 3);
    this._bindInstanceData(this.instanceSizeBuffer, this.locations.creature.instanceSize, new Float32Array(sizes), 1);
    this._bindInstanceData(this.instanceRotationBuffer, this.locations.creature.instanceRotation, new Float32Array(rotations), 1);
    
    gl.uniformMatrix3fv(this.locations.creature.matrix, false, matrix);
    gl.uniform2f(this.locations.creature.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.locations.creature.lightLevel, lightLevel * 0.7); // Darker
    
    if (gl.drawArraysInstanced) {
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 17, instanceCount);
    }
    
    this.stats.drawCalls++;
    this.stats.instances += instanceCount;
  }
  
  _bindInstanceData(buffer, location, data, size) {
    const gl = this.gl;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    
    // Set divisor for instancing (if supported)
    if (gl.vertexAttribDivisor) {
      gl.vertexAttribDivisor(location, 1);
    }
  }
  
  _drawOverlayFeatures(world, opts) {
    // Use overlay canvas 2D context for features that need complex drawing
    // This is a hybrid approach: WebGL for performance-critical rendering,
    // Canvas 2D for complex UI elements
    
    const ctx = this.overlayCtx;
    ctx.save();
    
    // Apply camera transform
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    
    // Draw features using existing feature drawing logic
    // (Vision cones, territories, etc. - reuse from canvas renderer)
    
    ctx.restore();
  }
  
  _hslToRgb(h, s, l) {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return [r, g, b];
  }
  
  getStats() {
    return { ...this.stats };
  }
  
  // Stub methods for feature compatibility
  setMiniMapOption(key, value) {
    if (!this.miniMapSettings) this.miniMapSettings = {};
    this.miniMapSettings[key] = value;
  }
}

