import React from 'react';
import { ChevronRight, ChevronLeft, MessageCircle } from 'lucide-react';
import { Client } from '../types';
import { formatWhatsAppLink, MESSAGES } from '../lib/whatsapp';

interface ClientTableProps {
  clients: Client[];
  selectedClientId: string;
  onSelectClient: (id: string) => void;
  totalClientsCount?: number;
  isLoading?: boolean;
}

export default function ClientTable({ clients, selectedClientId, onSelectClient, totalClientsCount, isLoading }: ClientTableProps) {
  const handleWhatsApp = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation(); // Don't trigger the row select
    const message = MESSAGES.WELCOME(client.name);
    const link = formatWhatsAppLink(client.phone, message);
    window.open(link, '_blank');
  };

  return (
    <div className="glass-card rounded-3xl sm:rounded-[40px] p-2 sm:p-4 flex flex-col">
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left min-w-[550px]">
        <thead>
          <tr className="text-white/30 border-b border-white/5">
            <th className="px-6 py-6 text-[10px] font-bold uppercase tracking-widest">Cliente</th>
            <th className="px-6 py-6 text-[10px] font-bold uppercase tracking-widest text-center">Última Visita</th>
            <th className="px-6 py-6 text-[10px] font-bold uppercase tracking-widest text-center">Status</th>
            <th className="px-6 py-6 text-[10px] font-bold uppercase tracking-widest text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {clients.map((client) => {
            const isSelected = client.id === selectedClientId;
            return (
              <tr 
                key={client.id}
                onClick={() => onSelectClient(client.id)}
                className={`hover:bg-white/5 transition-all cursor-pointer group rounded-2xl ${
                  isSelected ? 'bg-white/10' : ''
                }`}
              >
                <td className="px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold overflow-hidden shrink-0">
                      {client.avatar ? (
                        <img 
                          src={client.avatar} 
                          alt={client.name} 
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-xs">{client.name.split(' ').filter(Boolean).map(n => n[0]).join('')}</span>
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm transition-colors ${isSelected ? 'text-white' : 'text-white/80'}`}>{client.name}</p>
                      <p className="text-xs text-white/40">{client.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-sm text-center text-white/50 font-medium whitespace-nowrap">
                  {client.lastVisit}
                </td>
                <td className="px-6 py-5 text-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                    client.status === 'Ativo' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : client.status === 'Em Atendimento'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                      : 'bg-white/5 text-white/40 border-white/10'
                  }`}>
                    {client.status}
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={(e) => handleWhatsApp(e, client)}
                      className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <MessageCircle size={14} />
                    </button>
                    <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all ${isSelected ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-white/20 group-hover:text-white/60 group-hover:bg-white/5'}`}>
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      
      <div className="p-6 flex items-center justify-between text-xs text-white/30 font-medium">
        <p>
          {isLoading 
            ? 'Carregando clientes...' 
            : totalClientsCount !== undefined && clients.length !== totalClientsCount
              ? `Mostrando ${clients.length} de ${totalClientsCount} clientes`
              : `Total de ${clients.length} cliente(s) cadastrado(s)`
          }
        </p>
        <div className="flex gap-2">
          <button 
            onClick={() => onSelectClient(clients[0]?.id)}
            className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-white/60"
          >
            <ChevronLeft size={16} />
          </button>
          <button className="h-9 w-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">1</button>
          <button 
            onClick={() => onSelectClient(clients[clients.length - 1]?.id)}
            className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-white/60"
          >
            2
          </button>
          <button 
            onClick={() => onSelectClient(clients[0]?.id)}
            className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-white/60"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
