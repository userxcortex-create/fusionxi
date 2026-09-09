import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]); // {role, text, image?}
  const [input, setInput] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef(null);
  const taRef = useRef(null);

  // --- Auth guard ---------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) router.replace("/login");
  }, [session, router]);

  // --- Load chat list --------------------------------------------------
  const loadChats = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from("chats")
      .select("id, title, created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setChats(data);
  }, [session]);

  useEffect(() => {
    if (session) loadChats();
  }, [session, loadChats]);

  // --- Load messages for active chat -----------------------------------
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("role, text, image")
        .eq("chat_id", activeChatId)
        .order("created_at", { ascending: true });
      if (!error && data) setMessages(data);
    })();
  }, [activeChatId]);

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

  async function ensureChat(firstText) {
    if (activeChatId) return activeChatId;
    const title = firstText.slice(0, 48) + (firstText.length > 48 ? "…" : "");
    const { data, error } = await supabase
      .from("chats")
      .insert({ title, user_id: session.user.id })
      .select("id, title, created_at")
      .single();
    if (error || !data) return null;
    setChats((prev) => [data, ...prev]);
    setActiveChatId(data.id);
    return data.id;
  }

  async function saveMessage(chatId, msg) {
    if (!chatId) return;
    await supabase.from("messages").insert({
      chat_id: chatId,
      role: msg.role,
      text: msg.text,
      image: msg.image || null,
    });
  }

  function newChat() {
    setActiveChatId(null);
    setMessages([]);
    setInput("");
  }

  async function deleteChat(id, e) {
    e.stopPropagation();
    if (!confirm("Ye chat delete karein?")) return;
    await supabase.from("chats").delete().eq("id", id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) newChat();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function send(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || busy || !session) return;

    setBusy(true);
    setInput("");
    setTimeout(autosize, 0);

    const userMsg = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    const chatId = await ensureChat(text);
    await saveMessage(chatId, userMsg);

    if (imageMode) {
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const data = await res.json();
        let botMsg;
        if (data.error) {
          botMsg = { role: "bot", text: "Image error: " + data.error };
        } else {
          botMsg = { role: "bot", text: `"${text}"`, image: data.image };
        }
        setMessages((prev) => [...prev, botMsg]);
        await saveMessage(chatId, botMsg);
      } catch (err) {
        const botMsg = { role: "bot", text: "Connection hiccup generating that image." };
        setMessages((prev) => [...prev, botMsg]);
        await saveMessage(chatId, botMsg);
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
      let botMsg;
      if (data.error) {
        botMsg = { role: "bot", text: "Error: " + data.error };
      } else {
        botMsg = { role: "bot", text: data.text };
      }
      setMessages((prev) => [...prev, botMsg]);
      await saveMessage(chatId, botMsg);
    } catch (err) {
      const botMsg = { role: "bot", text: "Connection hiccup — please try again." };
      setMessages((prev) => [...prev, botMsg]);
      await saveMessage(chatId, botMsg);
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

  if (session === undefined) {
    return (
      <div className="auth-loading">
        <div className="mark" />
      </div>
    );
  }
  if (session === null) return null; // redirecting to /login

  return (
    <>
      <Head>
        <title>FusionXi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className={`app-shell ${sidebarOpen ? "" : "collapsed"}`}>
        <aside className="sidebar">
          <div className="sidebar-top">
            <button className="new-chat-btn" onClick={newChat}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New chat
            </button>
            <button className="collapse-btn" onClick={() => setSidebarOpen((v) => !v)} title="Toggle sidebar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M9 4v16" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </button>
          </div>

          <div className="chat-list">
            {chats.length === 0 && <div className="chat-list-empty">Koi purani chat nahi hai</div>}
            {chats.map((c) => (
              <div
                key={c.id}
                className={`chat-item ${c.id === activeChatId ? "active" : ""}`}
                onClick={() => setActiveChatId(c.id)}
              >
                <span className="chat-item-title">{c.title}</span>
                <button className="chat-item-del" onClick={(e) => deleteChat(c.id, e)} title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="sidebar-user">
            <button className="user-btn" onClick={() => setMenuOpen((v) => !v)}>
              <div className="user-avatar">{(session.user.email || "?")[0].toUpperCase()}</div>
              <span className="user-email">{session.user.email}</span>
            </button>
            {menuOpen && (
              <div className="user-menu">
                <button onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </aside>

        <div className="app">
          <header>
            <button className="collapse-btn mobile-only" onClick={() => setSidebarOpen((v) => !v)} title="Toggle sidebar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M9 4v16" stroke="currentColor" strokeWidth="1.7" />
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
