import React, { useState, useEffect, useRef } from 'react';
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
  useDraggable,
  useDroppable
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  MessageCircle, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Calendar, 
  DollarSign, 
  X, 
  Send, 
  FileText, 
  Loader2, 
  Plus, 
  Sparkles, 
  Phone, 
  History, 
  TrendingUp, 
  Tag, 
  Ban, 
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { CrmCard, CrmStatus } from '../types';
import api from '../lib/api';

// Configuração das 6 colunas do Funil de Atendimento CRM
interface ColumnDef {
  id: CrmStatus;
  title: string;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  badgeBg: string;
}

const COLUMNS: ColumnDef[] = [
  { 
    id: 'Novo Lead', 
    title: '1. Novo Lead', 
    colorBg: 'bg-slate-500/10', 
    colorText: 'text-slate-300', 
    colorBorder: 'border-slate-500/20',
    badgeBg: 'bg-slate-500/20 text-slate-300'
  },
  { 
    id: 'Qualificação', 
    title: '2. Qualificação', 
    colorBg: 'bg-cyan-500/10', 
    colorText: 'text-cyan-400', 
    colorBorder: 'border-cyan-500/20',
    badgeBg: 'bg-cyan-500/20 text-cyan-400'
  },
  { 
    id: 'APN Enviada', 
    title: '3. APN Enviada', 
    colorBg: 'bg-indigo-500/10', 
    colorText: 'text-indigo-400', 
    colorBorder: 'border-indigo-500/20',
    badgeBg: 'bg-indigo-500/20 text-indigo-400'
  },
  { 
    id: 'Follow-up / Objeções', 
    title: '4. Follow-up & Objeções', 
    colorBg: 'bg-amber-500/10', 
    colorText: 'text-amber-400', 
    colorBorder: 'border-amber-500/20',
    badgeBg: 'bg-amber-500/20 text-amber-400'
  },
  { 
    id: 'Fechamento / Kit', 
    title: '5. Fechamento / Kit', 
    colorBg: 'bg-yellow-500/10', 
    colorText: 'text-yellow-400', 
    colorBorder: 'border-yellow-500/20',
    badgeBg: 'bg-yellow-500/20 text-yellow-400'
  },
  { 
    id: 'Cadastrado', 
    title: '6. Cadastrado', 
    colorBg: 'bg-emerald-500/10', 
    colorText: 'text-emerald-400', 
    colorBorder: 'border-emerald-500/20',
    badgeBg: 'bg-emerald-500/20 text-emerald-400'
  },
  { 
    id: 'Ativado (1º Pedido)', 
    title: '7. Ativado (1º Pedido)', 
    colorBg: 'bg-purple-500/10', 
    colorText: 'text-purple-400', 
    colorBorder: 'border-purple-500/20',
    badgeBg: 'bg-purple-500/20 text-purple-400'
  }
];

// Helper para normalizar status com compatibilidade Go Pro
const normalizeStatus = (status?: string): CrmStatus => {
  if (!status) return 'Novo Lead';
  const clean = status.trim();
  if (clean === 'Novo Lead') return 'Novo Lead';
  if (clean === 'Qualificação' || clean === 'Abordagem & Qualificação') return 'Qualificação';
  if (clean === 'APN Enviada' || clean === 'Agendado' || clean === 'Remarcado') return 'APN Enviada';
  if (clean === 'Follow-up / Objeções' || clean === 'Follow-up') return 'Follow-up / Objeções';
  if (clean === 'Fechamento / Kit' || clean === 'Confirmado') return 'Fechamento / Kit';
  if (clean === 'Cadastrado') return 'Cadastrado';
  if (clean === 'Ativado (1º Pedido)' || clean === 'Ativado' || clean === 'Alta' || clean === 'Alta/Concluído') return 'Ativado (1º Pedido)';
  if (clean === 'Cancelado' || clean === 'Faltou') return 'Acompanhamento Futuro';
  if (clean === 'Novo Contato') return 'Novo Lead';
  return 'Novo Lead';
};

// Helper seguro de formatação de data para evitar RangeError em navegadores
const formatDateSafe = (dateStr?: string) => {
  if (!dateStr) return 'Data a definir';
  try {
    const isoStr = dateStr.includes(' ') ? dateStr.replace(' ', 'T') : dateStr;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateStr;
  }
};

// Componente Draggable do Card de Paciente
const KanbanCardItem: React.FC<{
  card: CrmCard;
  onOpenDrawer: (card: CrmCard) => void;
  onUpdateStatus: (card: CrmCard, newStatus: CrmStatus) => void;
  onDeleteCard: (card: CrmCard) => void;
}> = ({ card, onOpenDrawer, onUpdateStatus, onDeleteCard }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: card,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const cleanPhone = card.telefone ? card.telefone.replace(/\D/g, '') : '';
  const priceValue = typeof card.price === 'number' ? card.price : Number(card.price) || 150;
  const formattedPrice = priceValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getDispatchBadge = (status: string) => {
    switch (status) {
      case 'Enviado':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 size={10} /> Enviado</span>;
      case 'Processando':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse"><Loader2 size={10} className="animate-spin" /> Processando</span>;
      case 'Erro':
      case 'Falhou':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertCircle size={10} /> Erro</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock size={10} /> Aguardando</span>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpenDrawer(card)}
      className="bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/30 p-4 rounded-2xl cursor-grab active:cursor-grabbing mb-3 shadow-lg backdrop-blur-md transition-all group/card relative"
    >
      {/* Top Header Card */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-bold text-white group-hover/card:text-emerald-300 transition-colors truncate">
          {card.nome || 'Prospect'}
        </h4>
        {cleanPhone && (
          <a
            href={`https://wa.me/55${cleanPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white transition-all shrink-0"
            title="Abrir WhatsApp"
          >
            <MessageCircle size={13} />
          </a>
        )}
      </div>

      {/* Procedimento & Profissional */}
      <div className="text-xs text-white/50 space-y-1 mb-3">
        <p className="flex items-center gap-1.5 font-medium text-white/70 truncate">
          <Tag size={12} className="text-indigo-400 shrink-0" />
          <span className="truncate">{card.treatment_command || card.categoria || 'Consulta Clínica'}</span>
        </p>
        <p className="flex items-center gap-1.5 truncate">
          <User size={12} className="text-white/40 shrink-0" />
          <span className="truncate">{card.professional || 'Profissional Responsável'}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Clock size={12} className="text-white/40 shrink-0" />
          {formatDateSafe(card.horarioConsulta)}
        </p>
      </div>

      {/* Badges e Ações do Card */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2 gap-2">
        <div className="flex items-center gap-2">
          {getDispatchBadge(card.status_envio)}
          <span className="text-[10px] font-extrabold text-white/70 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
            {formattedPrice}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {card.crm_status !== 'Cancelado' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateStatus(card, 'Cancelado');
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-[10px] font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 px-2 py-1 rounded-lg border border-rose-500/20 transition-all flex items-center gap-1"
              title="Cancelar Agendamento"
            >
              <Ban size={10} /> Cancelar
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCard(card);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-[10px] font-bold text-rose-400/80 hover:text-rose-300 bg-white/5 hover:bg-rose-500/20 p-1 rounded-lg border border-white/5 transition-all"
            title="Excluir Agendamento"
          >
            <Trash2 size={11} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrawer(card);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-lg border border-indigo-500/20 transition-all flex items-center gap-1"
          >
            <History size={10} /> Timeline
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente Droppable da Coluna
const KanbanColumnItem: React.FC<{
  col: ColumnDef;
  cards: CrmCard[];
  onOpenDrawer: (card: CrmCard) => void;
  onUpdateStatus: (card: CrmCard, newStatus: CrmStatus) => void;
  onDeleteCard: (card: CrmCard) => void;
}> = ({ col, cards, onOpenDrawer, onUpdateStatus, onDeleteCard }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: col.id,
  });

  const totalValue = cards.reduce((acc, c) => acc + (Number(c.price) || 150), 0);
  const formattedTotal = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="flex flex-col w-80 shrink-0 select-none h-full max-h-full">
      {/* Column Header */}
      <div className={`p-4 rounded-2xl border ${col.colorBorder} ${col.colorBg} mb-3 flex flex-col gap-1 backdrop-blur-md shrink-0 shadow-sm`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-extrabold text-sm ${col.colorText} flex items-center gap-2`}>
            <span className="w-2 h-2 rounded-full bg-current"></span>
            {col.title}
          </h3>
          <span className={`text-xs font-black px-2.5 py-0.5 rounded-xl ${col.badgeBg}`}>
            {cards.length}
          </span>
        </div>
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">
          Total: <span className="text-white font-black">{formattedTotal}</span>
        </p>
      </div>

      {/* Column Body Container */}
      <div
        ref={setNodeRef}
        className={`kanban-column-body flex-1 min-h-0 overflow-y-auto p-2.5 rounded-3xl transition-colors custom-scrollbar ${
          isOver ? 'bg-white/10 border-2 border-dashed border-indigo-500/50' : 'bg-black/20 border border-white/5'
        }`}
      >
        {cards.map((card) => (
          <KanbanCardItem 
            key={card.id} 
            card={card} 
            onOpenDrawer={onOpenDrawer} 
            onUpdateStatus={onUpdateStatus}
            onDeleteCard={onDeleteCard}
          />
        ))}
        {cards.length === 0 && (
          <div className="h-40 flex flex-col items-center justify-center text-white/20 text-xs font-semibold uppercase tracking-wider border border-dashed border-white/5 rounded-2xl m-2">
            Nenhum prospect
          </div>
        )}
      </div>
    </div>
  );
};

// Componente Principal CRM Kanban
export default function CrmKanban() {
  const [cards, setCards] = useState<CrmCard[]>([]);
  const [activeCard, setActiveCard] = useState<CrmCard | null>(null);
  const [selectedCardForDrawer, setSelectedCardForDrawer] = useState<CrmCard | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const boardRef = useRef<HTMLDivElement>(null);

  const handleBoardWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const insideColumnBody = target.closest('.kanban-column-body');
    if (!insideColumnBody && boardRef.current) {
      boardRef.current.scrollLeft += e.deltaY;
    }
  };

  const scrollBoard = (direction: 'left' | 'right') => {
    if (boardRef.current) {
      const scrollAmount = 340;
      boardRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  );

  const activeCardRef = useRef<CrmCard | null>(null);
  activeCardRef.current = activeCard;

  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent && cards.length === 0) setIsLoading(true);
      let res: any = null;
      try {
        res = await api.get('/appointments');
      } catch (e1) {
        try {
          res = await api.get('/schedules');
        } catch (e2) {
          console.warn("Endpoints /appointments e /schedules inacessíveis:", e2);
        }
      }

      let rawData: any[] = [];
      if (res && res.data) {
        if (Array.isArray(res.data)) {
          rawData = res.data;
        } else if (Array.isArray((res.data as any)?.appointments)) {
          rawData = (res.data as any).appointments;
        } else if (Array.isArray((res.data as any)?.data)) {
          rawData = (res.data as any).data;
        } else if (Array.isArray((res.data as any)?.schedules)) {
          rawData = (res.data as any).schedules;
        }
      }

      // Se o usuário estiver ativamente arrastando um card, pula o update silencioso para não interromper
      if (isSilent && activeCardRef.current) return;

      const mappedCards: CrmCard[] = rawData.map((a: any) => ({
        id: String(a.id || ''),
        tenant_id: a.tenant_id,
        patient_id: a.patient_id,
        nome: a.patient_name || a.nome || 'Prospect',
        telefone: a.patient_phone || a.telefone || '',
        professional: a.user_name || a.user_id || a.profissional || a.professional || 'Profissional',
        categoria: a.category || a.categoria || 'Geral',
        price: a.price ? Number(a.price) : 150.00,
        horarioConsulta: a.horario_consulta || a.horarioConsulta || a.appointment_time || '',
        horarioMensagem: a.horario_mensagem || a.horarioMensagem || a.message_time || '',
        status_envio: a.status_envio || a.status_message || a.status || 'Aguardando',
        crm_status: normalizeStatus(a.crm_status || a.status_crm || a.status),
        aiMessagePreview: a.ai_message_preview || a.aiMessagePreview || '',
        treatment_command: a.treatment || a.treatment_command || a.comando || '',
        logs: a.logs || '',
        created_at: a.created_at || a.createdAt || ''
      }));

      setCards(mappedCards);

      // Sincroniza dados da gaveta lateral caso esteja aberta
      if (selectedCardForDrawer) {
        const found = mappedCards.find(c => c.id === selectedCardForDrawer.id);
        if (found) {
          setSelectedCardForDrawer(found);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar agendamentos do CRM Kanban:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
    // Polling automático a cada 6 segundos para mover cards em tempo real quando o webhook responder
    const interval = setInterval(() => {
      loadData(true);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (card: CrmCard, targetStatus: CrmStatus) => {
    if (card.crm_status === targetStatus) return;

    if (targetStatus === 'Cancelado') {
      const confirmCancel = window.confirm(
        `Deseja realmente cancelar o agendamento de "${card.nome}"?\n\nO horário será liberado e o compromisso será cancelado na Google Agenda.`
      );
      if (!confirmCancel) return;
    }

    const previousStatus = card.crm_status;
    const timestampStr = new Date().toLocaleString('pt-BR');
    const stageLog = `\n[${timestampStr}] Status CRM alterado de "${previousStatus}" para "${targetStatus}".`;
    const updatedLogs = (card.logs || '') + stageLog;

    // Atualização otimista imediata na UI
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, crm_status: targetStatus, logs: updatedLogs } : c))
    );

    if (selectedCardForDrawer?.id === card.id) {
      setSelectedCardForDrawer((prev) => prev ? { ...prev, crm_status: targetStatus, logs: updatedLogs } : null);
    }

    try {
      await api.put(`/appointments/${card.id}`, {
        crm_status: targetStatus,
        status_crm: targetStatus,
        logs: updatedLogs
      });
    } catch (error: any) {
      console.error('Falha ao atualizar status no servidor:', error);
      alert("Falha ao sincronizar alteração de estágio no servidor. Revertendo alteração.");
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, crm_status: previousStatus, logs: card.logs } : c))
      );
    }
  };

  const handleDeleteAppointment = async (card: CrmCard) => {
    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir definitivamente o agendamento de "${card.nome}"?\n\nEsta ação removerá o registro do sistema e cancelará na Google Agenda.`
    );
    if (!confirmDelete) return;

    try {
      await api.delete(`/appointments/${card.id}`);
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      if (selectedCardForDrawer?.id === card.id) {
        setSelectedCardForDrawer(null);
      }
      alert("Agendamento excluído com sucesso!");
    } catch (err: any) {
      console.error("Erro ao excluir agendamento:", err);
      alert("Erro ao excluir agendamento: " + (err.response?.data?.error || err.message || 'Falha de comunicação'));
    }
  };

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
    const targetStatus = over.id as CrmStatus;

    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    await handleUpdateStatus(card, targetStatus);
  };

  const handleSaveNote = async () => {
    if (!selectedCardForDrawer || !newNoteText.trim()) return;
    setIsSavingNote(true);
    try {
      const timestampStr = new Date().toLocaleString('pt-BR');
      const noteLog = `\n[${timestampStr}] Anotação Interna: ${newNoteText.trim()}`;
      const updatedLogs = (selectedCardForDrawer.logs || '') + noteLog;

      await api.put(`/appointments/${selectedCardForDrawer.id}`, {
        logs: updatedLogs
      });

      const updatedCard = { ...selectedCardForDrawer, logs: updatedLogs };
      setSelectedCardForDrawer(updatedCard);
      setCards((prev) => prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)));
      setNewNoteText('');
      alert("Anotação salva no histórico do prospect!");
    } catch (err: any) {
      alert("Erro ao salvar anotação: " + (err.message || 'Falha de comunicação'));
    } finally {
      setIsSavingNote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-white/50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col select-none w-full overflow-hidden">
      {/* Header do Funil Kanban */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
        <div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-lg">
            Funil de Prospecção & Vendas Go Pro
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1 italic flex items-center gap-3">
            Pipeline Go Pro de Prospects <TrendingUp className="text-emerald-400" size={24} />
          </h2>
          <p className="text-xs text-white/40 mt-0.5 uppercase tracking-widest font-semibold">
            Arraste os cards pelas 7 etapas do recrutamento e fechamento Atlântica Natural
          </p>
        </div>

        {/* Controles de Navegação Horizontal das Colunas */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollBoard('left')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors text-xs font-semibold shadow-sm active:scale-95"
            title="Rolar colunas para a esquerda"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <button
            onClick={() => scrollBoard('right')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors text-xs font-semibold shadow-sm active:scale-95"
            title="Rolar colunas para a direita"
          >
            Próximo <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Board Kanban com Drag and Drop */}
      <div 
        ref={boardRef}
        onWheel={handleBoardWheel}
        className="flex-1 min-h-0 flex gap-6 overflow-x-auto pb-4 pt-1 items-stretch w-full custom-scrollbar"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {COLUMNS.map((col) => (
            <KanbanColumnItem
              key={col.id}
              col={col}
              cards={cards.filter((c) => c.crm_status === col.id)}
              onOpenDrawer={setSelectedCardForDrawer}
              onUpdateStatus={handleUpdateStatus}
              onDeleteCard={handleDeleteAppointment}
            />
          ))}

          <DragOverlay>
            {activeCard ? (
              <KanbanCardItem 
                card={activeCard} 
                onOpenDrawer={() => {}} 
                onUpdateStatus={() => {}} 
                onDeleteCard={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Gaveta Lateral (Drawer Timeline & Anotações) */}
      <AnimatePresence>
        {selectedCardForDrawer && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCardForDrawer(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
            />

            {/* Side Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full max-w-lg glass-card bg-slate-950/95 border-l border-white/10 z-50 p-6 overflow-y-auto flex flex-col justify-between shadow-2xl"
            >
              <div className="space-y-6">
                {/* Header Drawer */}
                <div className="flex items-start justify-between border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                      Ficha do Prospect / APN
                    </span>
                    <h3 className="text-xl font-extrabold text-white mt-2">
                      {selectedCardForDrawer.nome}
                    </h3>
                    <p className="text-xs text-white/50 flex items-center gap-2 mt-1">
                      <Phone size={12} className="text-emerald-400" />
                      {selectedCardForDrawer.telefone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteAppointment(selectedCardForDrawer)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold"
                      title="Excluir Agendamento Definitivamente"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                    <button
                      onClick={() => setSelectedCardForDrawer(null)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Resumo do Atendimento */}
                <div className="grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 text-xs">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase">Interesse / Linha</p>
                    <p className="font-bold text-white mt-0.5">{selectedCardForDrawer.treatment_command || selectedCardForDrawer.categoria}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase">Líder / Apresentador</p>
                    <p className="font-bold text-white mt-0.5">{selectedCardForDrawer.professional}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase">Data da APN / Follow-up</p>
                    <p className="font-bold text-white mt-0.5">
                      {formatDateSafe(selectedCardForDrawer.horarioConsulta)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase">Estágio Go Pro</p>
                    <p className="font-bold text-emerald-400 mt-0.5">{selectedCardForDrawer.crm_status}</p>
                  </div>
                </div>

                {/* Ações Rápidas de Alteração de Status */}
                <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-extrabold text-white/40 uppercase tracking-wider mb-2">Alterar Estágio Rápido</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      onClick={() => handleUpdateStatus(selectedCardForDrawer, 'Novo Contato')}
                      className={`p-2 rounded-xl border font-bold transition-all text-[11px] ${selectedCardForDrawer.crm_status === 'Novo Contato' ? 'bg-slate-500 text-white border-slate-400' : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'}`}
                    >
                      Novo Contato
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedCardForDrawer, 'Agendado')}
                      className={`p-2 rounded-xl border font-bold transition-all text-[11px] ${selectedCardForDrawer.crm_status === 'Agendado' ? 'bg-blue-600 text-white border-blue-400' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'}`}
                    >
                      Agendado
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedCardForDrawer, 'Confirmado')}
                      className={`p-2 rounded-xl border font-bold transition-all text-[11px] ${selectedCardForDrawer.crm_status === 'Confirmado' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                    >
                      Confirmado
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedCardForDrawer, 'Faltou')}
                      className={`p-2 rounded-xl border font-bold transition-all text-[11px] ${selectedCardForDrawer.crm_status === 'Faltou' ? 'bg-amber-500 text-white border-amber-400' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'}`}
                    >
                      Faltou
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedCardForDrawer, 'Alta/Concluído')}
                      className={`p-2 rounded-xl border font-bold transition-all text-[11px] ${selectedCardForDrawer.crm_status === 'Alta/Concluído' ? 'bg-purple-500 text-white border-purple-400' : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'}`}
                    >
                      Concluído
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedCardForDrawer, 'Cancelado')}
                      className={`p-2 rounded-xl border font-bold transition-all text-[11px] ${selectedCardForDrawer.crm_status === 'Cancelado' ? 'bg-rose-600 text-white border-rose-500' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'}`}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                {/* Prévia da Mensagem da IA */}
                {selectedCardForDrawer.aiMessagePreview && (
                  <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
                    <h5 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 mb-1.5">
                      <Sparkles size={14} /> Prévia da Mensagem (IA Gemini)
                    </h5>
                    <p className="text-xs text-white/80 italic leading-relaxed">
                      "{selectedCardForDrawer.aiMessagePreview}"
                    </p>
                  </div>
                )}

                {/* Linha do Tempo Cronológica (Logs & Eventos) */}
                <div>
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <History size={14} className="text-indigo-400" /> Linha do Tempo e Histórico
                  </h4>

                  <div className="space-y-3 pl-3 border-l-2 border-white/10 text-xs">
                    <div className="relative pl-4 before:absolute before:-left-[17px] before:top-1 before:w-2.5 before:h-2.5 before:rounded-full before:bg-indigo-500">
                      <p className="font-bold text-white">Registro Criado no CRM</p>
                      <p className="text-[10px] text-white/40 mt-0.5">Agendamento registrado no banco multi-tenant</p>
                    </div>

                    {selectedCardForDrawer.logs ? (
                      selectedCardForDrawer.logs.split('\n').filter(line => line.trim()).map((line, idx) => (
                        <div key={idx} className="relative pl-4 before:absolute before:-left-[17px] before:top-1 before:w-2.5 before:h-2.5 before:rounded-full before:bg-emerald-400">
                          <p className="text-white/80 leading-snug">{line}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-white/30 text-xs italic pl-4">Nenhum evento adicional gravado no log.</p>
                    )}
                  </div>
                </div>

                {/* Bloco de Anotações do Líder / Fechamento */}
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText size={14} className="text-emerald-400" /> Anotações de Fechamento & Objeções
                  </h4>
                  <textarea
                    rows={3}
                    placeholder="Digite observações internas sobre o prospect, kit de interesse ou objeções..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all resize-none"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                  />
                  <button
                    disabled={isSavingNote || !newNoteText.trim()}
                    onClick={handleSaveNote}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                  >
                    {isSavingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Salvar Anotação de Fechamento
                  </button>
                </div>
              </div>

              {/* Roda-pé do Drawer */}
              <div className="pt-4 border-t border-white/10 mt-6">
                <a
                  href={`https://wa.me/55${selectedCardForDrawer.telefone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <MessageCircle size={16} /> Abrir Conversa no WhatsApp
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
