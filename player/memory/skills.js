// Conhecimento de skills por agente, persistido (sobrevive a restart).
// Skills "gated": só executam de verdade se o agente já souber, ou por
// sorte numa tentativa de prática. Skills de sobrevivência/sociais (flee,
// eat, follow, goTo, explore, idle, speak) NUNCA passam por aqui — não
// podem depender de aprendizado, senão quebra a prioridade de sobrevivência.

const { getDb } = require('./db.js')
const profile = require('./profile.js')

const GATED_SKILLS = ['mine', 'craft', 'place', 'cook', 'hunt', 'plant', 'swim', 'fight', 'bow']

// A partir de quantas tentativas sem saber a skill destrava garantido —
// antes disso, cada tentativa tem uma chance crescente de dar certo mesmo
// sem saber (aprendizado gradual, não um interruptor).
const PRACTICE_UNLOCK_ATTEMPTS = 8

function ensureRow(db, skill) {
  const existing = db.prepare('SELECT * FROM skills WHERE skill = ?').get(skill)
  if (existing) return existing

  db.prepare('INSERT INTO skills (skill, known, practice_attempts, updated_at) VALUES (?, 0, 0, ?)').run(
    skill,
    Date.now()
  )
  return db.prepare('SELECT * FROM skills WHERE skill = ?').get(skill)
}

function knowsSkill(agentName, skill) {
  const db = getDb(agentName)
  return !!ensureRow(db, skill).known
}

function learnSkill(agentName, skill, via) {
  const db = getDb(agentName)
  db.prepare(
    `INSERT INTO skills (skill, known, practice_attempts, acquired_via, updated_at)
     VALUES (?, 1, 0, ?, ?)
     ON CONFLICT(skill) DO UPDATE SET known = 1, acquired_via = excluded.acquired_via, updated_at = excluded.updated_at`
  ).run(skill, via, Date.now())
}

// Chamado quando o Controller decide uma ação gated que o agente ainda não
// sabe. Cada tentativa soma progresso; a chance de acertar mesmo sem saber
// cresce com as tentativas, até destravar de vez.
function attemptWithoutKnowledge(agentName, skill) {
  const db = getDb(agentName)
  const row = ensureRow(db, skill)

  const attempts = row.practice_attempts + 1
  const successChance = Math.min(1, attempts / PRACTICE_UNLOCK_ATTEMPTS)
  const succeeded = Math.random() < successChance

  db.prepare('UPDATE skills SET practice_attempts = ?, updated_at = ? WHERE skill = ?').run(
    attempts,
    Date.now(),
    skill
  )

  if (attempts >= PRACTICE_UNLOCK_ATTEMPTS || succeeded) {
    learnSkill(agentName, skill, 'practiced')
  }

  return succeeded
}

function listKnownSkills(agentName) {
  const db = getDb(agentName)
  return db
    .prepare('SELECT skill FROM skills WHERE known = 1')
    .all()
    .map((row) => row.skill)
}

// Estado de TODAS as skills gated (conhecidas ou não), pra observabilidade
// (dashboard) — não usa ensureRow, então só olhar o progresso não cria
// linhas novas no banco pra skills nunca tentadas.
function getSkillsProgress(agentName) {
  const db = getDb(agentName)
  const rows = db.prepare('SELECT skill, known, practice_attempts, acquired_via FROM skills').all()
  const byName = new Map(rows.map((row) => [row.skill, row]))

  return GATED_SKILLS.map((skill) => {
    const row = byName.get(skill)
    return {
      skill,
      known: !!(row && row.known),
      attempts: row ? row.practice_attempts : 0,
      acquiredVia: row ? row.acquired_via : null,
    }
  })
}

// Sorteia um kit inicial de skills já conhecidas na primeira vez que o
// agente sobe — nunca de novo depois disso (flag em profile, independente
// da tabela skills, pra não confundir "nunca inicializado" com "sorteado
// zero skills").
function assignStarterSkills(agentName, { count = 2 } = {}) {
  const already = profile.getProfile(agentName, 'skills_initialized')
  if (already) return null

  const shuffled = [...GATED_SKILLS].sort(() => Math.random() - 0.5)
  const starter = shuffled.slice(0, count)

  for (const skill of starter) learnSkill(agentName, skill, 'starter')
  profile.setProfile(agentName, 'skills_initialized', 'true')

  return starter
}

module.exports = {
  GATED_SKILLS,
  knowsSkill,
  learnSkill,
  attemptWithoutKnowledge,
  listKnownSkills,
  getSkillsProgress,
  assignStarterSkills,
}
