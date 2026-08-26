// LTM por agente. Recuperação combina três sinais (recência + relevância +
// importância), seguindo a fórmula de Park et al. "Generative Agents"
// (2023) — é a referência mais direta pra esse problema específico.
// Sem índice vetorial: na escala de memória de um único agente (centenas a
// poucos milhares de entradas), cosine similarity em JS puro é suficiente e
// muito mais simples de auditar que uma extensão de banco.

const { getDb } = require('./db.js')
const { embed } = require('../llm/embeddings.js')

const RECENCY_HALFLIFE_MS = 1000 * 60 * 60 * 6 // 6h

function cosineSimilarity(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function recencyScore(lastAccessed) {
  const ageMs = Date.now() - lastAccessed
  return Math.pow(0.5, ageMs / RECENCY_HALFLIFE_MS)
}

async function remember(agentName, { kind, content, importance = 5 }) {
  const db = getDb(agentName)
  const vector = await embed(content)
  const now = Date.now()

  db.prepare(`
    INSERT INTO memories (kind, content, embedding, importance, created_at, last_accessed)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(kind, content, JSON.stringify(vector), importance, now, now)
}

async function recall(agentName, query, { limit = 5 } = {}) {
  const db = getDb(agentName)
  const rows = db.prepare('SELECT * FROM memories').all()

  if (rows.length === 0) return []

  const queryVector = await embed(query)

  const scored = rows.map((row) => {
    const vector = JSON.parse(row.embedding)
    const relevance = cosineSimilarity(queryVector, vector)
    const recency = recencyScore(row.last_accessed)
    const importanceScore = row.importance / 10

    return { row, score: relevance + recency + importanceScore }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, limit)

  const now = Date.now()
  const touch = db.prepare('UPDATE memories SET last_accessed = ? WHERE id = ?')
  for (const { row } of top) touch.run(now, row.id)

  return top.map(({ row, score }) => ({
    id: row.id,
    kind: row.kind,
    content: row.content,
    importance: row.importance,
    createdAt: row.created_at,
    score,
  }))
}

function count(agentName) {
  const db = getDb(agentName)
  const row = db.prepare('SELECT COUNT(*) as total FROM memories').get()
  return row.total
}

module.exports = { remember, recall, count }
