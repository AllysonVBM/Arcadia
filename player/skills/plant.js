// Skill: plantar — usa uma semente/muda do inventário numa terra arável já
// existente por perto. Não sabe preparar terra (precisaria de enxada +
// mecânica de tilling, ainda não implementada) — só planta onde já há
// farmland pronto.

const Vec3 = require('vec3')
const mcDataLoader = require('minecraft-data')
const { Movements, goals } = require('mineflayer-pathfinder')
const blackboard = require('../state/blackboard.js')
const chatThrottle = require('../core/chatThrottle.js')

const PLANTABLE = ['wheat_seeds', 'beetroot_seeds', 'melon_seeds', 'pumpkin_seeds', 'carrot', 'potato']
const FARMLAND_SEARCH_RADIUS = 24

async function plant(bot) {
  const seed = bot.inventory.items().find((item) => PLANTABLE.includes(item.name))

  blackboard.set('last_action', {
    name: 'plant',
    expected: { hasSeed: !!seed },
    startedAt: Date.now(),
  })

  if (!seed) {
    chatThrottle.say(bot, 'Não tenho nenhuma semente pra plantar.')
    return false
  }

  const mcData = mcDataLoader(bot.version)
  const farmlandType = mcData.blocksByName.farmland
  const farmland = farmlandType
    ? bot.findBlock({ matching: farmlandType.id, maxDistance: FARMLAND_SEARCH_RADIUS })
    : null

  if (!farmland) {
    chatThrottle.say(bot, 'Não achei terra arável por perto pra plantar.')
    return false
  }

  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
  await bot.pathfinder.goto(new goals.GoalLookAtBlock(farmland.position, bot.world))

  await bot.equip(seed, 'hand')
  await bot.placeBlock(farmland, new Vec3(0, 1, 0))

  chatThrottle.say(bot, `Plantei ${seed.name}.`)
  return true
}

module.exports = plant
