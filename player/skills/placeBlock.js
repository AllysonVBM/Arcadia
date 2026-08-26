// Skill: construir — coloca um bloco do inventário. Primitivo simples (um
// bloco por vez, sempre em cima do bloco em que o agente está pisando),
// não um planejador de estrutura. "Construir um abrigo" ainda depende de
// várias chamadas dessa skill em sequência, decididas pelo Controller.

const Vec3 = require('vec3')
const blackboard = require('../state/blackboard.js')

async function placeBlock(bot, blockName) {
  const item = bot.inventory.items().find((i) => i.name === blockName)

  blackboard.set('last_action', {
    name: 'place',
    expected: { blockName, hadItem: !!item },
    startedAt: Date.now(),
  })

  if (!item) {
    bot.chat(`Não tenho ${blockName} no inventário pra construir.`)
    return false
  }

  const referenceBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0))
  if (!referenceBlock) {
    bot.chat('Não achei um bloco de referência pra construir aqui.')
    return false
  }

  await bot.equip(item, 'hand')
  await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0))
  bot.chat(`Construí com ${blockName}.`)
  return true
}

module.exports = placeBlock
