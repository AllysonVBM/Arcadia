// Cliente mínimo pro endpoint /api/chat do Ollama. Sem SDK — só fetch nativo
// (Node 18+), pra não prender o projeto a um provedor específico. Trocar de
// LLM local mais pra frente é reescrever este arquivo, nada além dele.

const llmConfig = require('../config/llm_cfg.js')

async function chat(messages) {
  const response = await fetch(`${llmConfig.host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llmConfig.model,
      messages,
      stream: false,
      format: 'json',
      options: { temperature: llmConfig.temperature },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Ollama respondeu ${response.status}: ${body}`)
  }

  const data = await response.json()
  return data.message.content
}

module.exports = { chat }
