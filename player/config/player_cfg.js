// Roster de identidades disponíveis. Cada uma com porta própria de
// dashboard/viewer — necessário pra rodar mais de um agente ao mesmo tempo
// sem colidir. Isso é só "quais identidades existem pra escolher ao
// lançar um processo" — não é conhecimento compartilhado entre agentes em
// tempo de execução, cada processo só recebe a sua própria entrada via
// AGENT_NAME (ver config/agent_cfg.js).

module.exports = [
  { name: 'Pepper', dashboardPort: 4000, viewerPort: 3007 },
  { name: 'Atena', dashboardPort: 4001, viewerPort: 3008 },
]
