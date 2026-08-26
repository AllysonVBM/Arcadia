const blackboard = require('../state/blackboard.js')

function agentHealth(bot) {
  blackboard.set('health', bot.health) // 0-20
  blackboard.set('hunger', bot.food)   // 0-20
}

module.exports = agentHealth
