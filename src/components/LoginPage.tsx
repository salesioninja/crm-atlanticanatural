import { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, isLoading } = useAuth();
  const [emailInput, setEmailInput] = useState('suporteninja1@gmail.com');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setIsSubmittingEmail(true);
    try {
      await loginWithEmail(emailInput.trim());
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-md z-10 animate-fade-in">
        <div className="glass-card rounded-[32px] p-8 sm:p-10 border border-white/10 shadow-2xl relative overflow-hidden bg-white/5 backdrop-blur-2xl">
          
          <div className="text-center space-y-2 mb-8">
            <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 font-extrabold text-[10px] uppercase tracking-widest mb-2">
              Grupo ATL • Expansão Oficial
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Atlântica Natural CRM
            </h1>
            <p className="text-emerald-400 font-bold tracking-widest text-[10px] uppercase">
              Especialista Go Pro • Acesso Seguro
            </p>
          </div>

          <div className="space-y-4">
            {/* Botão de 1 Clique para Suporte Ninja */}
            <button
              type="button"
              onClick={() => loginWithEmail('suporteninja1@gmail.com')}
              disabled={isLoading || isSubmittingEmail}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-2xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading || isSubmittingEmail ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>Entrando no CRM...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Acesso Ninja (suporteninja1@gmail.com)</span>
                </>
              )}
            </button>

            {/* Divisor */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">ou entre com outro e-mail</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            {/* Formulário com E-mail */}
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <input
                type="email"
                placeholder="Digite seu e-mail de líder..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-xs text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || isSubmittingEmail || !emailInput.trim()}
                className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/15 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Entrar com este E-mail
              </button>
            </form>

            {/* Botão Google Tradicional */}
            <div className="pt-2">
              <button
                type="button"
                onClick={loginWithGoogle}
                disabled={isLoading || isSubmittingEmail}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 px-4 py-3 rounded-2xl font-semibold text-xs flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  <path d="M1 1h22v22H1z" fill="none"/>
                </svg>
                <span>Conectar com Google Pop-up</span>
              </button>
            </div>
          </div>
          
          <div className="mt-8 text-center border-t border-white/5 pt-6">
             <p className="text-[10px] text-white/30 font-semibold tracking-wide">
               Ambiente Dedicado VPS • PostgreSQL 16 Nativo<br/>
               Atlântica Natural • Grupo ATL • Acesso Seguro
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
