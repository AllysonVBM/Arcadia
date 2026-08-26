// Moeda por agente, persistida junto com o resto do perfil (mesma base
// SQLite da LTM). Usada só pra pagar por skills ensinadas por outro
// agente — não afeta sobrevivência nem qualquer skill de código.

const profile = require('./profile.js')

const STARTING_BALANCE = 10

function ensureInitialized(agentName) {
  const stored = profile.getProfile(agentName, 'currency')
  if (!stored) profile.setProfile(agentName, 'currency', String(STARTING_BALANCE))
}

function getBalance(agentName) {
  const stored = profile.getProfile(agentName, 'currency')
  return stored ? Number(stored.value) : STARTING_BALANCE
}

function setBalance(agentName, value) {
  profile.setProfile(agentName, 'currency', String(Math.max(0, value)))
}

function credit(agentName, amount) {
  setBalance(agentName, getBalance(agentName) + amount)
}

// Retorna false sem debitar nada se o saldo for insuficiente.
function debit(agentName, amount) {
  const balance = getBalance(agentName)
  if (balance < amount) return false
  setBalance(agentName, balance - amount)
  return true
}

module.exports = { STARTING_BALANCE, ensureInitialized, getBalance, credit, debit }
