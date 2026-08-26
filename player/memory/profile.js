// Fatos de identidade persistentes por agente — chave/valor simples na
// mesma base SQLite da LTM. Primeiro uso é a profissão, mas serve pra
// qualquer outro fato de identidade que precise sobreviver a um restart
// (o blackboard.js é só RAM, some quando o processo cai).

const { getDb } = require('./db.js')

function setProfile(agentName, key, value) {
  const db = getDb(agentName)
  const now = Date.now()

  db.prepare(`
    INSERT INTO profile (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now)
}

function getProfile(agentName, key) {
  const db = getDb(agentName)
  const row = db.prepare('SELECT value, updated_at FROM profile WHERE key = ?').get(key)
  return row ? { value: row.value, updatedAt: row.updated_at } : null
}

module.exports = { setProfile, getProfile }
