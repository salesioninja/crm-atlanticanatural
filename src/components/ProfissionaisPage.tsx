import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, BadgeCheck, Phone, Mail, Award, Trash2, Edit, UserPlus, Image } from 'lucide-react';
import Modal from './Modal';
import api from '../lib/api';

export interface Professional {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  email: string;
  phone?: string;
  avatar?: string;
  avatar_url?: string;
  status: 'Ativo' | 'Férias' | 'Inativo';
}

export default function ProfissionaisPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [newProf, setNewProf] = useState({ name: '', role: '', specialty: '', email: '', phone: '', avatar_url: '' });
  const [editingProf, setEditingProf] = useState<Professional | null>(null);

  const fetchProfessionals = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/users');
      // Mapear campos do banco para o estado do frontend
      if (Array.isArray(res.data)) {
        const mapped: Professional[] = res.data.map((u: any) => ({
          id: u.id,
          name: u.name || 'Líder Atlântica',
          role: u.role || 'Consultor Líder',
          specialty: u.specialty || (u.role === 'lider_diamante' ? 'Líder Diamante Oficial' : 'Mentor de Negócios MMN'),
          email: u.email,
          phone: u.phone || '+55 46 99976-5576',
          avatar: u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name || 'AN')}`,
          avatar_url: u.avatar_url || '',
          status: (u.status === 'Ativo' || u.status === 'Férias' || u.status === 'Inativo') ? u.status : 'Ativo'
        }));
        setProfessionals(mapped);
      }
    } catch (err) {
      console.error("Erro ao buscar profissionais do banco:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const handleAddProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProf.name || !newProf.role || !newProf.email) return;

    try {
      const payload = {
        name: newProf.name,
        role: newProf.role,
        email: newProf.email,
        avatar_url: newProf.avatar_url,
        status: 'Ativo',
        google_calendar_id: 'primary'
      };

      await api.post('/users', payload);
      alert("Profissional cadastrado com sucesso no banco de dados!");
      fetchProfessionals();
      setNewProf({ name: '', role: '', specialty: '', email: '', phone: '', avatar_url: '' });
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao cadastrar profissional: ${err.message}`);
    }
  };

  const handleEditClick = (prof: Professional) => {
    setEditingProf(prof);
    setIsEditModalOpen(true);
  };

  const handleUpdateProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProf) return;

    try {
      const payload = {
        name: editingProf.name,
        role: editingProf.role,
        email: editingProf.email,
        avatar_url: editingProf.avatar_url,
        status: editingProf.status
      };

      await api.put(`/users/${editingProf.id}`, payload);
      alert("Profissional atualizado com sucesso no banco de dados!");
      fetchProfessionals();
      setIsEditModalOpen(false);
      setEditingProf(null);
    } catch (err: any) {
      alert(`Erro ao atualizar profissional: ${err.message}`);
    }
  };

  const handleDeleteProfessional = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este profissional do banco de dados?')) {
      try {
        await api.delete(`/users/${id}`);
        alert("Profissional removido com sucesso!");
        fetchProfessionals();
      } catch (err: any) {
        alert(`Erro ao remover profissional: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-10 pb-24 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
            Linha Ascendente & Liderança
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mt-3 sm:mt-4 italic">
            Líderes & Mentores
          </h2>
          <p className="text-xs sm:text-sm text-white/40 mt-1 uppercase tracking-widest font-semibold">Equipe de mentoria e fechamento da Atlântica Natural.</p>
        </div>

        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-indigo-950/20 active:scale-95 hover:bg-indigo-500 shrink-0"
        >
          <Plus size={18} />
          Novo Integrante
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-3 text-center py-20 text-white/40">
            Carregando profissionais da clínica...
          </div>
        ) : professionals.length === 0 ? (
          <div className="col-span-3 text-center py-20 text-white/40">
            Nenhum profissional cadastrado.
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {professionals.map((prof, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                key={prof.id}
                className="glass-card p-6 rounded-[32px] border-white/5 flex flex-col justify-between group relative overflow-hidden text-center items-center bg-white/5"
              >
                <div className="absolute top-4 right-4 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEditClick(prof)}
                    className="h-8 w-8 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all"
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteProfessional(prof.id)}
                    className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Avatar */}
                <div className="h-28 w-28 rounded-full border-4 border-white/10 overflow-hidden shadow-2xl relative bg-slate-900 mb-4 mt-2">
                  <img 
                    src={prof.avatar} 
                    alt={prof.name} 
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Info */}
                <div className="space-y-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                    prof.status === 'Ativo' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : prof.status === 'Férias'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-white/5 text-white/30 border-white/10'
                  }`}>
                    {prof.status}
                  </span>
                  <h3 className="font-extrabold text-lg text-white group-hover:text-indigo-400 transition-all leading-snug">{prof.name}</h3>
                  <p className="text-xs text-white/50 font-bold uppercase tracking-wider leading-none">{prof.role}</p>
                  <p className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase mt-1">{prof.specialty || 'Profissional'}</p>
                </div>

                {/* Contacts */}
                <div className="w-full border-t border-white/5 mt-6 pt-4 space-y-2 text-xs text-white/40 text-left">
                  <p className="flex items-center gap-2 truncate">
                    <Mail size={12} className="text-indigo-400 shrink-0" />
                    {prof.email}
                  </p>
                  <p className="flex items-center gap-2 truncate">
                    <Phone size={12} className="text-purple-400 shrink-0" />
                    {prof.phone}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add Professional Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        title="Cadastrar Novo Profissional"
      >
        <form onSubmit={handleAddProfessional} className="space-y-4">
          <div className="relative group">
            <UserPlus className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <input 
              required
              type="text" 
              placeholder="Nome do Profissional"
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white placeholder-white/25"
              value={newProf.name}
              onChange={e => setNewProf({...newProf, name: e.target.value})}
            />
          </div>

          <div className="relative group">
            <Award className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <input 
              required
              type="text" 
              placeholder="Cargo / Especialidade (ex: Osteopatia)"
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white placeholder-white/25"
              value={newProf.role}
              onChange={e => setNewProf({...newProf, role: e.target.value})}
            />
          </div>

          <div className="relative group">
            <Mail className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <input 
              required
              type="email" 
              placeholder="E-mail de Trabalho"
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white placeholder-white/25"
              value={newProf.email}
              onChange={e => setNewProf({...newProf, email: e.target.value})}
            />
          </div>

          <div className="relative group">
            <Image className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <input 
              type="url" 
              placeholder="URL da Foto (opcional)"
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white placeholder-white/25"
              value={newProf.avatar_url}
              onChange={e => setNewProf({...newProf, avatar_url: e.target.value})}
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest mt-4 shadow-xl hover:bg-indigo-500 transition-all active:scale-95"
          >
            Cadastrar Profissional
          </button>
        </form>
      </Modal>

      {/* Edit Professional Modal */}
      {editingProf && (
        <Modal 
          isOpen={isEditModalOpen} 
          onClose={() => { setIsEditModalOpen(false); setEditingProf(null); }}
          title="Editar Profissional"
        >
          <form onSubmit={handleUpdateProfessional} className="space-y-4">
            <div className="relative group">
              <UserPlus className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                required
                type="text" 
                placeholder="Nome do Profissional"
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white"
                value={editingProf.name}
                onChange={e => setEditingProf({...editingProf, name: e.target.value})}
              />
            </div>

            <div className="relative group">
              <Award className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                required
                type="text" 
                placeholder="Cargo"
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white"
                value={editingProf.role}
                onChange={e => setEditingProf({...editingProf, role: e.target.value})}
              />
            </div>

            <div className="relative group">
              <Mail className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                required
                type="email" 
                placeholder="E-mail de Trabalho"
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white"
                value={editingProf.email}
                onChange={e => setEditingProf({...editingProf, email: e.target.value})}
              />
            </div>

            <div className="relative group">
              <Image className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type="url" 
                placeholder="URL da Foto (opcional)"
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white placeholder-white/25"
                value={editingProf.avatar_url || ''}
                onChange={e => setEditingProf({...editingProf, avatar_url: e.target.value})}
              />
            </div>

            <div className="relative group">
              <select 
                required
                className="w-full bg-[#121214] border border-white/5 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-white"
                value={editingProf.status}
                onChange={e => setEditingProf({...editingProf, status: e.target.value as 'Ativo' | 'Férias' | 'Inativo'})}
              >
                <option value="Ativo" className="bg-[#121214]">Ativo</option>
                <option value="Férias" className="bg-[#121214]">Férias</option>
                <option value="Inativo" className="bg-[#121214]">Inativo</option>
              </select>
            </div>

            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest mt-4 shadow-xl hover:bg-indigo-500 transition-all active:scale-95"
            >
              Salvar Alterações
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
