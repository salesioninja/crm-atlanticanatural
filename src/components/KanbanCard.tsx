import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CrmCard } from '../types';
import { Clock, MessageCircle, AlertCircle, CheckCircle } from 'lucide-react';

interface KanbanCardProps {
  card: CrmCard;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ card }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: card,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aguardando': return 'text-amber-500 bg-amber-500/10';
      case 'Enviado': return 'text-green-500 bg-green-500/10';
      case 'Falhou':
      case 'Erro': return 'text-red-500 bg-red-500/10';
      case 'Processando': return 'text-blue-500 bg-blue-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Aguardando': return <Clock className="w-3 h-3 mr-1" />;
      case 'Enviado': return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'Falhou':
      case 'Erro': return <AlertCircle className="w-3 h-3 mr-1" />;
      default: return <Clock className="w-3 h-3 mr-1" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-zinc-800 p-3 rounded-lg border border-white/5 hover:border-white/20 cursor-grab active:cursor-grabbing mb-3 shadow-sm transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-medium text-white truncate pr-2">{card.nome || 'Sem Nome'}</h4>
      </div>
      
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center text-xs text-zinc-400">
          <Clock className="w-3 h-3 mr-1.5" />
          {new Date(card.horarioConsulta).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </div>
        
        <div className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium w-fit ${getStatusColor(card.status_envio)}`}>
          {getStatusIcon(card.status_envio)}
          WhatsApp {card.status_envio}
        </div>
      </div>

      {card.aiMessagePreview && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <div className="flex items-start">
            <MessageCircle className="w-3 h-3 text-zinc-500 mr-1.5 mt-0.5 shrink-0" />
            <p className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
              {card.aiMessagePreview}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanCard;
