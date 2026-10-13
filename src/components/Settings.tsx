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
  ShieldCheck,
  Save, 
  Bot, 
  Terminal, 
  Globe, 
  Key, 
  Zap,
  Clock,
  Sliders,
  Sparkles
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

  // Estados Anti-Ban e Temporização Humanizada
  const [antibanDelayMin, setAntibanDelayMin] = useState<number>(15);
  const [antibanDelayMax, setAntibanDelayMax] = useState<number>(45);
  const [antibanBatchSize, setAntibanBatchSize] = useState<number>(20);
  const [antibanBatchInterval, setAntibanBatchInterval] = useState<number>(5);
  const [antibanSimulateTyping, setAntibanSimulateTyping] = useState<boolean>(true);
  const [antibanSimulateAudio, setAntibanSimulateAudio] = useState<boolean>(false);
  
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
          if (res.data.antiban_delay_min !== undefined) setAntibanDelayMin(Number(res.data.antiban_delay_min));
          if (res.data.antiban_delay_max !== undefined) setAntibanDelayMax(Number(res.data.antiban_delay_max));
          if (res.data.antiban_batch_size !== undefined) setAntibanBatchSize(Number(res.data.antiban_batch_size));
          if (res.data.antiban_batch_interval !== undefined) setAntibanBatchInterval(Number(res.data.antiban_batch_interval));
          if (res.data.antiban_simulate_typing !== undefined) setAntibanSimulateTyping(Boolean(res.data.antiban_simulate_typing));
          if (res.data.antiban_simulate_audio !== undefined) setAntibanSimulateAudio(Boolean(res.data.antiban_simulate_audio));
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
        gemini_apikey: geminiApiKey,
        antiban_delay_min: Number(antibanDelayMin) || 15,
        antiban_delay_max: Number(antibanDelayMax) || 45,
        antiban_batch_size: Number(antibanBatchSize) || 20,
        antiban_batch_interval: Number(antibanBatchInterval) || 5,
        antiban_simulate_typing: antibanSimulateTyping,
        antiban_simulate_audio: antibanSimulateAudio
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

          {/* Card Anti-Ban & Temporização Humanizada (Ninja Engine) */}
          <div className="glass-card rounded-[32px] p-6 sm:p-8 border-white/10 space-y-6 bg-slate-950/70 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-lg">Parâmetros Anti-Ban & Disparo Seguro</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Ninja Engine
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    Intervalos pseudo-aleatórios e simulação de presença humana para blindar seus chips de WhatsApp.
                  </p>
                </div>
              </div>

              {/* Status do Risco Dinâmico */}
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Nível de Risco:</span>
                <span className={`text-xs font-black uppercase tracking-wider ${
                  antibanDelayMin < 10 
                    ? 'text-rose-400' 
                    : antibanDelayMin < 20 
                    ? 'text-amber-400' 
                    : 'text-emerald-400'
                }`}>
                  {antibanDelayMin < 10 ? 'Alto (Atenção)' : antibanDelayMin < 20 ? 'Moderado' : 'Mínimo / Seguro'}
                </span>
              </div>
            </div>

            {/* Barra Visual de Medidor de Risco */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-white/40 font-bold uppercase tracking-wider">
                <span>Indicador de Segurança de Tráfego</span>
                <span>{antibanDelayMin}s mínimo sorteado por mensagem</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    antibanDelayMin < 10 
                      ? 'w-1/4 bg-rose-500' 
                      : antibanDelayMin < 20 
                      ? 'w-3/5 bg-amber-400' 
                      : 'w-full bg-emerald-400'
                  }`}
                />
              </div>
            </div>

            {/* Configuração de Intervalos Pseudo-Aleatórios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-white/50 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={12} className="text-emerald-400" /> Intervalo Mínimo (Segundos)
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">{antibanDelayMin}s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={antibanDelayMin}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 5;
                    setAntibanDelayMin(val);
                    if (val > antibanDelayMax) setAntibanDelayMax(val + 5);
                  }}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <p className="text-[10px] text-white/30">Tempo mínimo de espera antes do próximo envio.</p>
              </div>

              <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-white/50 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={12} className="text-emerald-400" /> Intervalo Máximo (Segundos)
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">{antibanDelayMax}s</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="1"
                  value={antibanDelayMax}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 15;
                    setAntibanDelayMax(val);
                    if (val < antibanDelayMin) setAntibanDelayMin(val);
                  }}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <p className="text-[10px] text-white/30">O motor sorteia um valor randômico entre Mín e Máx.</p>
              </div>
            </div>

            {/* Envio em Blocos / Lotes (Batching) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                <label className="text-[10px] text-white/50 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Sliders size={12} className="text-indigo-400" /> Quantidade por Bloco
                </label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={antibanBatchSize}
                  onChange={(e) => setAntibanBatchSize(parseInt(e.target.value) || 20)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <p className="text-[10px] text-white/30">Quantidade de mensagens disparadas antes de pausar.</p>
              </div>

              <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                <label className="text-[10px] text-white/50 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={12} className="text-indigo-400" /> Pausa do Bloco (Minutos)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={antibanBatchInterval}
                  onChange={(e) => setAntibanBatchInterval(parseInt(e.target.value) || 5)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <p className="text-[10px] text-white/30">Descanso entre os blocos para quebrar padrões robóticos.</p>
              </div>
            </div>

            {/* Simulação de Comportamento Humano */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">
                Simulação de Comportamento Humano (Evolution API)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div 
                  onClick={() => setAntibanSimulateTyping(!antibanSimulateTyping)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    antibanSimulateTyping 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-white' 
                      : 'bg-white/5 border-white/5 text-white/50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles size={13} className={antibanSimulateTyping ? 'text-emerald-400' : 'text-white/30'} />
                      Simular Digitação
                    </p>
                    <p className="text-[10px] text-white/40">Exibe "Digitando..." por 2 a 3s antes do envio.</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${
                    antibanSimulateTyping ? 'bg-emerald-500' : 'bg-slate-800'
                  }`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${
                      antibanSimulateTyping ? 'right-1' : 'left-1'
                    }`} />
                  </div>
                </div>

                <div 
                  onClick={() => setAntibanSimulateAudio(!antibanSimulateAudio)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    antibanSimulateAudio 
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-white' 
                      : 'bg-white/5 border-white/5 text-white/50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Zap size={13} className={antibanSimulateAudio ? 'text-indigo-400' : 'text-white/30'} />
                      Simular Áudio
                    </p>
                    <p className="text-[10px] text-white/40">Exibe "Gravando áudio..." para mensagens de voz.</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${
                    antibanSimulateAudio ? 'bg-indigo-500' : 'bg-slate-800'
                  }`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${
                      antibanSimulateAudio ? 'right-1' : 'left-1'
                    }`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Aviso de Modo de Testes Sem Trava de Horário */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex items-center gap-2.5 text-[11px] text-emerald-300">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>
                <strong>Modo de Testes 24h Liberado:</strong> O sistema realiza os disparos em qualquer horário conforme agendado, permitindo validar o funcionamento de dia ou de noite.
              </span>
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
                  placeholder="https://evogo.acessaronline.com.br"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest block">
                    Nome da Instância (Multi-Chip)
                  </label>
                  {instanceId.includes(',') && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                      🔀 Rotação Ativa ({instanceId.split(',').filter(x => x.trim()).length} chips)
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                  placeholder="ex: atlanticanatural ou chip-01, chip-02"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                />
                <p className="text-[10px] text-white/30 mt-1">
                  {instanceId.includes(',') 
                    ? 'O sistema revezará automaticamente os disparos entre as instâncias informadas acima.' 
                    : 'Para rotação de múltiplos chips, separe os nomes por vírgula (ex: chip-01, chip-02).'}
                </p>
              </div>

              <div>
                <label className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-1 block">
                  API Key Global
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="d7b87fcfca7d42cfb7692298bc6d42ef"
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
