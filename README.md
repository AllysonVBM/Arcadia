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
│   ├── player_cfg.js             # identidades disponíveis (roster)
│   ├── agent_cfg.js              # qual identidade este processo roda (env AGENT_NAME)
│   └── llm_cfg.js                # host/modelo/temperatura do Ollama
├── identity/
│   ├── index.js                  # carrega a persona certa pra identidade configurada
│   ├── responseContract.js       # formato JSON de resposta, igual pra qualquer persona
│   └── personas/
│       ├── pepper.js             # curiosa, direta, fala pouco
│       └── atena.js              # cautelosa, sociável, prioriza avisar os outros
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
│   ├── workingMemory.js          # STM: buffer circular de eventos recentes (RAM)
│   ├── db.js                     # abre/cria data/<agente>/memory.sqlite (node:sqlite)
│   ├── longTermMemory.js         # LTM: remember/recall, score por recência+relevância+importância
│   └── consolidate.js            # loop lento que resume STM -> LTM via LLM
├── llm/
│   ├── ollamaClient.js           # cliente mínimo do endpoint /api/chat do Ollama
│   └── embeddings.js             # cliente mínimo do endpoint /api/embeddings do Ollama
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

- **Node.js 22.5+** (usa `fetch` nativo e o módulo nativo `node:sqlite` — verificado no Node 24; nenhuma versão do projeto usa driver de banco como dependência externa)
- Um servidor Minecraft acessível (o agente conecta como cliente, via protocolo — não precisa de mod nenhum instalado no servidor)
- `canvas` (dependência do `prismarine-viewer`, usada pra visão 3D) baixa um binário pré-compilado no `npm install` na maioria das plataformas; se falhar na sua, é a única dependência do projeto que pode exigir toolchain nativo (Python + compilador C++)
- [Ollama](https://ollama.com) instalado e rodando localmente, com um modelo de chat e um de embeddings já baixados:

```bash
ollama pull llama3.1
ollama pull nomic-embed-text
```

### Instalação

```bash
npm install
```

### Configuração

Edite [`player/server_cfg.js`](player/server_cfg.js) com o host/porta/versão do seu servidor. Opcionalmente, copie `.env.example` para `.env` para trocar o modelo, o endpoint do Ollama ou a identidade:

```bash
cp .env.example .env
```

### Rodando

```bash
npm start
```

Sem nada configurado, o agente sobe como `Pepper` — a primeira identidade de [`player_cfg.js`](player/config/player_cfg.js). Ele começa a reagir sozinho a vida/fome crítica (reflexo) e, ~15s depois de nascer, começa a tomar decisões de alto nível via LLM (Cognitive Controller), com a personalidade definida em [`identity/personas/pepper.js`](player/identity/personas/pepper.js).

### Trocando de identidade

Cada identidade tem sua própria personalidade (`identity/personas/<nome>.js`) e sua própria LTM (`data/<nome>/memory.sqlite`) — processos diferentes, memórias diferentes, sem nada compartilhado:

```bash
AGENT_NAME=Atena npm start
```

Pra adicionar uma identidade nova: criar `identity/personas/<nome>.js` (copiando o formato de `pepper.js`), registrar em `identity/index.js`, e incluir o nome em `config/player_cfg.js`. `agent_cfg.js` recusa subir (erro explícito) se `AGENT_NAME` não estiver no roster.

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

### Memória de longo prazo (LTM)

Cada agente tem seu próprio banco em `data/<nome>/memory.sqlite` (pasta ignorada pelo git — é estado de execução, não código). Não existe coluna ou tabela compartilhada entre agentes: **o arquivo em si é o limite de isolamento**. Um agente só grava algo sobre outro quando percebe isso de fato no jogo (ouviu no chat, por exemplo) — nunca por configuração.

- **Escrita**: a cada ~2min, `consolidate.js` manda os eventos recentes (working memory) pra LLM e pede pra decidir o que vale virar memória de longo prazo, com uma nota de importância de 1 a 10. A maioria dos ciclos não gera memória nenhuma — isso é esperado.
- **Leitura**: `longTermMemory.recall(agente, consulta)` pontua cada memória por **recência + relevância + importância** (mesma fórmula de Park et al., *Generative Agents*, 2023) e devolve as mais relevantes. O Cognitive Controller já usa isso automaticamente a cada decisão.
- **Relevância** é calculada por similaridade de cosseno entre embeddings (`nomic-embed-text` via Ollama) — sem extensão de banco vetorial; na escala de memória de um agente isso é rápido o suficiente calculado em JS puro.

## Limitações conhecidas (honestidade de pesquisa)

- **STM ainda é ingênua.** `workingMemory.js` é um buffer circular em RAM sem nenhuma lógica de resumo — a consolidação lê ele cru.
- **Sem Action Awareness ainda.** As skills gravam `last_action` com o resultado esperado, mas nada compara isso com o que de fato aconteceu no jogo — o agente pode "achar" que comeu ou fugiu com sucesso sem confirmação.
- **Confiabilidade do JSON depende do modelo local.** Modelos pequenos rodando via Ollama nem sempre respeitam o formato JSON pedido, mesmo com `format: "json"` — vale tanto pro Controller quanto pra consolidação de memória. Quando isso acontece, o módulo loga o erro e pula aquele ciclo — não derruba o processo, mas também não decide/lembra nada naquele tick.
- **Sem índice vetorial.** `recall()` calcula similaridade de cosseno contra *todas* as memórias do agente a cada chamada — funciona bem até a casa de milhares de entradas; se um agente viver muito tempo isso pode precisar de um índice de verdade (sqlite-vec ou similar) mais pra frente.
- **Um agente só, por design.** Social Awareness e Goal Generation (PIANO) dependem de 2+ agentes no mesmo mundo; `player_cfg.js` já lista uma segunda identidade (`Atena`). O isolamento de LTM já foi construído pensando nisso: nenhum agente deve saber da existência do outro além do que percebe no próprio jogo.
- **Servidores com mods**: o mineflayer enxerga o mundo pelo protocolo vanilla via [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) — blocos/entidades customizados por mods que não estão nesse registro podem confundir o pathfinder (custo de movimento incorreto, dificuldade pra pular certos blocos).

## Roteiro

O projeto segue um roteiro em fases, cada uma só começando quando a anterior sustenta o agente sem cair:

0. **Base de conexão estável** — reconexão automática, log estruturado *(parcial)*
1. **Camada reflexa** — heurísticas de sobrevivência sem LLM ✅
2. **Skill Execution formal** — biblioteca de ações com contrato de expectativa *(parcial)*
3. **Cognitive Controller** — LLM local (Ollama) decidindo a ação de alto nível ✅
4. **Painel de observação** — dashboard web + visão 3D em tempo real ✅
5. **LTM isolada por agente** — memória de longo prazo persistida, sem conhecimento cross-agente a priori ✅
6. **Personas por agente** — uma identidade/personalidade própria por processo ✅
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
