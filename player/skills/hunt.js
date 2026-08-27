// Skill: caçar — ataca o animal mais próximo até derrubar. O drop (carne
// crua) é recolhido automaticamente pelo mineflayer, sem ação extra.

const { Movements, goals } = require('mineflayer-pathfinder')
const mcDataLoader = require('minecraft-data')
const blackboard = require('../state/blackboard.js')
const chatThrottle = require('../core/chatThrottle.js')

const HUNT_RADIUS = 32
const ATTACK_INTERVAL_MS = 700 // respeita o cooldown de ataque do jogo
const MAX_ATTACKS = 20 // rede de segurança — não persegue pra sempre

function isHuntable(entity) {
  return entity.kind === 'Passive mobs' && entity.type === 'animal'
}

async function hunt(bot) {
  const candidate = bot.nearestEntity(isHuntable)
  const target = candidate && bot.entity.position.distanceTo(candidate.position) <= HUNT_RADIUS ? candidate : null

  blackboard.set('last_action', {
    name: 'hunt',
    expected: { found: !!target },
    startedAt: Date.now(),
  })

  if (!target) {
    chatThrottle.say(bot, 'Não achei nenhum animal por perto pra caçar.')
    return false
  }

  const mcData = mcDataLoader(bot.version)
  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
  await bot.pathfinder.goto(new goals.GoalFollow(target, 2))

  for (let i = 0; i < MAX_ATTACKS; i++) {
    if (!target.isValid) break
    bot.attack(target)
    await new Promise((resolve) => setTimeout(resolve, ATTACK_INTERVAL_MS))
  }

  chatThrottle.say(bot, 'Caçada terminada.')
  return true
}

module.exports = hunt
