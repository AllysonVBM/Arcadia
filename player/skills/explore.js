// Skill: explorar — anda numa direção aleatória por uma distância. Não
// busca nada específico; é o que dá ao agente chance de descobrir recursos
// novos (bot.findBlock só acha o que já está em chunks carregados).

const mcDataLoader = require('minecraft-data')
const { Movements, goals } = require('mineflayer-pathfinder')
const blackboard = require('../state/blackboard.js')

const EXPLORE_DISTANCE = 24

function explore(bot) {
  const angle = Math.random() * Math.PI * 2
  const origin = bot.entity.position
  const targetX = origin.x + Math.cos(angle) * EXPLORE_DISTANCE
  const targetZ = origin.z + Math.sin(angle) * EXPLORE_DISTANCE

  blackboard.set('last_action', {
    name: 'explore',
    expected: { x: targetX, z: targetZ },
    startedAt: Date.now(),
  })

  const mcData = mcDataLoader(bot.version)
  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
  bot.pathfinder.setGoal(new goals.GoalXZ(targetX, targetZ))
}

module.exports = explore
