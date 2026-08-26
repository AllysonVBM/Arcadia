// Config do Cognitive Controller / Ollama. Tudo com valor padrão pra rodar
// sem precisar configurar nada, mas sobrescrevível por variável de ambiente.

module.exports = {
  host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.1',
  temperature: 0.7,
  tickIntervalMs: 15000, // a cada 15s — modelo local não aguenta a cadência de um tick de jogo
}
