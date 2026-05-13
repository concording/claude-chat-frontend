import { useState, useEffect, useCallback, useRef } from 'react';
import { Tooltip, message as antMessage } from 'antd';
import {
  ShareAltOutlined,
  StarOutlined,
  DownOutlined,
} from '@ant-design/icons';
import Sidebar from './components/Sidebar';
import WelcomePage from './components/WelcomePage';
import ChatView from './components/ChatView';
import ShareDialog from './components/ShareDialog';
import LoginPage from './components/LoginPage';
import type { ChatMessage, ChatSession } from './types';
import { MODELS } from './constants';
import { sendChatMessageStream } from './services/api';
import { getSessions, saveSession, deleteSession } from './services/session';
import { getCurrentUser, isAuthenticated } from './services/auth';
import { initTheme, toggleTheme as toggleThemeService } from './services/theme';
import type { User } from './services/auth';
import './App.css';

const MODEL_ID_MAP: Record<string, string> = {
  'opus-4-7': 'claude-opus-4-7',
  'sonnet-4-6': 'claude-sonnet-4-6',
  'haiku-4-5': 'claude-haiku-4-5-20251001',
};

function generateSessionId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  return firstUser.content.slice(0, 40);
}

export default function App() {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(MODELS[1].id);
  const [shareOpen, setShareOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isReady, setIsReady] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize theme and check auth
  useEffect(() => {
    const savedTheme = initTheme();
    setTheme(savedTheme);

    // Check auth status
    if (isAuthenticated()) {
      const currentUser = getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
      setIsReady(true);
    } else {
      setNeedsAuth(true);
      setIsReady(true);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await getSessions();
      setSessions(list);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    refreshSessions();
  }, [isReady, refreshSessions]);

  const persistSession = useCallback(
    async (sessionId: string, nextMessages: ChatMessage[], sessionModel: string) => {
      if (nextMessages.length === 0) return;
      const existing = sessions.find((s) => s.id === sessionId);
      const now = Date.now();
      const session: ChatSession = {
        id: sessionId,
        title: deriveTitle(nextMessages),
        messages: nextMessages,
        model: sessionModel,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      try {
        await saveSession(session);
        await refreshSessions();
      } catch (err) {
        console.error('Failed to save session:', err);
      }
    },
    [sessions, refreshSessions],
  );

  const handleSend = async (text: string) => {
    const sessionId = activeChat ?? generateSessionId();
    if (!activeChat) setActiveChat(sessionId);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    // Create placeholder for streaming response
    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const apiModel = MODEL_ID_MAP[model] || 'claude-sonnet-4-6';
      let fullResponse = '';
      let fullThinking = '';

      // Stream the response with abort signal
      for await (const chunk of sendChatMessageStream(nextMessages, apiModel, abortControllerRef.current.signal)) {
        if (chunk.type === 'text') {
          fullResponse += chunk.content;
        } else if (chunk.type === 'thinking') {
          fullThinking += chunk.thinking;
        }
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: fullResponse,
              thinking: fullThinking || undefined
            };
          }
          return updated;
        });
      }

      await persistSession(sessionId, [...nextMessages, { ...assistantMsg, content: fullResponse, thinking: fullThinking || undefined }], model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      antMessage.error(`请求失败: ${msg}`);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
          updated[lastIndex] = { ...updated[lastIndex], content: `请求失败: ${msg}` };
        }
        return updated;
      });
      const finalMessages = messages;
      await persistSession(sessionId, [...finalMessages, { ...assistantMsg, content: `请求失败: ${msg}` }], model);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleToggleTheme = () => {
    const nextTheme = toggleThemeService();
    setTheme(nextTheme);
  };

  const handleSelectChat = async (id: string | null) => {
    if (messages.length > 0 && activeChat) {
      await persistSession(activeChat, messages, model);
    }

    if (id === null) {
      setActiveChat(null);
      setMessages([]);
      setModel(MODELS[1].id);
    } else {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        setActiveChat(session.id);
        setMessages(session.messages);
        setModel(session.model);
      }
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteSession(id);
      await refreshSessions();
      if (activeChat === id) {
        setActiveChat(null);
        setMessages([]);
        setModel(MODELS[1].id);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleEditTitle = () => {
    setTitleInput(deriveTitle(messages));
    setEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (activeChat && titleInput.trim()) {
      const newTitle = titleInput.trim();
      const session = sessions.find((s) => s.id === activeChat);
      if (session) {
        const updatedSession: ChatSession = {
          ...session,
          title: newTitle,
          updatedAt: Date.now(),
        };
        try {
          await saveSession(updatedSession);
          await refreshSessions();
        } catch (err) {
          console.error('Failed to update title:', err);
        }
      }
    }
    setEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setEditingTitle(false);
    setTitleInput('');
  };

  const hasConversation = messages.length > 0;
  const currentTitle = hasConversation
    ? deriveTitle(messages)
    : activeChat
      ? '仿照claude官网实现项目'
      : 'New chat';

  // Show loading until auth check is complete
  if (!isReady) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (needsAuth) {
    return <LoginPage />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        sessions={sessions}
        user={user}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
      />

      <main className="main-content">
        <header className="main-header">
          {editingTitle ? (
            <div className="header-title-edit">
              <input
                type="text"
                className="title-edit-input"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') handleCancelEditTitle();
                }}
                autoFocus
              />
              <button className="title-edit-btn save" onClick={handleSaveTitle}>Save</button>
              <button className="title-edit-btn cancel" onClick={handleCancelEditTitle}>Cancel</button>
            </div>
          ) : (
            <div className="header-title" onClick={hasConversation ? handleEditTitle : undefined}>
              <span>{currentTitle}</span>
              {hasConversation && <DownOutlined style={{ fontSize: 10, color: 'var(--text-tertiary)' }} />}
            </div>
          )}
          <div className="header-actions">
            <Tooltip title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              <button className="header-btn" onClick={handleToggleTheme}>
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </Tooltip>
            <Tooltip title="Star">
              <button className="header-btn" style={{ padding: 7, width: 34 }}>
                <StarOutlined />
              </button>
            </Tooltip>
            <button
              className="header-btn"
              onClick={() => setShareOpen(true)}
            >
              <ShareAltOutlined />
              <span>Share</span>
            </button>
          </div>
        </header>

        {hasConversation ? (
          <ChatView
            messages={messages}
            onSend={handleSend}
            onEditMessage={(messageId, newContent) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId ? { ...m, content: newContent } : m
                )
              );
            }}
            loading={loading}
            model={model}
            onModelChange={setModel}
            onStop={handleStop}
          />
        ) : (
          <WelcomePage
            onSend={handleSend}
            model={model}
            onModelChange={setModel}
            user={user}
          />
        )}
      </main>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} conversationId={activeChat ?? undefined} />
    </div>
  );
}
