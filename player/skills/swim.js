// Skill: nadar — vai deliberadamente até a água mais próxima e atravessa.
// Não afeta o comportamento das outras skills (elas continuam evitando
// água pelo custo padrão do Movements) — é só a ação explícita de nadar,
// não uma mudança geral de política de movimento.

const mcDataLoader = require('minecraft-data')
const { Movements, goals } = require('mineflayer-pathfinder')
const blackboard = require('../state/blackboard.js')

const WATER_SEARCH_RADIUS = 32

async function swim(bot) {
  const mcData = mcDataLoader(bot.version)
  const waterType = mcData.blocksByName.water
  const waterBlock = waterType ? bot.findBlock({ matching: waterType.id, maxDistance: WATER_SEARCH_RADIUS }) : null

  blackboard.set('last_action', {
    name: 'swim',
    expected: { found: !!waterBlock },
    startedAt: Date.now(),
  })

  if (!waterBlock) {
    bot.chat('Não encontrei água por perto pra nadar.')
    return false
  }

  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
  await bot.pathfinder.goto(new goals.GoalNear(waterBlock.position.x, waterBlock.position.y, waterBlock.position.z, 1))

  bot.chat('Nadei até a água.')
  return true
}

module.exports = swim
