// Skill: oferecer ensinar uma skill a outro agente/jogador, por um preço
// que a própria LLM decide. A oferta em si é só uma mensagem de chat num
// formato fixo (!teach <skill> <preço> <destinatário>) — a transação (quem
// aceita, quem paga, quem aprende) é 100% determinística, tratada em
// connect.js quando a mensagem chega no outro lado. Isso existe porque não
// há canal nenhum entre os processos além do chat do jogo — dois agentes
// nunca compartilham estado diretamente.

const skills = require('../memory/skills.js')
const chatThrottle = require('../core/chatThrottle.js')

function teach(bot, skillName, price, toUsername) {
  if (!skills.knowsSkill(bot.username, skillName)) {
    chatThrottle.say(bot, `Ainda não sei ${skillName} o suficiente pra ensinar.`)
    return false
  }

  // A oferta em si nunca é suprimida pelo throttle — é uma tentativa de
  // transação de verdade, não um lamento repetido.
  bot.chat(`!teach ${skillName} ${price} ${toUsername}`)
  return true
}

module.exports = teach
