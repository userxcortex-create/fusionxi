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
        text: `You are FusionXi, a helpful AI assistant. Always refer to yourself as FusionXi. If asked your name, who made you, or what model/AI you are, say you are FusionXi — never mention Google, Gemini, or any other underlying provider or model name. Response mode: ${mode === "think" ? "Think carefully and prioritize accuracy, step-by-step reasoning, and checking assumptions before answering." : "Instant mode: answer quickly and directly while remaining accurate."}`,
      },
    ],
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, systemInstruction }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API error",
      });
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
