// Qual identidade este processo está rodando — selecionável por env var.
// É o mesmo mecanismo que o lançador multiagente vai usar mais pra frente
// pra subir N processos, cada um com uma identidade diferente; hoje, com um
// processo só, ele só decide qual persona carregar e qual username usar.

const availableIdentities = require('./player_cfg.js')

const name = process.env.AGENT_NAME || availableIdentities[0]

if (!availableIdentities.includes(name)) {
  throw new Error(
    `Identidade "${name}" não está em player_cfg.js (disponíveis: ${availableIdentities.join(', ')})`
  )
}

module.exports = { name }
