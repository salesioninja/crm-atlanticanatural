import { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight, Plus, Sparkles, Zap } from 'lucide-react';
import { Appointment } from '../types';

interface AgendaPageProps {
  appointments: Appointment[];
  onNewAppointment: () => void;
  onSelectClient: (clientName: string) => void;
  onBack: () => void;
}

const HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function AgendaPage({ appointments, onNewAppointment, onSelectClient, onBack }: AgendaPageProps) {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInMonth = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    setSelectedDate(new Date(year, month, day));
  };

  // Group appointments by hour for the selected day
  const appointmentsForSelectedDay = appointments.filter(apt => {
    if (!apt.time) return false;
    
    const now = new Date();
    const isTodaySelected = selectedDate.toDateString() === now.toDateString();
    
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrowSelected = selectedDate.toDateString() === tomorrow.toDateString();

    const lowerTime = apt.time.toLowerCase();
    if (isTodaySelected && lowerTime.includes('hoje')) return true;
    if (isTomorrowSelected && lowerTime.includes('amanhã')) return true;

    // Formatação de data local (previne timezone drift UTC)
    const selYear = selectedDate.getFullYear();
    const dayStr = String(selectedDate.getDate()).padStart(2, '0');
    const monthStr = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const formattedShort = `${dayStr}/${monthStr}`;
    const isoShort = `${selYear}-${monthStr}-${dayStr}`;

    if (apt.time.includes(formattedShort) || apt.time.includes(isoShort)) return true;

    return false;
  });

  const selectedDayFormatted = `${selectedDate.getDate()} de ${MONTH_NAMES[selectedDate.getMonth()]}, ${selectedDate.getFullYear()}`;

  return (
    <div className="space-y-10 pb-24 select-none">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-lg">
            Cronograma
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mt-4 italic">
            Agenda Médica
          </h2>
        </div>
        
        <button 
          onClick={onNewAppointment}
          className="bg-white text-indigo-600 px-7 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-black/20 active:scale-95 hover:bg-white/90"
        >
          <Plus size={18} />
          Novo Agendamento
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Calendar Grid Selector */}
        <div className="col-span-12 xl:col-span-5 glass-card rounded-[40px] p-8 border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-lg text-white">
              {MONTH_NAMES[month]} {year}
            </h4>
            <div className="flex gap-2">
              <button 
                onClick={handlePrevMonth}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors"
                title="Mês Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={handleNextMonth}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors"
                title="Próximo Mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Pad days before the first day of the month */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`pad-${i}`} className="h-10"></div>
            ))}
            
            {daysInMonth.map((day) => {
              const dateForDay = new Date(year, month, day);
              const isSelected = selectedDate.toDateString() === dateForDay.toDateString();
              const isToday = new Date().toDateString() === dateForDay.toDateString();
              
              // Check if any appointment is scheduled for this day
              const hasAppointments = appointments.some(apt => {
                if (!apt.time) return false;
                const dayStr = String(day).padStart(2, '0');
                const monthStr = String(month + 1).padStart(2, '0');
                if (isToday && apt.time.toLowerCase().includes('hoje')) return true;
                return apt.time.includes(`${dayStr}/${monthStr}`) || apt.time.includes(`${year}-${monthStr}-${dayStr}`);
              });

              return (
                <button
                  key={day}
                  onClick={() => handleSelectDay(day)}
                  className={`h-10 rounded-xl flex flex-col items-center justify-center relative text-sm font-bold transition-all ${
                    isSelected
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : isToday 
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-white/5 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span>{day}</span>
                  {hasAppointments && !isSelected && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Timeline */}
        <div className="col-span-12 xl:col-span-7 glass-card rounded-[40px] p-8 border-white/5">
          <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
            <div>
              <h4 className="font-bold text-lg text-white">Cronograma do Dia</h4>
              <p className="text-xs text-white/30">{selectedDayFormatted}</p>
            </div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">
              {appointmentsForSelectedDay.length} Atendimento(s)
            </span>
          </div>

          <div className="space-y-6 relative before:absolute before:left-[55px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
            {HOURS.map((hour) => {
              const hourPrefix = hour.slice(0, 3); // e.g. '09:'
              const matchedApt = appointmentsForSelectedDay.find(apt => apt.time.includes(hour) || apt.time.includes(hourPrefix));
              
              return (
                <div key={hour} className="flex gap-6 items-start group">
                  <span className="text-xs font-bold text-white/30 w-10 text-right pt-2.5">{hour}</span>
                  
                  {/* Timeline dot */}
                  <div className={`w-3 h-3 rounded-full border-2 border-slate-950 mt-3.5 z-10 shrink-0 transition-colors ${
                    matchedApt ? 'bg-indigo-500 scale-125' : 'bg-white/10 group-hover:bg-white/30'
                  }`}></div>

                  <div className="flex-1">
                    {matchedApt ? (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => onSelectClient(matchedApt.clientName)}
                        className="bg-white/5 hover:bg-white/10 border border-white/5 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all group/card"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${matchedApt.type === 'primary' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'}`}>
                            {matchedApt.icon === 'Sparkles' ? <Sparkles size={16} /> : <Zap size={16} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white group-hover/card:text-indigo-400 transition-colors">{matchedApt.treatmentName}</p>
                            <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5"><User size={12} /> {matchedApt.clientName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg">Confirmado</span>
                        </div>
                      </motion.div>
                    ) : (
                      <button 
                        onClick={onNewAppointment}
                        className="w-full text-left py-3.5 px-4 rounded-2xl border border-dashed border-white/5 hover:border-white/10 text-white/10 hover:text-white/30 transition-all text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
                      >
                        <Plus size={14} /> Reservar Horário
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
