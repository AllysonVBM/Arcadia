// Skill: cozinhar num forno. Exige combustível e o item cru já no
// inventário, e um forno por perto — não minera nem crafta nada sozinha,
// só faz a etapa de cozimento em si.

const mcDataLoader = require('minecraft-data')
const { Movements, goals } = require('mineflayer-pathfinder')
const blackboard = require('../state/blackboard.js')

const FURNACE_SEARCH_RADIUS = 32
const SMELT_WAIT_MS = 12000 // um smelt vanilla leva ~10s; folga de segurança
const FUEL_NAMES = ['coal', 'charcoal', 'oak_planks', 'stick']

async function cookItem(bot, itemName) {
  const mcData = mcDataLoader(bot.version)
  const inputItem = mcData.itemsByName[itemName]

  blackboard.set('last_action', {
    name: 'cook',
    expected: { itemName },
    startedAt: Date.now(),
  })

  if (!inputItem) {
    bot.chat(`Não conheço um item chamado "${itemName}".`)
    return false
  }

  const hasInput = bot.inventory.items().some((i) => i.name === itemName)
  if (!hasInput) {
    bot.chat(`Não tenho ${itemName} pra cozinhar.`)
    return false
  }

  const fuel = bot.inventory.items().find((i) => FUEL_NAMES.includes(i.name))
  if (!fuel) {
    bot.chat('Não tenho combustível (carvão, madeira...) pra acender o forno.')
    return false
  }

  const furnaceType = mcData.blocksByName.furnace
  const furnaceBlock = furnaceType ? bot.findBlock({ matching: furnaceType.id, maxDistance: FURNACE_SEARCH_RADIUS }) : null

  if (!furnaceBlock) {
    bot.chat('Não encontrei um forno por perto.')
    return false
  }

  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
  await bot.pathfinder.goto(new goals.GoalLookAtBlock(furnaceBlock.position, bot.world))

  const furnace = await bot.openFurnace(furnaceBlock)

  try {
    await furnace.putFuel(fuel.type, null, 1)
    await furnace.putInput(inputItem.id, null, 1)
    await new Promise((resolve) => setTimeout(resolve, SMELT_WAIT_MS))
    await furnace.takeOutput()
    bot.chat(`Cozinhei ${itemName}.`)
    return true
  } finally {
    furnace.close()
  }
}

module.exports = cookItem
