// Cliente mínimo do endpoint /api/embeddings do Ollama — mesmo espírito do
// ollamaClient.js: fetch nativo, sem SDK.

const llmConfig = require('../config/llm_cfg.js')

async function embed(text) {
  const response = await fetch(`${llmConfig.host}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: llmConfig.embedModel, prompt: text }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Ollama (embeddings) respondeu ${response.status}: ${body}`)
  }

  const data = await response.json()
  return data.embedding
}

module.exports = { embed }
