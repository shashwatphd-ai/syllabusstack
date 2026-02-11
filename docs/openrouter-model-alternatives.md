# OpenRouter Model Alternatives Research

> **Date**: February 2026
> **Purpose**: Evaluate comparable and potentially superior OpenRouter models for each task currently handled by SyllabusStack's AI pipeline.

---

## Current Model Inventory

All AI operations route through [OpenRouter](https://openrouter.ai) as a unified gateway. Below is the current task-to-model mapping as defined in `supabase/functions/_shared/openrouter-client.ts`:

| Task | Primary Model | Fallback | Input $/1M | Output $/1M |
|------|--------------|----------|------------|-------------|
| Slide Content (Professor AI) | `google/gemini-3-flash-preview` | `google/gemini-2.5-flash` | $0.10 | $0.40 |
| Image Generation | `google/gemini-3-pro-image-preview` | `google/gemini-2.5-flash-image` | $0.50 | $2.00 |
| Research & Grounding | `perplexity/sonar-pro` | `perplexity/sonar` | $3.00 | $15.00 |
| Curriculum Reasoning | `deepseek/deepseek-r1` | `google/gemini-2.5-pro` | $0.55 | $2.19 |
| Syllabus Parsing | `google/gemini-2.5-flash` | `google/gemini-flash-1.5` | $0.075 | $0.30 |
| Fast Extraction | `google/gemini-2.5-flash-lite` | `openai/gpt-4o-mini` | $0.02 | $0.08 |

---

## 1. Slide Content Generation (Professor AI)

**Current**: `google/gemini-3-flash-preview` — $0.10/$0.40 per 1M tokens
**Requirements**: Long-form structured JSON (24K max tokens), pedagogical quality, 6-slide output with speaker notes (200-300 words each), visual directives, Bloom's taxonomy alignment. Temperature: 0.4.

| Model | ID | Input $/1M | Output $/1M | Context | Max Output | Strengths | Weaknesses |
|-------|-----|-----------|-------------|---------|-----------|-----------|------------|
| **Gemini 3 Flash Preview** (current) | `google/gemini-3-flash-preview` | $0.10 | $0.40 | 1M | 65K | Fast, great JSON adherence, 1M context, strong instruction following | Preview model — may change |
| **DeepSeek V3.2** | `deepseek/deepseek-v3.2` | $0.25 | $0.38 | 164K | 164K | Near-frontier quality at 1/50th GPT-5 cost, excellent structured output, hybrid reasoning mode | Shorter context (164K vs 1M), Chinese-origin model may have cultural bias in educational content |
| **Qwen3 30B A3B** | `qwen/qwen3-30b-a3b` | $0.05 | $0.34 | 33K | 33K | Cheapest option, MoE efficiency, decent JSON output | Small context window (33K), may struggle with 24K token output requirement |
| **Llama 4 Maverick** | `meta-llama/llama-4-maverick` | $0.20 | $0.60 | 1M | — | Open source, 1M context, strong multimodal reasoning | More expensive output than current, less proven for education-specific content |
| **MiMo V2 Flash** | `xiaomi/mimo-v2-flash` | $0.09 | $0.29 | 262K | 16K | Very cheap, matches Claude-level quality on benchmarks | 16K max output may be tight for 24K token slide generation |
| **GPT-5.1** | `openai/gpt-5.1` | $1.25 | $10.00 | 128K | — | Best instruction adherence, clearest explanations, adaptive reasoning | 12x more expensive than current, overkill for slide gen |
| **Step 3.5 Flash** | `stepfun/step-3.5-flash` | Free | Free | — | — | Free tier available, 196B MoE (11B active), speed-efficient | Unproven for structured JSON, limited support/SLA |

### Recommendation
**Keep `google/gemini-3-flash-preview` as primary.** It offers the best price/quality/context balance for 24K-token structured JSON output. **Add `deepseek/deepseek-v3.2` as a secondary fallback** — it costs ~2.5x more on input but is comparable quality with strong JSON handling. The current fallback (`gemini-2.5-flash`) remains solid.

---

## 2. Image Generation

**Current**: `google/gemini-3-pro-image-preview` — ~$0.04/image via Vertex, token-based via OpenRouter
**Requirements**: Educational diagrams, text-faithful rendering, domain-specific visuals (flowcharts, comparison charts, annotated screenshots).

| Model | ID | Cost/Image | Strengths | Weaknesses |
|-------|-----|-----------|-----------|------------|
| **Gemini 3 Pro Image** (current) | `google/gemini-3-pro-image-preview` | ~$0.04 | Best text rendering in images, identity preservation, multi-image blending, 2K/4K output | Preview model |
| **Seedream 4.5** | `bytedance-seed/seedream-4.5` | $0.04 (flat) | Same price, strong portrait/detail preservation, improved editing consistency, good text rendering | Less proven for technical/educational diagrams |
| **FLUX.2 [klein]** | `black-forest-labs/flux.2-klein` | ~$0.01 | 4x cheaper, fast throughput, good quality for the price | May lack precision for educational text in diagrams |
| **FLUX.2 [max]** | `black-forest-labs/flux.2-max` | ~$0.07 | Highest image quality tier, strong prompt understanding | 75% more expensive, image-only (no text+image output) |
| **GPT-5 Image** | `openai/gpt-5-image` | Varies | Strong creative generation, excellent prompt adherence | Generally more expensive, less educational focus |

### Recommendation
**Keep `google/gemini-3-pro-image-preview` as primary** — industry-leading text rendering in images is critical for educational diagrams. **Consider `bytedance-seed/seedream-4.5` as an alternative fallback** at the same $0.04/image price point for non-diagram visuals. **Use `black-forest-labs/flux.2-klein` for bulk/lower-priority images** at ~$0.01/image (75% savings).

---

## 3. Research & Grounding

**Current**: `perplexity/sonar-pro` — $3.00/$15.00 per 1M tokens
**Requirements**: Live web search with citations, factual grounding for lecture content, 7-day cache TTL. Integrated citation format.

| Model | ID | Input $/1M | Output $/1M | Per Request | Strengths | Weaknesses |
|-------|-----|-----------|-------------|-------------|-----------|------------|
| **Sonar Pro** (current) | `perplexity/sonar-pro` | $3.00 | $15.00 | — | Always-on web search, built-in citations, anti-hallucination design, 200K context | Most expensive model in the stack |
| **Sonar** (lighter) | `perplexity/sonar` | $1.00 | $5.00 | — | 3x cheaper, still has web search + citations, fast | Fewer citations, less depth |
| **Sonar Pro Search** | `perplexity/sonar-pro-search` | Token + $18/1K req | — | $0.018/req | Multi-step agentic research, autonomous workflow planning | Per-request pricing adds up, complex cost model |
| **Sonar Reasoning Pro** | `perplexity/sonar-reasoning-pro` | Token-based | — | — | Chain-of-thought reasoning + web search, larger context, more citations | Even more expensive than Sonar Pro |
| **Sonar Deep Research** | `perplexity/sonar-deep-research` | $2.00 | $8.00 | +$5/1K searches | Deepest research capability | Expensive per-search pricing |

### Note on Alternatives Outside Perplexity
No other model on OpenRouter provides native always-on web search with citations comparable to Perplexity Sonar. Generic models (Claude, GPT, Gemini) can be paired with OpenRouter's web search plugin, but lack the tight retrieval-then-synthesize pipeline that makes Sonar effective for factual grounding. Gemini's built-in grounding via Vertex AI is an option but requires separate Google billing.

### Recommendation
**Keep `perplexity/sonar-pro` for lecture research** where citation quality matters. **Downgrade to `perplexity/sonar` ($1/$5) for lighter research tasks** (e.g., topic summaries where fewer citations are acceptable). The 7-day cache already mitigates repeat costs significantly. With caching, the high per-token cost is amortized.

---

## 4. Curriculum Reasoning

**Current**: `deepseek/deepseek-r1` — $0.55/$2.19 per 1M tokens
**Requirements**: Complex chain-of-thought reasoning, pedagogical decomposition, backward design, Bloom's taxonomy classification. Temperature: 0.7.

| Model | ID | Input $/1M | Output $/1M | Context | Strengths | Weaknesses |
|-------|-----|-----------|-------------|---------|-----------|------------|
| **DeepSeek R1** (current) | `deepseek/deepseek-r1` | $0.55 | $2.19 | 164K | Dedicated reasoning model, full chain-of-thought access, open weights | R1 reasoning tokens can be verbose (cost multiplier) |
| **DeepSeek V3.2** | `deepseek/deepseek-v3.2` | $0.25 | $0.38 | 164K | Hybrid reasoning (enable/disable thinking), 55% cheaper input, 83% cheaper output, frontier-class performance | Reasoning may be slightly less deep than dedicated R1 |
| **DeepSeek V3.2 Speciale** | `deepseek/deepseek-v3.2-speciale` | ~$0.25 | ~$0.38 | 164K | Relaxed length constraints, parity with Gemini 3 Pro, strongest open reasoning | Same pricing as V3.2, may be slower |
| **Gemini 2.5 Pro** (current fallback) | `google/gemini-2.5-pro` | $1.25 | $5.00 | 1M | 1M context, strong reasoning, configurable thinking levels | 2-4x more expensive than DeepSeek |
| **GPT-5.1** | `openai/gpt-5.1` | $1.25 | $10.00 | 128K | Best general reasoning, adaptive computation | 5x output cost vs R1, likely overkill |
| **Qwen3 30B A3B (Thinking)** | `qwen/qwen3-30b-a3b:thinking` | $0.05 | $0.34 | 33K | 90% cheaper than R1, decent reasoning for size | 33K context limit, smaller model = less depth |

### Recommendation
**Replace `deepseek/deepseek-r1` with `deepseek/deepseek-v3.2` as primary.** V3.2 offers hybrid reasoning (enable thinking mode when needed), 55-83% cost reduction, and performance in the GPT-5 class. Keep `deepseek/deepseek-r1` as fallback for cases requiring maximum reasoning depth. This change alone could cut curriculum reasoning costs by ~80%.

---

## 5. Syllabus Parsing

**Current**: `google/gemini-2.5-flash` — $0.075/$0.30 per 1M tokens
**Requirements**: Multimodal document parsing (PDF/image syllabi), function calling for structured extraction, capability identification, proficiency rating. Temperature: 0.3.

| Model | ID | Input $/1M | Output $/1M | Context | Strengths | Weaknesses |
|-------|-----|-----------|-------------|---------|-----------|------------|
| **Gemini 2.5 Flash** (current) | `google/gemini-2.5-flash` | $0.075 | $0.30 | 1M | Excellent multimodal (PDF/image), strong function calling, 1M context | — |
| **Gemini 2.5 Flash-Lite** | `google/gemini-2.5-flash-lite` | $0.02 | $0.08 | 1M | 73% cheaper, 1.5x faster than 2.0 Flash, same context | Thinking disabled by default, may miss nuance in complex syllabi |
| **DeepSeek V3.2** | `deepseek/deepseek-v3.2` | $0.25 | $0.38 | 164K | Strong instruction following, good JSON output | Text-only (no native PDF/image), 3x more expensive |
| **MiMo V2 Flash** | `xiaomi/mimo-v2-flash` | $0.09 | $0.29 | 262K | Cheap, 262K context | Text-only, unproven for document parsing |
| **Qwen3 Coder 30B** | `qwen/qwen3-coder-30b-a3b-instruct` | $0.07 | $0.27 | 160K | Good structured extraction, 160K context | No multimodal, coding-focused |

### Recommendation
**Keep `google/gemini-2.5-flash` as primary** — multimodal support (PDF/image syllabi) is essential and no cheaper model matches its document understanding. Consider promoting to `google/gemini-3-flash-preview` ($0.10/$0.40) as primary when it reaches GA for even better extraction quality.

---

## 6. Fast Extraction (High Volume)

**Current**: `google/gemini-2.5-flash-lite` — $0.02/$0.08 per 1M tokens
**Requirements**: Simple structured extraction, assessment questions, gap analysis, recommendations, content strategy. High volume, low cost. Temperature: 0.3-0.7.

| Model | ID | Input $/1M | Output $/1M | Context | Strengths | Weaknesses |
|-------|-----|-----------|-------------|---------|-----------|------------|
| **Gemini 2.5 Flash-Lite** (current) | `google/gemini-2.5-flash-lite` | $0.02 | $0.08 | 1M | Cheapest paid Gemini, 190 tok/s throughput, 1M context | Thinking disabled by default |
| **Qwen3 8B** | `qwen/qwen3-8b` | $0.028 | $0.11 | — | Near-free, small and fast | Smaller model = less quality on nuanced tasks |
| **Nemotron 3 Nano 30B** | `nvidia/nemotron-3-nano-30b-a3b` | $0.06 | $0.24 | — | Free tier available, MoE architecture, strong agentic support | 3x more expensive than Flash-Lite paid tier |
| **Step 3.5 Flash** | `stepfun/step-3.5-flash` | Free | Free | — | 196B MoE model for free, 11B active params | Rate limits on free tier, reliability concerns |
| **DeepSeek V3.2** | `deepseek/deepseek-v3.2` | $0.25 | $0.38 | 164K | Premium quality for complex extractions | 12x more expensive, overkill for simple tasks |
| **GPT-4o Mini** (current fallback) | `openai/gpt-4o-mini` | $0.15 | $0.60 | 128K | Proven reliability, good JSON output | 7.5x more expensive than Flash-Lite |
| **openrouter/free** | `openrouter/free` | Free | Free | Varies | Auto-routes to best available free model | No SLA, variable quality, not production-ready |

### Recommendation
**Keep `google/gemini-2.5-flash-lite` as primary** — at $0.02/$0.08 it is extremely cost-effective with 1M context and fast throughput. No paid alternative is materially cheaper. **Replace `openai/gpt-4o-mini` fallback with `deepseek/deepseek-v3.2`** for better quality at lower cost ($0.25/$0.38 vs $0.15/$0.60 — cheaper output, comparable overall).

---

## Summary: Recommended Changes

| Slot | Current Model | Recommended Change | Rationale | Est. Savings |
|------|--------------|-------------------|-----------|-------------|
| Slide Content | `gemini-3-flash-preview` | **No change** | Best price/quality for structured output | — |
| Image Gen | `gemini-3-pro-image-preview` | **No change**, add `seedream-4.5` as alt | Best text rendering; Seedream is strong backup | — |
| Research | `perplexity/sonar-pro` | **No change**, use `sonar` for light tasks | No alternative matches built-in search+cite | Up to 66% on light tasks |
| **Reasoning** | `deepseek/deepseek-r1` | **Switch to `deepseek/deepseek-v3.2`** | Hybrid reasoning, 55-83% cheaper, GPT-5 class | **~80% cost reduction** |
| Syllabus Parsing | `gemini-2.5-flash` | **No change** | Multimodal parsing requires Gemini | — |
| Fast Extraction | `gemini-2.5-flash-lite` | **No change** primary; replace fallback with `deepseek-v3.2` | Flash-Lite is cheapest; V3.2 better fallback than GPT-4o-mini | ~37% on fallback |

### Cost Impact Estimate

The biggest cost savings opportunity is **switching curriculum reasoning from DeepSeek R1 to DeepSeek V3.2**:
- Input: $0.55 → $0.25 (55% reduction)
- Output: $2.19 → $0.38 (83% reduction)
- V3.2 includes hybrid thinking mode that can be toggled per request

Secondary savings from replacing `gpt-4o-mini` fallback with `deepseek-v3.2` in fast extraction:
- Output: $0.60 → $0.38 (37% reduction)

---

## Models to Watch

| Model | Why | When to Consider |
|-------|-----|-----------------|
| **DeepSeek V3.2 Speciale** | Relaxed length constraints, IMO/IOI gold-medal reasoning | When available as stable release for maximum reasoning tasks |
| **MiMo V2 Flash** ($0.09/$0.29) | Top open-source model on SWE-bench, Claude-comparable at 3.5% cost | If slide generation max output increases beyond 16K |
| **Sonar Reasoning Pro** | Chain-of-thought + web search in one model | For research tasks requiring deep reasoning over search results |
| **FLUX.2 [klein]** (~$0.01/image) | 75% cheaper images for bulk generation | For non-critical educational visuals where text quality is less important |
| **Gemini 3 Flash** (GA) | When preview → GA, more stable + potential price drop | Promote to primary for all Gemini tasks |

---

## Sources

- [OpenRouter Models](https://openrouter.ai/models)
- [OpenRouter Pricing](https://openrouter.ai/pricing)
- [OpenRouter Model Rankings 2026](https://www.teamday.ai/blog/top-ai-models-openrouter-2026)
- [OpenRouter Model Price Comparison](https://compare-openrouter-models.pages.dev/)
- [DeepSeek V3.2 on OpenRouter](https://openrouter.ai/deepseek/deepseek-v3.2)
- [DeepSeek R1 on OpenRouter](https://openrouter.ai/deepseek/deepseek-r1)
- [Perplexity on OpenRouter](https://openrouter.ai/perplexity)
- [OpenRouter Image Models](https://openrouter.ai/collections/image-models)
- [DeepSeek Model Guide](https://www.bentoml.com/blog/the-complete-guide-to-deepseek-models-from-v3-to-r1-and-beyond)
- [Perplexity Alternatives - DigitalOcean](https://www.digitalocean.com/resources/articles/perplexity-alternatives)
- [OpenRouter Pricing Calculator](https://invertedstone.com/calculators/openrouter-pricing)
- [GPT-5.2 on OpenRouter](https://openrouter.ai/openai/gpt-5.2)
- [Gemini 3 Flash on OpenRouter](https://openrouter.ai/google/gemini-3-flash-preview)
