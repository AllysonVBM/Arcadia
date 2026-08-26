// Skill: ir até uma coordenada. Usada hoje só pra levar o agente até a
// área de spawn do cenário ativo, mas é genérica — qualquer outra skill
// futura que precise "andar até (x,y,z)" pode reusar essa em vez de
// duplicar a configuração de Movements.

const mcDataLoader = require('minecraft-data')
const { Movements } = require('mineflayer-pathfinder')
const { GoalNear } = require('mineflayer-pathfinder').goals
const blackboard = require('../state/blackboard.js')

function goTo(bot, { x, y, z }, range = 2) {
  blackboard.set('last_action', {
    name: 'goTo',
    expected: { x, y, z, range },
    startedAt: Date.now(),
  })

  const mcData = mcDataLoader(bot.version)
  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
  bot.pathfinder.setGoal(new GoalNear(x, y, z, range))
}

module.exports = goTo
