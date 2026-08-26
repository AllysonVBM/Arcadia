// Servidor do dashboard: HTTP servindo index.html + WebSocket transmitindo o
// estado do agente em tempo real. Roda dentro do mesmo processo do agente
// (lê o blackboard direto, sem IPC) — isso é uma simplificação deliberada da
// Etapa 1; quando o lançador multiagente existir, cada agente sobe o seu
// próprio dashboard numa porta própria, e um agregador (se necessário) vem
// depois disso, não antes.

const http = require('http')
const fs = require('fs')
const path = require('path')
const { WebSocketServer } = require('ws')

const blackboard = require('../state/blackboard.js')
const status = require('../state/validators/status.js')
const { hasHostileNearby } = require('../state/validators/threat.js')
const skills = require('../memory/skills.js')
const currency = require('../memory/currency.js')
const longTermMemory = require('../memory/longTermMemory.js')

const INDEX_PATH = path.join(__dirname, 'index.html')

function buildSnapshot(bot) {
  return {
    type: 'snapshot',
    agent: bot.username,
    at: Date.now(),
    data: {
      health: blackboard.get('health') ?? null,
      hunger: blackboard.get('hunger') ?? null,
      profession: blackboard.get('profession') ?? null,
      position: blackboard.get('position') ?? null,
      inventory: blackboard.get('inventory') || [],
      threatNearby: hasHostileNearby(bot),
      isHealthCritical: status.isHealthCritical(),
      isHungry: status.isHungry(),
      currentIntent: blackboard.get('current_intent') ?? null,
      lastAction: blackboard.get('last_action') ?? null,
      workingMemory: blackboard.get('memory.working') || [],
      skillsProgress: skills.getSkillsProgress(bot.username),
      currency: currency.getBalance(bot.username),
      ltmCount: longTermMemory.count(bot.username),
    },
  }
}

function startDashboard(bot, { port = 4000, viewerPort = null } = {}) {
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      fs.readFile(INDEX_PATH, (err, content) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Falha ao carregar o dashboard: ' + err.message)
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(content)
      })
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Não encontrado')
  })

  const wss = new WebSocketServer({ server })

  function broadcast(message) {
    const payload = JSON.stringify(message)
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(payload)
    }
  }

  wss.on('connection', (ws) => {
    // Manda a config (porta do viewer 3D) e um snapshot imediato ao conectar,
    // em vez de deixar o cliente esperando até o próximo tick de 1s.
    ws.send(JSON.stringify({ type: 'config', data: { viewerPort } }))
    ws.send(JSON.stringify(buildSnapshot(bot)))
  })

  const interval = setInterval(() => broadcast(buildSnapshot(bot)), 1000)

  function pushChat(username, message) {
    broadcast({
      type: 'chat',
      agent: bot.username,
      data: { username, message, at: Date.now() },
    })
  }

  server.on('error', (err) => {
    console.error('[dashboard] falhou:', err.message)
  })

  server.listen(port, () => {
    console.log(`[dashboard] disponível em http://localhost:${port}`)
  })

  return {
    pushChat,
    stop: () => {
      clearInterval(interval)
      wss.close()
      server.close()
    },
  }
}

module.exports = { startDashboard }
