import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, PauseCircle, PlayCircle, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { Client, ChatMessage } from '../types';

interface ChatWindowProps {
  patient: Client;
  onUpdatePatientStatus: (id: string, newStatus: 'active' | 'paused') => void;
  onBackToList?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ patient, onUpdatePatientStatus, onBackToList }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const res = await api.get(`/messages?patient_id=${patient.id}`);
      setMessages(res.data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadMessages();
    
    // Polling otimizado com Page Visibility API
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadMessages();
    }, 5000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [patient.id]);

  useEffect(() => {
    // Scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Optimistic UI
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      tenant_id: '',
      patient_id: patient.id,
      direction: 'outbound',
      content,
      sender_name: 'Humano',
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      await api.post('/messages', {
        patient_id: patient.id,
        content
      });
      await loadMessages(); // recarrega para ter o ID real e data do servidor
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      // Remove optimistic message if error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert('Falha ao enviar a mensagem. Verifique se a Evolution API está configurada.');
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleBot = async () => {
    const newStatus = patient.bot_status === 'paused' ? 'active' : 'paused';
    // Otimista
    onUpdatePatientStatus(patient.id, newStatus);
    try {
      await api.put(`/patients/${patient.id}/bot-status`, { bot_status: newStatus });
    } catch (error) {
      console.error('Erro ao alterar status do bot:', error);
      // Reverter
      onUpdatePatientStatus(patient.id, patient.bot_status || 'active');
      alert('Falha ao alterar o controle da IA.');
    }
  };

  const isPaused = patient.bot_status === 'paused';

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950 border-l border-white/5">
      {/* Header */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between p-3 sm:p-4 border-b border-white/5 bg-zinc-900/50 gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onBackToList && (
            <button 
              onClick={onBackToList}
              className="md:hidden p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-white shrink-0"
              title="Voltar aos contatos"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-medium text-zinc-200 truncate">{patient.name}</h3>
            <p className="text-[10px] sm:text-xs text-zinc-500 truncate">{patient.phone}</p>
          </div>
        </div>

        <button
          onClick={handleToggleBot}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-colors shrink-0 ${
            isPaused 
              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
              : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20'
          }`}
        >
          {isPaused ? (
            <>
              <PauseCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">IA Pausada (Atendimento Humano)</span>
              <span className="sm:hidden">IA Pausada</span>
            </>
          ) : (
            <>
              <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>IA Ativa</span>
            </>
          )}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-zinc-500 text-sm">
            Nenhuma mensagem neste histórico ainda.
          </div>
        ) : (
          messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1 mb-1 px-1">
                  {msg.sender_name === 'IA' && <Bot className="w-3 h-3 text-emerald-400" />}
                  {msg.sender_name === 'Humano' && <User className="w-3 h-3 text-blue-400" />}
                  <span className="text-[10px] text-zinc-500 font-medium">
                    {msg.sender_name}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    • {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                    isOutbound
                      ? 'bg-emerald-600/20 text-emerald-100 rounded-tr-sm border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-200 rounded-tl-sm border border-zinc-700'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-zinc-900/50">
        {!isPaused && (
          <div className="mb-2 text-xs text-amber-500 flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Pause a IA no topo antes de enviar uma mensagem manual para evitar conflitos de resposta.
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isPaused ? "Digite sua mensagem..." : "Pause a IA primeiro..."}
            className="flex-1 bg-zinc-950 border border-white/10 rounded-full px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            type="submit"
            disabled={isSending || !inputText.trim()}
            className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;


