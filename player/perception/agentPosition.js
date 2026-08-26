// player/perception/agentPosition.js
const blackboard = require('../state/blackboard.js')

function agentPosition(bot) {
  const position = {
    x: Math.floor(bot.entity.position.x),
    y: Math.floor(bot.entity.position.y),
    z: Math.floor(bot.entity.position.z),
  }

  const previous = blackboard.get('position')

  const changed = !previous ||
    position.x !== previous.x ||
    position.y !== previous.y ||
    position.z !== previous.z

  if (!changed) return null

  blackboard.set('position', position)
  return position
}

module.exports = agentPosition