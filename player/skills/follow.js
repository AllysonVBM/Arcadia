// Skill: seguir um jogador. GoalFollow (não GoalNear) porque acompanha a
// entidade continuamente — GoalNear mirava só na posição capturada no
// instante do comando, virando um ponto parado assim que o alvo se movia.

const mcDataLoader = require('minecraft-data')
const { Movements } = require('mineflayer-pathfinder')
const { GoalFollow } = require('mineflayer-pathfinder').goals
const blackboard = require('../state/blackboard.js')

function follow(bot, username) {
  const target = bot.players[username]

  if (!target || !target.entity) {
    bot.chat('Você está muito longe, não consigo te ver!')
    return false
  }

  blackboard.set('last_action', {
    name: 'follow',
    expected: { targetVisible: true },
    startedAt: Date.now(),
  })

  const mcData = mcDataLoader(bot.version)
  const movements = new Movements(bot, mcData)
  movements.scafoldingBlocks = []

  bot.pathfinder.setMovements(movements)
  bot.pathfinder.setGoal(new GoalFollow(target.entity, 1), true)
  return true
}

module.exports = follow
