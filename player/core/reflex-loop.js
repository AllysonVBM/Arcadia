// Camada reflexa: heurísticas locais, sem LLM. Consome os validadores que
// leem o Agent State (blackboard) e decide ações imediatas de sobrevivência.
// Roda em paralelo ao Cognitive Controller e nunca espera por ele — é o
// princípio de concorrência do PIANO. Cada ação de sobrevivência adquire a
// trava (reflexLock) pra impedir que o Controller a sobrescreva no meio —
// e também pra não repetir a mesma fala/ação a cada tick de vida/fome
// enquanto a condição continuar verdadeira (sem isso, spamma chat).

const status = require('../state/validators/status.js')
const { hasHostileNearby } = require('../state/validators/threat.js')
const reflexLock = require('../state/reflexLock.js')
const flee = require('../skills/flee.js')
const eat = require('../skills/eat.js')

const FLEE_LOCK_MS = 6000 // tempo estimado pra se afastar de verdade
const EAT_LOCK_MS = 10000 // também segura o "não tenho comida" — sem isso repetia a cada tick de fome

function reflexTick(bot) {
  if (reflexLock.isActive()) return // já está fugindo/comendo, não repete fala nem ação

  const healthCritical = status.isHealthCritical()
  const hungry = status.isHungry()

  // Vida crítica sem ameaça ativa por perto: comer é a prioridade, porque é
  // isso que resolve a causa (fome), e não há motivo pra fugir de nada.
  if (healthCritical && hungry && !hasHostileNearby(bot)) {
    bot.chat('Vida crítica e com fome, comendo antes de continuar.')
    reflexLock.acquire(EAT_LOCK_MS)
    eat(bot).catch((err) => console.error('[reflex] falha ao comer:', err.message))
    return
  }

  if (healthCritical) {
    bot.chat('Vida crítica, recuando!')
    reflexLock.acquire(FLEE_LOCK_MS)
    flee(bot)
    return
  }

  if (hungry) {
    bot.chat('Estou com fome, procurando comida.')
    reflexLock.acquire(EAT_LOCK_MS)
    eat(bot).catch((err) => console.error('[reflex] falha ao comer:', err.message))
    return
  }
}

module.exports = reflexTick
