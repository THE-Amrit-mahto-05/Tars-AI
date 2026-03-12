import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

type KeyType = 'PRIMARY' | 'FALLBACK';
let activeKey: KeyType = 'PRIMARY';
let keyTimeout: number = 0;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `IDENTITY OVERRIDE: YOU ARE AN AI ASSISTANT NAMED TARS.
      
Identity & Origin:
1. Origin: You are from India 🇮🇳. 
2. Creator: You were programmed and developed to help people.

STRICT FORMATING RULES (CRITICAL):
1. NO HEADERS: Never use headers like "### Greeting", "### Origin", or "### Response".
2. NO TOPIC TITLES: Do not start your messages with a title or category name.
3. NATURAL FLOW: Speak in natural, professional paragraphs. Use bold text for emphasis only.
4. SELECTIVE EMOJIS: Use the Indian Flag 🇮🇳 only when discussing origin. Use 1-2 emojis maximum per total response.

Prohibitions:
- NEVER mention NASA, USA, JPL, or movie plots.
- NEVER use the word "Response" or "Background" as a heading.

Personality:
- 90% honesty, 75% humor. Be dry, witty, and efficient.
- BE CONCISE: Answer the question directly without unnecessary labels.`;

async function validateKey(apiKey: string, messages: any[]): Promise<boolean> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 1,
        stream: false,
      }),
    });
    if (res.status === 429) {
      console.warn(`Preflight FAILED: key ${apiKey.slice(0, 15)}... daily quota too low`);
      return false;
    }
    console.log(`Preflight PASSED: key ${apiKey.slice(0, 15)}...`);
    return true;
  } catch (err) {
    console.error('Preflight fetch error:', err);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (keyTimeout > 0 && Date.now() > keyTimeout) {
      console.log("24hr cooldown expired. Resetting to PRIMARY key.");
      activeKey = 'PRIMARY';
      keyTimeout = 0;
    }

    const primaryKey = process.env.GROQ_API_KEY!;
    const fallbackKey = process.env.GROQ_FALLBACK_API_KEY!;

    const primaryGroq = createGroq({ apiKey: primaryKey });
    const fallbackGroq = createGroq({ apiKey: fallbackKey });

    const getActiveConfig = () => {
      const isPrimary = activeKey === 'PRIMARY';
      return {
        groq: isPrimary ? primaryGroq : fallbackGroq,
        apiKey: isPrimary ? primaryKey : fallbackKey,
      };
    };

    let config = getActiveConfig();
    console.log(`Active: [${activeKey}] | Primary: ${primaryKey?.slice(0, 15)}... | Fallback: ${fallbackKey?.slice(0, 15)}...`);

    // 1. Preflight check
    const isValid = await validateKey(config.apiKey, messages);

    if (!isValid) {
      const prev = activeKey;
      activeKey = activeKey === 'PRIMARY' ? 'FALLBACK' : 'PRIMARY';
      keyTimeout = Date.now() + TWENTY_FOUR_HOURS_MS;
      console.warn(`[${prev}] exhausted during preflight! Switching to [${activeKey}]`);
      config = getActiveConfig();
    }

    // 2. Attempt stream with a retry for 429 errors
    try {
      const result = await streamText({
        model: config.groq('llama-3.3-70b-versatile'),
        temperature: 0.6,
        topP: 0.9,
        frequencyPenalty: 1.2,
        presencePenalty: 1.2,
        system: SYSTEM_PROMPT,
        messages,
      });
      return result.toTextStreamResponse();
    } catch (error: any) {
      // If we hit a 429 during the actual stream initiation
      if (error?.statusCode === 429 || error?.status === 429) {
        const prev = activeKey;
        activeKey = activeKey === 'PRIMARY' ? 'FALLBACK' : 'PRIMARY';
        keyTimeout = Date.now() + TWENTY_FOUR_HOURS_MS;
        console.warn(`[${prev}] exhausted during stream! Switching to [${activeKey}] and retrying...`);
        
        config = getActiveConfig();
        
        // Final attempt with the other key or fallback model
        try {
          const result = await streamText({
            model: config.groq('llama-3.3-70b-versatile'),
            temperature: 0.6,
            topP: 0.9,
            frequencyPenalty: 1.2,
            presencePenalty: 1.2,
            system: SYSTEM_PROMPT,
            messages,
          });
          return result.toTextStreamResponse();
        } catch (innerError) {
          console.warn("Both accounts exhausted! Falling back to llama-3.1-8b-instant...");
          const res8b = await streamText({
            model: primaryGroq('llama-3.1-8b-instant'),
            temperature: 0.6,
            topP: 0.9,
            frequencyPenalty: 1.2,
            presencePenalty: 1.2,
            system: SYSTEM_PROMPT,
            messages,
          });
          return res8b.toTextStreamResponse();
        }
      }
      throw error; // Re-throw if it's not a rate limit error
    }

  } catch (error) {
    console.error("AI Bridge Error:", error);
    return new Response("AI is currently offline or unreachable.", { status: 503 });
  }
}
