import { Sparkles, Zap, PlusCircle } from 'lucide-react';
import { Appointment } from '../types';

interface AppointmentCardProps {
  appointment?: Appointment;
  isAdd?: boolean;
}

export default function AppointmentCard({ appointment, isAdd }: AppointmentCardProps) {
  if (isAdd) {
    return (
      <div className="bg-white/5 border border-dashed border-white/10 p-6 rounded-[32px] flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all cursor-pointer group">
        <PlusCircle size={24} className="mr-3 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-bold uppercase tracking-[0.2em]">Novo Agendamento</span>
      </div>
    );
  }

  if (!appointment) return null;

  const Icon = appointment.icon === 'Sparkles' ? Sparkles : Zap;
  const isPrimary = appointment.type === 'primary';

  return (
    <div className="glass-card p-6 rounded-[32px] flex items-start gap-4 hover:bg-white/10 transition-all group cursor-pointer border-white/5">
      <div className={`p-3 rounded-2xl ${isPrimary ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'}`}>
        <Icon size={24} className="group-hover:rotate-12 transition-transform" />
      </div>
      <div>
        <p className="font-bold text-white tracking-tight">{appointment.treatmentName}</p>
        <p className="text-[10px] text-white/30 font-bold mt-1.5 uppercase tracking-[0.15em]">
          {appointment.time}
        </p>
      </div>
    </div>
  );
}
