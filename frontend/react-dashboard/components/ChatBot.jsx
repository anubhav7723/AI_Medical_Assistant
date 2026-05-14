import { useState, useRef, useEffect } from 'react';

const BASE = import.meta.env.VITE_API_URL ?? `${import.meta.env.VITE_API_URL}`;

async function sendMessage(messages) {
  // Build the messages array to send
  // If report context exists, prepend it as a system message
  const payload = [];
 
  if (reportContext) {
    payload.push({
      role: 'system',
      content: JSON.stringify({
        ml_predictions:  reportContext.predictions  ?? [],
        report_summary:  reportContext.summary      ?? '',
        parameters:      reportContext.parameters   ?? {},
      }),
    });
  }
 
  // Add conversation history (skip any existing system messages)
  payload.push(...messages.filter(m => m.role !== 'system'));
 
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: payload }),
  });
 
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Chat failed (HTTP ${res.status})`);
  }
  return res.json(); // { reply, rag_sources }
}

export default function Chatbot({ reportContext = null }) {

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m Mediee. Ask me anything about your medical report or health concerns.' }
  ]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  // ── sendMessage lives inside component → has access to reportContext ──
  async function sendMessage(msgs) {
    const payload = [];

    if (reportContext) {
      payload.push({
        role: 'system',
        content: JSON.stringify({
          ml_predictions: reportContext.predictions ?? [],
          report_summary: reportContext.summary     ?? '',
          parameters:     reportContext.parameters  ?? {},
        }),
      });
    }

    payload.push(...msgs.filter(m => m.role !== 'system'));

    const res = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payload }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? `Chat failed (HTTP ${res.status})`);
    }
    return res.json();
  }

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const res = await sendMessage(updated);
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={s.wrapper}>

      {/* ── Chat window ───────────────────────────── */}
      {open && (
        <div style={s.window}>

          {/* Header */}
          <div style={s.header}>
            <div style={s.headerLeft}>
              <div style={s.avatar}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <div>
                <div style={s.botName}>Mediee</div>
                <div style={s.botStatus}>
                  <span style={s.statusDot} /> Online
                </div>
              </div>
            </div>
            <button style={s.closeBtn} onClick={() => setOpen(false)} title="Minimise">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div style={s.messages}>
            {messages.map((msg, i) => (
              <div key={i} style={{ ...s.msgRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={s.msgAvatar}>M</div>
                )}
                <div style={{
                  ...s.bubble,
                  ...(msg.role === 'user' ? s.bubbleUser : s.bubbleBot),
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ ...s.msgRow, justifyContent: 'flex-start' }}>
                <div style={s.msgAvatar}>M</div>
                <div style={{ ...s.bubble, ...s.bubbleBot, ...s.typingBubble }}>
                  <span style={s.dot1} />
                  <span style={s.dot2} />
                  <span style={s.dot3} />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={s.errorRow}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={s.inputWrap}>
            <textarea
              ref={inputRef}
              style={s.textarea}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Mediee anything…"
              rows={1}
              disabled={loading}
            />
            <button
              style={{ ...s.sendBtn, ...((!input.trim() || loading) ? s.sendBtnDisabled : {}) }}
              onClick={handleSend}
              disabled={!input.trim() || loading}
              title="Send"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

          <p style={s.hint}>Press Enter to send · Shift+Enter for new line</p>
        </div>
      )}

      {/* ── FAB toggle button ─────────────────────── */}
      <button style={s.fab} onClick={() => setOpen(o => !o)} title={open ? 'Minimise Mediee' : 'Chat with Mediee'}>
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        )}
        {!open && <span style={s.fabLabel}>Mediee</span>}
      </button>

    </div>
  );
}

/* ── styles ──────────────────────────────────────────────────── */
const s = {
  wrapper: {
    position: 'fixed',
    bottom: 28,
    right: 28,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 12,
  },

  /* Chat window */
  window: {
    width: 360,
    height: 520,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 18,
    boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'fadeUp 0.25s cubic-bezier(0.16,1,0.3,1) both',
  },

  /* Header */
  header: {
    padding: '14px 16px',
    background: 'var(--ink)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', flexShrink: 0,
  },
  botName: { fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.2 },
  botStatus: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 11, color: 'rgba(255,255,255,0.55)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  statusDot: {
    display: 'inline-block',
    width: 6, height: 6,
    borderRadius: '50%',
    background: '#4ade80',
    boxShadow: '0 0 6px #4ade80',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none', cursor: 'pointer',
    color: '#fff', width: 28, height: 28,
    borderRadius: 7,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  },

  /* Messages area */
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: 'var(--bg)',
  },

  msgRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 7,
  },
  msgAvatar: {
    width: 26, height: 26, borderRadius: 8,
    background: 'var(--ink)',
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700,
    flexShrink: 0,
  },

  bubble: {
    maxWidth: '78%',
    padding: '10px 13px',
    borderRadius: 14,
    fontSize: 13.5,
    lineHeight: 1.6,
    wordBreak: 'break-word',
  },
  bubbleBot: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--ink-2)',
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    background: 'var(--ink)',
    color: '#fff',
    borderBottomRightRadius: 4,
  },

  /* Typing dots */
  typingBubble: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '12px 16px',
  },
  dot1: { ...dotBase(), animationDelay: '0s'    },
  dot2: { ...dotBase(), animationDelay: '0.18s' },
  dot3: { ...dotBase(), animationDelay: '0.36s' },

  /* Error row */
  errorRow: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--red)',
    background: 'var(--red-bg)',
    border: '1px solid #fecaca',
    padding: '7px 11px', borderRadius: 8,
    margin: '0 2px',
  },

  /* Input area */
  inputWrap: {
    padding: '10px 12px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    background: 'var(--surface)',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    resize: 'none',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '9px 12px',
    fontFamily: "'Syne', sans-serif",
    fontSize: 13.5,
    color: 'var(--ink)',
    background: 'var(--surface2)',
    outline: 'none',
    lineHeight: 1.5,
    maxHeight: 100,
    overflowY: 'auto',
    transition: 'border-color 0.15s',
  },
  sendBtn: {
    width: 36, height: 36, flexShrink: 0,
    background: 'var(--ink)',
    border: 'none', borderRadius: 10,
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.15s',
  },
  sendBtnDisabled: { opacity: 0.35, cursor: 'not-allowed' },

  hint: {
    textAlign: 'center',
    fontSize: 10.5,
    color: 'var(--ink-4)',
    fontFamily: "'JetBrains Mono', monospace",
    padding: '0 0 8px',
    flexShrink: 0,
    background: 'var(--surface)',
  },

  /* FAB */
  fab: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '0 20px 0 16px',
    height: 48,
    background: 'var(--ink)',
    color: '#fff',
    border: 'none', borderRadius: 24,
    cursor: 'pointer',
    fontFamily: "'Syne', sans-serif",
    fontWeight: 600, fontSize: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  fabLabel: {},
};

/* typing dot shared base */
function dotBase() {
  return {
    display: 'inline-block',
    width: 7, height: 7,
    borderRadius: '50%',
    background: 'var(--ink-4)',
    animation: 'pulse 1.2s ease infinite',
  };
}