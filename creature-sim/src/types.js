/**
 * Shared JSDoc typedefs for editor intellisense.
 */

/**
 * @typedef {Object} SaveCreature
 * @property {number} id
 * @property {number|null} parentId
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} dir
 * @property {number} energy
 * @property {number} age
 * @property {number} health
 * @property {number} maxHealth
 * @property {boolean} alive
 * @property {number|null} deathTime
 * @property {string|null} deathCause
 * @property {number|string|null} killedBy
 * @property {Object} genes
 * @property {Object} stats
 * @property {Object|null} emotions
 * @property {Object|null} intelligence
 * @property {Object|null} sexuality
 * @property {Object|null} migration
 */

/**
 * @typedef {Object} SaveFood
 * @property {number} x
 * @property {number} y
 * @property {number} energy
 */

/**
 * @typedef {Object} SaveCorpse
 * @property {number} x
 * @property {number} y
 * @property {number} energy
 * @property {number} age
 * @property {boolean} isPredator
 */

/**
 * @typedef {Object} SaveWorld
 * @property {number} width
 * @property {number} height
 * @property {number} t
 * @property {number} seasonPhase
 * @property {number} _nextId
 * @property {number} timeOfDay
 * @property {number} dayLength
 * @property {SaveCreature[]} creatures
 * @property {SaveFood[]} food
 * @property {SaveCorpse[]} corpses
 * @property {{parentId:number, childIds:number[]}[]} childrenOf
 * @property {number} biomeSeed
 * @property {Object|null} activeDisaster
 * @property {number} disasterDuration
 * @property {number} disasterIntensity
 */

/**
 * @typedef {Object} SaveCamera
 * @property {number} x
 * @property {number} y
 * @property {number} zoom
 * @property {string} followMode
 * @property {number|null} followTarget
 * @property {number} viewportWidth
 * @property {number} viewportHeight
 */

/**
 * @typedef {Object} SaveAnalytics
 * @property {Object[]} dataPoints
 * @property {number} totalGenerations
 */

/**
 * @typedef {Object} SaveData
 * @property {string} version
 * @property {number} timestamp
 * @property {string} savedAt
 * @property {SaveWorld} world
 * @property {SaveCamera} camera
 * @property {SaveAnalytics|null} analytics
 * @property {Array<[number,string]>} lineageNames
 * @property {Object} metadata
 */

export {};
