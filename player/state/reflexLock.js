// Trava de sobrevivência: enquanto ativa, o Output (core/output.js) ignora
// qualquer decisão do Cognitive Controller que mexa em movimento/ação
// física — flee/eat/follow. É isso que torna "não morrer" uma prioridade
// de verdade, não só uma instrução no prompt: o reflexo nunca fica exposto
// a ser sobrescrito pelo Controller no meio de uma ação de sobrevivência.

const blackboard = require('./blackboard.js')

function acquire(durationMs) {
  blackboard.set('reflex_active', { until: Date.now() + durationMs })
}

function isActive() {
  const lock = blackboard.get('reflex_active')
  if (!lock) return false
  return Date.now() < lock.until
}

function release() {
  blackboard.set('reflex_active', null)
}

module.exports = { acquire, isActive, release }
