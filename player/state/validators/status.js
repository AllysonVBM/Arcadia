// Validadores: funções puras que leem o blackboard e devolvem um veredito.
// Nunca tocam no bot e nunca escrevem no blackboard — só interpretam o que
// a percepção já gravou. Ordem fixa em cada validador: existe? está
// fresco? tem o tipo certo? só então aplica a regra de negócio.

const blackboard = require('../blackboard.js')

const HEALTH_CRITICAL = 6 // de 20
const HUNGER_LOW = 6      // de 20
const STALE_MS = 5000     // dado com mais de 5s é considerado desatualizado

function isFresh(key) {
  const entry = blackboard.getEntry(key)
  if (!entry) return false
  return (Date.now() - entry.updatedAt) < STALE_MS
}

function isValidNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value)
}

function isHealthCritical() {
  if (!isFresh('health')) return false
  const health = blackboard.get('health')
  if (!isValidNumber(health)) return false
  return health <= HEALTH_CRITICAL
}

function isHungry() {
  if (!isFresh('hunger')) return false
  const hunger = blackboard.get('hunger')
  if (!isValidNumber(hunger)) return false
  return hunger <= HUNGER_LOW
}

module.exports = { isHealthCritical, isHungry, isFresh, isValidNumber }
