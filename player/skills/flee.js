// Skill: fugir. Grava a expectativa no Agent State antes de agir (convenção
// que o Action Awareness, mais pra frente, vai usar pra comparar com o que
// realmente aconteceu) e usa o pathfinder pra se afastar da ameaça mais
// próxima — ou, na ausência de uma, de qualquer direção, só pra sair do lugar.

const mcDataLoader = require('minecraft-data')
const { Movements } = require('mineflayer-pathfinder')
const { GoalXZ } = require('mineflayer-pathfinder').goals
const blackboard = require('../state/blackboard.js')
const { nearestHostile } = require('../state/validators/threat.js')

const FLEE_DISTANCE = 8

function flee(bot) {
  try {
    const threat = nearestHostile(bot)

    blackboard.set('last_action', {
      name: 'flee',
      expected: threat
        ? { distanceFromThreat: FLEE_DISTANCE }
        : { movedAway: true },
      startedAt: Date.now(),
    })

    const mcData = mcDataLoader(bot.version)
    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)

    const origin = bot.entity.position
    let dx, dz

    if (threat) {
      dx = origin.x - threat.position.x
      dz = origin.z - threat.position.z
    } else {
      // Sem ameaça identificada: não há de quê fugir de verdade, então só
      // sai do lugar numa direção aleatória.
      dx = Math.random() - 0.5
      dz = Math.random() - 0.5
    }

    const length = Math.hypot(dx, dz) || 1
    const targetX = origin.x + (dx / length) * FLEE_DISTANCE
    const targetZ = origin.z + (dz / length) * FLEE_DISTANCE

    bot.pathfinder.setGoal(new GoalXZ(targetX, targetZ))
  } catch (err) {
    console.error('[skills/flee] falhou:', err.message)
  }
}

module.exports = flee
