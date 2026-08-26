// Output: o único ponto que traduz uma decisão em fala + ação no jogo. Só
// reage ao current_intent mais recente do Agent State — nunca gera fala e
// ação a partir de fontes diferentes. É essa disciplina que evita o agente
// dizer uma coisa e fazer outra (Passo 6 do PIANO).
//
// Sobrevivência como prioridade máxima: se o reflexo estiver com a trava
// ativa (reflexLock), uma decisão do Controller que mexeria em movimento
// é ignorada nesse ciclo — fala ainda passa, porque não interfere fisicamente.

const blackboard = require('../state/blackboard.js')
const reflexLock = require('../state/reflexLock.js')
const flee = require('../skills/flee.js')
const eat = require('../skills/eat.js')
const follow = require('../skills/follow.js')
const mine = require('../skills/mine.js')
const craftItem = require('../skills/craftItem.js')
const placeBlock = require('../skills/placeBlock.js')
const cookItem = require('../skills/cookItem.js')
const explore = require('../skills/explore.js')

const MOVEMENT_ACTIONS = new Set(['flee', 'eat', 'follow', 'mine', 'craft', 'place', 'cook', 'explore'])

function dispatchIntent(bot) {
  const intent = blackboard.get('current_intent')
  if (!intent) return

  if (intent.message) {
    bot.chat(intent.message)
  }

  if (reflexLock.isActive() && MOVEMENT_ACTIONS.has(intent.action)) {
    console.log(`[output] reflexo em sobrevivência, ignorando decisão do Controller: ${intent.action}`)
    return
  }

  switch (intent.action) {
    case 'flee':
      flee(bot)
      break
    case 'eat':
      eat(bot).catch((err) => console.error('[output] falha ao comer:', err.message))
      break
    case 'follow':
      if (intent.target) follow(bot, intent.target)
      break
    case 'mine':
      if (intent.target) mine(bot, intent.target).catch((err) => console.error('[output] falha ao minerar:', err.message))
      break
    case 'craft':
      if (intent.target) craftItem(bot, intent.target).catch((err) => console.error('[output] falha ao craftar:', err.message))
      break
    case 'place':
      if (intent.target) placeBlock(bot, intent.target).catch((err) => console.error('[output] falha ao construir:', err.message))
      break
    case 'cook':
      if (intent.target) cookItem(bot, intent.target).catch((err) => console.error('[output] falha ao cozinhar:', err.message))
      break
    case 'explore':
      explore(bot)
      break
    case 'idle':
    default:
      // 'idle' precisa de fato parar o bot — sem isso, um goal de
      // movimento de uma decisão anterior (ex.: follow) continuava rodando
      // pra sempre, porque nada nunca cancelava.
      if (bot.pathfinder) bot.pathfinder.setGoal(null)
      break
  }
}

module.exports = dispatchIntent
