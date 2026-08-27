// Cliente mínimo pro endpoint /api/chat do Ollama. Sem SDK — só fetch nativo
// (Node 18+), pra não prender o projeto a um provedor específico. Trocar de
// LLM local mais pra frente é reescrever este arquivo, nada além dele.

const llmConfig = require('../config/llm_cfg.js')

// Alguns modelos (ex.: qwen3) têm "thinking mode" e podem prefixar a
// resposta com um bloco de raciocínio antes do JSON, mesmo com think:false
// pedido. Remove isso em vez de confiar cegamente que o modelo obedeceu —
// quem faz o JSON.parse de verdade fica em cada módulo que chama chat().
function stripThinkingBlock(content) {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

async function chat(messages) {
  const response = await fetch(`${llmConfig.host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llmConfig.model,
      messages,
      stream: false,
      format: 'json',
      think: llmConfig.think,
      options: { temperature: llmConfig.temperature },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Ollama respondeu ${response.status}: ${body}`)
  }

  const data = await response.json()
  return stripThinkingBlock(data.message.content)
}

module.exports = { chat }
