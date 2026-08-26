const mineflayer = require('mineflayer')
const pathfinder = require('mineflayer-pathfinder').pathfinder

const serverConfig = require('./server_cfg.js')
const agentConfig = require('./config/agent_cfg.js')
const blackboard = require('./state/blackboard.js')
const agentHealth = require('./perception/agentHealth.js')
const agentPosition = require('./perception/agentPosition.js')
const inventoryState = require('./perception/inventoryState.js')
const reflexTick = require('./core/reflex-loop.js')
const follow = require('./skills/follow.js')
const workingMemory = require('./memory/workingMemory.js')
const { startCognitiveController } = require('./core/cognitive-controller.js')
const { startDashboard } = require('./dashboard/server.js')
const { startViewer } = require('./dashboard/viewer.js')
const { startConsolidation } = require('./memory/consolidate.js')
const { startProfessionReflection } = require('./core/profession-reflection.js')
const { getActiveScenario, getAgentEntry } = require('./config/scenario_cfg.js')
const goTo = require('./skills/goTo.js')

const scenario = getActiveScenario()
const scenarioAgent = getAgentEntry(scenario, agentConfig.name)

if (scenario && !scenarioAgent) {
  throw new Error(`O cenário "${scenario.id}" não inclui a identidade "${agentConfig.name}"`)
}

const bot = mineflayer.createBot({
  host: serverConfig.host,
  username: agentConfig.name,
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
  // mineflayer-pathfinder já chama bot.lookAt() todo tick pra orientar o
  // movimento (ouvindo physicsTick); isso aqui ouve physicTick, o alias
  // depreciado que dispara logo depois, no mesmo tick — sem essa guarda,
  // os dois brigavam pela direção do olhar sempre que havia um goal ativo
  // e outro jogador/agente por perto, travando o movimento no lugar.
  if (bot.pathfinder && bot.pathfinder.isMoving()) return

  const playerFilter = (entity) => entity.type === 'player' && entity.username !== bot.username
  const playerEntity = bot.nearestEntity(playerFilter)

  if (!playerEntity) return

  const pos = playerEntity.position.offset(0, playerEntity.height, 0)
  bot.lookAt(pos)
}


// Percepção: grava no blackboard sempre que o mineflayer avisa mudança de vida/fome
// Reflexo: reage imediatamente com heurísticas locais, sem esperar a LLM
bot.on('health', () => {
  agentHealth(bot)
  reflexTick(bot)
})

bot.on('chat', (username, message) => {
  if (username === bot.username) return

  // Toda mensagem vira contexto pro Cognitive Controller, mesmo os comandos
  workingMemory.remember(username, message)
  if (dashboard) dashboard.pushChat(username, message)

  if (message === '!follow') {
    follow(bot, username)
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

// Cognitive Controller: só começa a decidir sozinho depois que o bot de fato
// nasceu no mundo (antes disso não há estado nenhum pra ler).
// Dashboard + viewer 3D + consolidação de memória: mesma lógica.
let stopCognitiveController = null
let stopConsolidation = null
let stopProfessionReflection = null
let dashboard = null

bot.once('spawn', () => {
  stopCognitiveController = startCognitiveController(bot)
  stopConsolidation = startConsolidation(bot.username)
  stopProfessionReflection = startProfessionReflection(bot.username)
  dashboard = startDashboard(bot, { port: agentConfig.dashboardPort, viewerPort: agentConfig.viewerPort })
  startViewer(bot, { port: agentConfig.viewerPort })

  if (scenarioAgent) {
    bot.chat(`Cenário ativo: ${scenario.id}. Indo pra minha área.`)
    goTo(bot, scenarioAgent.spawnArea)
  }
})

function shutdown() {
  if (stopCognitiveController) stopCognitiveController()
  if (stopConsolidation) stopConsolidation()
  if (stopProfessionReflection) stopProfessionReflection()
  if (dashboard) dashboard.stop()
}

bot.on('end', shutdown)

// SIGINT/SIGTERM: é assim que o lançador multiagente encerra cada processo
// filho. Sem isso o processo ainda sai (comportamento padrão do Node), mas
// deixa o bot "fantasma" logado no servidor por alguns segundos até o
// timeout do lado do servidor.
process.on('SIGINT', () => {
  shutdown()
  bot.quit()
  process.exit(0)
})
process.on('SIGTERM', () => {
  shutdown()
  bot.quit()
  process.exit(0)
})
