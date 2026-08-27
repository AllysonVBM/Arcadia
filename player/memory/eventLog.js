// Log estruturado de eventos por agente — JSON Lines, persistido em
// data/<agente>/events.log. Existe porque console.log some assim que o
// terminal fecha; isso aqui sobrevive, e é o que o relatório (player/
// report.js) lê pra reconstruir o que aconteceu numa sessão sem monitoramento
// ao vivo (madrugada, trabalho, faculdade...).
//
// Não substitui o SQLite (skills/currency/profile/memories) — complementa:
// o SQLite guarda o estado atual, isso aqui guarda a linha do tempo de como
// se chegou até ele.

const fs = require('fs')
const path = require('path')
const { DATA_DIR } = require('./db.js')

function sanitizeAgentName(name) {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, '_')
}

function eventLogPath(agentName) {
  return path.join(DATA_DIR, sanitizeAgentName(agentName), 'events.log')
}

function logEvent(agentName, type, details = {}) {
  const filePath = eventLogPath(agentName)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  const line = JSON.stringify({ at: Date.now(), type, ...details })
  fs.appendFileSync(filePath, line + '\n')
}

// Lê todos os eventos de um agente, em ordem. Usado pelo relatório — não
// pelo próprio agente em execução (que só escreve, nunca precisa reler).
function readEvents(agentName) {
  const filePath = eventLogPath(agentName)
  if (!fs.existsSync(filePath)) return []

  return fs
    .readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

module.exports = { logEvent, readEvents, eventLogPath }
