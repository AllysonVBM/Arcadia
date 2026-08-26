// Wrapper fino sobre o prismarine-viewer: expõe uma visão 3D do que o bot
// está vendo, servida na própria página do dashboard via iframe. Falha de
// forma silenciosa (loga e retorna null) em vez de derrubar o agente — o
// dashboard/observação nunca deve poder tirar o bot do ar.

function startViewer(bot, { port = 3007, firstPerson = false } = {}) {
  try {
    const { mineflayer: mineflayerViewer } = require('prismarine-viewer')
    mineflayerViewer(bot, { port, firstPerson })
    console.log(`[viewer] disponível em http://localhost:${port}`)
    return port
  } catch (err) {
    console.error('[viewer] prismarine-viewer indisponível:', err.message)
    return null
  }
}

module.exports = { startViewer }
