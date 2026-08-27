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
const { startGoalGeneration } = require('./core/goal-generation.js')
const { getActiveScenario, getAgentEntry } = require('./config/scenario_cfg.js')
const goTo = require('./skills/goTo.js')
const skills = require('./memory/skills.js')
const currency = require('./memory/currency.js')

const TEACH_OFFER_RE = /^!teach (\S+) (\d+) (\S+)$/
const TEACH_ACCEPT_RE = /^!teach-accept (\S+) (\d+) (\S+)$/
const TEACH_PROXIMITY_BLOCKS = 16

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


function isNearby(bot, username, maxDistance) {
  const target = bot.players[username]
  if (!target || !target.entity) return false
  return bot.entity.position.distanceTo(target.entity.position) <= maxDistance
}

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

  if (message === '!skills') {
    const known = skills.listKnownSkills(bot.username)
    bot.chat('Skills: ' + (known.length ? known.join(', ') : 'nenhuma ainda'))
  }

  if (message === '!currency') {
    bot.chat('Moeda: ' + currency.getBalance(bot.username))
  }

  // Protocolo de ensino entre agentes — não existe canal fora do chat, então
  // a "transação" inteira acontece por mensagens num formato fixo, nunca
  // interpretadas por LLM. Só processa oferta/aceite dirigidos a mim, e só
  // de quem está fisicamente perto (é isso que garante que precisa "se
  // encontrar" pra negociar, e não só estar em algum lugar do servidor).
  const offerMatch = message.match(TEACH_OFFER_RE)
  if (offerMatch) {
    const [, skillName, priceStr, toUsername] = offerMatch
    const price = Number(priceStr)

    if (toUsername === bot.username && isNearby(bot, username, TEACH_PROXIMITY_BLOCKS)) {
      if (skills.knowsSkill(bot.username, skillName)) {
        bot.chat(`Obrigado, mas já sei ${skillName}.`)
      } else if (currency.debit(bot.username, price)) {
        skills.learnSkill(bot.username, skillName, 'taught')
        bot.chat(`!teach-accept ${skillName} ${price} ${username}`)
        bot.chat(`Aprendi ${skillName} com ${username}!`)
      } else {
        bot.chat(`Gostaria de aprender ${skillName}, mas não tenho ${price} de moeda.`)
      }
    }
  }

  const acceptMatch = message.match(TEACH_ACCEPT_RE)
  if (acceptMatch) {
    const [, skillName, priceStr, fromTeacherUsername] = acceptMatch
    const price = Number(priceStr)

    if (fromTeacherUsername === bot.username) {
      currency.credit(bot.username, price)
      bot.chat(`Recebi ${price} por ensinar ${skillName}.`)
    }
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
let stopGoalGeneration = null
let dashboard = null

bot.once('spawn', () => {
  // Kit inicial de skills sorteado só na primeira vez (não repete em
  // restarts seguintes) + saldo inicial de moeda.
  const starter = skills.assignStarterSkills(agentConfig.name)
  currency.ensureInitialized(agentConfig.name)
  if (starter) {
    console.log(`[skills] kit inicial sorteado para ${agentConfig.name}: ${starter.join(', ')}`)
  }

  stopCognitiveController = startCognitiveController(bot)
  stopConsolidation = startConsolidation(bot.username)
  stopProfessionReflection = startProfessionReflection(bot.username)
  stopGoalGeneration = startGoalGeneration(bot)
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
  if (stopGoalGeneration) stopGoalGeneration()
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
