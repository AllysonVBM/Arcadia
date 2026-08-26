// Output: o único ponto que traduz uma decisão em fala + ação no jogo. Só
// reage ao current_intent mais recente do Agent State — nunca gera fala e
// ação a partir de fontes diferentes. É essa disciplina que evita o agente
// dizer uma coisa e fazer outra (Passo 6 do PIANO).

const blackboard = require('../state/blackboard.js')
const flee = require('../skills/flee.js')
const eat = require('../skills/eat.js')
const follow = require('../skills/follow.js')

function dispatchIntent(bot) {
  const intent = blackboard.get('current_intent')
  if (!intent) return

  if (intent.message) {
    bot.chat(intent.message)
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
    case 'idle':
    default:
      break
  }
}

module.exports = dispatchIntent
