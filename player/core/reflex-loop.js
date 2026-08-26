// Camada reflexa: heurísticas locais, sem LLM. Consome os validadores que
// leem o Agent State (blackboard) e decide ações imediatas de sobrevivência.
// Roda em paralelo ao Cognitive Controller (ainda não implementado) e nunca
// espera por ele — é o princípio de concorrência do PIANO: reflexo reage
// rápido enquanto algo mais lento (a LLM) ainda pensa.

const status = require('../state/validators/status.js')
const { hasHostileNearby } = require('../state/validators/threat.js')
const flee = require('../skills/flee.js')
const eat = require('../skills/eat.js')

function reflexTick(bot) {
  const healthCritical = status.isHealthCritical()
  const hungry = status.isHungry()

  // Vida crítica sem ameaça ativa por perto: comer é a prioridade, porque é
  // isso que resolve a causa (fome), e não há motivo pra fugir de nada.
  if (healthCritical && hungry && !hasHostileNearby(bot)) {
    bot.chat('Vida crítica e com fome, comendo antes de continuar.')
    eat(bot).catch((err) => console.error('[reflex] falha ao comer:', err.message))
    return
  }

  if (healthCritical) {
    bot.chat('Vida crítica, recuando!')
    flee(bot)
    return
  }

  if (hungry) {
    bot.chat('Estou com fome, procurando comida.')
    eat(bot).catch((err) => console.error('[reflex] falha ao comer:', err.message))
    return
  }
}

module.exports = reflexTick
