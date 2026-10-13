import BookingPage from './BookingPage';
import { Smartphone, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SimulacoesPage() {
  const { tenantId, tenantName } = useAuth();
  const handleConfirmSimulation = (data: any) => {
    alert(`Reunião de APN Simulada com Sucesso!\nProspect: ${data.name}\nObjetivo: ${data.treatmentName}\nHorário: ${data.date} às ${data.time}`);
  };

  return (
    <div className="space-y-8 pb-20 select-none">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-lg">
          Ambiente de Homologação Sandbox
        </span>
        <h2 className="text-4xl font-extrabold tracking-tight text-white mt-4 italic">
          Simulação de Agendamento da APN
        </h2>
        <p className="text-sm text-white/30">Simule a jornada de agendamento de reunião/APN do prospect através da página pública.</p>
      </div>

      {/* Info Alert */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 text-emerald-300 text-xs items-center max-w-3xl">
        <Info size={16} className="shrink-0" />
        <p className="leading-relaxed">
          Esta tela renderiza a <strong>Página de Convite da APN</strong> em modo sandbox. Qualquer agendamento efetuado aqui testará o fluxo de inserção de fila e envio de lembretes em tempo real.
        </p>
      </div>

      {/* Viewport Frame */}
      <div className="flex justify-center mt-6">
        <div className="w-full max-w-5xl glass-card rounded-[32px] p-6 border-white/5 bg-[#09090b]/50 overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-10 bg-white/5 border-b border-white/5 flex items-center px-6 gap-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">
            <Smartphone size={12} /> Viewport do Smartphone do Prospect (Responsivo)
          </div>
          <div className="pt-10">
            <BookingPage 
              onBackToAdmin={() => {}} 
              tenantId={tenantId || undefined}
              tenantName={tenantName || undefined}
              onConfirmBooking={handleConfirmSimulation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
