// Skill: minerar/coletar um bloco de um tipo específico (madeira, pedra,
// minério...). Acha o bloco mais próximo desse tipo dentro do alcance já
// explorado, vai até ele e quebra.
//
// Mecânica real do Minecraft que isso respeita: pedra e minério exigem uma
// picareta pra soltar item — quebrar com a mão só remove o bloco, sem
// drop nenhum. Madeira não exige ferramenta. Sem isso, o agente "minerava"
// pedra pra sempre sem nunca ganhar nada, achando que tinha dado certo.

const mcDataLoader = require('minecraft-data')
const { Movements, goals } = require('mineflayer-pathfinder')
const blackboard = require('../state/blackboard.js')

const SEARCH_RADIUS = 32

function findSuitableTool(bot, blockType) {
  if (!blockType.harvestTools) return { needed: false, tool: null }

  const toolIds = Object.keys(blockType.harvestTools).map(Number)
  const tool = bot.inventory.items().find((item) => toolIds.includes(item.type))

  return { needed: true, tool: tool || null }
}

async function mine(bot, blockName) {
  const mcData = mcDataLoader(bot.version)
  const blockType = mcData.blocksByName[blockName]

  blackboard.set('last_action', {
    name: 'mine',
    expected: { blockName, found: !!blockType },
    startedAt: Date.now(),
  })

  if (!blockType) {
    bot.chat(`Não conheço um bloco chamado "${blockName}".`)
    return false
  }

  const { needed, tool } = findSuitableTool(bot, blockType)

  if (needed && !tool) {
    bot.chat(`Preciso de uma ferramenta melhor pra minerar ${blockName} de verdade — ainda não tenho uma.`)
    return false
  }

  const block = bot.findBlock({ matching: blockType.id, maxDistance: SEARCH_RADIUS })

  if (!block) {
    bot.chat(`Não encontrei ${blockName} por perto.`)
    return false
  }

  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
  await bot.pathfinder.goto(new goals.GoalLookAtBlock(block.position, bot.world))

  if (tool) await bot.equip(tool, 'hand')

  await bot.dig(block)
  bot.chat(`Minerei ${blockName}.`)
  return true
}

module.exports = mine
