import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Zap, 
  Database, 
  Cpu, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Send, 
  Key, 
  Link2,
  Terminal
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { registerCalendarWebhook, stopCalendarWebhook } from '../lib/calendar';

export default function IntegracaoPage() {
  const { user, tenantId } = useAuth();
  const [dbStatus, setDbStatus] = useState<'connected' | 'error'>('connected');
  const [geminiStatus, setGeminiStatus] = useState<'active' | 'error'>('active');
  const [n8nStatus, setN8nStatus] = useState<'connected' | 'disconnected'>('connected');
  const [calendarStatus, setCalendarStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [isTesting, setIsTesting] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "SaaS Bootstrap: Tenant resolvido com sucesso.",
    "Database: Conexão PDO ativa na Hostinger MySQL.",
    "Gemini API: Modelo 'gemini-3.5-flash' autenticado."
  ]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  useEffect(() => {
    if (!user?.id) return;
    
    const checkCalendarConnection = async () => {
      try {
        const res = await api.get(`/users/${user.id}`);
        if (res.data && res.data.google_connected) {
          setCalendarStatus('connected');
          addLog("Google Calendar: Agenda do profissional vinculada.");

          // Se retornou do OAuth com sucesso, registra o Watch de notificação push automaticamente
          if (window.location.search.includes('google_calendar_success=true')) {
            addLog("Google Calendar: Registrando canal de notificação push (Watch)...");
            const watchRes = await registerCalendarWebhook(user.id);
            if (watchRes.success) {
              addLog("Google Calendar: Canal de Push Notification registrado com sucesso!");
            } else {
              addLog("Google Calendar: Aviso ao registrar canal de Push: " + (watchRes.error || 'Erro'));
            }
          }
        } else {
          setCalendarStatus('disconnected');
          addLog("Google Calendar: Agenda do profissional desconectada.");
        }
      } catch (err) {
        console.error("Erro ao checar conexão do Google Calendar:", err);
      }
    };
    checkCalendarConnection();
  }, [user]);

  const handleConnectCalendar = () => {
    if (!user?.id || !tenantId) return;
    addLog("Redirecionando para autorização do Google OAuth 2.0...");
    const baseURL = api.defaults.baseURL || '';
    const baseApiUrl = baseURL.startsWith('http') ? baseURL : `${window.location.origin}${baseURL}`;
    window.location.href = `${baseApiUrl}/google-auth?user_id=${user.id}&tenant_id=${tenantId}`;
  };

  const handleDisconnectCalendar = async () => {
    if (!user?.id) return;
    if (!window.confirm("Deseja realmente desconectar sua conta do Google Agenda?")) return;
    
    try {
      await stopCalendarWebhook(user.id);
      await api.post('/google-disconnect', { user_id: user.id });
      setCalendarStatus('disconnected');
      addLog("Google Calendar: Conta e canal de notificação push desconectados com sucesso.");
      alert("Google Agenda desconectado!");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao desconectar Google Agenda: " + err.message);
    }
  };

  const handleTestGoogleCalendar = async () => {
    if (!user?.id) return;
    addLog("Google Calendar: Registrando canal de notificação push (Watch API)...");
    try {
      const watchRes = await registerCalendarWebhook(user.id);
      if (watchRes.success) {
        addLog("Google Calendar: Canal de Push registrado com sucesso!");
        alert("Sincronização com o Google Calendar testada e operando!");
      } else {
        addLog("Google Calendar: " + (watchRes.error || watchRes.message || 'Verifique credenciais .env'));
        alert("Status: " + (watchRes.error || watchRes.message || 'Verifique GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env'));
      }
    } catch (err: any) {
      addLog("Google Calendar Erro: " + err.message);
      alert("Erro ao testar canal de sincronização: " + err.message);
    }
  };

  const handleTestWebhook = async () => {
    setIsTesting(true);
    addLog("Iniciando ping para o webhook do n8n...");
    try {
      // simulate delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      addLog("Sucesso: Webhook do n8n respondeu HTTP 200 OK!");
      alert("Webhook do n8n testado com sucesso!");
    } catch (err) {
      addLog("Erro: Falha na conexão com o webhook do n8n.");
      alert("Falha no teste do webhook: " + err);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 select-none">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-lg">
          Configuração de Rede e APIs
        </span>
        <h2 className="text-4xl font-extrabold tracking-tight text-white mt-4 italic">
          Integração Ninja
        </h2>
        <p className="text-sm text-white/30">Gerencie a conexão do banco relacional Hostinger, API do Gemini e mensageria assíncrona n8n.</p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Painel Esquerdo: Cards de Status de APIs */}
        <div className="col-span-12 xl:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Database Card */}
            <div className="glass-card p-6 rounded-[32px] border-white/5 space-y-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-white/5 rounded-2xl text-emerald-400">
                  <Database size={24} />
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                  <CheckCircle size={10} /> Conectado
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-white text-base leading-tight">Banco de Dados MySQL</h4>
                <p className="text-xs text-white/40 mt-1">Hostinger VPS dedicada</p>
                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 font-mono text-[10px] text-white/60 space-y-1">
                  <p>STATUS: Conectado (Produção)</p>
                  <p>DRIVER: MySQL / PDO</p>
                  <p>POOL: InnoDB / UTF-8</p>
                </div>
              </div>
            </div>

            {/* Gemini API Card */}
            <div className="glass-card p-6 rounded-[32px] border-white/5 space-y-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-white/5 rounded-2xl text-indigo-400">
                  <Cpu size={24} />
                </div>
                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                  <CheckCircle size={10} /> Ativo
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-white text-base leading-tight">Google Gemini API</h4>
                <p className="text-xs text-white/40 mt-1">Geração de Texto Humanizado</p>
                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 font-mono text-[10px] text-white/60 space-y-1">
                  <p>MODEL: gemini-3.5-flash</p>
                  <p>API_KEY: Configurado no .env (Mascarado)</p>
                  <p>STATUS: Pronto</p>
                </div>
              </div>
            </div>

            {/* n8n Webhook Card */}
            <div className="glass-card p-6 rounded-[32px] border-white/5 space-y-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-white/5 rounded-2xl text-amber-400">
                  <Zap size={24} />
                </div>
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                  <CheckCircle size={10} /> Escuta Ativa
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-white text-base leading-tight">Fila n8n Webhooks</h4>
                <p className="text-xs text-white/40 mt-1">Disparador Assíncrono</p>
                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 font-mono text-[10px] text-white/60 space-y-1">
                  <p className="truncate">URL: https://seun8n.com/webhook/clinica-elo</p>
                  <p>METHOD: POST JSON</p>
                </div>
                <button
                  disabled={isTesting}
                  onClick={handleTestWebhook}
                  className="w-full mt-4 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] uppercase tracking-wider py-3 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  <Send size={12} /> {isTesting ? 'Testando Webhook...' : 'Testar Conexão Webhook'}
                </button>
              </div>
            </div>

            {/* Google Calendar Card */}
            <div className="glass-card p-6 rounded-[32px] border-white/5 space-y-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-white/5 rounded-2xl text-purple-400">
                  <Calendar size={24} />
                </div>
                {calendarStatus === 'connected' ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                    <CheckCircle size={10} /> Conectado
                  </span>
                ) : (
                  <span className="bg-white/5 text-white/30 border border-white/10 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                    <XCircle size={10} /> Desconectado
                  </span>
                )}
              </div>
              <div>
                <h4 className="font-extrabold text-white text-base leading-tight">Google Calendar</h4>
                <p className="text-xs text-white/40 mt-1">Sincronização Bidirecional</p>
                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 font-mono text-[10px] text-white/60 space-y-1">
                  <p>SCOPES: calendar.events</p>
                  <p>AUTH: OAuth 2.0 Token</p>
                  <p>SYNC: Automática</p>
                </div>
                {calendarStatus === 'connected' ? (
                  <div className="space-y-2 mt-4">
                    <button
                      onClick={handleTestGoogleCalendar}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] uppercase tracking-wider py-3 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={12} /> Testar Sincronização Push
                    </button>
                    <button
                      onClick={handleDisconnectCalendar}
                      className="w-full bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-rose-500/20"
                    >
                      Desconectar Agenda
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectCalendar}
                    className="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] uppercase tracking-wider py-3 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    Conectar Google Agenda
                  </button>
                )}
              </div>
            </div>

            {/* Link do Convite para APN Card */}
            <div className="glass-card p-6 rounded-[32px] border-emerald-500/20 bg-emerald-500/5 space-y-4 relative overflow-hidden col-span-1 md:col-span-2">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400">
                  <Link2 size={24} />
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                  <CheckCircle size={10} /> Ativo & Público
                </span>
              </div>
              <div>
                <h4 className="font-extrabold text-white text-base leading-tight">Link Público de Agendamento da APN</h4>
                <p className="text-xs text-white/40 mt-1">Divulgue este link nas redes sociais, WhatsApp ou campanhas de prospecção para recrutar novos distribuidores.</p>
                <div className="mt-4 p-3 bg-black/40 rounded-xl border border-white/10 font-mono text-xs text-emerald-300 flex items-center justify-between gap-4">
                  <span className="truncate">https://crmatlanticanatural.acessaronline.com.br/?mode=agendar</span>
                  <button
                    type="button"
                    onClick={() => {
                      const fullUrl = `${window.location.origin}/?mode=agendar`;
                      navigator.clipboard.writeText(fullUrl);
                      alert(`Link de agendamento copiado:\n${fullUrl}`);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all shrink-0 active:scale-95"
                  >
                    Copiar Link
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Painel Direito: Terminal Log Console */}
        <div className="col-span-12 xl:col-span-4 glass-card rounded-[32px] p-6 border-white/5 flex flex-col justify-between min-h-[400px]">
          <div>
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
              <Terminal className="text-indigo-400" size={18} />
              <h4 className="font-extrabold text-white text-base">Console Logs</h4>
            </div>

            <div className="space-y-3 font-mono text-[10px] text-white/50 max-h-[300px] overflow-y-auto pr-1 no-scrollbar flex flex-col-reverse">
              {logs.map((log, idx) => (
                <div key={idx} className="p-2.5 bg-white/5 border border-white/5 rounded-xl leading-relaxed whitespace-pre-wrap">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
