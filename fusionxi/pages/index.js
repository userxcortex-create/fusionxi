import { useState, useRef, useEffect } from "react";
import Head from "next/head";

export default function Home() {
  const [messages, setMessages] = useState([]); // {role, text, image?}
  const [input, setInput] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const mainRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = mainRef.current.scrollHeight;
    }
  }, [messages, busy]);

  function autosize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  async function send(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || busy) return;

    setBusy(true);
    setInput("");
    setTimeout(autosize, 0);

    const userMsg = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    if (imageMode) {
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const data = await res.json();
        if (data.error) {
          setMessages((prev) => [...prev, { role: "bot", text: "Image error: " + data.error }]);
        } else {
          setMessages((prev) => [...prev, { role: "bot", text: `"${text}"`, image: data.image }]);
        }
      } catch (err) {
        setMessages((prev) => [...prev, { role: "bot", text: "Connection hiccup generating that image." }]);
      }
      setBusy(false);
      return;
    }

    // chat mode
    const history = [...messages, userMsg]
      .filter((m) => !m.image)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [...prev, { role: "bot", text: "Error: " + data.error }]);
      } else {
        setMessages((prev) => [...prev, { role: "bot", text: data.text }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "bot", text: "Connection hiccup — please try again." }]);
    }
    setBusy(false);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const suggestions = imageMode
    ? [
        "A neon jellyfish drifting through space",
        "Cozy cabin in a snowy forest, watercolor",
        "Retro travel poster for Mars",
        "A city built inside a giant tree",
      ]
    : [
        "Explain quantum entanglement simply",
        "Write a short poem about the sea",
        "Give me a 5-day trip plan for Kyoto",
        "Debug my Python function",
      ];

  return (
    <>
      <Head>
        <title>FusionXi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className="app">
        <header>
          <div className="mark" />
          <div className="wordmark">
            Fusion<span>Xi</span>
          </div>
          <div className="status">
            <span className="dot" />
            {imageMode ? "image mode" : "chat mode"}
          </div>
        </header>

        <main ref={mainRef}>
          {messages.length === 0 && (
            <div className="empty">
              <h1>
                What are we <span>fusing</span> today?
              </h1>
              <p>{imageMode ? "Describe an image and I'll generate it." : "Ask anything — FusionXi is ready."}</p>
              <div className="suggestions">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="thread">
            {messages.map((m, i) => (
              <div className={`row ${m.role === "user" ? "user" : "bot"}`} key={i}>
                <div className={`avatar ${m.role === "user" ? "user" : "bot"}`} />
                <div className="bubble">
                  {m.text}
                  {m.image && <img src={m.image} alt="Generated" />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="row bot">
                <div className="avatar bot" />
                <div className="bubble">
                  <div className="thinking">
                    <i /> <i /> <i />
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        <footer>
          <div className="composer">
            <button
              className={`mode-btn ${imageMode ? "active" : ""}`}
              title="Toggle image generation"
              onClick={() => setImageMode((v) => !v)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="9" cy="9" r="1.6" fill="currentColor" />
                <path d="M21 15l-5.5-5.5a1 1 0 0 0-1.4 0L5 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <textarea
              ref={taRef}
              rows={1}
              placeholder={imageMode ? "Describe an image..." : "Message FusionXi..."}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autosize();
              }}
              onKeyDown={onKeyDown}
            />
            <button className="send" disabled={!input.trim() || busy} onClick={() => send()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="hint">FusionXi can make mistakes. Check important info.</div>
        </footer>
      </div>
    </>
  );
}
