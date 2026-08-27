// Config do Cognitive Controller / Ollama. Tudo com valor padrão pra rodar
// sem precisar configurar nada, mas sobrescrevível por variável de ambiente.

module.exports = {
  host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  // qwen3:8b — ~5GB em Q4, cabe com folga numa RTX 3060 12GB mesmo
  // compartilhando entre vários agentes, e é hoje o modelo local mais
  // confiável pra tool use/JSON estruturado (menor taxa de "tool call"
  // inválido entre os que rodam num consumidor). Ver README.
  model: process.env.OLLAMA_MODEL || 'qwen3:8b',
  embedModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  temperature: 0.7,
  think: false, // qwen3 tem "thinking mode"; desligado pra manter a resposta só o JSON e a latência baixa
  tickIntervalMs: 15000, // a cada 15s — modelo local não aguenta a cadência de um tick de jogo
  consolidationIntervalMs: 120000, // a cada 2min — STM -> LTM, ainda mais lento que o Controller
  professionIntervalMs: 600000, // a cada 10min — reflexão de identidade, mais lenta que tudo
  goalIntervalMs: 45000, // a cada 45s — Goal Generation, mais lento que o Controller mas mais rápido que profissão
}
