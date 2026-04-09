import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Cpu, ShieldCheck, PlayCircle } from 'lucide-react';
import CyberBrain from './CyberBrain';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

import './App.css';

// --- Custom Renderer for our Source Chips ---
const SourceChip = ({ node, ...props }) => {
  if (props.href && props.href.startsWith('https://source.internal/')) {
    const raw = props.href.replace('https://source.internal/', '');
    const [title, time] = raw.split('/').map(decodeURIComponent);

    // Automatically generate a YouTube Search link since it's an online video course
    // Appending &sp=EgIQAQ%3D%3D explicitly forces YouTube to ONLY show individual videos and blocks Playlists
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}&sp=EgIQAQ%3D%3D`;

    return (
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', display: 'inline-block' }}
      >
        <div className="source-chip">
          <PlayCircle size={16} className="play-icon" />
          <div className="source-details">
            <span className="source-title">{title}</span>
            <span className="source-time">Seek to: {time}</span>
          </div>
        </div>
      </a>
    );
  }
  return <a {...props} />;
};

function App() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Neural link established. Streaming core online. Ask me anything about the course material.' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userQuery = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    setInput('');
    setIsThinking(true);

    try {
      // 1. Fetch Request with Stream Expectation
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery, history: messages.slice(1) }),
      });

      if (!response.ok) {
        throw new Error('Neural network interference detected.');
      }

      // 2. Setup Streaming SSE Decoder
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let fullResponse = "";
      // Pre-add empty system bubble for the stream to write into
      setMessages(prev => [...prev, { role: 'system', content: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });

        // SSE responses can pack multiple "data: {}" lines in one chunk
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const dataObj = JSON.parse(line.substring(5));
              fullResponse += dataObj.chunk;

              setMessages(prev => {
                const newMessages = [...prev];
                // Update the very last message progressively!
                newMessages[newMessages.length - 1].content = fullResponse;
                return newMessages;
              });
            } catch (err) {
              // Ignore partial JSON parse errors in transit
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${error.message}` }]);
    } finally {
      setIsThinking(false);
    }
  };

  const processContent = (text) => {
    // Intercept our custom tag [[SOURCE: title | time]] and convert it into a markdown link
    // We use a dummy HTTPS domain because React-Markdown strips unknown protocols like 'source://'
    return text.replace(/\[\[SOURCE:\s*(.*?)\s*\|\s*(.*?)\s*\]\]/gi, (match, title, time) => {
      return `[SOURCE](https://source.internal/${encodeURIComponent(title.trim())}/${encodeURIComponent(time.trim())})`;
    });
  };

  return (
    <div className="app-container">
      {/* Background 3D Engine */}
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={0.2} />
          <directionalLight position={[10, 10, 10]} intensity={1.5} color="#00f0ff" />
          <pointLight position={[-10, -10, -10]} intensity={1} color="#8000ff" />
          <CyberBrain isThinking={isThinking} />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate={!isThinking} autoRotateSpeed={0.5} />
          <Environment preset="night" />
        </Canvas>
      </div>

      {/* Foreground UI Overlay */}
      <main className="ui-overlay">
        <header className="glass-panel app-header">
          <div className="brand">
            <Cpu size={28} color="var(--accent-cyan)" />
            <h1>NOVA <span>CORE</span></h1>
          </div>
          <div className="security-badge">
            <ShieldCheck size={16} color="#00ff88" />
            <span>SECURE LINK</span>
          </div>
        </header>

        <section className="glass-panel chat-container">
          <div className="messages-area">
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`message-bubble ${msg.role === 'user' ? 'user-bubble' : 'system-bubble'}`}
                >
                  <div className="bubble-content">
                    <ReactMarkdown
                      rehypePlugins={[rehypeHighlight]}
                      components={{ a: SourceChip }}
                    >
                      {processContent(msg.content)}
                    </ReactMarkdown>
                    {/* Gentle pulsing dot for extreme realism during thinking */}
                    {isThinking && msg.role === 'system' && idx === messages.length - 1 && (
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className="cursor"
                      >
                        •
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={endOfMessagesRef} />
          </div>

          <form onSubmit={handleSubmit} className="input-area">
            <div className="input-wrapper">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Initialize query..."
                maxLength={500}
                disabled={isThinking}
              />
              <button type="submit" disabled={isThinking || !input.trim()} className="send-btn">
                <Send size={20} color={isThinking ? 'var(--text-secondary)' : '#fff'} />
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;
