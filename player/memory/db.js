// Um arquivo SQLite por agente, em data/<agente>/memory.sqlite. O arquivo em
// si é o limite de isolamento — não existe coluna agent_id nem tabela
// compartilhada entre identidades. Isso é deliberado: um agente só deve
// conhecer o que está na própria LTM.

const { DatabaseSync } = require('node:sqlite')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const openDatabases = new Map()

function sanitizeAgentName(name) {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, '_')
}

function getDb(agentName) {
  const key = sanitizeAgentName(agentName)
  if (openDatabases.has(key)) return openDatabases.get(key)

  const dir = path.join(DATA_DIR, key)
  fs.mkdirSync(dir, { recursive: true })

  const db = new DatabaseSync(path.join(dir, 'memory.sqlite'))
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      importance REAL NOT NULL DEFAULT 5,
      created_at INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      skill TEXT PRIMARY KEY,
      known INTEGER NOT NULL DEFAULT 0,
      practice_attempts INTEGER NOT NULL DEFAULT 0,
      acquired_via TEXT,
      updated_at INTEGER NOT NULL
    )
  `)

  openDatabases.set(key, db)
  return db
}

module.exports = { getDb, DATA_DIR }
