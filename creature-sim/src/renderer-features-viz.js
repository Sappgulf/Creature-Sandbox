import { clamp } from './utils.js';

export function applyFeatureVizMethods(Renderer) {
  Renderer.prototype.drawNests = function(world) {
    if (!world.nestGrid || world.nests.length === 0) return;
    const ctx = this.ctx;
    const bounds = this._viewBounds;

    // OPTIMIZATION: Use spatial grid for frustum culling
    const visibleNests = world.nestGrid.queryRect(bounds.x1, bounds.y1, bounds.x2, bounds.y2);

    for (const nest of visibleNests) {
      if (!nest) continue;
      const comfort = nest.comfortEffective ?? nest.comfort ?? 0.7;
      const alpha = 0.1 + comfort * 0.25;
      ctx.save();
      ctx.beginPath();
      ctx.arc(nest.x, nest.y, nest.radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230, 200, 150, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = nest.overcrowded ? 'rgba(255, 140, 120, 0.55)' : 'rgba(240, 220, 170, 0.45)';
      ctx.lineWidth = nest.overcrowded ? 2 : 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(nest.x, nest.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = nest.overcrowded ? 'rgba(255, 140, 120, 0.7)' : 'rgba(255, 230, 190, 0.75)';
      ctx.fill();
      ctx.restore();
    }
  };

  Renderer.prototype.drawTerritories = function(world) {
    const ctx = this.ctx;

    if (world.regions?.length) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      for (const region of world.regions) {
        if (!region?.bounds) continue;
        const { x1, y1, x2, y2 } = region.bounds;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }
      ctx.restore();
      return;
    }

    if (!world.territories?.entries) return;

    // Draw territory circles (legacy)
    for (const [id, territory] of world.territories.entries()) {
      const owner = world.registry.get(id);
      if (!owner || !owner.alive) continue;

      ctx.save();
      ctx.beginPath();
      ctx.arc(territory.x, territory.y, territory.radius, 0, Math.PI * 2);

      // Color based on rank
      const hue = territory.dominanceRank === 1 ? 0 : (territory.dominanceRank <= 3 ? 30 : 50);
      const alpha = territory.dominanceRank === 1 ? 0.15 : 0.08;
      ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.4)`;
      ctx.lineWidth = territory.dominanceRank === 1 ? 2 : 1;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Draw rank indicator
      if (territory.dominanceRank <= 3) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`#${territory.dominanceRank}`, territory.x - 8, territory.y + 6);
        ctx.restore();
      }
    }

    // Draw conflict zones
    for (const conflict of world.territoryConflicts || []) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(conflict.x, conflict.y, 20 * conflict.intensity, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 80, 80, ${conflict.intensity * 0.3})`;
      ctx.fill();
      ctx.restore();
    }
  };

  Renderer.prototype.drawMemory = function(creature) {
    const ctx = this.ctx;

    for (const mem of creature.memory.locations) {
      ctx.save();
      const alpha = mem.strength * 0.6;
      let color;

      const tag = mem.tag ?? mem.type;
      switch (tag) {
        case 'food':
          color = `rgba(100, 255, 100, ${alpha})`;
          break;
        case 'danger':
          color = `rgba(255, 100, 100, ${alpha})`;
          break;
        case 'calm':
          color = `rgba(120, 200, 255, ${alpha})`;
          break;
        case 'nest':
          color = `rgba(255, 200, 140, ${alpha})`;
          break;
        case 'safe':
          color = `rgba(100, 200, 255, ${alpha})`;
          break;
        default:
          color = `rgba(200, 200, 200, ${alpha})`;
      }

      ctx.beginPath();
      ctx.arc(mem.x, mem.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color.replace(String(alpha), String(alpha * 1.5));
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  };

  Renderer.prototype.drawMemoryDebug = function(world) {
    const ctx = this.ctx;
    const view = this._viewBounds;

    // OPTIMIZATION: Only process visible creatures to find memory points
    const visibleCreatures = world.creatureManager.creatureGrid.queryRect(view.x1, view.y1, view.x2, view.y2);

    ctx.save();
    for (const creature of visibleCreatures) {
      if (!creature?.alive || !creature.memory?.locations) continue;
      for (const mem of creature.memory.locations) {
        // Double check bounds for precise culling of memory points
        if (mem.x < view.x1 || mem.x > view.x2 || mem.y < view.y1 || mem.y > view.y2) continue;
        const alpha = clamp((mem.strength ?? 0) * 0.35, 0.08, 0.35);
        const tag = mem.tag ?? mem.type;
        let color = `rgba(200, 200, 200, ${alpha})`;
        if (tag === 'food') color = `rgba(120, 255, 150, ${alpha})`;
        if (tag === 'danger') color = `rgba(255, 120, 120, ${alpha})`;
        if (tag === 'calm') color = `rgba(140, 210, 255, ${alpha})`;
        if (tag === 'nest') color = `rgba(255, 210, 160, ${alpha})`;
        ctx.beginPath();
        ctx.arc(mem.x, mem.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
    ctx.restore();
  };

  Renderer.prototype.drawLifeStageDebug = function(world) {
    const ctx = this.ctx;
    const view = this._viewBounds;

    ctx.save();
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255, 240, 200, 0.9)';

    for (const creature of world.creatures) {
      if (!creature?.alive) continue;
      if (creature.x < view.x1 || creature.x > view.x2 || creature.y < view.y1 || creature.y > view.y2) continue;
      const label = creature.lifeStage ? creature.lifeStage.toUpperCase() : '';
      if (!label) continue;
      ctx.fillText(label, creature.x, creature.y - creature.size - 6);
    }

    ctx.restore();
  };

  Renderer.prototype.drawSocialBonds = function(world) {
    const ctx = this.ctx;

    for (const creature of world.creatures) {
      if (!creature.social || !creature.alive) continue;

      // Draw herding connections for herbivores
      if (!creature.genes.predator && creature.social.herdMates.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(150, 255, 150, 0.15)';
        ctx.lineWidth = 1;

        for (const mate of creature.social.herdMates.slice(0, 3)) {
          ctx.beginPath();
          ctx.moveTo(creature.x, creature.y);
          ctx.lineTo(mate.x, mate.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw pack connections for predators
      if (creature.genes.predator && creature.social.packTarget) {
        const target = world.getAnyCreatureById(creature.social.packTarget);
        if (target && target.alive) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 150, 150, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(creature.x, creature.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    }
  };

  Renderer.prototype.drawMigration = function(world) {
    const ctx = this.ctx;

    for (const creature of world.creatures) {
      if (!creature.migration || !creature.alive) continue;
      if (!creature.migration.active || creature.migration.settled) continue;
      if (!creature.migration.target) continue;

      // Draw line to migration target
      const targetX = creature.migration.target.x;
      const targetY = creature.migration.target.y;

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 200, 100, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 10]);

      ctx.beginPath();
      ctx.moveTo(creature.x, creature.y);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      // Draw arrow at target
      const dx = targetX - creature.x;
      const dy = targetY - creature.y;
      const angle = Math.atan2(dy, dx);
      ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
      ctx.translate(targetX, targetY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-10, -5);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();

      ctx.setLineDash([]);
      ctx.restore();
    }
  };

  Renderer.prototype.drawEmotions = function(creature) {
    if (!creature.emotions) return;
    const ctx = this.ctx;
    const em = creature.emotions;

    // Draw emotional aura
    const dominantEmotion = this._getDominantEmotion(em);
    if (dominantEmotion.strength > 0.3) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(creature.x, creature.y, 25 + dominantEmotion.strength * 10, 0, Math.PI * 2);
      ctx.fillStyle = `${dominantEmotion.color.replace('1)', dominantEmotion.strength * 0.15 + ')')}`;
      ctx.fill();
      ctx.restore();
    }

    // Draw emotion bar chart next to creature
    const emotions = [
      { name: 'Fear', value: em.fear, color: 'rgba(255, 100, 100, 0.8)' },
      { name: 'Hunger', value: em.hunger, color: 'rgba(255, 200, 100, 0.8)' },
      { name: 'Confidence', value: em.confidence, color: 'rgba(100, 255, 100, 0.8)' },
      { name: 'Curiosity', value: em.curiosity, color: 'rgba(100, 200, 255, 0.8)' }
    ];

    ctx.save();
    const barX = creature.x + 40;
    const barY = creature.y - 30;
    const barWidth = 4;
    const barHeight = 30;

    emotions.forEach((e, i) => {
      const x = barX + i * 6;
      const h = e.value * barHeight;
      ctx.fillStyle = e.color;
      ctx.fillRect(x, barY + barHeight - h, barWidth, h);

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '8px monospace';
      ctx.fillText(e.name[0], x, barY + barHeight + 10);
    });
    ctx.restore();
  };

  Renderer.prototype._getDominantEmotion = function(em) {
    const emotions = [
      { name: 'fear', strength: em.fear, color: 'rgba(255, 80, 80, 1)' },
      { name: 'stress', strength: em.stress, color: 'rgba(180, 80, 180, 1)' },
      { name: 'contentment', strength: em.contentment, color: 'rgba(100, 255, 150, 1)' },
      { name: 'curiosity', strength: em.curiosity, color: 'rgba(100, 200, 255, 1)' }
    ];

    return emotions.reduce((max, e) => e.strength > max.strength ? e : max, emotions[0]);
  };

  Renderer.prototype.drawSensoryViz = function(world) {
    const ctx = this.ctx;

    for (const creature of world.creatures) {
      if (!creature.senseType || creature.senseType === 'normal') continue;

      const radius = creature.getEnhancedSenseRadius ? creature.getEnhancedSenseRadius() : creature.genes.sense;

      ctx.save();
      ctx.beginPath();
      ctx.arc(creature.x, creature.y, radius, 0, Math.PI * 2);

      let color;
      switch (creature.senseType) {
        case 'echolocation':
          color = 'rgba(200, 100, 255, 0.1)';
          break;
        case 'chemical':
          color = 'rgba(100, 255, 200, 0.1)';
          break;
        case 'thermal':
          color = 'rgba(255, 150, 100, 0.1)';
          break;
        default:
          color = 'rgba(200, 200, 200, 0.05)';
      }

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color.replace('0.1', '0.3');
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  };

  Renderer.prototype.drawIntelligenceIndicators = function(world) {
    const ctx = this.ctx;

    for (const creature of world.creatures) {
      if (!creature.intelligence || creature.intelligence.level < 0.8) continue;

      // Show light bulb for intelligent creatures
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 100, ${creature.intelligence.level * 0.5})`;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('💡', creature.x - 6, creature.y - 15);

      // Show innovation count
      if (creature.intelligence.innovations > 0) {
        ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
        ctx.font = '10px sans-serif';
        ctx.fillText(`×${creature.intelligence.innovations}`, creature.x + 8, creature.y - 12);
      }
      ctx.restore();
    }
  };

  Renderer.prototype.drawGoalDebug = function(world) {
    const ctx = this.ctx;
    const view = this._viewBounds;

    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const creature of world.creatures) {
      if (!creature?.alive) continue;
      if (creature.x < view.x1 || creature.x > view.x2 || creature.y < view.y1 || creature.y > view.y2) continue;

      const goalLabel = creature.goal?.current;
      if (goalLabel) {
        ctx.fillStyle = 'rgba(120, 220, 255, 0.9)';
        ctx.fillText(goalLabel, creature.x, creature.y - creature.size - 18);
      }

      const target = creature.target;
      if (target) {
        const tx = target.x ?? creature.x;
        const ty = target.y ?? creature.y;
        ctx.save();
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(creature.x, creature.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = 'rgba(120, 220, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  };

  Renderer.prototype.drawMatingDisplays = function(world) {
    const ctx = this.ctx;

    for (const creature of world.creatures) {
      if (!creature.sexuality || !creature.sexuality.isDisplaying) continue;

      // Draw sparkle/display animation
      const time = Date.now() * 0.005;
      const phase = Math.sin(time + creature.id) * 0.5 + 0.5;

      ctx.save();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time;
        const dist = 20 + phase * 10;
        const x = creature.x + Math.cos(angle) * dist;
        const y = creature.y + Math.sin(angle) * dist;

        ctx.fillStyle = `hsla(${(creature.genes.hue + i * 45) % 360}, 100%, 70%, ${phase * 0.8})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + phase * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Heart/display indicator
      ctx.fillStyle = 'rgba(255, 100, 150, 0.8)';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('💗', creature.x - 8, creature.y - 20);
      ctx.restore();
    }
  };
}
