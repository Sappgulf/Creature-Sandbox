/**
 * Asset Loader - Loads and manages SVG creature sprites
 * Provides dynamic color tinting for genetic variation
 */

export class AssetLoader {
  constructor() {
    this.assets = new Map();
    this.promises = [];
    this.isLoading = false;
    this.isLoaded = false;
  }

  /**
   * Load an SVG file
   * @param {string} name - Asset identifier
   * @param {string} path - Path to SVG file
   */
  loadSVG(name, path) {
    if (typeof fetch === 'undefined') return Promise.resolve(null);

    const promise = fetch(path)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load ${path}: ${response.statusText}`);
        }
        return response.text();
      })
      .then(svgText => {
        this.assets.set(name, svgText);
        return svgText;
      })
      .catch(error => {
        console.warn(`Failed to load SVG ${name}:`, error);
        // Store null to prevent repeated failed requests
        this.assets.set(name, null);
        return null;
      });

    this.promises.push(promise);
    return promise;
  }

  /**
   * Load all registered assets
   * @returns {Promise<Map>} Map of loaded assets
   */
  async loadAll() {
    if (this.isLoading) {
      await Promise.all(this.promises);
      return this.assets;
    }

    this.isLoading = true;
    await Promise.all(this.promises);
    this.isLoaded = true;
    this.isLoading = false;

    console.log(`✅ Loaded ${this.assets.size} creature assets`);
    return this.assets;
  }

  /**
   * Get loaded SVG text
   * @param {string} name - Asset identifier
   * @returns {string|null} SVG text or null if not loaded
   */
  getSVG(name) {
    return this.assets.get(name) || null;
  }

  /**
   * Creates a tinted canvas from an SVG
   * @param {string} name - Asset name
   * @param {string} color - CSS color string
   * @param {number} size - Canvas size
   * @returns {Promise<HTMLCanvasElement|null>}
   */
  async createTintedCanvas(name, color, size = 64) {
    // Worker safety check
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return null;
    }

    const svgText = this.getSVG(name);
    if (!svgText) {
      console.warn(`SVG asset '${name}' not found`);
      return null;
    }

    try {
      // Replace currentColor with the target color
      const tintedSvg = svgText.replace(/currentColor/g, color);

      const blob = new Blob([tintedSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          // Draw with centered positioning
          ctx.drawImage(img, 0, 0, size, size);

          URL.revokeObjectURL(url);
          resolve(canvas);
        };

        img.onerror = (error) => {
          console.error(`Failed to load image for ${name}:`, error);
          URL.revokeObjectURL(url);
          reject(error);
        };

        img.src = url;
      });
    } catch (error) {
      console.error(`Error creating tinted canvas for ${name}:`, error);
      return null;
    }
  }

  /**
   * Check if assets are ready
   * @returns {boolean}
   */
  isReady() {
    return this.isLoaded;
  }
}

// Global singleton instance
export const assetLoader = new AssetLoader();
