import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import { CrmCard } from '../types';

interface KanbanColumnProps {
  id: string;
  title: string;
  cards: CrmCard[];
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, cards }) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const getBadgeColor = (title: string) => {
    switch (title) {
      case 'Novo Contato': return 'bg-blue-500/20 text-blue-400';
      case 'Agendado': return 'bg-amber-500/20 text-amber-400';
      case 'Confirmado': return 'bg-green-500/20 text-green-400';
      case 'Faltou': return 'bg-red-500/20 text-red-400';
      case 'Remarcado': return 'bg-purple-500/20 text-purple-400';
      case 'Alta': return 'bg-zinc-500/20 text-zinc-400';
      default: return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  return (
    <div className="flex flex-col w-72 sm:w-80 shrink-0 snap-start">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="font-semibold text-zinc-200 text-sm">{title}</h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getBadgeColor(title)}`}>
          {cards.length}
        </span>
      </div>
      
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[500px] p-2 rounded-xl transition-colors ${
          isOver ? 'bg-white/5 border border-white/10' : 'bg-zinc-900/50 border border-transparent'
        }`}
      >
        {cards.map((card) => (
          <KanbanCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
};

export default KanbanColumn;
