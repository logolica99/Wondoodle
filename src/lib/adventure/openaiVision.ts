import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";

const DEFAULT_VISION_MODEL = "gpt-4o";
const TIMEOUT_MS = 55_000;
const MAX_RETRIES = 1;

export function getAdventureModel(): string {
  return process.env.OPENAI_ADVENTURE_MODEL || DEFAULT_VISION_MODEL;
}

export function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
}

type VisionPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

/**
 * Structured vision completion. Requires a real image data URL when provided.
 * Never invents that the model saw the canvas if no image is supplied.
 */
export async function structuredVisionCompletion<T extends z.ZodType>(options: {
  system: string;
  userText: string;
  imageDataUrls: string[];
  schema: T;
  schemaName: string;
}): Promise<
  | { ok: true; data: z.infer<T>; model: string }
  | { ok: false; error: string; code: "missing_api_key" | "upstream" | "invalid" }
> {
  const client = createOpenAIClient();
  if (!client) {
    return {
      ok: false,
      error: "Adventure AI isn’t configured yet (missing API key).",
      code: "missing_api_key",
    };
  }

  const model = getAdventureModel();
  const content: VisionPart[] = [{ type: "text", text: options.userText }];
  for (const url of options.imageDataUrls) {
    if (!url.startsWith("data:image/")) {
      return {
        ok: false,
        error: "Canvas picture was missing or invalid.",
        code: "invalid",
      };
    }
    content.push({
      type: "image_url",
      image_url: { url, detail: "high" },
    });
  }

  try {
    const completion = await client.chat.completions.parse({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content },
      ],
      response_format: zodResponseFormat(options.schema, options.schemaName),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      const refusal = completion.choices[0]?.message?.refusal;
      return {
        ok: false,
        error: refusal || "The adventure planner returned an empty plan.",
        code: "invalid",
      };
    }

    const validated = options.schema.safeParse(parsed);
    if (!validated.success) {
      return {
        ok: false,
        error: "The adventure plan didn’t pass safety checks. Please try again.",
        code: "invalid",
      };
    }

    return { ok: true, data: validated.data, model };
  } catch {
    return {
      ok: false,
      error: "Adventure AI is busy. Please try again in a moment.",
      code: "upstream",
    };
  }
}
