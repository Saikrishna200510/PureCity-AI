import { useEffect, useState, useRef } from 'react';
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  AlertTriangle,
  MessageSquare,
  Info,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext } from '../contexts/LocationContext';
import { apiRequest } from '../services/apiClient';
import {
  subscribeChatConversations,
  createChatConversation,
  appendChatMessages,
  deleteChatConversation,
} from '../services/firestoreService';
import { getDisplayAqi, getAqiCategory, formatTimestamp } from '../utils/aqi';

const QUICK_PROMPTS = [
  'Is it safe to go for a run today?',
  'Why is the air quality at this level in my city?',
  'What does PM2.5 mean and why does it matter?',
  'What practical steps can reduce my daily pollution exposure?',
];

export default function AssistantPage() {
  const { user, userProfile } = useAuth();
  const { selectedCity, currentReading, aqiStandard } = useLocationContext();

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [configGuide, setConfigGuide] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeChatConversations(user.uid, (list) => {
      setConversations(list);
      if (list.length > 0 && !activeConvId) {
        setActiveConvId(list[0].id);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;
  const messages = activeConv?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleNewChat() {
    if (!user?.uid) return;
    setErrorMsg('');
    const docRef = await createChatConversation(user.uid, `${selectedCity?.name} Air Chat`, {
      name: selectedCity?.name,
      lat: selectedCity?.lat,
      lon: selectedCity?.lon,
    });
    setActiveConvId(docRef.id);
  }

  async function handleSend(promptText = input) {
    const trimmed = promptText.trim();
    if (!trimmed || sending || !user?.uid) return;

    setErrorMsg('');
    setConfigGuide(false);
    setSending(true);
    setInput('');

    let convId = activeConvId;
    let existingMessages = messages;
    let prevInteractionId = activeConv?.lastInteractionId || null;

    try {
      if (!convId) {
        const docRef = await createChatConversation(user.uid, trimmed.slice(0, 50), {
          name: selectedCity?.name,
          lat: selectedCity?.lat,
          lon: selectedCity?.lon,
        });
        convId = docRef.id;
        setActiveConvId(convId);
        existingMessages = [];
      }

      const userMsg = {
        id: `u_${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
      };

      const updatedWithUser = [...existingMessages, userMsg];
      await appendChatMessages(
        convId,
        updatedWithUser,
        prevInteractionId,
        existingMessages.length === 0 ? trimmed.slice(0, 50) : null
      );

      const response = await apiRequest('/assistant', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          previousInteractionId: prevInteractionId,
          cityContext: {
            name: selectedCity?.name,
            state: selectedCity?.state,
            country: selectedCity?.country,
            lat: selectedCity?.lat,
            lon: selectedCity?.lon,
            reading: currentReading?.unavailable ? null : currentReading,
          },
          userPreferences: {
            activityPreference: userProfile?.activityPreference || 'general',
            sensitivityGroup: userProfile?.sensitivityGroup || 'standard',
            preferredStandard: aqiStandard,
          },
        }),
      });

      const assistantMsg = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: response.reply,
        timestamp: response.groundedAt || new Date().toISOString(),
        model: response.model,
      };

      await appendChatMessages(convId, [...updatedWithUser, assistantMsg], response.interactionId || null);
    } catch (err) {
      if (err.code === 'GEMINI_NOT_CONFIGURED' || err.status === 503 || err.status === 404) {
        setConfigGuide(true);
      }
      setErrorMsg(err.message || 'Failed to get AI response.');
    } finally {
      setSending(false);
    }
  }

  const displayAqi = getDisplayAqi(currentReading, aqiStandard);
  const cat = getAqiCategory(displayAqi, aqiStandard);

  return (
    <div className="grid lg:grid-cols-12 gap-5 h-[calc(100vh-8.5rem)] min-h-[560px]">
      {/* Conversation Sidebar */}
      <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Conversations</span>
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-slate-400 p-4 text-center">No chats yet. Ask a question to begin.</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition ${
                  c.id === activeConvId
                    ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => setActiveConvId(c.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span className="truncate">{c.title}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChatConversation(c.id);
                    if (activeConvId === c.id) setActiveConvId(null);
                  }}
                  aria-label="Delete conversation"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
        {/* Grounded Live Context Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">PureCity Gemini AI Assistant</h1>
              <p className="text-[11px] text-slate-500">
                Grounded in {selectedCity?.name} •{' '}
                {currentReading?.unavailable ? (
                  <span className="text-amber-700 font-semibold">Live data unavailable</span>
                ) : (
                  <span>
                    {aqiStandard} AQI: <strong style={{ color: cat.hex }}>{displayAqi ?? 'N/A'}</strong> ({cat.shortLabel})
                    • PM2.5: {currentReading?.pm25 != null ? `${currentReading.pm25.toFixed(1)} µg/m³` : '—'}
                  </span>
                )}
              </p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            General guidance • Not medical advice
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-xl mx-auto py-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Ask anything about {selectedCity?.name}'s air quality
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Responses are powered by Google Gemini via a secure Cloud Function and strictly grounded in live
                readings.
              </p>
              <div className="mt-5 grid sm:grid-cols-2 gap-2.5 text-left">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 text-xs font-medium text-slate-700 transition cursor-pointer"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200/70'
                }`}
              >
                {m.text}
                <div
                  className={`mt-1.5 text-[10px] ${
                    m.role === 'user' ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {formatTimestamp(m.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                Analyzing live air quality context with Gemini...
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{errorMsg}</p>
                {configGuide && (
                  <p className="mt-1.5 text-rose-800">
                    To activate the Gemini AI Assistant: add <code>GEMINI_API_KEY</code> to{' '}
                    <code>functions/.env</code> and run Firebase Emulators (<code>firebase emulators:start</code>) or
                    deploy Cloud Functions (<code>firebase deploy --only functions</code>).
                  </p>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3.5 border-t border-slate-200 bg-white flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${selectedCity?.name} air quality, PM2.5, or outdoor plans...`}
            className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
