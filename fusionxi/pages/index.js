import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const STORAGE_KEY = "fusionxi_chats_v1";

function makeChat() {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: "New chat", messages: [] };
}

function titleFromText(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 38 ? clean.slice(0, 38).trimEnd() + "…" : clean;
}

export default function Home() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [plusOpen, setPlusOpen] = useState(false);
  const [mode, setMode] = useState("instant");
  const [modeOpen, setModeOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const mainRef = useRef(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const recognitionRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeId) || null;
  const messages = activeChat?.messages || [];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved) && saved.length) {
        setChats(saved);
        setActiveId(saved[0].id);
      } else {
        const first = makeChat();
        setChats([first]);
        setActiveId(first.id);
      }
    } catch {
      const first = makeChat();
      setChats([first]);
      setActiveId(first.id);
    }
  }, []);

  useEffect(() => {
    if (!chats.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = mainRef.current.scrollHeight;
  }, [messages, busy, activeId]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function autosize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  function createNewChat() {
    const chat = makeChat();
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
    setInput("");
    setAttachment(null);
    setPlusOpen(false);
    setTimeout(autosize, 0);
    if (window.innerWidth <= 850) setSidebarOpen(false);
  }

  function selectChat(id) {
    setActiveId(id);
    setInput("");
    setAttachment(null);
    setPlusOpen(false);
    setTimeout(autosize, 0);
    if (window.innerWidth <= 850) setSidebarOpen(false);
  }

  function deleteChat(id) {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (!next.length) {
        const fresh = makeChat();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  function appendMessages(id, additions) {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, messages: [...c.messages, ...additions] } : c)));
  }

  function updateChat(id, patch) {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function toggleVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported by this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInput(transcript);
      setTimeout(autosize, 0);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAttachment({ name: file.name, type: file.type, size: file.size });
    setPlusOpen(false);
    event.target.value = "";
  }

  async function send(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || busy || !activeChat) return;

    const chatId = activeId;
    const userMsg = { role: "user", text, attachment: attachment?.name || null };
    const currentMessages = activeChat.messages;

    setBusy(true);
    setInput("");
    setAttachment(null);
    setPlusOpen(false);
    setTimeout(autosize, 0);

    appendMessages(chatId, [userMsg]);
    if (!currentMessages.length) updateChat(chatId, { title: titleFromText(text) });

    if (imageMode) {
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const data = await res.json();
        if (data.error) appendMessages(chatId, [{ role: "bot", text: "Image error: " + data.error }]);
        else appendMessages(chatId, [{ role: "bot", text: `"${text}"`, image: data.image }]);
      } catch {
        appendMessages(chatId, [{ role: "bot", text: "Connection hiccup generating that image." }]);
      }
      setBusy(false);
      return;
    }

    const history = [...currentMessages, userMsg]
      .filter((m) => !m.image)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, mode }),
      });
      const data = await res.json();
      if (data.error) appendMessages(chatId, [{ role: "bot", text: "Error: " + data.error }]);
      else appendMessages(chatId, [{ role: "bot", text: data.text }]);
    } catch {
      appendMessages(chatId, [{ role: "bot", text: "Connection hiccup — please try again." }]);
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
    ? ["A neon jellyfish drifting through space", "Cozy cabin in a snowy forest, watercolor", "Retro travel poster for Mars", "A city built inside a giant tree"]
    : ["Explain quantum entanglement simply", "Write a short poem about the sea", "Give me a 5-day trip plan for Kyoto", "Debug my Python function"];

  return (
    <>
      <Head>
        <title>FusionXi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/fusionxi-favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/fusionxi-favicon.png" />
      </Head>

      <div className="app">
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <div className="mark" />
              <div className="wordmark">Fusion<span>Xi</span></div>
            </div>
            <button className="collapse-btn" title="Close sidebar" onClick={() => setSidebarOpen(false)}>‹</button>
          </div>

          <button className="new-chat" onClick={createNewChat}><span className="plus">＋</span><span>New chat</span></button>
          <div className="history-label">Chats</div>
          <div className="chat-list">
            {chats.map((chat) => (
              <div className={`chat-item ${chat.id === activeId ? "selected" : ""}`} key={chat.id}>
                <button className="chat-select" onClick={() => selectChat(chat.id)} title={chat.title}>
                  <span className="chat-icon">💬</span><span className="chat-title">{chat.title}</span>
                </button>
                <button className="delete-chat" onClick={() => deleteChat(chat.id)} title="Delete chat">×</button>
              </div>
            ))}
          </div>
          <div className="sidebar-bottom">
            <div className="memory-note"><span className="memory-dot" /><div><strong>Chat memory</strong><small>Saved on this device</small></div></div>
          </div>
        </aside>

        <section className="workspace">
          <header>
            <button className="menu-btn" title="Open chats" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="mobile-brand">Fusion<span>Xi</span></div>
            <div className="status"><span className="dot" />{imageMode ? "image mode" : `${mode} mode`}</div>
          </header>

          <main ref={mainRef}>
            {messages.length === 0 && (
              <div className="empty">
                <h1>What are we <span>fusing</span> today?</h1>
                <p>{imageMode ? "Describe an image and I'll generate it." : "Ask anything — FusionXi is ready."}</p>
                <div className="suggestions">{suggestions.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>
              </div>
            )}

            <div className="thread">
              {messages.map((m, i) => (
                <div className={`row ${m.role === "user" ? "user" : "bot"}`} key={i}>
                  <div className={`avatar ${m.role === "user" ? "user" : "bot"}`} />
                  <div className="bubble">
                    {m.text}
                    {m.attachment && <div className="message-attachment">📎 {m.attachment}</div>}
                    {m.image && <img src={m.image} alt="Generated" />}
                  </div>
                </div>
              ))}
              {busy && <div className="row bot"><div className="avatar bot" /><div className="bubble"><div className="thinking"><i /><i /><i /></div></div></div>}
            </div>
          </main>

          <footer>
            <div className="composer-wrap">
              {plusOpen && (
                <div className="plus-menu">
                  <button onClick={() => fileRef.current?.click()}><span className="option-icon">↥</span><span><strong>Upload photos & files</strong><small>Add a file to your message</small></span></button>
                  <button onClick={() => { setImageMode(true); setPlusOpen(false); }}><span className="option-icon">✦</span><span><strong>Create an image</strong><small>Generate an image with FusionXi</small></span></button>
                  <button onClick={() => { setMode("think"); setModeOpen(false); setPlusOpen(false); }}><span className="option-icon">◌</span><span><strong>Think</strong><small>Use deeper reasoning for harder tasks</small></span></button>
                </div>
              )}

              {attachment && <div className="attachment-chip"><span>📎</span><span>{attachment.name}</span><button onClick={() => setAttachment(null)}>×</button></div>}

              <div className="composer">
                <button className="plus-btn" title="More options" onClick={() => { setPlusOpen((v) => !v); setModeOpen(false); }}>＋</button>
                <button className={`mode-btn ${imageMode ? "active" : ""}`} title="Toggle image generation" onClick={() => setImageMode((v) => !v)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.7" /><circle cx="9" cy="9" r="1.6" fill="currentColor" /><path d="M21 15l-5.5-5.5a1 1 0 0 0-1.4 0L5 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <textarea ref={taRef} rows={1} placeholder={imageMode ? "Describe an image..." : "Message FusionXi..."} value={input} onChange={(e) => { setInput(e.target.value); autosize(); }} onKeyDown={onKeyDown} />

                <div className="mode-picker">
                  <button className="mode-current" onClick={() => { setModeOpen((v) => !v); setPlusOpen(false); }} title="Choose response mode">
                    {mode === "think" ? "Think" : "Instant"}<span>⌄</span>
                  </button>
                  {modeOpen && <div className="mode-menu">
                    <button className={mode === "instant" ? "chosen" : ""} onClick={() => { setMode("instant"); setModeOpen(false); }}><span>⚡</span><span><strong>Instant</strong><small>Fast answers</small></span>{mode === "instant" && <b>✓</b>}</button>
                    <button className={mode === "think" ? "chosen" : ""} onClick={() => { setMode("think"); setModeOpen(false); }}><span>◌</span><span><strong>Think</strong><small>Deeper reasoning</small></span>{mode === "think" && <b>✓</b>}</button>
                  </div>}
                </div>

                <button className={`voice-btn ${listening ? "listening" : ""}`} title={listening ? "Stop voice input" : "Voice input"} onClick={toggleVoice}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="8" y="3" width="8" height="12" rx="4" stroke="currentColor" strokeWidth="1.8" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </button>
                <button className="send" disabled={!input.trim() || busy} onClick={() => send()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </div>
            <div className="hint">FusionXi can make mistakes. Check important info.</div>
            <input ref={fileRef} className="hidden-file" type="file" accept="image/*,.pdf,.txt,.doc,.docx" onChange={handleFile} />
          </footer>
        </section>
      </div>
    </>
  );
}
