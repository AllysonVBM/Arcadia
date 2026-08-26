// Skill: minerar/coletar um bloco de um tipo específico (madeira, pedra,
// minério...). Acha o bloco mais próximo desse tipo dentro do alcance já
// explorado, vai até ele e quebra. É a mesma mecânica pra "gather" de
// recurso em geral — minerar madeira ou pedra não é diferente disso.

const mcDataLoader = require('minecraft-data')
const { Movements, goals } = require('mineflayer-pathfinder')
const blackboard = require('../state/blackboard.js')

const SEARCH_RADIUS = 32

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

  const block = bot.findBlock({ matching: blockType.id, maxDistance: SEARCH_RADIUS })

  if (!block) {
    bot.chat(`Não encontrei ${blockName} por perto.`)
    return false
  }

  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)
  await bot.pathfinder.goto(new goals.GoalLookAtBlock(block.position, bot.world))

  await bot.dig(block)
  bot.chat(`Minerei ${blockName}.`)
  return true
}

module.exports = mine
