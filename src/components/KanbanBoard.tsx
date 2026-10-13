import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { CrmCard, CrmStatus } from '../types';
import api from '../lib/api';

const STAGES: CrmStatus[] = [
  'Novo Contato',
  'Agendado',
  'Confirmado',
  'Remarcado',
  'Faltou',
  'Alta'
];

interface KanbanBoardProps {
  initialCards: CrmCard[];
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ initialCards }) => {
  const [cards, setCards] = useState<CrmCard[]>(initialCards);
  const [activeCard, setActiveCard] = useState<CrmCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = cards.find((c) => c.id === active.id);
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const cardId = active.id as string;
    const newStatus = over.id as CrmStatus;

    const card = cards.find((c) => c.id === cardId);
    
    if (card && card.crm_status !== newStatus) {
      // Optimistic UI update
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, crm_status: newStatus } : c))
      );

      try {
        await api.put(`/appointments/${cardId}`, { crm_status: newStatus });
      } catch (error) {
        console.error('Falha ao atualizar status do card:', error);
        // Revert on failure
        setCards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, crm_status: card.crm_status } : c))
        );
      }
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 h-full items-start w-full touch-pan-x no-scrollbar">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            id={stage}
            title={stage}
            cards={cards.filter((c) => c.crm_status === stage)}
          />
        ))}

        <DragOverlay>
          {activeCard ? <KanbanCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default KanbanBoard;
