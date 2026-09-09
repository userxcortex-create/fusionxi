import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const STORAGE_KEY = "fusionxi_chats_v1";
const PROFILE_KEY = "fusionxi_profile_v1";

function makeChat() {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: "New chat", messages: [], createdAt: Date.now(), updatedAt: Date.now(), pinned: false };
}

function formatChatTime(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today • ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} • ${time}`;
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
  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: "", phone: "", age: "", logo: "" });
  const mainRef = useRef(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const recognitionRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeId) || null;
  const messages = activeChat?.messages || [];

  // Every fresh page open starts in a brand-new chat, while previous chats
  // stay saved in the sidebar. This is intentionally independent of how many
  // chats the visitor had before closing/reloading the site.
  useEffect(() => {
    try {
      const savedProfile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
      if (savedProfile?.name && savedProfile?.phone && savedProfile?.age) {
        setProfile(savedProfile);
        setProfileDraft({ name: savedProfile.name || "", phone: savedProfile.phone || "", age: savedProfile.age || "", logo: savedProfile.logo || "" });
      } else {
        setProfileOpen(true);
      }
    } catch {
      setProfileOpen(true);
    }

    const first = makeChat();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const previousChats = Array.isArray(saved) ? saved : [];
      setChats([first, ...previousChats]);
      setActiveId(first.id);
    } catch {
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


  function handleProfileLogo(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setProfileDraft((prev) => ({ ...prev, logo: canvas.toDataURL("image/jpeg", 0.82) }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function saveProfile(e) {
    e.preventDefault();
    const name = profileDraft.name.trim();
    const phone = profileDraft.phone.replace(/\D/g, "").trim();
    const age = String(profileDraft.age).replace(/\D/g, "").trim();
    if (!name || !phone || !age) return;
    const next = { name, phone, age, logo: profileDraft.logo || "" };
    setProfile(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setProfileOpen(false);
  }

  function openProfileEditor() {
    setProfileDraft(profile || { name: "", phone: "", age: "", logo: "" });
    setProfileOpen(true);
  }

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

  function togglePinChat(id) {
    setChats((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c));
      return [...next].sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
    });
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
    const now = Date.now();
    const userMsg = { role: "user", text, attachment: attachment?.name || null, sentAt: now };
    const currentMessages = activeChat.messages;

    setBusy(true);
    setInput("");
    setAttachment(null);
    setPlusOpen(false);
    setTimeout(autosize, 0);

    appendMessages(chatId, [userMsg]);
    updateChat(chatId, { updatedAt: now, ...(currentMessages.length ? {} : { title: titleFromText(text) }) });

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
              <div className={`chat-item ${chat.id === activeId ? "selected" : ""} ${chat.pinned ? "pinned" : ""}`} key={chat.id}>
                <button className="chat-select" onClick={() => selectChat(chat.id)} title={chat.title}>
                  <span className="chat-icon">{chat.pinned ? "📌" : "💬"}</span><span className="chat-title">{chat.title}</span>
                </button>
                <div className="chat-actions">
                  <button className="pin-chat" onClick={() => togglePinChat(chat.id)} title={chat.pinned ? "Unpin chat" : "Pin chat"}>{chat.pinned ? "📌" : "☆"}</button>
                  <button className="delete-chat" onClick={() => deleteChat(chat.id)} title="Delete chat">×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="sidebar-bottom">
            <button className="profile-mini" onClick={openProfileEditor}>
              <div className="profile-avatar">{profile?.logo ? <img src={profile.logo} alt="Profile" /> : (profile?.name?.charAt(0)?.toUpperCase() || "?")}</div>
              <div><strong>{profile?.name || "Your profile"}</strong><small>Customize profile</small></div>
              <span>⚙</span>
            </button>
            <div className="memory-note"><span className="memory-dot" /><div><strong>Chat memory</strong><small>Saved on this device</small></div></div>
          </div>
        </aside>

        {profileOpen && (
          <div className="profile-backdrop">
            <form className="profile-card" onSubmit={saveProfile}>
              <div className="profile-logo">{profileDraft.logo ? <img src={profileDraft.logo} alt="Profile logo" /> : <div className="mark" />}</div>
              <label className="logo-upload">Profile logo<input type="file" accept="image/*" onChange={handleProfileLogo} /><span>{profileDraft.logo ? "Change logo" : "Add logo"}</span></label>
              <h2>{profile ? "Customize your profile" : "Welcome to FusionXi"}</h2>
              <p>{profile ? "Update your details anytime. They stay saved on this device." : "Before you start, tell FusionXi a little about yourself."}</p>
              <label>Name<input autoFocus value={profileDraft.name} onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })} placeholder="Your name" /></label>
              <label>Phone number<input type="tel" inputMode="numeric" pattern="[0-9]*" value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value.replace(/\D/g, "") })} placeholder="Your phone number" /></label>
              <label>Age<input type="text" inputMode="numeric" pattern="[0-9]*" min="1" max="120" value={profileDraft.age} onChange={(e) => setProfileDraft({ ...profileDraft, age: e.target.value.replace(/\D/g, "") })} placeholder="Your age" /></label>
              <button className="profile-save" type="submit">{profile ? "Save changes" : "Continue to FusionXi"}</button>
              {profile && <button className="profile-cancel" type="button" onClick={() => setProfileOpen(false)}>Cancel</button>}
              <small className="profile-note">Your profile is stored locally in this browser.</small>
            </form>
          </div>
        )}

        <section className="workspace">
          <header>
            <button className="menu-btn" title="Open chats" onClick={() => setSidebarOpen(true)}>☰</button>
            <div className="mobile-brand">Fusion<span>Xi</span></div>
            <div className="chat-time"><div className="top-fusion-avatar"><img src="/fusionxi-favicon.png" alt="FusionXi" /></div><div><strong>FusionXi</strong><small>{activeChat?.messages?.length ? `Chat time • ${formatChatTime(activeChat.updatedAt)}` : `Started • ${formatChatTime(activeChat?.createdAt)}`}</small></div></div>
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
                  <div className={`avatar ${m.role === "user" ? "user" : "bot"}`}>{m.role === "user" ? (profile?.logo ? <img src={profile.logo} alt="You" /> : (profile?.name?.charAt(0)?.toUpperCase() || "U")) : <img src="/fusionxi-favicon.png" alt="FusionXi" />}</div>
                  <div className="bubble">
                    {m.text}
                    {m.attachment && <div className="message-attachment">📎 {m.attachment}</div>}
                    {m.image && <img src={m.image} alt="Generated" />}
                  </div>
                </div>
              ))}
              {busy && <div className="row bot"><div className="avatar bot"><img src="/fusionxi-favicon.png" alt="FusionXi" /></div><div className="bubble"><div className="thinking"><i /><i /><i /></div></div></div>}
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
