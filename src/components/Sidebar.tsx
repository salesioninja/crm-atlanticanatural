import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Sparkles, 
  BadgeCheck, 
  Settings, 
  FileText,
  MessageSquare,
  Play,
  Zap,
  Plus,
  TrendingUp,
  Smartphone,
  X,
  Link as LinkIcon,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ViewType = 
  | 'dashboard' 
  | 'agenda' 
  | 'admin' 
  | 'records' 
  | 'servicos' 
  | 'lista_ia' 
  | 'profissionais' 
  | 'simulacoes' 
  | 'integracao' 
  | 'configuracoes'
  | 'client' // Portal do Cliente
  | 'crm' // Pipeline CRM
  | 'inbox' // Chat ao Vivo
  | 'dispositivos' // QR Code e Status
  | 'super_admin'; // Central Master de Clínicas

interface SidebarProps {
  onViewChange: (view: ViewType) => void;
  onNewAppointment: () => void;
  onNewClient: () => void;
  currentView: ViewType;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ 
  onViewChange, 
  onNewAppointment, 
  onNewClient, 
  currentView,
  isMobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard MMN', icon: LayoutDashboard, view: 'dashboard' as const },
    { id: 'crm', name: 'Pipeline Go Pro', icon: TrendingUp, view: 'crm' as const },
    { id: 'inbox', name: 'Inbox (WhatsApp)', icon: MessageSquare, view: 'inbox' as const },
    { id: 'agenda', name: 'Agenda de APNs', icon: Calendar, view: 'agenda' as const },
    { id: 'client', name: 'Link de Indicação', icon: LinkIcon, view: 'client' as const },
    { id: 'clientes', name: 'Gestão de Prospects', icon: Users, view: 'admin' as const },
    { id: 'records', name: 'Fichas & Qualificação', icon: FileText, view: 'records' as const },
    { id: 'servicos', name: 'Catálogo & Kits', icon: Sparkles, view: 'servicos' as const },
    { id: 'lista_ia', name: 'Follow-up IA', icon: MessageSquare, view: 'lista_ia' as const },
    { id: 'profissionais', name: 'Líderes & Mentores', icon: BadgeCheck, view: 'profissionais' as const },
    { id: 'simulacoes', name: 'Simulações de Lucro', icon: Play, view: 'simulacoes' as const },
    { id: 'integracao', name: 'Integrações', icon: Zap, view: 'integracao' as const },
    { id: 'dispositivos', name: 'WhatsApp Conectado', icon: Smartphone, view: 'dispositivos' as const },
    { id: 'configuracoes', name: 'Configurações da IA', icon: Settings, view: 'configuracoes' as const },
  ];

  const { isSuperAdmin, tenantId, tenantName } = useAuth();
  const logoUrl = "https://acessaronline.com.br/wp-content/uploads/2026/03/WhatsApp-Image-2025-12-05-at-09.33.24.jpeg";

  const handleSelectView = (view: ViewType) => {
    onViewChange(view);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden transition-opacity"
        />
      )}

      <aside className={`fixed left-0 top-0 h-screen w-64 glass-sidebar flex flex-col py-8 px-6 z-50 select-none transition-transform duration-300 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Brand logo & Close Button for Mobile */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/30 shadow-lg shadow-emerald-500/20 shrink-0 bg-slate-900 flex items-center justify-center">
              <span className="text-emerald-400 font-extrabold text-lg">AN</span>
            </div>
            <div>
              <span className="text-white text-sm font-bold tracking-tight block truncate max-w-[140px]">{tenantName || 'Atlântica Natural'}</span>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block leading-none mt-0.5">Especialista MMN</span>
            </div>
          </div>

          <button 
            onClick={onCloseMobile}
            className="md:hidden text-white/40 hover:text-white p-2 rounded-xl bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav List */}
        <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar pr-1">
          {/* Item exclusivo Super Admin */}
          {isSuperAdmin && (
            <div className="pb-2 mb-2 border-b border-indigo-500/20">
              <button
                onClick={() => handleSelectView('super_admin')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group border ${
                  currentView === 'super_admin'
                    ? 'text-white bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                    : 'text-indigo-300 hover:text-white hover:bg-indigo-500/10 border-indigo-500/10'
                }`}
              >
                <Building2 size={18} className="text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                <span className="text-xs font-bold tracking-wide flex-1 text-left">Gestão de Clínicas</span>
                <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                  Master
                </span>
              </button>
            </div>
          )}

          {menuItems.map((item) => {
            const isActive = (item.view === currentView);
            
            return (
              <button
                key={item.id}
                onClick={() => handleSelectView(item.view)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group border border-transparent ${
                  isActive 
                    ? 'text-white bg-white/10 border-white/5 shadow-inner' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon size={18} className={isActive ? 'text-indigo-400' : 'text-white/40 group-hover:text-white transition-colors'} />
                <span className="text-xs font-semibold tracking-wide">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Roda-pé com as duas CTAs principais da clínica */}
        <div className="pt-6 border-t border-white/5 space-y-2 mt-auto">
          <button 
            onClick={() => { onNewAppointment(); if (onCloseMobile) onCloseMobile(); }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-indigo-600/10 flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            Novo Agendamento
          </button>
          <button 
            onClick={() => { onNewClient(); if (onCloseMobile) onCloseMobile(); }}
            className="w-full bg-white hover:bg-white/90 text-indigo-600 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            Novo Cliente
          </button>
        </div>
      </aside>
    </>
  );
}
