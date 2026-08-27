// Evita poluir o chat repetindo a mesma mensagem toda hora. As skills
// continuam falando normalmente — só a mesma frase exata, vinda do mesmo
// processo, não repete antes do cooldown passar. Mensagem diferente (ou a
// fala livre que a LLM gera via "message") nunca é bloqueada por isso.

const lastSent = new Map() // texto da mensagem -> timestamp do último envio

const COOLDOWN_MS = 60000 // 1 minuto

function say(bot, message) {
  const last = lastSent.get(message)
  const now = Date.now()

  if (last && now - last < COOLDOWN_MS) return false

  lastSent.set(message, now)
  bot.chat(message)
  return true
}

module.exports = { say }
