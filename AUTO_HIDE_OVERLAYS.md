# 🎯 AUTO-HIDE OVERLAYS - COMPLETE

## ✅ WHAT'S BEEN DONE

### **The Problem**
Mini-map and stats graphs were always visible, blocking the view and getting in the way.

### **The Solution**
Added intelligent auto-hide system that fades overlays out when the camera is moving and brings them back when stationary!

---

## 🎮 HOW IT WORKS

### **Auto-Hide Logic**
1. **Camera Tracks Movement**: Camera now has `isMoving` property
2. **Movement Detection**: Checks if camera position differs from target
3. **Smooth Fade**: Overlays fade out (opacity 0.0) when moving
4. **Smooth Fade In**: Overlays fade in (opacity 1.0) when stationary
5. **Threshold**: 0.5 pixels difference = "moving"

### **What Triggers Auto-Hide**
- Panning camera (dragging mouse/touch)
- Zooming (pinch or scroll)
- Camera travel (mini-map clicks)
- Follow mode (tracking creature)

### **When Overlays Show**
- Camera is stationary (target reached)
- Auto-hide is disabled (press 'A')
- Always visible if feature is toggled on

---

## ⌨️ KEYBOARD SHORTCUTS

| Key | Action | Description |
|-----|--------|-------------|
| **N** | Toggle Mini-Map | Show/hide the world map overlay |
| **L** | Toggle Stats Graphs | Show/hide the live statistics |
| **A** | Toggle Auto-Hide | Enable/disable auto-hide behavior |

### **Usage Examples**
```
Press 'N' → Mini-map disappears/appears
Press 'L' → Stats graphs disappear/appear
Press 'A' → Auto-hide ON (hides when moving) / OFF (always show)
```

---

## 🔧 TECHNICAL DETAILS

### **Camera.js Changes**
```javascript
// New properties
this.isMoving = false;
this.movementThreshold = 0.5;

// In update() method
const dx = Math.abs(this.x - this.targetX);
const dy = Math.abs(this.y - this.targetY);
const dz = Math.abs(this.zoom - this.targetZoom);
this.isMoving = (dx > 0.5 || dy > 0.5 || dz > 0.01) || this.travel !== null;
```

### **Renderer.js Changes**
```javascript
// New properties
this.miniMapAutoHide = true;
this.miniMapOpacity = 1.0;
this.miniMapTargetOpacity = 1.0;

// In drawMiniMap()
if (this.miniMapAutoHide && opts.cameraMoving) {
  this.miniMapTargetOpacity = 0.0;
} else {
  this.miniMapTargetOpacity = 1.0;
}

// Smooth fade
this.miniMapOpacity += (this.miniMapTargetOpacity - this.miniMapOpacity) * 0.15;

// Skip if fully transparent
if (this.miniMapOpacity < 0.01) return;

// Apply opacity
ctx.globalAlpha = this.miniMapOpacity;
```

### **Mini-Graphs.js Changes**
```javascript
// New properties
this.autoHide = true;
this.opacity = 1.0;
this.targetOpacity = 1.0;

// In draw()
if (this.autoHide && opts.cameraMoving) {
  this.targetOpacity = 0.0;
} else {
  this.targetOpacity = 1.0;
}

// Smooth fade
this.opacity += (this.targetOpacity - this.opacity) * 0.15;

// Skip if fully transparent
if (this.opacity < 0.01) return;

// Apply opacity
ctx.globalAlpha = this.opacity;
```

### **Main.js Changes**
```javascript
// Pass cameraMoving flag to renderers
renderer.drawWorld(world, {
  // ... other options
  cameraMoving: camera.isMoving
});

miniGraphs.draw(ctx, {
  // ... other options
  cameraMoving: camera.isMoving
});

// Keyboard shortcuts
if (e.key.toLowerCase() === 'n') {
  renderer.enableMiniMap = !renderer.enableMiniMap;
}
if (e.key.toLowerCase() === 'l') {
  miniGraphs.enabled = !miniGraphs.enabled;
}
if (e.key.toLowerCase() === 'a') {
  renderer.miniMapAutoHide = !renderer.miniMapAutoHide;
  miniGraphs.autoHide = !miniGraphs.autoHide;
}
```

---

## 🎨 USER EXPERIENCE

### **Before**
❌ Mini-map always visible (blocking view)
❌ Stats graphs always visible (distracting)
❌ No way to hide except disabling entirely
❌ Hard to see creatures behind overlays

### **After**
✅ Overlays auto-hide when exploring
✅ Overlays return when you stop moving
✅ Smooth fade transitions (not jarring)
✅ Full control with keyboard shortcuts
✅ Perfect for both desktop and mobile

---

## 📊 FADE ANIMATION

### **Fade Speed**
- Fade out: 0.15 lerp factor (~500ms to fully fade)
- Fade in: 0.15 lerp factor (~500ms to fully appear)
- Smooth interpolation (not instant)

### **Opacity Levels**
- Fully visible: `opacity = 1.0`
- Fully hidden: `opacity = 0.0`
- Skip rendering: `opacity < 0.01` (optimization)

### **Performance**
- No performance impact when hidden (skip drawing)
- Smooth 60 FPS fade animations
- Uses `ctx.globalAlpha` for fade

---

## 🎯 MOVEMENT DETECTION

### **Movement Threshold**
```javascript
movementThreshold = 0.5 // pixels
```
- Camera is "moving" if distance to target > 0.5 pixels
- Also considers zoom changes (> 0.01 difference)
- Also considers camera travel mode (animated movement)

### **Movement States**
```javascript
isMoving = true  → Camera is panning/zooming → Hide overlays
isMoving = false → Camera is stationary → Show overlays
```

---

## 🚀 BENEFITS

1. **Better View**: Unobstructed view when exploring
2. **Less Distraction**: No UI clutter during gameplay
3. **Still Accessible**: Overlays appear when needed
4. **Smooth UX**: Gradual fade (not jarring on/off)
5. **User Control**: Can disable auto-hide anytime
6. **Mobile-Friendly**: Less clutter on small screens
7. **Performance**: Skips rendering when hidden

---

## 🎮 RECOMMENDED SETTINGS

### **For Exploration**
- Auto-hide: **ON** (press 'A' if needed)
- Mini-map: **ON** (press 'N' to enable)
- Stats: **ON** (press 'L' to enable)

**Result**: Overlays appear when you stop to look around, hide when moving.

### **For Clean View**
- Auto-hide: **OFF** (press 'A')
- Mini-map: **OFF** (press 'N')
- Stats: **OFF** (press 'L')

**Result**: No overlays at all, maximum screen space.

### **For Always Visible**
- Auto-hide: **OFF** (press 'A')
- Mini-map: **ON** (press 'N')
- Stats: **ON** (press 'L')

**Result**: Overlays always visible (like before).

---

## 📝 FILES MODIFIED

1. **creature-sim/src/camera.js**
   - Added `isMoving` property
   - Added `movementThreshold` property
   - Updated `update()` to track movement

2. **creature-sim/src/renderer.js**
   - Added `miniMapAutoHide` property
   - Added `miniMapOpacity` properties
   - Updated `drawMiniMap()` with fade logic

3. **creature-sim/src/mini-graphs.js**
   - Added `autoHide` property
   - Added `opacity` properties
   - Updated `draw()` with fade logic

4. **creature-sim/src/main.js**
   - Pass `cameraMoving` to renderers
   - Added keyboard shortcuts (N, L, A)
   - Console log feedback

5. **AUTO_HIDE_OVERLAYS.md** (NEW)
   - Complete documentation

---

## 🎉 SUMMARY

**OVERLAYS NOW AUTO-HIDE WHEN CAMERA MOVES!**

✅ Smooth fade in/out transitions
✅ Intelligent movement detection
✅ Keyboard shortcuts (N, L, A)
✅ Better UX on desktop & mobile
✅ Performance optimized
✅ User-controllable

**The game now has a clean, unobstructed view when exploring!** 🎯✨

---

*Last updated: November 4, 2025*
*Status: ✅ COMPLETE*

