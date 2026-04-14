/**
 * Family Bonds & Relationships System
 * Tracks family connections, bonds, and social relationships
 */

export class FamilyBondsSystem {
  constructor() {
    this.relationships = new Map(); // creature ID -> relationship data
    this.families = new Map(); // family ID -> family data
    this.bonds = new Map(); // bond ID -> bond data
    this.nextFamilyId = 1;
    this.nextBondId = 1;
  }

  /**
   * Initialize relationships for a new creature
   */
  initializeCreature(creature, parent1 = null, parent2 = null) {
    const relationshipData = {
      creatureId: creature.id,
      parents: [],
      siblings: [],
      children: [],
      mate: null,
      friends: [],
      rivals: [],
      familyId: null,
      socialScore: 50, // 0-100 scale
      bondStrength: new Map() // creature ID -> bond strength
    };

    // Add parents
    if (parent1) {
      relationshipData.parents.push(parent1.id);
      this.addParentChildBond(parent1, creature);
    }
    if (parent2) {
      relationshipData.parents.push(parent2.id);
      this.addParentChildBond(parent2, creature);
    }

    // Assign to family
    if (parent1 || parent2) {
      const parentData = this.relationships.get(parent1?.id || parent2?.id);
      if (parentData?.familyId) {
        relationshipData.familyId = parentData.familyId;
        this.families.get(parentData.familyId).members.push(creature.id);
      } else {
        // Create new family
        relationshipData.familyId = this.createFamily(creature, parent1, parent2);
      }

      // Find siblings (same parents)
      this.findSiblings(creature, relationshipData);
    } else {
      // Orphan - create solo family
      relationshipData.familyId = this.createFamily(creature);
    }

    this.relationships.set(creature.id, relationshipData);
    return relationshipData;
  }

  /**
   * Create a new family
   */
  createFamily(founder, parent1 = null, parent2 = null) {
    const familyId = `fam_${this.nextFamilyId++}`;

    const family = {
      id: familyId,
      founder: founder.id,
      generation: founder.generation || 0,
      members: [founder.id],
      patriarch: parent1?.id || founder.id,
      matriarch: parent2?.id || founder.id,
      founded: Date.now(),
      hue: founder.genes?.hue ?? 120, // Family color
      territory: null
    };

    this.families.set(familyId, family);
    return familyId;
  }

  /**
   * Find and link siblings
   */
  findSiblings(creature, relationshipData) {
    // Look for other creatures with same parents
    for (const [otherId, otherData] of this.relationships.entries()) {
      if (otherId === creature.id) continue;

      const sharedParents = relationshipData.parents.filter(p =>
        otherData.parents.includes(p)
      );

      if (sharedParents.length > 0) {
        // They're siblings!
        relationshipData.siblings.push(otherId);
        otherData.siblings.push(creature.id);

        // Create sibling bond
        this.createBond(creature.id, otherId, 'sibling', 0.7);
      }
    }
  }

  /**
   * Add parent-child bond
   */
  addParentChildBond(parent, child) {
    const parentData = this.relationships.get(parent.id);
    if (parentData) {
      parentData.children.push(child.id);
      this.createBond(parent.id, child.id, 'parent-child', 0.9);
    }
  }

  /**
   * Create a bond between two creatures
   */
  createBond(creature1Id, creature2Id, type, initialStrength = 0.5) {
    const bondId = `bond_${this.nextBondId++}`;

    const bond = {
      id: bondId,
      creatures: [creature1Id, creature2Id],
      type, // 'parent-child', 'sibling', 'mate', 'friend', 'rival'
      strength: initialStrength, // 0-1 scale
      formed: Date.now(),
      lastInteraction: Date.now(),
      interactions: 0,
      positiveInteractions: 0,
      negativeInteractions: 0
    };

    this.bonds.set(bondId, bond);

    // Update relationship data
    const data1 = this.relationships.get(creature1Id);
    const data2 = this.relationships.get(creature2Id);

    if (data1) data1.bondStrength.set(creature2Id, initialStrength);
    if (data2) data2.bondStrength.set(creature1Id, initialStrength);

    return bond;
  }

  /**
   * Record an interaction between creatures
   */
  recordInteraction(creature1, creature2, isPositive = true) {
    const bond = this.findBond(creature1.id, creature2.id);

    if (!bond) {
      // Create friendship bond if interacting positively
      if (isPositive) {
        this.createBond(creature1.id, creature2.id, 'friend', 0.3);
      }
      return;
    }

    bond.interactions++;
    bond.lastInteraction = Date.now();

    if (isPositive) {
      bond.positiveInteractions++;
      bond.strength = Math.min(1, bond.strength + 0.05);
    } else {
      bond.negativeInteractions++;
      bond.strength = Math.max(0, bond.strength - 0.1);

      // Convert to rivalry if bond becomes negative
      if (bond.strength < 0.2 && bond.type === 'friend') {
        bond.type = 'rival';
        this.convertToRivalry(creature1.id, creature2.id);
      }
    }

    // Update bond strength in relationship data
    const data1 = this.relationships.get(creature1.id);
    const data2 = this.relationships.get(creature2.id);

    if (data1) data1.bondStrength.set(creature2.id, bond.strength);
    if (data2) data2.bondStrength.set(creature1.id, bond.strength);
  }

  /**
   * Convert friendship to rivalry
   */
  convertToRivalry(creature1Id, creature2Id) {
    const data1 = this.relationships.get(creature1Id);
    const data2 = this.relationships.get(creature2Id);

    if (data1) {
      data1.friends = data1.friends.filter(id => id !== creature2Id);
      if (!data1.rivals.includes(creature2Id)) {
        data1.rivals.push(creature2Id);
      }
    }

    if (data2) {
      data2.friends = data2.friends.filter(id => id !== creature1Id);
      if (!data2.rivals.includes(creature1Id)) {
        data2.rivals.push(creature1Id);
      }
    }
  }

  /**
   * Find bond between two creatures
   */
  findBond(creature1Id, creature2Id) {
    for (const bond of this.bonds.values()) {
      if (bond.creatures.includes(creature1Id) && bond.creatures.includes(creature2Id)) {
        return bond;
      }
    }
    return null;
  }

  /**
   * Get family members for a creature
   */
  getFamilyMembers(creatureId, world) {
    const data = this.relationships.get(creatureId);
    if (!data || !data.familyId) return [];

    const family = this.families.get(data.familyId);
    if (!family) return [];

    return world.creatures.filter(c => family.members.includes(c.id));
  }

  /**
   * Get closest family member
   */
  getClosestFamilyMember(creature, world) {
    const familyMembers = this.getFamilyMembers(creature.id, world);
    if (familyMembers.length === 0) return null;

    let closest = null;
    let closestDist = Infinity;

    for (const member of familyMembers) {
      if (member.id === creature.id || !member.alive) continue;

      const dx = member.x - creature.x;
      const dy = member.y - creature.y;
      const dist = dx * dx + dy * dy;

      if (dist < closestDist) {
        closestDist = dist;
        closest = member;
      }
    }

    return closest;
  }

  /**
   * Apply family bond behaviors
   */
  applyFamilyBehaviors(creature, world, dt) {
    const data = this.relationships.get(creature.id);
    if (!data) return;

    // Stay near family (weak attraction)
    const closestFamily = this.getClosestFamilyMember(creature, world);
    if (closestFamily) {
      const dx = closestFamily.x - creature.x;
      const dy = closestFamily.y - creature.y;
      const distSq = dx * dx + dy * dy;

      // Weak attraction to family within 200 units
      if (distSq < 200 * 200 && distSq > 50 * 50) {
        const strength = 0.1 * dt;
        creature.vx += (dx / Math.sqrt(distSq)) * strength;
        creature.vy += (dy / Math.sqrt(distSq)) * strength;
      }
    }

    // Defend family members from threats
    if (creature.genes?.packInstinct && creature.genes.packInstinct > 0.6) {
      this.defendFamily(creature, world);
    }
  }

  /**
   * Defend family from predators
   */
  defendFamily(creature, world) {
    const familyMembers = this.getFamilyMembers(creature.id, world);

    for (const member of familyMembers) {
      if (!member.alive || member.id === creature.id) continue;

      // Check if family member is being attacked
      const nearbyPredators = world.creatures.filter(c => {
        if (!c.alive || !c.genes?.predator) return false;

        const dx = c.x - member.x;
        const dy = c.y - member.y;
        return dx * dx + dy * dy < 100 * 100;
      });

      if (nearbyPredators.length > 0 && !creature.genes?.predator) {
        // Try to distract predator
        creature.isDefending = true;
        creature.defendingTarget = member.id;
      }
    }
  }

  /**
   * Draw family connections
   */
  drawFamilyConnections(ctx, creature, world) {
    const data = this.relationships.get(creature.id);
    if (!data) return;

    const familyMembers = this.getFamilyMembers(creature.id, world);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 220, 100, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    for (const member of familyMembers) {
      if (member.id === creature.id || !member.alive) continue;

      // Only draw if close enough
      const dx = member.x - creature.x;
      const dy = member.y - creature.y;
      if (dx * dx + dy * dy < 150 * 150) {
        ctx.beginPath();
        ctx.moveTo(creature.x, creature.y);
        ctx.lineTo(member.x, member.y);
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Get relationship description for UI
   */
  getRelationshipDescription(creatureId) {
    const data = this.relationships.get(creatureId);
    if (!data) return 'No relationships';

    const parts = [];

    if (data.parents.length > 0) parts.push(`${data.parents.length} parents`);
    if (data.siblings.length > 0) parts.push(`${data.siblings.length} siblings`);
    if (data.children.length > 0) parts.push(`${data.children.length} children`);
    if (data.friends.length > 0) parts.push(`${data.friends.length} friends`);
    if (data.rivals.length > 0) parts.push(`${data.rivals.length} rivals`);
    if (data.mate) parts.push('mated');

    return parts.join(', ') || 'Solitary';
  }

  /**
   * Clean up dead creature relationships
   */
  cleanup(world) {
    const aliveIds = new Set(world.creatures.map(c => c.id));

    // Remove relationships for dead creatures
    for (const [id, data] of this.relationships.entries()) {
      if (!aliveIds.has(id)) {
        this.relationships.delete(id);

        // Remove from family
        if (data.familyId) {
          const family = this.families.get(data.familyId);
          if (family) {
            family.members = family.members.filter(memberId => memberId !== id);

            // Remove empty families
            if (family.members.length === 0) {
              this.families.delete(data.familyId);
            }
          }
        }
      }
    }

    // Remove bonds with dead creatures
    for (const [bondId, bond] of this.bonds.entries()) {
      const allAlive = bond.creatures.every(id => aliveIds.has(id));
      if (!allAlive) {
        this.bonds.delete(bondId);
      }
    }
  }
}

export const familyBondsSystem = new FamilyBondsSystem();
