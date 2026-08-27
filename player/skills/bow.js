// Skill: atirar com arco — exige arco e pelo menos uma flecha no
// inventário. Mira na ameaça hostil mais próxima, puxa a corda, solta.

const blackboard = require('../state/blackboard.js')
const { nearestHostile } = require('../state/validators/threat.js')
const chatThrottle = require('../core/chatThrottle.js')

const BOW_RADIUS = 24
const DRAW_TIME_MS = 1000

async function bow(bot) {
  const bowItem = bot.inventory.items().find((item) => item.name === 'bow')
  const hasArrow = bot.inventory.items().some((item) => item.name === 'arrow')

  // Checa inventário antes de consultar entidades próximas — mais barato, e
  // evita depender de bot.nearestEntity quando já vai falhar por outro motivo.
  if (!bowItem) {
    blackboard.set('last_action', { name: 'bow', expected: { hasBow: false }, startedAt: Date.now() })
    chatThrottle.say(bot, 'Não tenho um arco no inventário.')
    return false
  }

  if (!hasArrow) {
    blackboard.set('last_action', { name: 'bow', expected: { hasBow: true, hasArrow: false }, startedAt: Date.now() })
    chatThrottle.say(bot, 'Tenho arco, mas não tenho flechas.')
    return false
  }

  const target = nearestHostile(bot)
  const inRange = target && bot.entity.position.distanceTo(target.position) <= BOW_RADIUS

  blackboard.set('last_action', {
    name: 'bow',
    expected: { hasBow: true, hasArrow: true, found: !!inRange },
    startedAt: Date.now(),
  })

  if (!inRange) {
    chatThrottle.say(bot, 'Não tem nenhuma ameaça à vista pra atirar.')
    return false
  }

  await bot.equip(bowItem, 'hand')
  await bot.lookAt(target.position.offset(0, target.height ?? 1, 0))
  bot.activateItem()
  await new Promise((resolve) => setTimeout(resolve, DRAW_TIME_MS))
  bot.deactivateItem()

  chatThrottle.say(bot, 'Atirei uma flecha.')
  return true
}

module.exports = bow
