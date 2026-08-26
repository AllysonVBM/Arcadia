// Carrega a persona certa pra identidade configurada em agent_cfg.js. Ponto
// de entrada único — o resto do código nunca importa personas/*.js
// diretamente, sempre passa por aqui.

const agentConfig = require('../config/agent_cfg.js')

const personas = {
  Pepper: require('./personas/pepper.js'),
  Atena: require('./personas/atena.js'),
}

const persona = personas[agentConfig.name]

if (!persona) {
  throw new Error(
    `Nenhuma persona definida para a identidade "${agentConfig.name}" (adicione em identity/personas/)`
  )
}

module.exports = persona
