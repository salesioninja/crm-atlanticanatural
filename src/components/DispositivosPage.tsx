import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, QrCode, LogOut, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import api from '../lib/api';

export const DispositivosPage: React.FC = () => {
  const [status, setStatus] = useState<'open' | 'close' | 'connecting' | 'loading' | 'error'>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await api.get('/whatsapp/status');
      // The Evolution API usually returns { instance: {...}, state: "open" }
      const connectionState = res.data.state || res.data.instance?.state || 'close';
      setStatus(connectionState);

      if (connectionState === 'close' || connectionState === 'connecting') {
        fetchQrCode();
      }
    } catch (err: any) {
      console.warn('Erro ao buscar status do WhatsApp, assumindo desconectado:', err);
      setStatus('close');
      setErrorMessage(err.response?.data?.error || '');
      fetchQrCode();
    }
  };

  const fetchQrCode = async () => {
    try {
      const res = await api.get('/whatsapp/qrcode');
      // The Evolution API returns { base64: "data:image/png;base64,..." }
      if (res.data.base64) {
        const raw = res.data.base64;
        const clean = raw.includes('|') ? raw.split('|')[0] : raw;
        const formatted = clean.startsWith('data:image') ? clean : `data:image/png;base64,${clean}`;
        setQrCode(formatted);
      }
    } catch (err) {
      console.error('Erro ao buscar QR Code:', err);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar o WhatsApp?')) return;
    
    setStatus('loading');
    try {
      await api.delete('/whatsapp/logout');
      await fetchStatus();
    } catch (err: any) {
      console.error('Erro ao desconectar:', err);
      alert('Falha ao desconectar: ' + (err.response?.data?.error || err.message));
      fetchStatus();
    }
  };

  useEffect(() => {
    fetchStatus();

    // Polling a cada 12 segundos com Page Visibility API
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchStatus();
    }, 12000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="p-8 space-y-8 select-none max-w-4xl">
      <div>
        <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-lg">
          Sessão do WhatsApp
        </span>
        <h2 className="text-4xl font-extrabold tracking-tight text-white mt-4 italic flex items-center gap-3">
          <Smartphone className="w-8 h-8 text-emerald-500" />
          Dispositivos
        </h2>
        <p className="text-sm text-white/30 mt-2">
          Gerencie a conexão do seu WhatsApp (via Evolution API) para envio e recebimento de mensagens pelo CRM.
        </p>
      </div>

      <div className="glass-card rounded-[32px] p-8 border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8">
          <button 
            onClick={fetchStatus}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
            title="Atualizar Status"
          >
            <RefreshCw className={`w-5 h-5 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-emerald-500" />
            <p>Verificando conexão com a Evolution API...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-20 text-red-500 text-center">
            <AlertCircle className="w-16 h-16 mb-4 opacity-80" />
            <h3 className="text-xl font-bold mb-2">Erro de Conexão</h3>
            <p className="text-sm text-red-400/80 max-w-md">{errorMessage}</p>
          </div>
        )}

        {status === 'open' && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-emerald-500/10 border-4 border-emerald-500/30 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              </div>
              <span className="absolute top-0 right-0 w-6 h-6 bg-emerald-500 rounded-full border-4 border-zinc-900 animate-pulse"></span>
            </div>
            
            <h3 className="text-3xl font-extrabold text-white mb-2">WhatsApp Conectado</h3>
            <p className="text-zinc-400 mb-8 text-center max-w-md">
              Seu WhatsApp está operando normalmente. O CRM e a IA estão prontos para enviar e receber mensagens.
            </p>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-2xl font-bold transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Desconectar Sessão
            </button>
          </div>
        )}

        {(status === 'close' || status === 'connecting') && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-3xl bg-zinc-800 flex items-center justify-center mb-6 border border-white/5">
              <QrCode className="w-10 h-10 text-zinc-400" />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Conecte seu WhatsApp</h3>
            <p className="text-zinc-400 mb-8 text-center max-w-md text-sm">
              Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie o código abaixo.
            </p>

            <div className="bg-white p-4 rounded-3xl shadow-2xl relative min-w-[256px] min-h-[256px] flex items-center justify-center">
              {qrCode ? (
                <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
              ) : (
                <div className="flex flex-col items-center text-zinc-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <span className="text-sm font-medium">Gerando QR Code...</span>
                </div>
              )}
            </div>
            
            <div className="mt-8 text-xs text-zinc-500 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Aguardando escaneamento... (Atualização automática)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DispositivosPage;
