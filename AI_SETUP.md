# AI Players — Local Testing with Ollama

Zubrenn's AI opponents can be driven by a Large Language Model. Two paths exist:

- **Level 2 (preferred): tool-calling agent.** The model is given a set of
  *tools* (functions) and plays its turn by calling them in a loop —
  `get_state`, `get_colonies`, `describe_cell`, `list_buildable`, `find_cells`
  (queries) and `work_cell`, `unwork_cell`, `build`, `remove_building`,
  `launch_colony`, `set_tax_rate`, `end_turn` (actions). Every action tool
  reuses the game's own legality checks, so the AI can never do anything a human
  player couldn't.
- **Level 1 (fallback): one-shot JSON plan.** If the model/vendor has no tool
  support (or the tool loop errors), the AI falls back to a single JSON plan
  (`work` / `build` / `launch` / `remove` / `taxRate`), then to the built-in
  heuristic AI.

Both fall back gracefully, so a weak or tool-less model still plays.

## Running a local model with Ollama

1. Install [Ollama](https://ollama.com/) and start it (it serves an
   OpenAI-compatible API at `http://localhost:11434/v1`, no API key needed).
2. Pull a model. Pick based on your hardware — **tool-calling support matters**:

   | Tier | Model | `ollama pull` | Approx size | Notes |
   | --- | --- | --- | --- | --- |
   | Small / fast | Llama 3.2 3B | `ollama pull llama3.2:3b` | ~2 GB | Good tool calling for its size; fast iteration. |
   | Small+ | Qwen 2.5 7B | `ollama pull qwen2.5:7b` | ~4.7 GB | Stronger reasoning, reliable tools. |
   | Medium | Qwen 2.5 14B | `ollama pull qwen2.5:14b` | ~9 GB | Best reasoning-to-size; top mid pick. |
   | Large (≤64 GB) | Qwen 2.5 72B | `ollama pull qwen2.5:72b` | ~47 GB | Frontier open model that fits in 64 GB. |
   | Large (≤64 GB) | Llama 3.3 70B | `ollama pull llama3.3:70b` | ~43 GB | Comparable frontier choice. |

3. In Zubrenn, open **Settings ▸ AI**, turn **off** "Use built-in AI", choose
   vendor **Ollama**, and select the model you pulled (the model list is fetched
   live from your running Ollama, and a few suggestions are pre-listed).
4. Start a game with AI opponents. Watch the dev console (Window ▸ Toggle
   Developer Tools) for `[ai-tool]` log lines showing each tool call, its
   arguments, and the result.

## Caps & safety

- The agent loop is bounded: **≤ 20 tool calls** and **~30 s** per AI turn.
- **Ctrl+Esc** force-ends a stuck AI turn.
- Query tools are fog/intel-aware; action tools reuse `canPlaceTypeAt`,
  prerequisite, affordability, and zone checks — so the AI is anti-cheat by
  construction.

## Cloud vendors

The same tool-calling path works with any OpenAI-compatible vendor (OpenAI,
Groq, Mistral, etc.) and with Anthropic (mapped to its `tools`/`tool_use`
format). Configure a vendor + API key in Settings instead of Ollama.
