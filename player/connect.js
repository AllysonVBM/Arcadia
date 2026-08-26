const mineflayer = require('mineflayer')
const pathfinder = require('mineflayer-pathfinder').pathfinder
const Movements = require('mineflayer-pathfinder').Movements
const { GoalFollow } = require('mineflayer-pathfinder').goals
const mcDataLoader = require('minecraft-data')

const serverConfig = require('./server_cfg.js')
const blackboard = require('./state/blackboard.js')
const agentHealth = require('./perception/agentHealth.js')
const agentPosition = require('./perception/agentPosition.js')
const inventoryState = require('./perception/inventoryState.js')
const reflexTick = require('./core/reflex-loop.js')

const bot = mineflayer.createBot({
  host: serverConfig.host,
  username: 'Pepper',
  port: serverConfig.port,
  version: serverConfig.version,
})


// Bot Load Plugins

bot.loadPlugin(pathfinder)

// Diagnóstico do pathfinder — status real de cada recálculo de caminho.
// 'noPath' ou 'timeout' repetidos indicam que ele não está achando uma rota
// válida (possível bloco de mod não reconhecido pelo minecraft-data); se o
// status vier sempre 'success' mas o bot não sai do lugar, o problema é
// outro (ex.: física/salto). Ajuda a diagnosticar sem precisar adivinhar.
bot.on('path_update', (results) => {
  console.log(`[pathfinder] status=${results.status} passos=${results.path.length}`)
})
bot.on('goal_reached', () => {
  console.log('[pathfinder] objetivo alcançado')
})
bot.on('path_reset', (reason) => {
  console.log(`[pathfinder] caminho resetado: ${reason}`)
})


function lookAtNearestPlayer() {
  const playerFilter = (entity) => entity.type === 'player' && entity.username !== bot.username
  const playerEntity = bot.nearestEntity(playerFilter)

  if (!playerEntity) return

  const pos = playerEntity.position.offset(0, playerEntity.height, 0)
  bot.lookAt(pos)
}

function followPlayer(username) {
  const target = bot.players[username]

  if (!target || !target.entity) {
    bot.chat('Você está muito longe, não consigo te ver!')
    return
  }

  const mcData = mcDataLoader(bot.version)
  const movements = new Movements(bot, mcData)
  movements.scafoldingBlocks = []

  bot.pathfinder.setMovements(movements)
  // GoalFollow (não GoalNear) porque acompanha a entidade continuamente —
  // GoalNear mirava só na posição capturada no instante do comando, então
  // virava um ponto parado assim que o jogador se movia de novo.
  bot.pathfinder.setGoal(new GoalFollow(target.entity, 1), true)
}


// Percepção: grava no blackboard sempre que o mineflayer avisa mudança de vida/fome
// Reflexo: reage imediatamente com heurísticas locais, sem esperar a LLM
bot.on('health', () => {
  agentHealth(bot)
  reflexTick(bot)
})

bot.on('chat', (username, message) => {
  if (username === bot.username) return

  if (message === '!follow') {
    followPlayer(username)
  }

  if (message === '!position') {
    const position = agentPosition(bot) || blackboard.get('position')

    if (position) {
      bot.chat(`Posição: ${position.x}x, ${position.y}y, ${position.z}z`)
    }
  }

  if (message === '!inventory') {
    const inventory = inventoryState(bot)
    bot.chat('Inventário: ' + inventory.map(item => item.displayName).join(' | '))
  }

  if (message === '!life') {
    bot.chat('Vida: ' + parseInt(bot.health))
  }

  if (message === '!hunger') {
    bot.chat('Fome: ' + parseInt(bot.food))
  }
})

bot.on('physicTick', () => {
  lookAtNearestPlayer()
  agentPosition(bot)
})
