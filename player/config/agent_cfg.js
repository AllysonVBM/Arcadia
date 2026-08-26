// Qual identidade este processo está rodando — selecionável por env var. É
// o mecanismo que o lançador multiagente usa pra dar uma identidade a cada
// processo que sobe (player/launcher.js).

const roster = require('./player_cfg.js')

const name = process.env.AGENT_NAME || roster[0].name
const identity = roster.find((entry) => entry.name === name)

if (!identity) {
  throw new Error(
    `Identidade "${name}" não está em player_cfg.js (disponíveis: ${roster.map((e) => e.name).join(', ')})`
  )
}

module.exports = identity // { name, dashboardPort, viewerPort }
