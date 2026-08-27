// Skill: lutar com estratégia — engaja a ameaça hostil mais próxima em vez
// de fugir, mas aborta e deixa o reflexo assumir (fuga) se a vida cair
// demais no meio da luta. É isso que separa "lutar com estratégia" de só
// avançar cegamente: tem uma condição de saída.

const { Movements, goals } = require('mineflayer-pathfinder')
const mcDataLoader = require('minecraft-data')
const blackboard = require('../state/blackboard.js')
const { nearestHostile } = require('../state/validators/threat.js')
const status = require('../state/validators/status.js')
const chatThrottle = require('../core/chatThrottle.js')

const FIGHT_RADIUS = 20
const ATTACK_INTERVAL_MS = 700
const MAX_ATTACKS = 20

async function fight(bot) {
  const target = nearestHostile(bot)
  const inRange = target && bot.entity.position.distanceTo(target.position) <= FIGHT_RADIUS

  blackboard.set('last_action', {
    name: 'fight',
    expected: { found: !!inRange },
    startedAt: Date.now(),
  })

  if (!inRange) {
    chatThrottle.say(bot, 'Não tem nenhuma ameaça por perto pra enfrentar.')
    return false
  }

  const mcData = mcDataLoader(bot.version)
  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
  await bot.pathfinder.goto(new goals.GoalFollow(target, 2))

  for (let i = 0; i < MAX_ATTACKS; i++) {
    if (!target.isValid) break

    if (status.isHealthCritical()) {
      chatThrottle.say(bot, 'Recuando da luta, vida crítica demais pra continuar.')
      break
    }

    bot.attack(target)
    await new Promise((resolve) => setTimeout(resolve, ATTACK_INTERVAL_MS))
  }

  chatThrottle.say(bot, 'Luta terminada.')
  return true
}

module.exports = fight
