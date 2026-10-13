import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, 
  QrCode, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  LogOut, 
  Loader2, 
  AlertCircle, 
  Shield, 
  Save, 
  Bot, 
  Terminal, 
  Globe, 
  Key, 
  Zap 
} from 'lucide-react';
import api from '../lib/api';

export type WhatsappConnectionState = 'open' | 'connecting' | 'close' | 'loading' | 'error';

export const Settings: React.FC = () => {
  // Estados da Instância do WhatsApp (Evolution API)
  const [connectionState, setConnectionState] = useState<WhatsappConnectionState>('loading');
  const [instanceName, setInstanceName] = useState<string>('');
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Estados dos Formulários das Configurações do Tenant
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperatura, setTemperatura] = useState(0.70);
  const [provider, setProvider] = useState('Evolution API');
  const [instanceId, setInstanceId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [evolutionUrl, setEvolutionUrl] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const prevConnectionStateRef = useRef<WhatsappConnectionState>('loading');

  const triggerNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setShowToast({ message, type });
    setTimeout(() => setShowToast(null), 4000);
  };

  // Carregar Configurações do Tenant
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data) {
          setSystemPrompt(res.data.system_prompt || '');
          setTemperatura(parseFloat(res.data.temperatura) || 0.70);
          setProvider(res.data.provider || 'Evolution API');
          setInstanceId(res.data.instance_id || '');
          setApiKey(res.data.api_key || '');
          setEvolutionUrl(res.data.evolution_url || '');
          setGeminiApiKey(res.data.gemini_apikey || '');
        }
      } catch (err) {
        console.error("Erro ao carregar configurações do servidor:", err);
      }
    };
    fetchSettings();
  }, []);

  // Consultar Status da Conexão via Proxy Backend
  const checkStatus = async () => {
    if (document.hidden) return; // Page Visibility API Optimization
    try {
      const res = await api.get('/whatsapp/status');
      const state: WhatsappConnectionState = res.data.state || (res.data.status === 'connected' ? 'open' : 'close');
      setInstanceName(res.data.instanceName || instanceId || 'Instância WhatsApp');
      
      // Notificar transição para 'open'
      if (prevConnectionStateRef.current !== 'open' && state === 'open') {
        triggerNotification('WhatsApp conectado com sucesso!', 'success');
        setQrCodeBase64(null);
      }
      
      prevConnectionStateRef.current = state;
      setConnectionState(state);
      setErrorMessage('');
    } catch (err: any) {
      setConnectionState('error');
      setErrorMessage(err.response?.data?.error || 'Falha ao comunicar com o servidor proxy do WhatsApp.');
    }
  };

  // Polling Leve (a cada 4 segundos)
  useEffect(() => {
    checkStatus();

    const intervalId = setInterval(() => {
      if (connectionState !== 'open') {
        checkStatus();
      }
    }, 4000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectionState]);

  // Buscar / Gerar QR Code
  const handleFetchQrCode = async () => {
    setIsGeneratingQr(true);
    setErrorMessage('');
    try {
      const res = await api.get('/whatsapp/qrcode');
      if (res.data.base64) {
        const raw = res.data.base64;
        const clean = raw.includes('|') ? raw.split('|')[0] : raw;
        setQrCodeBase64(clean);
        setConnectionState('connecting');
        triggerNotification('QR Code gerado. Escaneie no WhatsApp do celular.', 'success');
      } else {
        throw new Error('Nenhum QR Code retornado pela Evolution API.');
      }
    } catch (err: any) {
      console.error('Erro ao gerar QR Code:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Erro ao gerar QR Code.');
      triggerNotification('Erro ao obter QR Code.', 'error');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  // Desconectar Sessão
  const handleDisconnect = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar a sessão do WhatsApp? Os disparos automáticos serão pausados.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      await api.post('/whatsapp/disconnect');
      setQrCodeBase64(null);
      setConnectionState('close');
      triggerNotification('WhatsApp desconectado com sucesso.', 'success');
      checkStatus();
    } catch (err: any) {
      console.error('Erro ao desconectar:', err);
      alert('Falha ao desconectar: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Salvar Configurações
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put('/settings', {
        system_prompt: systemPrompt,
        temperatura: parseFloat(temperatura.toString()),
        provider,
        instance_id: instanceId,
        api_key: apiKey,
        evolution_url: evolutionUrl,
        gemini_apikey: geminiApiKey
      });
      triggerNotification('Configurações salvas com sucesso!', 'success');
      checkStatus();
    } catch (err: any) {
      alert("Erro ao salvar configurações: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-24 select-none relative max-w-6xl">
      {/* Toast Feedback Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 ${
              showToast.type === 'success' ? 'bg-emerald-500 border-emerald-400' : 'bg-rose-500 border-rose-400'
            } text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-xs uppercase tracking-widest z-50 flex items-center gap-2 border`}
          >
            {showToast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {showToast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header da Página */}
      <div>
        <span className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-lg">
          Workspace do Administrador
        </span>
        <h2 className="text-4xl font-extrabold tracking-tight text-white mt-4 italic flex items-center gap-3">
          Configurações & Conexão WhatsApp <Smartphone className="text-emerald-400" size={28} />
        </h2>
        <p className="text-sm text-white/30 mt-1">
          Gerencie a integração com a Evolution API v2 e ajuste a inteligência da sua clínica.
        </p>
      </div>

      {/* Card 1: Módulo de Conexão WhatsApp QR Code (Evolution API) */}
      <div className="glass-card rounded-[32px] p-8 border-white/10 shadow-2xl space-y-6 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <QrCode size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
                Conexão WhatsApp (Evolution API v2)
              </h3>
              <p className="text-xs text-white/40 mt-0.5">
                Instância: <span className="text-white font-mono">{instanceName || instanceId || 'Padrão'}</span>
              </p>
            </div>
          </div>

          {/* Indicador de Status Visual */}
          <div className="flex items-center gap-3">
            {connectionState === 'open' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider animate-pulse">
                <Wifi size={14} className="text-emerald-400" /> WhatsApp Conectado e Operando
              </span>
            )}
            {connectionState === 'connecting' && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
                <Loader2 size={14} className="animate-spin text-amber-400" /> Aguardando Leitura do QR Code
              </span>
            )}
            {(connectionState === 'close' || connectionState === 'error') && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black uppercase tracking-wider">
                <WifiOff size={14} className="text-rose-400" /> Desconectado
              </span>
            )}

            <button
              onClick={checkStatus}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Atualizar Status"
            >
              <RefreshCw size={16} className={connectionState === 'loading' ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Cenário 1: WhatsApp Conectado (Open) */}
        {connectionState === 'open' && (
          <div className="bg-emerald-500/5 border border-emerald-500/15 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h4 className="font-extrabold text-white text-base">Sessão Ativa no Servidor</h4>
                <p className="text-xs text-white/50 mt-1 max-w-md">
                  Seu dispositivo está pareado. Todas as confirmações de consulta e mensagens da IA estão prontas para disparo automático.
                </p>
              </div>
            </div>

            <button
              disabled={isDisconnecting}
              onClick={handleDisconnect}
              className="w-full sm:w-auto bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
            >
              {isDisconnecting ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
              Desconectar WhatsApp
            </button>
          </div>
        )}

        {/* Cenário 2: Desconectado / Gerar ou Exibir QR Code */}
        {connectionState !== 'open' && (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-6">
            {!qrCodeBase64 ? (
              <div className="space-y-4">
                <p className="text-xs text-white/50 max-w-md">
                  Para habilitar o envio automático via WhatsApp, clique no botão abaixo para gerar o QR Code de pareamento.
                </p>
                <button
                  disabled={isGeneratingQr}
                  onClick={handleFetchQrCode}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest px-8 py-4 rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 mx-auto"
                >
                  {isGeneratingQr ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
                  Gerar QR Code de Conexão
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-3xl shadow-2xl border-4 border-emerald-500/30 relative">
                  <img src={qrCodeBase64} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                </div>
                <div className="text-xs text-white/70 space-y-1">
                  <p className="font-bold text-emerald-400">Abra o WhatsApp no celular e escaneie o código acima</p>
                  <p className="text-[10px] text-white/40">Menu &gt; Aparelhos Conectados &gt; Conectar um Aparelho</p>
                </div>
                <button
                  onClick={handleFetchQrCode}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20 flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw size={14} /> Atualizar QR Code
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card 2: Formulário Geral de Configurações da Clínica */}
      <form onSubmit={handleSaveSettings} className="grid grid-cols-12 gap-8">
        <div className="col-span-12 xl:col-span-8 space-y-8">
          
          {/* Personalização da IA */}
          <div className="glass-card rounded-[32px] p-6 border-white/5 space-y-6 bg-slate-950/60">
            <div className="flex items-center gap-2 border-b border-white/5 pb-4">
              <Bot className="text-indigo-400" size={18} />
              <h3 className="font-extrabold text-white text-base">Comportamento da Inteligência Artificial</h3>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Terminal size={12} /> System Prompt (Instruções Principais)
              </label>
              <textarea
                rows={5}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Ex: Você é o especialista em marketing de rede e produtos da Atlântica Natural. Seja profissional, aplique a metodologia Go Pro do Eric Worre, destaque o lucro de 100% no varejo e conduza o prospect ao agendamento da APN..."
                className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-xs text-white placeholder-white/20 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                  Criatividade da IA (Temperatura)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={temperatura}
                  onChange={(e) => setTemperatura(parseFloat(e.target.value))}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Key size={12} /> Gemini API Key
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Lateral: Credenciais do Provedor de Mensageria */}
        <div className="col-span-12 xl:col-span-4 space-y-8">
          <div className="glass-card rounded-[32px] p-6 border-white/5 space-y-6 bg-slate-950/60">
            <div className="flex items-center gap-2 border-b border-white/5 pb-4">
              <Zap className="text-indigo-400" size={18} />
              <h3 className="font-extrabold text-white text-base">Parâmetros da Evolution API</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                  <Globe size={11} /> URL da Evolution API
                </label>
                <input
                  type="url"
                  value={evolutionUrl}
                  onChange={(e) => setEvolutionUrl(e.target.value)}
                  placeholder="https://api.evolution.com"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-1 block">
                  Nome da Instância
                </label>
                <input
                  type="text"
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                  placeholder="clinica-elo-instancia"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-1 block">
                  API Key Global
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="SUA_GLOBAL_API_KEY"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar Configurações
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Settings;
