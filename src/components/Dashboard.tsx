import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Clock, 
  Check, 
  ShieldCheck, 
  ChevronRight, 
  MessageSquare, 
  Plus, 
  Smartphone, 
  Wand2, 
  UserPlus, 
  Tag, 
  CheckCircle,
  HelpCircle,
  FileText,
  Trash2
} from 'lucide-react';
import { Client, Appointment } from '../types';

interface DashboardProps {
  clients: Client[];
  appointments: Appointment[];
  selectedClientId: string;
  onSelectClient: (id: string) => void;
  onUpdateClient: (updatedClient: Client) => void;
  onNewAppointment: () => void;
  onNewClient: () => void;
}

// Componente memoizado de gráficos analíticos para evitar o recálculo dos nós SVG do Recharts
const AnalyticsCharts = React.memo(() => {
  const financialData = useMemo(() => [
    { name: 'Nutracêuticos', ganha: 6400, perdida: 450 },
    { name: 'Linha Ozônio', ganha: 4200, perdida: 200 },
    { name: 'Perfumaria Fina', ganha: 5800, perdida: 600 }
  ], []);

  const interestData = useMemo(() => [
    { day: 'Revenda', rate: 55 },
    { day: 'Liderança', rate: 30 },
    { day: 'Consumo', rate: 15 }
  ], []);

  const funnelData = useMemo(() => [
    { stage: 'Novo Lead', count: 48 },
    { stage: 'Qualificação', count: 36 },
    { stage: 'APN Enviada', count: 28 },
    { stage: 'Follow-up', count: 19 },
    { stage: 'Fechamento', count: 12 },
    { stage: 'Cadastrado', count: 8 }
  ], []);

  return (
    <div className="col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* Gráfico 1: Volume PV / Vendas (BarChart) */}
      <div className="glass-card rounded-[32px] p-6 border-white/5">
        <h4 className="font-extrabold text-white text-sm mb-4">Volume por Linha de Produtos (R$)</h4>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financialData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="ganha" name="Volume Confirmado" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="perdida" name="Em Aberto" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Perfil de Interesse (LineChart / BarChart) */}
      <div className="glass-card rounded-[32px] p-6 border-white/5">
        <h4 className="font-extrabold text-white text-sm mb-4">Perfil dos Prospects (%)</h4>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={interestData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="day" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="rate" name="% dos Contatos" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 3: Funil Go Pro (AreaChart) */}
      <div className="glass-card rounded-[32px] p-6 border-white/5">
        <h4 className="font-extrabold text-white text-sm mb-4">Funil de Conversão Go Pro</h4>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="stage" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="count" name="Prospects" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

export default function Dashboard({ 
  clients, 
  appointments, 
  selectedClientId, 
  onSelectClient, 
  onUpdateClient,
  onNewAppointment,
  onNewClient 
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'agenda' | 'lembretes' | 'clientes'>('clientes');
  const [activeSubTab, setActiveSubTab] = useState<'anamnese' | 'historico' | 'arquivos'>('anamnese');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergy, setNewAllergy] = useState('');
  const [isAddingAllergy, setIsAddingAllergy] = useState(false);

  // Encontrar o cliente selecionado
  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || clients[0] || null;
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (selectedClient) {
      setAllergies(selectedClient.allergies || []);
    }
  }, [selectedClient?.id]);

  const kpiStats = useMemo(() => [
    { label: 'TOTAL CLIENTES (Hoje)', value: clients.length > 0 ? clients.length.toString() : '142', icon: Users, color: 'from-emerald-500/20 to-emerald-500/5', textCol: 'text-emerald-400' },
    { label: 'Total de Agendamentos (Hoje)', value: appointments.length > 0 ? appointments.length.toString() : '45', icon: CalendarIcon, color: 'from-indigo-500/20 to-indigo-500/5', textCol: 'text-indigo-400' },
    { label: 'Fila de Disparos Ativa', value: '12', icon: Clock, color: 'from-amber-500/20 to-amber-500/5', textCol: 'text-amber-400', isQueue: true },
    { label: 'Conversão Ninja', value: '98.4%', icon: ShieldCheck, color: 'from-purple-500/20 to-purple-500/5', textCol: 'text-purple-400', isProgress: true }
  ], [clients.length, appointments.length]);

  const handleAddAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllergy.trim() || !selectedClient) return;
    const updatedAllergies = [...allergies, newAllergy.trim()];
    setAllergies(updatedAllergies);
    onUpdateClient({
      ...selectedClient,
      allergies: updatedAllergies
    });
    setNewAllergy('');
    setIsAddingAllergy(false);
  };

  const handleRemoveAllergy = (allergyToRemove: string) => {
    if (!selectedClient) return;
    const updatedAllergies = allergies.filter(a => a !== allergyToRemove);
    setAllergies(updatedAllergies);
    onUpdateClient({
      ...selectedClient,
      allergies: updatedAllergies
    });
  };

  const handleSendWhatsApp = (client: Client) => {
    const message = `Olá ${client.name}, tudo bem? Gostaríamos de confirmar o seu próximo agendamento clínico.`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-8 pb-20 select-none">
      {/* Header do Painel */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white italic">
            Painel de Gestão e Lembretes Ninja <span className="inline-block text-indigo-400 font-bold not-italic text-xs sm:text-sm bg-indigo-500/10 px-2.5 py-1 rounded-xl mt-1 sm:mt-0 sm:ml-2 border border-indigo-500/20">CRM Ninja</span>
          </h2>
          <p className="text-xs sm:text-sm text-white/40 mt-1 uppercase tracking-widest font-semibold">Workspace da Clínica Conectada</p>
        </div>

        {/* Status de Rede */}
        <div className="bg-white/5 border border-white/5 rounded-2xl py-3 px-5 flex items-center gap-3 shrink-0 backdrop-blur-md">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Status de Rede</p>
            <p className="text-xs font-bold text-emerald-400">Rede Segura & Ninja Ativa</p>
          </div>
          <CheckCircle size={16} className="text-emerald-400 ml-2" />
        </div>
      </div>

      {/* Grid de KPIs do Topo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiStats.map((stat, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={stat.label}
            className={`glass-card p-6 rounded-[32px] border-white/5 bg-gradient-to-br ${stat.color} relative overflow-hidden flex flex-col justify-between`}
          >
            <div className="flex justify-between items-start">
              <div className={`p-2.5 rounded-xl bg-white/5 ${stat.textCol}`}>
                <stat.icon size={20} />
              </div>
              
              {stat.isQueue && (
                <div className="flex items-end gap-0.5 h-6">
                  <span className="w-1 bg-amber-500/20 rounded-full h-2"></span>
                  <span className="w-1 bg-amber-500/40 rounded-full h-3"></span>
                  <span className="w-1 bg-amber-500/60 rounded-full h-5"></span>
                  <span className="w-1 bg-amber-500 rounded-full h-4"></span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black text-white tracking-tighter leading-none">{stat.value}</h3>
              
              {stat.isProgress && (
                <div className="mt-3 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full w-[98.4%]"></div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Grid de 3 Colunas Central do Dashboard */}
      <div className="grid grid-cols-12 gap-6 items-start">
        
        {/* Nova Linha de Gráficos Analíticos Memoizados */}
        <AnalyticsCharts />

        {/* Coluna 2: Visão Geral (col-span-5) */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-5 glass-card rounded-[32px] p-6 border-white/5 min-h-[460px] flex flex-col justify-between">
          <div>
            {/* Abas Superiores */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4 mb-6">
              <h4 className="font-extrabold text-white text-base">Visão Geral</h4>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {[
                  { id: 'agenda', label: 'Agenda Próxima' },
                  { id: 'lembretes', label: 'Fila de Lembretes' },
                  { id: 'clientes', label: 'Lista de Clientes' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 sm:px-3 py-1.5 rounded-xl transition-all ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo das Abas */}
            <div className="space-y-3">
              {activeTab === 'clientes' && (
                <div className="space-y-3">
                  {clients.slice(0, 3).map((client) => {
                    const isSelected = client.id === selectedClientId;
                    return (
                      <div
                        key={client.id}
                        onClick={() => onSelectClient(client.id)}
                        className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-lg' 
                            : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-slate-900 rounded-xl overflow-hidden border border-white/10 shrink-0">
                            {client.avatar ? (
                              <img src={client.avatar} alt={client.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center font-bold text-xs text-white/20">{client.name[0]}</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{client.name}</p>
                            <p className="text-[10px] text-white/30 truncate">{client.email || 'Sem e-mail'}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                          <div className="text-left sm:text-right">
                            <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Última Visita</p>
                            <p className="text-[10px] text-white/80 font-medium">{client.lastVisit || 'N/A'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                              client.status === 'Ativo' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {client.status}
                            </span>
                            <button className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-indigo-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white/40'
                            }`}>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'agenda' && (
                <div className="space-y-3">
                  {appointments.slice(0, 3).map((apt) => (
                    <div
                      key={apt.id}
                      className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">{apt.treatmentName}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">{apt.clientName} • {apt.time}</p>
                      </div>
                      <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg">
                        Confirmado
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'lembretes' && (
                <div className="space-y-3">
                  {appointments.slice(0, 3).map((apt) => (
                    <div
                      key={apt.id}
                      className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">Disparo Agendado para {apt.clientName}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">{apt.treatmentName} • Envio programado</p>
                      </div>
                      <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        Fila IA
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Paginação */}
          <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-6">
            <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Mostrando 3 de {clients.length}</span>
            <div className="flex items-center gap-1">
              <button className="h-6 w-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40"><ChevronRight size={12} className="rotate-185" /></button>
              <button className="h-6 w-6 rounded bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">1</button>
              <button className="h-6 w-6 rounded bg-white/5 hover:bg-white/10 font-bold text-xs flex items-center justify-center text-white/40">2</button>
              <button className="h-6 w-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40"><ChevronRight size={12} /></button>
            </div>
          </div>
        </div>

        {/* Coluna 3: Ficha Detalhada Beatriz Soares (col-span-4) */}
        <div className="col-span-12 lg:col-span-12 xl:col-span-4 glass-card rounded-[32px] p-6 border-white/5 min-h-[460px] relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-[-50%] right-[-50%] w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]"></div>

          {selectedClient ? (
            <div>
              {/* Header do Cliente */}
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-2xl bg-slate-900 border-2 border-white/10 overflow-hidden shadow-xl shrink-0">
                  {selectedClient.avatar ? (
                    <img src={selectedClient.avatar} alt={selectedClient.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center font-bold text-xl text-white/20">{selectedClient.name[0]}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-white text-lg truncate leading-tight italic">{selectedClient.name}</h4>
                  <p className="text-xs text-white/40 mt-1 font-medium">{selectedClient.phone}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => handleSendWhatsApp(selectedClient)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider transition-colors active:scale-95 shadow-lg shadow-emerald-950/20"
                  >
                    WhatsApp
                  </button>
                  <button className="h-7 w-7 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all">
                    <CheckCircle size={14} />
                  </button>
                </div>
              </div>

              {/* Sub-Abas do Painel de Ficha */}
              <div className="flex border-b border-white/5 mb-4">
                {[
                  { id: 'anamnese', label: 'Anamnese' },
                  { id: 'historico', label: 'Histórico' },
                  { id: 'arquivos', label: 'Arquivos' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubTab(sub.id as any)}
                    className={`flex-1 text-[10px] font-bold uppercase tracking-widest text-center py-2 border-b-2 transition-all ${
                      activeSubTab === sub.id
                        ? 'border-indigo-500 text-white'
                        : 'border-transparent text-white/30 hover:text-white/50'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {/* Conteúdo das Sub-Abas */}
              <div className="space-y-4 text-xs">
                {activeSubTab === 'anamnese' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5">Condição da Pele</p>
                      <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-white/80 font-semibold italic flex items-center justify-between">
                        <span>{selectedClient.skinCondition || 'Mista a Oleosa'}</span>
                        <div className="h-2 w-2 rounded-full bg-indigo-400"></div>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Alergias</p>
                      <div className="flex flex-wrap gap-1.5">
                        {allergies.map(a => (
                          <span key={a} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-300 rounded-lg text-[9px] font-bold border border-rose-500/10">
                            {a}
                            <button onClick={() => handleRemoveAllergy(a)} className="text-rose-400 hover:text-rose-200 font-bold ml-1">×</button>
                          </span>
                        ))}

                        {isAddingAllergy ? (
                          <form onSubmit={handleAddAllergy} className="flex gap-1.5 items-center">
                            <input 
                              type="text" 
                              required
                              placeholder="Nova alergia"
                              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] outline-none text-white focus:border-indigo-500 w-24"
                              value={newAllergy}
                              onChange={e => setNewAllergy(e.target.value)}
                            />
                            <button type="submit" className="bg-emerald-600 text-white px-2 py-1 rounded-lg text-[9px] font-bold">Salvar</button>
                            <button type="button" onClick={() => setIsAddingAllergy(false)} className="text-zinc-500 text-[10px]">Cancelar</button>
                          </form>
                        ) : (
                          <button 
                            onClick={() => setIsAddingAllergy(true)}
                            className="px-2.5 py-1 bg-white/5 text-white/40 rounded-lg text-[9px] font-bold border border-dashed border-white/10 hover:border-white/20 hover:text-white transition-colors"
                          >
                            + ADICIONAR
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === 'historico' && (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto no-scrollbar">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <p className="font-bold text-white">Limpeza de Pele Profunda</p>
                      <p className="text-[9px] text-white/30 mt-0.5 uppercase">12 de Out, 2023 • Finalizado</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <p className="font-bold text-white">Peeling de Diamante</p>
                      <p className="text-[9px] text-white/30 mt-0.5 uppercase">05 de Set, 2023 • Finalizado</p>
                    </div>
                  </div>
                )}

                {activeSubTab === 'arquivos' && (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto no-scrollbar">
                    {selectedClient.files && selectedClient.files.length > 0 ? (
                      selectedClient.files.map(f => (
                        <div key={f.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center group">
                          <div className="flex items-center gap-2 truncate">
                            <FileText size={14} className="text-indigo-400 shrink-0" />
                            <div className="truncate">
                              <p className="font-bold text-white truncate">{f.name}</p>
                              <p className="text-[9px] text-white/30">{f.date} • {f.size}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-[10px] text-white/30 py-6">Nenhum arquivo anexado.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-white/20">Selecione um prospect</div>
          )}

          {/* Floating Bubble Icon */}
          <div className="flex justify-end mt-6">
            <button 
              onClick={() => handleSendWhatsApp(selectedClient)}
              className="h-10 w-10 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all"
            >
              <MessageSquare size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
