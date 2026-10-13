import React, { useState } from 'react';
import { 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Smartphone, 
  Share2, 
  Download,
  Sparkles,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BookingPage from './BookingPage';

export const LinkPacientePage: React.FC = () => {
  const { tenantId, tenantName } = useAuth();
  const [copied, setCopied] = useState(false);

  // Determina a URL pública de agendamento exclusiva da clínica
  const origin = window.location.origin;
  const publicBookingUrl = `${origin}/?mode=agendar`;

  // QR Code gerado via serviço rápido e confiável do Google/QuickChart
  const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicBookingUrl)}&margin=15`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicBookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenNewTab = () => {
    window.open(publicBookingUrl, '_blank');
  };

  return (
    <div className="space-y-8 pb-20 select-none max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-lg">
          Página Pública de Convite & APN
        </span>
        <h2 className="text-4xl font-extrabold tracking-tight text-white mt-4 italic flex items-center gap-3">
          <Link2 className="w-8 h-8 text-emerald-400" />
          Link de Agendamento da APN
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Compartilhe este link com seus prospects para que eles escolham o melhor dia e horário para a Apresentação do Plano ou Demonstração de Produtos.
        </p>
      </div>

      {/* Card Principal de Compartilhamento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Coluna da Esquerda: Links e Ações */}
        <div className="lg:col-span-8 glass-card rounded-[32px] p-6 sm:p-8 border-white/5 bg-slate-900/60 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                <Share2 size={15} className="text-emerald-400" /> Link do Distribuidor Independente
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                ● Ativo & Online
              </span>
            </div>

            {/* Input com o Link Completo */}
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-2 pl-4">
              <input 
                type="text" 
                readOnly 
                value={publicBookingUrl}
                className="bg-transparent border-none text-white text-xs sm:text-sm font-mono flex-1 focus:outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                  copied 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-lg shadow-emerald-600/20'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>

            {/* Dicas de Uso para Vendas */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-200/80 space-y-2">
              <div className="font-bold text-white flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" /> Onde divulgar este link de prospecção:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li><strong>Instagram / Redes Sociais:</strong> Cole no campo "Link na Bio" com a chamada para conhecer o Plano Atlântica Natural.</li>
                <li><strong>WhatsApp:</strong> Envie após fazer o convite Go Pro: "Se eu te mandasse o link da agenda, você escolheria um horário?".</li>
                <li><strong>Anúncios / Tráfego Pago:</strong> Use como página de destino para captação de novos empreendedores da sua cidade.</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
            <button
              onClick={handleOpenNewTab}
              className="flex-1 min-w-[200px] bg-white/10 hover:bg-white/15 text-white px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-white/10 active:scale-95"
            >
              <ExternalLink size={15} /> Abrir Página de Agendamento (Nova Aba)
            </button>
          </div>
        </div>

        {/* Coluna da Direita: QR Code de Eventos */}
        <div className="lg:col-span-4 glass-card rounded-[32px] p-6 border-white/5 bg-slate-900/60 flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-white/80 uppercase tracking-wider">
            <QrCode size={16} className="text-emerald-400" /> QR Code para Eventos & Materiais
          </div>

          <div className="p-3 bg-white rounded-2xl shadow-xl shadow-black/40">
            <img 
              src={qrCodeImgUrl} 
              alt="QR Code Autoagendamento" 
              className="w-44 h-44 object-contain rounded-lg"
            />
          </div>

          <p className="text-[11px] text-white/40 max-w-[220px]">
            Imprima este QR Code em seus cartões, banners ou apresentações presenciais de negócios.
          </p>

          <a 
            href={qrCodeImgUrl} 
            download={`qrcode-apn-${tenantId || 'atlantica'}.png`}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-white/5 hover:bg-white/10 text-white/80 px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-white/5"
          >
            <Download size={14} /> Baixar Imagem do QR Code
          </a>
        </div>
      </div>

      {/* Live Preview Viewport */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
            <Smartphone size={14} className="text-emerald-400" /> Pré-Visualização em Tempo Real (O que o Convidado Vê)
          </span>
          <span className="text-[10px] text-white/40">Visualização Responsiva</span>
        </div>

        <div className="w-full glass-card rounded-[32px] p-4 sm:p-8 border-white/5 bg-black/40 overflow-hidden shadow-2xl relative">
          <BookingPage 
            onBackToAdmin={() => {}} 
            isPublicAccess={false}
            tenantId={tenantId || undefined}
            tenantName={tenantName || undefined}
          />
        </div>
      </div>
    </div>
  );
};
