import { eventSystem } from '../event-system.js';
import { ScenarioRegistry } from './scenario-registry.js';
import { ObjectiveSystem } from './objective-system.js';
import { ProgressionSystem } from './progression-system.js';
import { StoryDirector } from './story-director.js';
import { GodToolSystem } from './god-tool-system.js';

export const GameDirectorEvents = Object.freeze({
  UPDATED: 'game-director:updated',
  SCENARIO_STARTED: 'game-director:scenario-started',
  MODE_CHANGED: 'game-director:mode-changed'
});

export class GameDirector {
  constructor({
    world = null,
    playableScenarios = null,
    sessionGoals = null,
    challengeSystem = null,
    achievements = null,
    unlockableAchievements = null,
    scenarioRegistry = new ScenarioRegistry(),
    objectiveSystem = new ObjectiveSystem(),
    progressionSystem = new ProgressionSystem(),
    storyDirector = null,
    godToolSystem = null
  } = {}) {
    this.world = world;
    this.playableScenarios = playableScenarios;
    this.sessionGoals = sessionGoals;
    this.challengeSystem = challengeSystem;
    this.achievements = achievements;
    this.unlockableAchievements = unlockableAchievements;
    this.scenarioRegistry = scenarioRegistry;
    this.objectiveSystem = objectiveSystem;
    this.progressionSystem = progressionSystem;
    this.storyDirector = storyDirector || new StoryDirector({ world });
    this.godToolSystem = godToolSystem || new GodToolSystem();
    this.mode = 'sandbox';
    this.lastSnapshot = this.buildSnapshot();
    this.updateTimer = 0;
  }

  startScenario(id, options = {}) {
    const snapshot = this.playableScenarios?.startScenario?.(id, options) || null;
    this.mode = snapshot?.active ? 'scenario' : 'sandbox';
    this.update(1, { force: true });
    eventSystem.emit(GameDirectorEvents.SCENARIO_STARTED, {
      id: snapshot?.scenario?.id || id,
      snapshot: this.lastSnapshot
    });
    return this.lastSnapshot;
  }

  setMode(mode = 'sandbox') {
    this.mode = mode;
    eventSystem.emit(GameDirectorEvents.MODE_CHANGED, { mode });
  }

  update(dt = 0, { force = false } = {}) {
    this.updateTimer += dt;
    if (!force && this.updateTimer < 0.45) return this.lastSnapshot;
    this.updateTimer = 0;

    this.lastSnapshot = this.buildSnapshot();
    this.progressionSystem?.update?.({
      world: this.world,
      playable: this.lastSnapshot.playable,
      challengeSystem: this.challengeSystem,
      achievements: this.achievements,
      unlockableAchievements: this.unlockableAchievements,
      objectiveSnapshot: this.lastSnapshot.objectives
    });
    this.storyDirector?.update?.(this.world, this.lastSnapshot.playable, this.lastSnapshot.objectives);
    this.lastSnapshot = this.buildSnapshot();
    eventSystem.emit(GameDirectorEvents.UPDATED, this.lastSnapshot, { throwOnError: false });
    return this.lastSnapshot;
  }

  buildSnapshot() {
    const playable = this.playableScenarios?.getSnapshot?.() || null;
    const activeScenarioId = playable?.scenario?.id || null;
    const scenarioObjectives = activeScenarioId ? this.scenarioRegistry.getObjectives(activeScenarioId) : [];
    const sessionGoals = this.sessionGoals?.getGoals?.() || [];
    const objectiveSource = sessionGoals.length ? sessionGoals : scenarioObjectives;
    const objectives = this.objectiveSystem.evaluate(
      this.world,
      objectiveSource,
      this.sessionGoals?.serialize?.()?.counters || {},
      { elapsed: playable?.elapsed }
    );

    return {
      mode: playable?.active ? 'scenario' : this.mode || 'sandbox',
      playable,
      scenarios: this.scenarioRegistry.toOptions(this.playableScenarios?.progress || {}),
      objectives,
      progression: this.progressionSystem?.getSnapshot?.() || null,
      story: this.storyDirector?.getSnapshot?.() || null,
      tools: this.godToolSystem?.getSnapshot?.({ progression: this.progressionSystem }) || null
    };
  }

  getSnapshot() {
    return this.lastSnapshot || this.buildSnapshot();
  }

  serialize() {
    return {
      mode: this.mode,
      progression: this.progressionSystem?.serialize?.() || null,
      story: this.storyDirector?.serialize?.() || null,
      tools: this.godToolSystem?.serialize?.() || null
    };
  }

  restore(data = {}) {
    if (!data || typeof data !== 'object') return false;
    if (data.mode) this.mode = data.mode;
    if (data.progression) this.progressionSystem?.restore?.(data.progression);
    if (data.story) this.storyDirector?.restore?.(data.story);
    if (data.tools) this.godToolSystem?.restore?.(data.tools);
    this.update(1, { force: true });
    return true;
  }
}
