// Skill: craftar um item. Tenta primeiro sem mesa de trabalho (grid 2x2 do
// inventário); se a receita exigir mesa e não houver uma por perto, e o
// agente já souber colocar blocos (place), tenta se virar sozinho: crafta
// uma mesa (2x2, não precisa de mesa pra isso) e coloca. Isso não ignora o
// sistema de conhecimento — só encadeia skills que o agente já tem.

const Vec3 = require('vec3')
const mcDataLoader = require('minecraft-data')
const { Movements, goals } = require('mineflayer-pathfinder')
const blackboard = require('../state/blackboard.js')
const skills = require('../memory/skills.js')

const TABLE_SEARCH_RADIUS = 32

async function tryMakeCraftingTable(bot, mcData) {
  let tableItem = bot.inventory.items().find((i) => i.name === 'crafting_table')

  if (!tableItem) {
    const tableItemType = mcData.itemsByName.crafting_table
    const tableRecipes = bot.recipesFor(tableItemType.id, null, 1, null)
    if (tableRecipes.length === 0) return null // sem planks suficientes pra fazer uma

    await bot.craft(tableRecipes[0], 1, null)
    tableItem = bot.inventory.items().find((i) => i.name === 'crafting_table')
    if (!tableItem) return null
  }

  const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0))
  if (!referenceBlock) return null

  await bot.equip(tableItem, 'hand')
  await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0))

  const tableType = mcData.blocksByName.crafting_table
  return bot.findBlock({ matching: tableType.id, maxDistance: 5 })
}

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

    if (!craftingTableBlock && skills.knowsSkill(bot.username, 'place')) {
      craftingTableBlock = await tryMakeCraftingTable(bot, mcData)
    }

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
