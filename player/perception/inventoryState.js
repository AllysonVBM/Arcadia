const blackboard = require('../state/blackboard.js')

function inventoryState(bot) {
  const items = bot.inventory.items()
  blackboard.set('inventory', items)
  return items
}

module.exports = inventoryState
