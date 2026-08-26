// Skill: oferecer ensinar uma skill a outro agente/jogador, por um preço
// que a própria LLM decide. A oferta em si é só uma mensagem de chat num
// formato fixo (!teach <skill> <preço> <destinatário>) — a transação (quem
// aceita, quem paga, quem aprende) é 100% determinística, tratada em
// connect.js quando a mensagem chega no outro lado. Isso existe porque não
// há canal nenhum entre os processos além do chat do jogo — dois agentes
// nunca compartilham estado diretamente.

const skills = require('../memory/skills.js')

function teach(bot, skillName, price, toUsername) {
  if (!skills.knowsSkill(bot.username, skillName)) {
    bot.chat(`Ainda não sei ${skillName} o suficiente pra ensinar.`)
    return false
  }

  bot.chat(`!teach ${skillName} ${price} ${toUsername}`)
  return true
}

module.exports = teach
