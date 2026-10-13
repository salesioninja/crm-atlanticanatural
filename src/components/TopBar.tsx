import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Bell, Settings, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TopBarProps {
  onSearch: (term: string) => void;
  onOpenSettings: () => void;
  onToggleMobileMenu?: () => void;
}

export default function TopBar({ onSearch, onOpenSettings, onToggleMobileMenu }: TopBarProps) {
  const { user, tenantId } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const isMasterSuperAdmin = tenantId === 'crmninja' || tenantId === 'agencianinja' || (user?.email === 'salesioninja@gmail.com') || (user?.email === 'suporteninja1@gmail.com');
  const logoUrl = "https://acessaronline.com.br/wp-content/uploads/2026/03/WhatsApp-Image-2025-12-05-at-09.33.24.jpeg";

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 h-20 z-40 glass-header flex items-center justify-between px-4 md:px-10 border-b border-white/5">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Hamburger Menu Button (Mobile Only) */}
        <button 
          onClick={onToggleMobileMenu}
          className="md:hidden p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:text-white transition-all active:scale-95"
          title="Abrir Menu"
        >
          <Menu size={20} />
        </button>

        {/* Search Bar */}
        <div className="flex items-center bg-white/5 px-4 md:px-6 py-2.5 rounded-2xl flex-1 group focus-within:bg-white/10 transition-all border border-white/10 focus-within:border-emerald-500/50 shadow-inner">
          <Search size={18} className="text-white/40 mr-2 md:mr-3 shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar prospects, líderes ou produtos..."
            className="bg-transparent border-none focus:ring-0 text-white text-xs md:text-sm w-full placeholder:text-white/30 outline-none"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 ml-2">
        <div className="flex gap-2 relative">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`w-10 h-10 md:w-11 md:h-11 border rounded-2xl flex items-center justify-center transition-all ${
                showNotifications 
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Bell size={18} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-emerald-500 rounded-full"></span>
            </button>
            
            <AnimatePresence>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="absolute right-0 mt-3 w-72 sm:w-80 max-w-[calc(100vw-2rem)] glass-card rounded-3xl border-white/10 p-4 sm:p-5 shadow-2xl z-50 space-y-4"
                  >
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <h4 className="font-bold text-sm text-white">Notificações MMN</h4>
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">3 novas</span>
                    </div>
                    <div className="space-y-3">
                      {[
                        { id: 1, text: 'Rodrigo Silva agendou APN 1 a 1 (Apresentação do Plano).', time: 'Há 5 min' },
                        { id: 2, text: 'Camila Ferreira escolheu Kit Bronze e solicitou ativação.', time: 'Há 1 hora' },
                        { id: 3, text: 'Follow-up 24h: Enviar vídeo institucional para Marcos Aurélio.', time: 'Há 2 horas' }
                      ].map(n => (
                        <div key={n.id} className="text-xs space-y-1 p-2.5 rounded-xl hover:bg-white/5 transition-all text-left">
                          <p className="font-semibold text-white/80 leading-normal">{n.text}</p>
                          <p className="text-[9px] text-white/30">{n.time}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={onOpenSettings}
            className="w-10 h-10 md:w-11 md:h-11 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <Settings size={18} />
          </button>
        </div>
        
        <div className="h-10 w-10 md:h-11 md:w-11 rounded-full overflow-hidden border border-emerald-400/30 cursor-pointer hover:border-emerald-400 transition-all shadow-lg ring-2 ring-white/5 shrink-0 bg-slate-900" title="Atlântica Natural">
          <img 
            src={logoUrl} 
            alt="Atlântica Natural"
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
}
