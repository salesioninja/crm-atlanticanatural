import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { Client } from '../types';
import { useAuth } from '../context/AuthContext';
import ChatWindow from './ChatWindow';

export const InboxPage: React.FC = () => {
  const { tenantId } = useAuth();
  const [patients, setPatients] = useState<Client[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadPatients = async () => {
    if (!tenantId) return;
    try {
      const res = await api.get('/patients');
      if (Array.isArray(res.data)) {
        const mapped: Client[] = res.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          email: p.email || '',
          phone: p.phone,
          avatar: '',
          lastVisit: 'Recente',
          status: 'Em Atendimento',
          bot_status: p.bot_status || 'active'
        }));
        setPatients(mapped);
      }
    } catch (err) {
      console.error("Erro ao carregar pacientes da Inbox:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [tenantId]);

  const handleUpdatePatientStatus = (id: string, newStatus: 'active' | 'paused') => {
    setPatients(prev => prev.map(p => 
      p.id === id ? { ...p, bot_status: newStatus } : p
    ));
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.phone.includes(search)
  );

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden relative">
      {/* Left Sidebar - Contacts List (full width on mobile when no chat is selected) */}
      <div className={`w-full md:w-80 flex flex-col border-r border-white/5 bg-zinc-950 shrink-0 ${
        selectedPatientId ? 'hidden md:flex' : 'flex'
      }`}>
        <div className="p-4 border-b border-white/5">
          <h2 className="text-xl font-bold text-white tracking-tight mb-4">Inbox (Chat)</h2>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredPatients.map((patient) => {
                const isSelected = selectedPatientId === patient.id;
                const isPaused = patient.bot_status === 'paused';

                return (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className={`flex flex-col p-4 text-left transition-colors border-b border-white/5 hover:bg-zinc-900/50 ${
                      isSelected ? 'bg-zinc-900 border-l-2 border-l-emerald-500' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-zinc-200 text-sm truncate pr-2">{patient.name}</span>
                    </div>
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs text-zinc-500">{patient.phone}</span>
                      {isPaused && (
                        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">
                          IA Pausada
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Content - Chat Window (full width on mobile when selected) */}
      <div className={`flex-1 flex flex-col bg-zinc-950 min-w-0 ${
        !selectedPatientId ? 'hidden md:flex' : 'flex'
      }`}>
        {selectedPatient ? (
          <ChatWindow 
            patient={selectedPatient} 
            onUpdatePatientStatus={handleUpdatePatientStatus} 
            onBackToList={() => setSelectedPatientId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-zinc-500 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <Search className="w-6 h-6" />
            </div>
            <p>Selecione um contato para ver a conversa.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxPage;
