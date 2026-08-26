// Skill: craftar um item. Tenta primeiro sem mesa de trabalho (grid 2x2 do
// inventário); se a receita exigir mesa, procura uma por perto e usa.

const mcDataLoader = require('minecraft-data')
const { Movements, goals } = require('mineflayer-pathfinder')
const blackboard = require('../state/blackboard.js')

const TABLE_SEARCH_RADIUS = 32

async function craftItem(bot, itemName, count = 1) {
  const mcData = mcDataLoader(bot.version)
  const item = mcData.itemsByName[itemName]

  blackboard.set('last_action', {
    name: 'craft',
    expected: { itemName, count, found: !!item },
    startedAt: Date.now(),
  })

  if (!item) {
    bot.chat(`Não conheço um item chamado "${itemName}".`)
    return false
  }

  let recipes = bot.recipesFor(item.id, null, 1, null)
  let craftingTableBlock = null

  if (recipes.length === 0) {
    const tableType = mcData.blocksByName.crafting_table
    craftingTableBlock = tableType ? bot.findBlock({ matching: tableType.id, maxDistance: TABLE_SEARCH_RADIUS }) : null

    if (craftingTableBlock) {
      const movements = new Movements(bot, mcData)
      bot.pathfinder.setMovements(movements)
      await bot.pathfinder.goto(new goals.GoalLookAtBlock(craftingTableBlock.position, bot.world))
      recipes = bot.recipesFor(item.id, null, 1, craftingTableBlock)
    }
  }

  if (recipes.length === 0) {
    bot.chat(`Não tenho os materiais (ou mesa de trabalho) pra craftar ${itemName}.`)
    return false
  }

  await bot.craft(recipes[0], count, craftingTableBlock)
  bot.chat(`Craftei ${itemName}.`)
  return true
}

module.exports = craftItem
