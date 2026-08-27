// Skill: comer. Grava a expectativa no Agent State, equipa o primeiro item
// comestível encontrado no inventário e consome. Retorna false sem lançar
// erro quando não há comida — quem chama decide o que fazer com isso.

const mcDataLoader = require('minecraft-data')
const blackboard = require('../state/blackboard.js')
const chatThrottle = require('../core/chatThrottle.js')

async function eat(bot) {
  const mcData = mcDataLoader(bot.version)
  const food = bot.inventory.items().find((item) => mcData.foodsByName[item.name])

  blackboard.set('last_action', {
    name: 'eat',
    expected: { hadFood: !!food },
    startedAt: Date.now(),
  })

  if (!food) {
    chatThrottle.say(bot, 'Não tenho comida no inventário.')
    return false
  }

  await bot.equip(food, 'hand')
  await bot.consume()
  return true
}

module.exports = eat
