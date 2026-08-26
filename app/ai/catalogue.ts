/**
 * The Workers AI text-generation models an admin may pick from.
 *
 * A SNAPSHOT, generated from `wrangler ai models list --json` on 2026-08-26 — every id,
 * context window, capability flag and PRICE below is Cloudflare's own metadata, not a
 * guess. Refresh it when Cloudflare ships models; nothing breaks if it lags, because a
 * model already chosen keeps working.
 *
 * It exists so the console offers a SELECT rather than a text field. A typo'd or retired
 * model id resolves to nothing at call time, which reads as a broken feature rather than
 * as a bad setting.
 *
 * DELIBERATELY EXCLUDED: the LoRA adapters (`*-lora`, which need adapter config we do not
 * send), `llama-guard` (a moderation classifier, not a chat model), and the code and
 * vision specialists — none of them are for writing prose to a merchant.
 */
export interface CatalogueModel {
  /** The Workers AI identifier, e.g. "@cf/openai/gpt-oss-120b". */
  readonly id: string;
  readonly label: string;
  /** Can be handed tools and asked to call them. */
  readonly toolCalling: boolean;
  /**
   * Emits a thinking trace. A CAPABILITY for multi-step work and a LIABILITY for
   * anything whose output is parsed or shown to a customer, which is why the two
   * kinds of role rank it in opposite directions.
   */
  readonly reasoning: boolean;
  readonly contextWindow: number;
  /**
   * Price per MILLION tokens, in MICRO-USD (1e-6 USD), as an integer.
   *
   * Not `Money` and not a float, on purpose. It is a RATE rather than an amount — nothing
   * is charged, stored or summed with it, it only ranks models — and the real prices go to
   * four decimal places of a dollar, so cents are far too coarse to order by. Integers
   * keep @rules/money.md's actual rule: never IEEE-754 for anything monetary.
   */
  readonly inputMicroUsdPerMTokens: number;
  readonly outputMicroUsdPerMTokens: number;
}

export const WORKERS_AI_MODELS: readonly CatalogueModel[] = [
  {
    id: "@cf/aisingapore/gemma-sea-lion-v4-27b-it",
    label: "Gemma Sea Lion V4 27b",
    toolCalling: false,
    reasoning: false,
    contextWindow: 128000,
    inputMicroUsdPerMTokens: 351000,
    outputMicroUsdPerMTokens: 555000,
  },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    label: "Deepseek R1 Distill Qwen 32b",
    toolCalling: false,
    reasoning: true,
    contextWindow: 80000,
    inputMicroUsdPerMTokens: 497000,
    outputMicroUsdPerMTokens: 4881000,
  },
  {
    id: "@cf/deepseek-ai/deepseek-v4-flash-0731",
    label: "Deepseek V4 Flash 0731",
    toolCalling: true,
    reasoning: true,
    contextWindow: 1310720,
    inputMicroUsdPerMTokens: 440000,
    outputMicroUsdPerMTokens: 1320000,
  },
  {
    id: "@cf/deepseek-ai/deepseek-v4-pro-0813",
    label: "Deepseek V4 Pro 0813",
    toolCalling: true,
    reasoning: true,
    contextWindow: 1048576,
    inputMicroUsdPerMTokens: 1320000,
    outputMicroUsdPerMTokens: 3960000,
  },
  {
    id: "@cf/google/gemma-4-26b-a4b-it",
    label: "Gemma 4 26b A4b",
    toolCalling: true,
    reasoning: true,
    contextWindow: 256000,
    inputMicroUsdPerMTokens: 100000,
    outputMicroUsdPerMTokens: 300000,
  },
  {
    id: "@cf/ibm-granite/granite-4.0-h-micro",
    label: "Granite 4.0 H Micro",
    toolCalling: true,
    reasoning: false,
    contextWindow: 131000,
    inputMicroUsdPerMTokens: 17000,
    outputMicroUsdPerMTokens: 112000,
  },
  {
    id: "@cf/meta/llama-3.1-8b-instruct-fp8",
    label: "Llama 3.1 8b Fp8",
    toolCalling: false,
    reasoning: false,
    contextWindow: 32000,
    inputMicroUsdPerMTokens: 152000,
    outputMicroUsdPerMTokens: 287000,
  },
  {
    id: "@cf/meta/llama-3.2-1b-instruct",
    label: "Llama 3.2 1b",
    toolCalling: false,
    reasoning: false,
    contextWindow: 60000,
    inputMicroUsdPerMTokens: 27000,
    outputMicroUsdPerMTokens: 201000,
  },
  {
    id: "@cf/meta/llama-3.2-3b-instruct",
    label: "Llama 3.2 3b",
    toolCalling: false,
    reasoning: false,
    contextWindow: 80000,
    inputMicroUsdPerMTokens: 50900,
    outputMicroUsdPerMTokens: 335000,
  },
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    label: "Llama 3.3 70b Fp8 Fast",
    toolCalling: true,
    reasoning: false,
    contextWindow: 24000,
    inputMicroUsdPerMTokens: 293000,
    outputMicroUsdPerMTokens: 2253000,
  },
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17b 16e",
    toolCalling: true,
    reasoning: false,
    contextWindow: 131000,
    inputMicroUsdPerMTokens: 270000,
    outputMicroUsdPerMTokens: 850000,
  },
  {
    id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    label: "Mistral Small 3.1 24b",
    toolCalling: true,
    reasoning: false,
    contextWindow: 128000,
    inputMicroUsdPerMTokens: 351000,
    outputMicroUsdPerMTokens: 555000,
  },
  {
    id: "@cf/moonshotai/kimi-k2.6",
    label: "Kimi K2.6",
    toolCalling: true,
    reasoning: true,
    contextWindow: 262144,
    inputMicroUsdPerMTokens: 950000,
    outputMicroUsdPerMTokens: 4000000,
  },
  {
    id: "@cf/nvidia/nemotron-3-120b-a12b",
    label: "Nemotron 3 120b A12b",
    toolCalling: true,
    reasoning: true,
    contextWindow: 256000,
    inputMicroUsdPerMTokens: 500000,
    outputMicroUsdPerMTokens: 1500000,
  },
  {
    id: "@cf/openai/gpt-oss-120b",
    label: "Gpt Oss 120b",
    toolCalling: true,
    reasoning: true,
    contextWindow: 128000,
    inputMicroUsdPerMTokens: 350000,
    outputMicroUsdPerMTokens: 750000,
  },
  {
    id: "@cf/openai/gpt-oss-20b",
    label: "Gpt Oss 20b",
    toolCalling: true,
    reasoning: true,
    contextWindow: 128000,
    inputMicroUsdPerMTokens: 200000,
    outputMicroUsdPerMTokens: 300000,
  },
  {
    id: "@cf/qwen/qwen3-30b-a3b-fp8",
    label: "Qwen3 30b A3b Fp8",
    toolCalling: true,
    reasoning: true,
    contextWindow: 32768,
    inputMicroUsdPerMTokens: 50900,
    outputMicroUsdPerMTokens: 335000,
  },
  {
    id: "@cf/qwen/qwen3.8-27b",
    label: "Qwen3.8 27b",
    toolCalling: true,
    reasoning: true,
    contextWindow: 262144,
    inputMicroUsdPerMTokens: 450000,
    outputMicroUsdPerMTokens: 3200000,
  },
  {
    id: "@cf/qwen/qwq-32b",
    label: "Qwq 32b",
    toolCalling: false,
    reasoning: true,
    contextWindow: 24000,
    inputMicroUsdPerMTokens: 660000,
    outputMicroUsdPerMTokens: 1000000,
  },
  {
    id: "@cf/zai-org/glm-4.7-flash",
    label: "Glm 4.7 Flash",
    toolCalling: true,
    reasoning: true,
    contextWindow: 131072,
    inputMicroUsdPerMTokens: 60500,
    outputMicroUsdPerMTokens: 400000,
  },
  {
    id: "@cf/zai-org/glm-5.2",
    label: "Glm 5.2",
    toolCalling: true,
    reasoning: true,
    contextWindow: 262144,
    inputMicroUsdPerMTokens: 1400000,
    outputMicroUsdPerMTokens: 4400000,
  },
];

/** Membership check, so a stored id can be shown as retired rather than trusted. */
export function isCatalogueModel(id: string): boolean {
  return WORKERS_AI_MODELS.some((model) => model.id === id);
}

export function findCatalogueModel(id: string): CatalogueModel | undefined {
  return WORKERS_AI_MODELS.find((model) => model.id === id);
}
