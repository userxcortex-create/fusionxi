import { useState, useRef, useEffect, useCallback } from "react";
import Head from "next/head";

const STORAGE_KEY = "fusionxi_chats_v1";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function makeChat() {
  return { id: uid(), title: "New chat", messages: [], createdAt: Date.now() };
}

function titleFromText(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 42 ? clean.slice(0, 42).trim() + "…" : clean;
}

export default function Home() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef(null);
  const taRef = useRef(null);

  // Load chats from localStorage on mount
  useEffect(() => {
    let initial;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.chats) && parsed.chats.length > 0) {
        initial = parsed;
      }
    } catch (err) {
      // ignore corrupt storage
    }
    if (!initial) {
      const chat = makeChat();
      initial = { chats: [chat], activeId: chat.id };
    }
    setChats(initial.chats);
    setActiveId(initial.activeId && initial.chats.some((c) => c.id === initial.activeId) ? initial.activeId : initial.chats[0].id);
    setLoaded(true);
  }, []);

  // Persist to localStorage whenever chats/activeId change
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats, activeId }));
    } catch (err) {
      // storage full or unavailable — ignore
    }
  }, [chats, activeId, loaded]);

  const activeChat = chats.find((c) => c.id === activeId) || null;
  const messages = activeChat ? activeChat.messages : [];

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

  const updateChatMessages = useCallback((chatId, updater) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: updater(c.messages) } : c))
    );
  }, []);

  function newChat() {
    const chat = makeChat();
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
    setInput("");
    setImageMode(false);
    setSidebarOpen(false);
    setTimeout(autosize, 0);
  }

  function selectChat(id) {
    setActiveId(id);
    setInput("");
    setSidebarOpen(false);
    setTimeout(autosize, 0);
  }

  function deleteChat(id, e) {
    e.stopPropagation();
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        if (next.length > 0) {
          setActiveId(next[0].id);
        } else {
          const chat = makeChat();
          setActiveId(chat.id);
          return [chat];
        }
      }
      return next;
    });
  }

  async function send(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || busy || !activeChat) return;

    const chatId = activeChat.id;
    const isFirstMessage = activeChat.messages.length === 0 && activeChat.title === "New chat";

    setBusy(true);
    setInput("");
    setTimeout(autosize, 0);

    const userMsg = { role: "user", text };
    updateChatMessages(chatId, (msgs) => [...msgs, userMsg]);

    if (isFirstMessage) {
      const t = titleFromText(text);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: t } : c)));
    }

    if (imageMode) {
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const data = await res.json();
        if (data.error) {
          updateChatMessages(chatId, (msgs) => [...msgs, { role: "bot", text: "Image error: " + data.error }]);
        } else {
          updateChatMessages(chatId, (msgs) => [...msgs, { role: "bot", text: `"${text}"`, image: data.image }]);
        }
      } catch (err) {
        updateChatMessages(chatId, (msgs) => [...msgs, { role: "bot", text: "Connection hiccup generating that image." }]);
      }
      setBusy(false);
      return;
    }

    // chat mode
    const history = [...activeChat.messages, userMsg]
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
        updateChatMessages(chatId, (msgs) => [...msgs, { role: "bot", text: "Error: " + data.error }]);
      } else {
        updateChatMessages(chatId, (msgs) => [...msgs, { role: "bot", text: data.text }]);
      }
    } catch (err) {
      updateChatMessages(chatId, (msgs) => [...msgs, { role: "bot", text: "Connection hiccup — please try again." }]);
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

  if (!loaded) {
    return null;
  }

  return (
    <>
      <Head>
        <title>FusionXi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className="app">
        {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}

        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-head">
            <div className="mark small" />
            <div className="wordmark">
              Fusion<span>Xi</span>
            </div>
          </div>

          <button className="new-chat-btn" onClick={newChat}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            New Chat
          </button>

          <div className="chat-list">
            {chats.map((c) => (
              <div
                key={c.id}
                className={`chat-item ${c.id === activeId ? "active" : ""}`}
                onClick={() => selectChat(c.id)}
              >
                <svg className="chat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 4h16v12H8l-4 4V4z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="chat-title">{c.title}</span>
                <button
                  className="chat-delete"
                  title="Delete chat"
                  onClick={(e) => deleteChat(c.id, e)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="main-col">
          <header>
            <button className="hamburger" onClick={() => setSidebarOpen((v) => !v)} title="Toggle sidebar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
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
      </div>
    </>
  );
}
