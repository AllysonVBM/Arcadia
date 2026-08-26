# Arcadia

Agente autônomo de IA jogando Minecraft como jogador real — com memória, personalidade, percepção do mundo e um LLM local decidindo suas ações de alto nível. Projeto de pesquisa sobre arquiteturas cognitivas para agentes embutidos em ambientes de jogo.

## Sobre o projeto

Arcadia é um experimento em construir um agente que se comporte como um jogador com "consciência de situação" dentro do Minecraft — não um bot de comandos fixos, mas um processo que percebe o mundo, mantém estado sobre ele, reage a perigo imediato sem esperar por um LLM, e usa um modelo de linguagem rodando localmente (via [Ollama](https://ollama.com)) para decidir o que fazer em um nível mais alto: conversar, seguir alguém, se afastar de uma ameaça, comer.

A pergunta de pesquisa por trás disso é simples de enunciar e difícil de responder: **dá pra sustentar um agente coerente e responsivo usando um LLM local, se a arquitetura em volta dele fizer o trabalho pesado de filtrar o que ele precisa ver?** A aposta, seguindo o paper da Altera.AL abaixo, é que sim — desde que a decisão de alto nível (LLM) fique isolada da reação imediata (código determinístico), e que o LLM receba sempre um recorte deliberado do estado do mundo, nunca o estado inteiro.

A arquitetura é adaptada do **PIANO** (*Parallel Information Aggregation via Neural Orchestration*), descrita no relatório técnico [**"Project Sid: Many-agent simulations toward AI civilization"**](https://arxiv.org/abs/2411.00114) (Altera.AL). O paper original roda de 10 a mais de 1000 agentes em um mundo de Minecraft via mod Forge + WebSocket; aqui a mesma arquitetura cognitiva foi remapeada para um único agente conectado via [mineflayer](https://github.com/PrismarineJS/mineflayer) — sem mod, sem WebSocket, direto pelo protocolo do jogo.

## Arquitetura

```
                    ┌─────────────────────────────────────────┐
                    │         Cognitive Controller             │
                    │   (loop lento, chama o LLM via Ollama)   │
                    │   lê um recorte do Agent State           │
                    │   escreve current_intent                 │
                    └───────────────┬───────────────────────────┘
                                    │
                                    ▼
┌──────────────┐   escreve   ┌──────────────┐   lê    ┌──────────────┐
│  Percepção    │ ──────────▶ │ Agent State  │ ◀────── │   Output      │
│  (mineflayer) │             │ (blackboard) │         │ fala + skills │
└──────────────┘             └──────┬───────┘         └──────────────┘
                                    ▲
                                    │ lê/age direto
                    ┌───────────────┴───────────────┐
                    │         Reflex Loop             │
                    │  (heurísticas locais, sem LLM)  │
                    │  roda a cada mudança de vida/    │
                    │  fome — nunca espera o Controller │
                    └─────────────────────────────────┘
```

Dois loops rodam em paralelo, em velocidades diferentes — o princípio de **concorrência** do PIANO:

- O **reflexo** reage a cada evento de vida/fome do jogo (até 20x/s no jogo), sem nunca chamar um LLM. Fugir de um mob ou comer com fome crítica não pode esperar uma resposta de rede.
- O **Cognitive Controller** roda a cada ~15s, lê um recorte proposital do estado (não tudo — isso é o *gargalo* do PIANO), pede ao LLM a próxima decisão, e escreve essa decisão como `current_intent`.
- O módulo de **Output** é o único ponto que fala com o jogo em nome de uma decisão — fala e ação sempre vêm da mesma fonte (`current_intent`), nunca de lugares diferentes. É essa disciplina que evita o agente dizer uma coisa e fazer outra.

### Mapa PIANO → Arcadia

| Termo do PIANO | Onde vive no Arcadia |
|---|---|
| Agent State | [`player/state/blackboard.js`](player/state/blackboard.js) |
| Heurísticas locais / concorrência | [`player/state/validators/`](player/state/validators/) + [`player/core/reflex-loop.js`](player/core/reflex-loop.js) |
| Skill Execution | [`player/skills/`](player/skills/) |
| Memory | [`player/memory/`](player/memory/) *(placeholder mínimo — ver Limitações)* |
| Cognitive Controller | [`player/core/cognitive-controller.js`](player/core/cognitive-controller.js) |
| Output / coerência | [`player/core/output.js`](player/core/output.js) |
| Social Awareness / Goal Generation | fora de escopo — exige 2+ agentes simultâneos |

## Estrutura de pastas

```
player/
├── connect.js                    # bootstrap: cria o bot e liga todos os módulos
├── server_cfg.js                 # host/porta/versão do servidor Minecraft
├── config/
│   ├── player_cfg.js             # identidades disponíveis para o agente
│   └── llm_cfg.js                # host/modelo/temperatura do Ollama
├── identity/
│   └── persona.js                # prompt de sistema — personalidade do agente
├── state/
│   ├── blackboard.js             # Agent State: Map com get/set/has/delete
│   └── validators/
│       ├── status.js             # isHealthCritical, isHungry
│       └── threat.js             # detecção de mob hostil por perto
├── perception/
│   ├── agentHealth.js            # grava vida/fome no Agent State
│   ├── agentPosition.js          # grava posição no Agent State
│   └── inventoryState.js         # grava inventário no Agent State
├── skills/
│   ├── flee.js                   # foge da ameaça mais próxima
│   ├── eat.js                    # come o primeiro item comestível do inventário
│   └── follow.js                 # segue um jogador continuamente
├── memory/
│   └── workingMemory.js          # buffer circular de eventos recentes (RAM)
├── llm/
│   └── ollamaClient.js           # cliente mínimo do endpoint /api/chat do Ollama
├── dashboard/
│   ├── server.js                 # HTTP + WebSocket, transmite o estado do agente em tempo real
│   ├── viewer.js                 # liga o prismarine-viewer (visão 3D do que o bot vê)
│   └── index.html                # o painel em si — aberto no navegador
└── core/
    ├── reflex-loop.js            # heurísticas locais, sem LLM
    ├── cognitive-controller.js   # loop que chama o LLM e decide current_intent
    └── output.js                 # único ponto que executa current_intent
```

## Como rodar

### Pré-requisitos

- Node.js 18+ (usa `fetch` nativo — sem SDK de LLM como dependência)
- Um servidor Minecraft acessível (o agente conecta como cliente, via protocolo — não precisa de mod nenhum instalado no servidor)
- `canvas` (dependência do `prismarine-viewer`, usada pra visão 3D) baixa um binário pré-compilado no `npm install` na maioria das plataformas; se falhar na sua, é a única dependência do projeto que pode exigir toolchain nativo (Python + compilador C++)
- [Ollama](https://ollama.com) instalado e rodando localmente, com um modelo já baixado:

```bash
ollama pull llama3.1
```

### Instalação

```bash
npm install
```

### Configuração

Edite [`player/server_cfg.js`](player/server_cfg.js) com o host/porta/versão do seu servidor. Opcionalmente, copie `.env.example` para `.env` para trocar o modelo ou o endpoint do Ollama:

```bash
cp .env.example .env
```

### Rodando

```bash
npm start
```

O agente entra no mundo com o nome `Pepper`, começa a reagir sozinho a vida/fome crítica (reflexo) e, ~15s depois de nascer, começa a tomar decisões de alto nível via LLM (Cognitive Controller).

### Comandos de chat (debug manual)

| Comando | O que faz |
|---|---|
| `!follow` | Segue quem digitou o comando |
| `!position` | Reporta a posição atual |
| `!inventory` | Lista o inventário |
| `!life` | Reporta a vida atual |
| `!hunger` | Reporta a fome atual |

Esses comandos são atalhos diretos pra debug — não passam pelo Cognitive Controller nem pelo `current_intent`.

### Painel de observação (dashboard)

Assim que o agente nasce no mundo, dois servidores locais sobem junto com ele — nenhum dos dois precisa ser iniciado à parte:

- **`http://localhost:4000`** — o painel: vida/fome com barra, posição, ameaça por perto, a decisão atual do Cognitive Controller (`current_intent` + `reason`), a última skill executada, inventário, chat do Minecraft em tempo real e a memória de trabalho recente. Tudo via WebSocket, atualizado a cada segundo (chat é instantâneo).
- **`http://localhost:3007`** — visão 3D do que o agente está vendo ([prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer)), embutida no próprio painel: informe a porta (já vem pré-preenchida) e clique em Conectar.

Hoje o painel mostra um agente porque só existe um agente rodando; ele já foi escrito pra renderizar quantos agentes reportarem a ele (chave por nome) — a extensão pra múltiplos processos é a Etapa do lançador multiagente, ainda não implementada (ver Roteiro).

## Limitações conhecidas (honestidade de pesquisa)

- **Memory é um placeholder.** `workingMemory.js` é só um buffer circular em RAM sem persistência — não existe ainda memória de curto/longo prazo sobrevivendo a um restart do processo.
- **Sem Action Awareness ainda.** As skills gravam `last_action` com o resultado esperado, mas nada compara isso com o que de fato aconteceu no jogo — o agente pode "achar" que comeu ou fugiu com sucesso sem confirmação.
- **Confiabilidade do JSON depende do modelo local.** Modelos pequenos rodando via Ollama nem sempre respeitam o formato JSON pedido, mesmo com `format: "json"`. Quando isso acontece, o Controller loga o erro e simplesmente pula aquele ciclo — não derruba o processo, mas também não decide nada naquele tick.
- **Um agente só.** Social Awareness e Goal Generation (PIANO) dependem de 2+ agentes no mesmo mundo; `player_cfg.js` já lista uma segunda identidade (`Atena`) para quando isso for retomado.
- **Servidores com mods**: o mineflayer enxerga o mundo pelo protocolo vanilla via [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) — blocos/entidades customizados por mods que não estão nesse registro podem confundir o pathfinder (custo de movimento incorreto, dificuldade pra pular certos blocos).

## Roteiro

O projeto segue um roteiro em fases, cada uma só começando quando a anterior sustenta o agente sem cair:

0. **Base de conexão estável** — reconexão automática, log estruturado *(parcial)*
1. **Camada reflexa** — heurísticas de sobrevivência sem LLM ✅
2. **Skill Execution formal** — biblioteca de ações com contrato de expectativa *(parcial)*
3. **Cognitive Controller** — LLM local (Ollama) decidindo a ação de alto nível ✅
4. **Painel de observação** — dashboard web + visão 3D em tempo real ✅
5. **LTM isolada por agente** — memória de longo prazo persistida, sem conhecimento cross-agente a priori *(pendente)*
6. **Personas por agente** — uma identidade/personalidade própria por processo *(pendente)*
7. **Lançador multiagente** — N processos independentes, cada um sem saber da existência dos outros até se encontrarem no jogo *(pendente)*
8. **Cenários com objetivos** — configuração por caso de teste (isolado / dupla / quinteto), sobrevivência como prioridade inegociável acima de qualquer objetivo *(pendente)*
9. **Profissão emergente** — reflexão de baixa frequência sobre a LTM do próprio agente, decidindo/reafirmando uma profissão *(pendente)*

## Referências

- Altera.AL — [*"Project Sid: Many-agent simulations toward AI civilization"*](https://arxiv.org/abs/2411.00114) (arXiv:2411.00114)
- Park et al. — [*"Generative Agents: Interactive Simulacra of Human Behavior"*](https://arxiv.org/abs/2304.03442) (arXiv:2304.03442) — inspiração para a recuperação de memória por recência + relevância + importância na LTM
- [mineflayer](https://github.com/PrismarineJS/mineflayer) / [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) / [prismarine-viewer](https://github.com/PrismarineJS/prismarine-viewer)
- [Ollama](https://ollama.com)

## Licença

ISC
