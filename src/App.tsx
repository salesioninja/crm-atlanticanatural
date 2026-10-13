import { useState, FormEvent, useEffect } from 'react';
import api from './lib/api';
import { Plus, MessageCircle, User, Mail, Phone, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import Sidebar from './components/Sidebar';
import type { ViewType } from './components/Sidebar';
import TopBar from './components/TopBar';
import ClientTable from './components/ClientTable';
import ClientDetail from './components/ClientDetail';
import AppointmentCard from './components/AppointmentCard';
import BookingPage from './components/BookingPage';
import RecordsPage from './components/RecordsPage';
import Dashboard from './components/Dashboard';
import AgendaPage from './components/AgendaPage';
import ServicosPage from './components/ServicosPage';
import ProfissionaisPage from './components/ProfissionaisPage';
import ListaIaPage from './components/ListaIaPage';
import IntegracaoPage from './components/IntegracaoPage';
import SimulacoesPage from './components/SimulacoesPage';
import ConfiguracoesPage from './components/ConfiguracoesPage';
import Scheduler from './components/Scheduler';
import Modal from './components/Modal';
import CRMView from './components/CRMView';
import InboxPage from './components/InboxPage';
import DispositivosPage from './components/DispositivosPage';
import SuperAdminPage from './components/SuperAdminPage';
import { LinkPacientePage } from './components/LinkPacientePage';
import { MOCK_CLIENTS, MOCK_APPOINTMENTS } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { Client, Appointment } from './types';
import LoginPage from './components/LoginPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [selectedClientId, setSelectedClientId] = useState(MOCK_CLIENTS[1].id);
  const [notification, setNotification] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { user, tenantId, tenantName, isLoading, isImpersonating, restoreOriginalTenant } = useAuth();

  // Carregar dados reais do banco MySQL via API no mount
  useEffect(() => {
    if (!user || !tenantId) return;

    const loadRealData = async () => {
      try {
        let patientsRes;
        try {
          patientsRes = await api.get('/prospects');
        } catch (ePrsp) {
          patientsRes = await api.get('/patients');
        }

        if (Array.isArray(patientsRes.data) && patientsRes.data.length > 0) {
          const mappedClients: Client[] = patientsRes.data.map((p: any) => ({
            id: p.id,
            name: p.name || p.nome || 'Prospect',
            email: p.email || '',
            phone: p.phone || p.whatsapp || '',
            avatar: p.avatar || '',
            lastVisit: 'Recente',
            status: p.status || 'Ativo',
            clinicalNotes: p.notas_qualificacao || p.clinical_notes || '',
            perfil_interesse: p.perfil_interesse || 'Revendedor',
            temperatura: p.temperatura || 'Morno',
            fase_funil: p.fase_funil || p.status_crm || 'Novo Lead',
            kit_interesse: p.kit_interesse || 'Kit Adesão R$ 79,90',
            meta_renda: p.meta_renda || '',
            origem: p.origem || 'WhatsApp Direto',
            patrocinador: p.patrocinador || 'Professor Salésio',
            files: p.files_json ? JSON.parse(p.files_json) : [],
            photos: p.photos_json ? JSON.parse(p.photos_json) : [],
            responsibleProf: p.patrocinador || p.responsible_prof || 'Líder Oficial Atlântica',
            patientSince: p.patient_since || 'Out de 2026'
          }));
          setClients(mappedClients);
          setSelectedClientId(prev => prev ? prev : mappedClients[0].id);
        }

        const aptsRes = await api.get('/appointments');
        if (Array.isArray(aptsRes.data) && aptsRes.data.length > 0) {
          const mappedApts: Appointment[] = aptsRes.data.map((a: any) => ({
            id: a.id,
            treatmentName: a.treatment || 'Apresentação de Negócio (APN)',
            time: new Date(a.horario_consulta).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
            clientName: a.patient_name || 'Prospect',
            icon: 'Calendar',
            type: 'primary'
          }));
          setAppointments(mappedApts);
        }
      } catch (err) {
        console.error("Falha ao sincronizar dados com o banco de dados:", err);
      }
    };
    loadRealData();
  }, [user, tenantId]);

  // Web-Cron automatic trigger to process scheduled reminders
  useEffect(() => {
    if (!user || !tenantId) return;

    // Run immediately on load (after 2 seconds)
    const initialTimeout = setTimeout(() => {
      api.post('/cron').catch(err => {
        console.error("Web Cron automatic trigger error:", err);
      });
    }, 2000);

    // Run every 60 seconds
    const intervalId = setInterval(() => {
      api.post('/cron').catch(err => {
        console.error("Web Cron automatic trigger error:", err);
      });
    }, 60000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [user, tenantId]);

  // Interceptar retorno de sucesso do Google Calendar OAuth
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_calendar_success') === 'true') {
      showNotification('Agenda do Google conectada com sucesso!');
      setCurrentView('integracao');
      
      // Limpar parâmetro sem recarregar a página
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  }, [user]);
  
  // Modal States
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  
  // Settings Form States
  const [clinicName, setClinicName] = useState('CRM Clínica Integrada');
  const [consultationFee, setConsultationFee] = useState('180');
  const [supportMessage, setSupportMessage] = useState('');

  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault();
    setIsSettingsModalOpen(false);
    showNotification('Configurações atualizadas com sucesso!');
  };

  const handleSendSupport = (e: FormEvent) => {
    e.preventDefault();
    setIsSupportModalOpen(false);
    setSupportMessage('');
    showNotification('Solicitação enviada com sucesso! Responderemos em breve.');
  };
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form States
  const [newClientData, setNewClientData] = useState({ name: '', email: '', phone: '' });
  const [newAptData, setNewAptData] = useState({ clientName: '', treatment: 'Consulta & Sessão de Osteopatia', time: '14:00' });

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

  const handleUpdateClient = async (updatedClient: Client) => {
    setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
    const payload = {
      id: updatedClient.id,
      name: updatedClient.name,
      phone: updatedClient.phone,
      email: updatedClient.email,
      clinical_notes: updatedClient.clinicalNotes || '',
      skin_condition: updatedClient.skinCondition || '',
      allergies: updatedClient.allergies ? updatedClient.allergies.join(',') : '',
      is_pregnant: updatedClient.isPregnant ? 1 : 0,
      files_json: JSON.stringify(updatedClient.files || []),
      photos_json: JSON.stringify(updatedClient.photos || []),
      responsible_prof: updatedClient.responsibleProf || '',
      patient_since: updatedClient.patientSince || ''
    };

    try {
      await api.put(`/patients/${updatedClient.id}`, payload);
      showNotification('Ficha do cliente salva no banco de dados com sucesso!');
    } catch (err: any) {
      console.warn("PUT /patients falhou, tentando fallback com POST /patients:", err);
      try {
        await api.post('/patients', payload);
        showNotification('Ficha do prospect salva no banco de dados com sucesso!');
      } catch (postErr: any) {
        console.error("Erro ao salvar prospect no banco:", postErr);
        showNotification('Ficha atualizada localmente, falha ao sincronizar com servidor.');
      }
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    const targetClient = clients.find(c => c.id === clientId);
    if (!targetClient) return;

    if (window.confirm(`Tem certeza que deseja excluir permanentemente o cadastro de ${targetClient.name}? Esta ação não pode ser desfeita.`)) {
      try {
        await api.delete(`/patients/${clientId}`);
        const updatedClients = clients.filter(c => c.id !== clientId);
        setClients(updatedClients);
        if (updatedClients.length > 0) {
          setSelectedClientId(updatedClients[0].id);
        }
        showNotification(`Prospect ${targetClient.name} excluído com sucesso!`);
      } catch (err: any) {
        console.error("Erro ao excluir prospect no banco:", err);
        const updatedClients = clients.filter(c => c.id !== clientId);
        setClients(updatedClients);
        if (updatedClients.length > 0) {
          setSelectedClientId(updatedClients[0].id);
        }
        showNotification(`Prospect ${targetClient.name} removido da lista.`);
      }
    }
  };

  const handleConfirmBooking = (newApt: Appointment) => {
    setAppointments(prev => [newApt, ...prev]);
    
    let targetClientId = '';
    const existingClient = clients.find(c => c.name === newApt.clientName);
    
    if (!existingClient) {
      const newClientId = Math.random().toString(36).substr(2, 9);
      const newClient: Client = {
        id: newClientId,
        name: newApt.clientName,
        email: '',
        phone: '',
        avatar: '',
        lastVisit: 'Recém Agendado',
        status: 'Pendente'
      };
      setClients(prev => [newClient, ...prev]);
      targetClientId = newClientId;
    } else {
      targetClientId = existingClient.id;
    }
    
    setSelectedClientId(targetClientId);
  };

  const handleCreateClient = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/patients', {
        name: newClientData.name,
        email: newClientData.email,
        phone: newClientData.phone
      });
      const newClientId = res.data.id || Math.random().toString(36).substr(2, 9);
      const newClient: Client = {
        id: newClientId,
        name: newClientData.name,
        email: newClientData.email,
        phone: newClientData.phone,
        avatar: '',
        lastVisit: 'Nenhuma',
        status: 'Pendente'
      };
      setClients(prev => [newClient, ...prev]);
      setSelectedClientId(newClientId);
      setIsNewClientModalOpen(false);
      showNotification(`Cliente ${newClient.name} cadastrado com sucesso!`);
      setNewClientData({ name: '', email: '', phone: '' });
    } catch (err: any) {
      console.error("Erro ao cadastrar cliente no backend:", err);
      showNotification('Erro ao salvar paciente no banco de dados.');
    }
  };

  const handleCreateAppointment = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const targetClient = clients.find(c => c.name === newAptData.clientName);
      if (!targetClient) {
        showNotification("Selecione um cliente válido.");
        return;
      }
      
      const aptTime = new Date().toISOString().slice(0, 10) + ' ' + newAptData.time + ':00';
      const res = await api.post('/appointments', {
        patient_id: targetClient.id,
        user_id: 'usr_ninja_01',
        treatment: newAptData.treatment,
        horario_consulta: aptTime,
        horario_mensagem: aptTime,
        status_envio: 'Aguardando',
        crm_status: 'Agendado'
      });

      const newApt: Appointment = {
        id: res.data.id || Math.random().toString(36).substr(2, 9),
        treatmentName: newAptData.treatment,
        clientName: newAptData.clientName,
        time: `Hoje, ${newAptData.time} • ${newAptData.clientName}`,
        icon: 'Sparkles',
        type: 'primary'
      };
      setAppointments(prev => [newApt, ...prev]);
      setSelectedClientId(targetClient.id);
      setIsNewAppointmentModalOpen(false);
      showNotification('Agendamento criado com sucesso e sincronizado!');
      setNewAptData({ clientName: '', treatment: 'Limpeza de Pele', time: '14:00' });
    } catch (err: any) {
      console.error("Erro ao salvar agendamento no backend:", err);
      showNotification('Erro ao salvar agendamento no banco de dados.');
    }
  };

  const handleSelectClientByAppointment = (clientName: string) => {
    const client = clients.find(c => c.name === clientName);
    if (client) {
      setSelectedClientId(client.id);
      showNotification(`Visualizando ficha de ${client.name}`);
    } else {
      showNotification(`Cliente ${clientName} não encontrado na base.`);
    }
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Detecção de Rota Pública de Agendamento do Paciente (/agendar ou ?mode=agendar)
  const isPublicBooking = window.location.pathname.endsWith('/agendar') || 
                          window.location.pathname.includes('/agendar') || 
                          window.location.search.includes('mode=agendar') || 
                          window.location.search.includes('agendar=true');

  if (isPublicBooking) {
    return (
      <BookingPage 
        isPublicAccess={true}
        tenantId={tenantId || undefined}
        tenantName={tenantName || undefined}
        onConfirmBooking={handleConfirmBooking}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden select-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="flex flex-col items-center gap-4 z-10">
          <Loader2 size={40} className="animate-spin text-emerald-500" />
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Atlântica Natural • Autenticando...</p>
        </div>
      </div>
    );
  }

  if (!user || !tenantId) {
    return <LoginPage />;
  }

  if (currentView === 'records') {
    return (
      <RecordsPage 
        clients={clients} 
        onUpdate={handleUpdateClient}
        onBack={() => setCurrentView('admin')} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface-bg flex relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-indigo-600 rounded-full blur-[120px] opacity-30 pointer-events-none transition-transform duration-1000 animate-pulse"></div>
      <div className="absolute bottom-[-5%] right-[-5%] w-[500px] h-[500px] bg-purple-600 rounded-full blur-[150px] opacity-20 pointer-events-none transition-transform duration-1000"></div>

      <Sidebar 
        onViewChange={setCurrentView}
        onNewAppointment={() => setIsNewAppointmentModalOpen(true)}
        onNewClient={() => setIsNewClientModalOpen(true)}
        currentView={currentView}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />
      
      <div className="flex-1 ml-0 md:ml-64 flex flex-col relative z-10 w-full min-w-0">
        {isImpersonating && (
          <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-200 px-4 py-2.5 text-xs flex items-center justify-between z-30 sticky top-0 backdrop-blur-md">
            <span>⚠️ <strong>Modo Master Super Admin:</strong> Você está visualizando os dados da clínica <strong>{tenantName || tenantId}</strong>.</span>
            <button
              onClick={restoreOriginalTenant}
              className="px-3 py-1 bg-amber-500 text-black font-bold rounded-lg text-xs hover:bg-amber-400 transition-colors shadow-md"
            >
              Voltar à Central Master
            </button>
          </div>
        )}

        <TopBar 
          onSearch={setSearchTerm} 
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        
        <main className={currentView === 'crm' ? "p-4 sm:p-6 pt-20 md:pt-22 pb-3 w-full max-w-none h-[100dvh] overflow-hidden flex flex-col" : "p-4 sm:p-6 md:p-10 pt-24 md:pt-28 pb-28 md:pb-10 max-w-7xl mx-auto w-full overflow-y-auto h-[100dvh] no-scrollbar"}>
          {currentView === 'super_admin' && (
            <SuperAdminPage />
          )}

          {currentView === 'dashboard' && (
            <Dashboard 
              clients={clients} 
              appointments={appointments} 
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
              onUpdateClient={handleUpdateClient}
              onNewAppointment={() => setIsNewAppointmentModalOpen(true)}
              onNewClient={() => setIsNewClientModalOpen(true)}
            />
          )}

          {currentView === 'agenda' && (
            <Scheduler />
          )}

          {currentView === 'crm' && <CRMView />}

          {currentView === 'inbox' && <InboxPage />}

          {currentView === 'dispositivos' && <DispositivosPage />}

          {currentView === 'client' && <LinkPacientePage />}

          {currentView === 'servicos' && (
            <ServicosPage />
          )}

          {currentView === 'profissionais' && (
            <ProfissionaisPage />
          )}

          {currentView === 'lista_ia' && (
            <ListaIaPage />
          )}

          {currentView === 'simulacoes' && (
            <SimulacoesPage />
          )}

          {currentView === 'integracao' && (
            <IntegracaoPage />
          )}

          {currentView === 'configuracoes' && (
            <ConfiguracoesPage />
          )}
          
          {currentView === 'admin' && (
            <>
              <div className="flex justify-between items-end mb-10">
                <div>
                  <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-lg">
                    Gestão de Prospects
                  </span>
                  <h2 className="text-4xl font-extrabold tracking-tight text-white mt-4">
                    Contatos & Empreendedores
                  </h2>
                </div>
                
                <button 
                  onClick={() => setIsNewClientModalOpen(true)}
                  className="bg-white text-indigo-600 px-7 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-black/20 active:scale-95 hover:bg-white/90"
                >
                  <Plus size={18} />
                  Novo Cliente
                </button>
              </div>

              <div className="grid grid-cols-12 gap-8 items-start mb-14">
                <div className="col-span-12 xl:col-span-7">
                  <ClientTable 
                    clients={filteredClients} 
                    selectedClientId={selectedClientId} 
                    onSelectClient={setSelectedClientId} 
                    totalClientsCount={clients.length}
                  />
                </div>

                <div className="col-span-12 xl:col-span-5">
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={selectedClient.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <ClientDetail client={selectedClient} onUpdate={handleUpdateClient} onDelete={handleDeleteClient} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-8 px-1">
                  Próximos Agendamentos
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                  {appointments.map((apt) => (
                    <div key={apt.id} onClick={() => handleSelectClientByAppointment(apt.clientName)}>
                      <AppointmentCard appointment={apt} />
                    </div>
                  ))}
                  <div onClick={() => setIsNewAppointmentModalOpen(true)}>
                    <AppointmentCard isAdd />
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl border border-white/20 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-medium text-sm"
            >
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-[60]">
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => showNotification('Chat de suporte ativo!')}
            className="h-14 w-14 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-2xl shadow-2xl shadow-indigo-500/40 flex items-center justify-center group relative overflow-hidden"
          >
            <MessageCircle size={24} />
          </motion.button>
        </div>
      </div>

      {/* New Client Modal */}
      <Modal 
        isOpen={isNewClientModalOpen} 
        onClose={() => setIsNewClientModalOpen(false)}
        title="Cadastrar Novo Cliente"
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div className="relative group">
            <User className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <input 
              required
              type="text" 
              placeholder="Nome Completo"
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              value={newClientData.name}
              onChange={e => setNewClientData({...newClientData, name: e.target.value})}
            />
          </div>
          <div className="relative group">
            <Mail className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <input 
              required
              type="email" 
              placeholder="E-mail"
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              value={newClientData.email}
              onChange={e => setNewClientData({...newClientData, email: e.target.value})}
            />
          </div>
          <div className="relative group">
            <Phone className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <input 
              required
              type="tel" 
              placeholder="Telefone"
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              value={newClientData.phone}
              onChange={e => setNewClientData({...newClientData, phone: e.target.value})}
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest mt-4 shadow-xl hover:bg-white/90 transition-all"
          >
            Cadastrar Cliente
          </button>
        </form>
      </Modal>

      {/* New Appointment Modal */}
      <Modal 
        isOpen={isNewAppointmentModalOpen} 
        onClose={() => setIsNewAppointmentModalOpen(false)}
        title="Agendar Tratamento"
      >
        <form onSubmit={handleCreateAppointment} className="space-y-4">
          <div className="relative group">
            <User className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <select 
              required
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all appearance-none"
              value={newAptData.clientName}
              onChange={e => setNewAptData({...newAptData, clientName: e.target.value})}
            >
              <option value="" disabled className="bg-surface-bg">Selecionar Cliente</option>
              {clients.map(c => <option key={c.id} value={c.name} className="bg-surface-bg">{c.name}</option>)}
            </select>
          </div>
          <div className="relative group">
            <Sparkles className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <select 
              required
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all appearance-none"
              value={newAptData.treatment}
              onChange={e => setNewAptData({...newAptData, treatment: e.target.value})}
            >
              <option value="Consulta & Sessão de Osteopatia" className="bg-surface-bg">Consulta & Sessão de Osteopatia</option>
              <option value="Sessão de Fisioterapia & Reabilitação" className="bg-surface-bg">Sessão de Fisioterapia & Reabilitação</option>
              <option value="Sessão de Acupuntura & Auriculoterapia" className="bg-surface-bg">Sessão de Acupuntura & Auriculoterapia</option>
              <option value="Drenagem Linfática Terapêutica" className="bg-surface-bg">Drenagem Linfática Terapêutica</option>
              <option value="Avaliação Inicial & Triagem Clínica" className="bg-surface-bg">Avaliação Inicial & Triagem Clínica</option>
            </select>
          </div>
          <div className="relative group">
            <CalendarIcon className="absolute left-4 top-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={18} />
            <input 
              required
              type="time" 
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              value={newAptData.time}
              onChange={e => setNewAptData({...newAptData, time: e.target.value})}
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest mt-4 shadow-xl hover:bg-white/90 transition-all"
          >
            Confirmar Reserva
          </button>
        </form>
      </Modal>

      {/* Settings Modal */}
      <Modal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)}
        title="Configurações do Sistema"
      >
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">Nome da Clínica</label>
            <input 
              required
              type="text" 
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              value={clinicName}
              onChange={e => setClinicName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">Valor Padrão da Consulta (R$)</label>
            <input 
              required
              type="number" 
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              value={consultationFee}
              onChange={e => setConsultationFee(e.target.value)}
            />
          </div>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Informações de Integração</p>
            <p className="text-xs text-white/40">O gateway da API do WhatsApp está conectado de forma nativa e o Hot Module Replacement (HMR) está ativado.</p>
          </div>
          <button 
            type="submit"
            className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest mt-4 shadow-xl hover:bg-white/90 transition-all"
          >
            Salvar Configurações
          </button>
        </form>
      </Modal>

      {/* Support Modal */}
      <Modal 
        isOpen={isSupportModalOpen} 
        onClose={() => setIsSupportModalOpen(false)}
        title="Central de Suporte • Atlântica Natural MMN"
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">Perguntas Frequentes</p>
            <div className="space-y-2">
              <details className="bg-white/5 border border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-white/10 transition-colors">
                <summary className="text-xs font-bold text-white outline-none">Como funciona a qualificação de decisores rápidos?</summary>
                <p className="text-xs text-white/40 mt-2 leading-relaxed">Quando a opção "Contato Quente / Decisor Rápido" está marcada na ficha do prospect, o CRM prioriza o agendamento da APN e destaca o contato para fechamento imediato de Kit de Adesão.</p>
              </details>
              <details className="bg-white/5 border border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-white/10 transition-colors">
                <summary className="text-xs font-bold text-white outline-none">Como exportar a ficha do prospect?</summary>
                <p className="text-xs text-white/40 mt-2 leading-relaxed">Na aba "Arquivo Digital" (Fichas de Qualificação), selecione o prospect, role até o final da página e clique em "Exportar Ficha do Prospect" para baixar o resumo de qualificação, kits e notas de follow-up em formato de texto.</p>
              </details>
            </div>
          </div>

          <form onSubmit={handleSendSupport} className="space-y-4 border-t border-white/5 pt-4">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">Fale com um Engenheiro</p>
            <textarea 
              required
              placeholder="Descreva sua dúvida ou problema técnico..."
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all h-24 resize-none"
              value={supportMessage}
              onChange={e => setSupportMessage(e.target.value)}
            />
            <button 
              type="submit"
              className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest mt-2 shadow-xl hover:bg-white/90 transition-all"
            >
              Enviar Solicitação
            </button>
          </form>
        </div>
      </Modal>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
