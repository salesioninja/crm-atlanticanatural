import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCheck, MessageSquareReply, BrainCircuit, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import api from '../lib/api';

interface CRMInteraction {
  id: string;
  tenant_id: string;
  patient_id: string;
  type: 'system_log' | 'whatsapp_sent' | 'client_reply' | 'ai_note' | 'stage_change';
  content: string;
  created_at: string;
}

interface PatientTimelineProps {
  patient_id: string;
}

export const PatientTimeline: React.FC<PatientTimelineProps> = ({ patient_id }) => {
  const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/interactions?patient_id=${patient_id}`);
        setInteractions(response.data);
      } catch (error) {
        console.error("Erro ao buscar linha do tempo:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (patient_id) {
      fetchTimeline();
    }
  }, [patient_id]);

  const getIconConfig = (type: string) => {
    switch (type) {
      case 'whatsapp_sent':
        return { icon: <CheckCheck size={14} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
      case 'client_reply':
        return { icon: <MessageSquareReply size={14} />, color: 'text-blue-400', bg: 'bg-blue-500/10' };
      case 'ai_note':
        return { icon: <BrainCircuit size={14} />, color: 'text-purple-400', bg: 'bg-purple-500/10' };
      case 'stage_change':
        return { icon: <RefreshCw size={14} />, color: 'text-amber-400', bg: 'bg-amber-500/10' };
      case 'system_log':
      default:
        return { icon: <AlertCircle size={14} />, color: 'text-slate-400', bg: 'bg-slate-500/10' };
    }
  };

  const formatData = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date).replace('de', '').replace('.', ',');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <Clock className="animate-spin text-indigo-400" size={24} />
        <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Carregando Histórico...</p>
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-white/10 rounded-2xl">
        <p className="text-xs text-white/40 text-center">Nenhum evento registrado na jornada deste prospect ainda.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-4 space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
      {interactions.map((interaction, index) => {
        const config = getIconConfig(interaction.type);
        return (
          <motion.div 
            key={interaction.id}
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
          >
            {/* Ícone central */}
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border border-white/5 ${config.bg} ${config.color} shadow-lg shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10`}>
              {config.icon}
            </div>

            {/* Card do evento */}
            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl bg-white/5 border border-white/5 shadow-xl hover:border-white/10 transition-colors backdrop-blur-sm">
              <div className="flex items-center justify-between space-x-2 mb-1">
                <div className={`font-bold text-[10px] uppercase tracking-wider ${config.color}`}>
                  {interaction.type.replace('_', ' ')}
                </div>
                <time className="text-[10px] font-medium text-white/30">{formatData(interaction.created_at)}</time>
              </div>
              <div className="text-xs text-white/70 leading-relaxed mt-2">
                {interaction.content}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default PatientTimeline;
