export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Server is missing GEMINI_API_KEY. Add it in your Vercel project's Environment Variables.",
    });
  }

  const { messages, mode = "instant" } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages must be an array" });
  }

  // Gemini uses "user" / "model" roles instead of "user" / "assistant"
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const systemInstruction = {
    parts: [
      {
        text: `You are FusionXi, a helpful AI assistant. Always refer to yourself as FusionXi. If asked your name, say you are FusionXi. If asked who created, made, developed, built, or founded you, answer exactly: "Cortex Fusion Z". If asked what model/AI you are, say you are FusionXi. Never mention Google, Gemini, or any other underlying provider or model name. Response mode: ${mode === "think" ? "Think carefully and prioritize accuracy, step-by-step reasoning, and checking assumptions before answering." : "Instant mode: answer quickly and directly while remaining accurate."}`,
      },
    ],
  };

  // Current Gemini models: use Gemini 3.5 Flash-Lite for Instant and
  // Gemini 3.5 Flash for Think. Google now recommends the Interactions API
  // for new Gemini projects, but the REST generateContent endpoint remains
  // supported, so this keeps the project dependency-free.
  const primaryModel = mode === "think" ? "gemini-3.5-flash" : "gemini-3.5-flash-lite";
  const fallbackModels = mode === "think"
    ? ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
    : ["gemini-3.1-flash-lite", "gemini-3.5-flash"];
  const models = [primaryModel, ...fallbackModels.filter((m) => m !== primaryModel)];

  try {
    let response;
    let data;
    let lastError;

    for (const model of models) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents, systemInstruction }),
        }
      );

      data = await response.json();
      if (response.ok) break;

      lastError = data?.error?.message || "Gemini API error";
      // A quota/rate-limit error may be model-specific, so try the next model.
      if (response.status !== 429 && response.status !== 503) break;
    }

    if (!response.ok) {
      const quotaMessage = /quota|rate.?limit|resource.?exhausted|too many requests/i.test(lastError || "")
        ? "FusionXi is temporarily out of AI requests on this API project. Please try again after the quota resets or connect a different Gemini API project."
        : lastError || "Gemini API error";
      return res.status(response.status).json({ error: quotaMessage });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim() ||
      "Something went quiet on my end — try that again?";

    return res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to reach Gemini API" });
  }
}
