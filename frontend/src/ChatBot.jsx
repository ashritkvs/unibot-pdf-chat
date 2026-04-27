import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const ChatBot = () => {
  const API_BASE = 'http://localhost:8000';

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user'|'bot', content: string }

  const scrollerRef = useRef(null);

  const selectedFileName = useMemo(() => {
    if (!selectedFile) return '';
    return selectedFile.name || 'selected.pdf';
  }, [selectedFile]);

  const scrollToBottom = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, thinking]);

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.status === 'success') {
        setIsReady(true);
        setMessages([]);
      } else {
        setUploadError(res.data?.error ?? 'Upload failed. Please try again.');
      }
    } catch (err) {
      const backendMsg = err?.response?.data?.error;
      setUploadError(backendMsg ?? err?.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || thinking || !isReady) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setThinking(true);

    try {
      const res = await axios.post(`${API_BASE}/ask`, { question });
      const answer = res.data?.answer ?? 'Sorry — I did not get an answer back.';
      setMessages((prev) => [...prev, { role: 'bot', content: answer }]);
    } catch (err) {
      const backendMsg = err?.response?.data?.error;
      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: backendMsg ?? 'Request failed. Check the backend logs.' },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const uploadHidden = isReady && !uploadError;

  return (
    <div className="unibotRoot">
      <style>{CSS}</style>

      <div className="unibotBgGlow" />

      <div className="unibotShell">
        <header className="unibotHeader">
          <div className="unibotTitleRow">
            <div className="unibotLogo">🎓</div>
            <div>
              <div className="unibotTitle">UniBot</div>
              <div className="unibotSubtitle">Ask anything about your document</div>
            </div>
          </div>
          <div className="unibotAccentBar" />
        </header>

        <main className="unibotCard">
          {!uploadHidden && (
            <section className="uploadCard">
              <div className="uploadTop">
                <div className="uploadLeft">
                  <label className="fileButton">
                    <UploadIcon />
                    <span>Choose PDF</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      disabled={uploading}
                    />
                  </label>
                  <div className="fileName" title={selectedFileName || ''}>
                    {selectedFile ? selectedFileName : 'No file selected'}
                  </div>
                </div>

                <button
                  className="uploadAction"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <Spinner />
                      <span>Processing…</span>
                    </>
                  ) : (
                    <>
                      <span>Upload & Process</span>
                      <ArrowRightIcon />
                    </>
                  )}
                </button>
              </div>

              {!uploading && uploadError && <div className="uploadError">❌ {uploadError}</div>}
              {!uploading && isReady && !uploadError && (
                <div className="uploadSuccess">
                  <span className="check">✅</span>
                  <span>Ready! Ask your questions.</span>
                </div>
              )}
              {uploading && <div className="uploadHint">Chunking → Embedding → Upserting to Pinecone…</div>}
            </section>
          )}

          <section className="chatArea" ref={scrollerRef}>
            {!isReady ? (
              <div className="emptyState">
                <div className="emptyTitle">Upload a PDF to get started</div>
                <div className="emptySub">
                  UniBot will process your document and then you can ask questions in a chat.
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, idx) => (
                  <ChatBubble key={idx} role={m.role} content={m.content} />
                ))}
                {thinking && (
                  <div className="row bot">
                    <div className="avatar">🎓</div>
                    <div className="bubble botBubble">
                      <TypingDots />
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <footer className="inputBar">
            <div className={`inputWrap ${!isReady ? 'disabled' : ''}`}>
              <textarea
                className="chatInput"
                placeholder={isReady ? 'Ask a question…' : 'Upload a PDF to enable chat'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                disabled={!isReady || thinking}
                rows={1}
              />
              <button
                className="sendBtn"
                onClick={sendMessage}
                disabled={!isReady || thinking || !input.trim()}
                title="Send"
              >
                <SendIcon />
              </button>
            </div>
            <div className="inputNote">
              Press <kbd>Enter</kbd> to send • <kbd>Shift</kbd> + <kbd>Enter</kbd> for a newline
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

const ChatBubble = ({ role, content }) => {
  if (role === 'user') {
    return (
      <div className="row user">
        <div className="bubble userBubble">{content}</div>
      </div>
    );
  }
  return (
    <div className="row bot">
      <div className="avatar">🎓</div>
      <div className="bubble botBubble">{content}</div>
    </div>
  );
};

const TypingDots = () => {
  return (
    <span className="typingDots" aria-label="UniBot is thinking">
      <span className="dot d1" />
      <span className="dot d2" />
      <span className="dot d3" />
    </span>
  );
};

const Spinner = () => <span className="spinner" aria-hidden="true" />;

const UploadIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 16V4m0 0 4 4M12 4 8 8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 12h12m0 0-5-5m5 5-5 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SendIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M22 2 11 13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 2 15 22l-4-9-9-4 20-7Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CSS = `
.unibotRoot{
  width: 100vw;
  height: 100vh;
  background: #0f0f1a;
  color: #eaeaf2;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
}
.unibotBgGlow{
  position: fixed;
  inset: -40%;
  background:
    radial-gradient(circle at 25% 20%, rgba(124, 58, 237, 0.28), transparent 40%),
    radial-gradient(circle at 75% 30%, rgba(56, 189, 248, 0.22), transparent 38%),
    radial-gradient(circle at 55% 80%, rgba(99, 102, 241, 0.18), transparent 42%);
  filter: blur(18px);
  pointer-events: none;
}
.unibotShell{
  width: min(900px, calc(100vw - 32px));
  height: min(920px, calc(100vh - 28px));
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.unibotHeader{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 14px 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(12, 12, 22, 0.55);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}
.unibotTitleRow{ display:flex; align-items:center; gap:12px; }
.unibotLogo{
  width: 42px; height: 42px;
  display:flex; align-items:center; justify-content:center;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22));
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 12px 30px rgba(0,0,0,0.35);
  font-size: 20px;
}
.unibotTitle{
  font-size: 18px;
  letter-spacing: 0.2px;
  font-weight: 700;
  line-height: 1.1;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.unibotSubtitle{
  margin-top: 2px;
  font-size: 13px;
  color: rgba(224, 224, 224, 0.88);
}
.unibotAccentBar{
  width: 130px;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(96,165,250,0.85), rgba(167,139,250,0.85));
  filter: blur(0.1px);
  opacity: 0.9;
}
.unibotCard{
  position: relative;
  flex: 1;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.09);
  background: rgba(10, 10, 18, 0.68);
  backdrop-filter: blur(14px);
  overflow: hidden;
  display:flex;
  flex-direction: column;
}
.uploadCard{
  padding: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.00));
}
.uploadTop{ display:flex; gap: 12px; align-items:center; justify-content:space-between; flex-wrap: wrap; }
.uploadLeft{ display:flex; align-items:center; gap: 12px; min-width: 280px; }
.fileButton{
  position: relative;
  display:inline-flex; gap:8px; align-items:center;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.92);
  cursor:pointer;
  user-select:none;
  transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
}
.fileButton:hover{ transform: translateY(-1px); background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.18); }
.fileButton input{ position:absolute; inset:0; opacity:0; cursor:pointer; }
.fileName{
  max-width: 420px;
  font-size: 13px;
  color: rgba(224,224,224,0.86);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.uploadAction{
  display:inline-flex;
  gap:10px;
  align-items:center;
  justify-content:center;
  border: none;
  padding: 11px 14px;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(59,130,246,0.92), rgba(124,58,237,0.92));
  color: white;
  font-weight: 650;
  cursor: pointer;
  transition: transform 140ms ease, filter 140ms ease, opacity 140ms ease;
  box-shadow: 0 18px 46px rgba(0,0,0,0.38);
}
.uploadAction:hover{ transform: translateY(-1px); filter: brightness(1.02); }
.uploadAction:disabled{ opacity: 0.55; cursor:not-allowed; transform:none; }
.uploadError{
  margin-top: 10px;
  font-size: 13px;
  color: rgba(248,113,113,0.98);
}
.uploadSuccess{
  margin-top: 10px;
  font-size: 13px;
  color: rgba(134,239,172,0.96);
  display:flex; align-items:center; gap:8px;
}
.uploadHint{
  margin-top: 10px;
  font-size: 12px;
  color: rgba(224,224,224,0.70);
}
.chatArea{
  flex: 1;
  overflow: auto;
  padding: 18px 16px 110px 16px;
  scroll-behavior: smooth;
}
.emptyState{
  height: calc(100% - 24px);
  display:flex;
  align-items:center;
  justify-content:center;
  flex-direction: column;
  text-align:center;
  padding: 24px;
  color: rgba(224,224,224,0.90);
}
.emptyTitle{
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
}
.emptySub{
  font-size: 13px;
  max-width: 520px;
  color: rgba(224,224,224,0.72);
}
.row{ display:flex; margin: 10px 0; }
.row.user{ justify-content: flex-end; }
.row.bot{ justify-content: flex-start; align-items:flex-start; gap:10px; }
.avatar{
  width: 30px; height: 30px;
  border-radius: 10px;
  display:flex; align-items:center; justify-content:center;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  flex: 0 0 auto;
}
.bubble{
  max-width: min(680px, calc(100% - 40px));
  padding: 12px 14px;
  border-radius: 16px;
  line-height: 1.55;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.userBubble{
  background: linear-gradient(180deg, rgba(59,130,246,0.95), rgba(37,99,235,0.92));
  color: #ffffff;
  border: 1px solid rgba(147,197,253,0.20);
  box-shadow: 0 20px 44px rgba(0,0,0,0.35);
  border-bottom-right-radius: 6px;
}
.botBubble{
  background: rgba(255,255,255,0.04);
  color: rgba(224,224,224,0.92);
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 12px 30px rgba(0,0,0,0.28);
  border-bottom-left-radius: 6px;
}
.inputBar{
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 14px 16px 16px 16px;
  background: linear-gradient(180deg, rgba(10,10,18,0.00), rgba(10,10,18,0.86) 30%, rgba(10,10,18,0.92));
  border-top: 1px solid rgba(255,255,255,0.08);
}
.inputWrap{
  display:flex;
  gap: 10px;
  align-items: center;
  padding: 10px 10px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.03);
}
.inputWrap.disabled{ opacity: 0.55; }
.chatInput{
  width: 100%;
  resize: none;
  background: transparent;
  border: none;
  outline: none;
  color: #ffffff;
  font-size: 14px;
  line-height: 1.4;
  max-height: 140px;
  padding: 2px 6px;
}
.chatInput::placeholder{ color: rgba(224,224,224,0.56); }
.sendBtn{
  width: 42px; height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.12);
  background: linear-gradient(90deg, rgba(59,130,246,0.95), rgba(124,58,237,0.95));
  color: white;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor: pointer;
  transition: transform 140ms ease, opacity 140ms ease, filter 140ms ease;
}
.sendBtn:hover{ transform: translateY(-1px); filter: brightness(1.03); }
.sendBtn:disabled{ opacity: 0.55; cursor:not-allowed; transform:none; }
.inputNote{
  margin-top: 10px;
  font-size: 11.5px;
  color: rgba(224,224,224,0.60);
  text-align: center;
}
kbd{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.92);
}
.icon{ width: 18px; height: 18px; }
.spinner{
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: rgba(255,255,255,0.95);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.typingDots{ display:inline-flex; gap: 6px; align-items:center; }
.typingDots .dot{
  width: 7px; height: 7px; border-radius: 999px;
  background: rgba(224,224,224,0.75);
  animation: bounce 1.15s infinite ease-in-out;
}
.typingDots .d2{ animation-delay: 0.14s; opacity: 0.9; }
.typingDots .d3{ animation-delay: 0.28s; opacity: 0.85; }
@keyframes bounce{
  0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
  40% { transform: translateY(-4px); opacity: 1; }
}
.chatArea::-webkit-scrollbar{ width: 10px; }
.chatArea::-webkit-scrollbar-thumb{
  background: rgba(255,255,255,0.10);
  border-radius: 999px;
  border: 2px solid rgba(10,10,18,0.92);
}
`;

export default ChatBot;
