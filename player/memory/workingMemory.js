// Placeholder mínimo da Fase 3 (Memory) do roteiro — só o suficiente pra dar
// contexto recente ao Cognitive Controller. Memória de curto/longo prazo
// com persistência ainda não existe; isso aqui é só um buffer circular em
// RAM, guardado dentro do próprio Agent State sob a chave 'memory.working'.

const blackboard = require('../state/blackboard.js')

const MAX_EVENTS = 10

function remember(who, text) {
  const working = blackboard.get('memory.working') || []
  working.push({ who, text, at: Date.now() })

  if (working.length > MAX_EVENTS) working.shift()

  blackboard.set('memory.working', working)
}

module.exports = { remember }
