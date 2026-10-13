import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ExternalLink, 
  Users, 
  Calendar, 
  MessageSquare, 
  ShieldAlert, 
  Trash2, 
  Power, 
  QrCode, 
  Loader2, 
  AlertCircle,
  TrendingUp,
  Settings,
  Sparkles
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TenantItem {
  id: string;
  name: string;
  nome_empresa?: string;
  cnpj?: string;
  email_contato?: string;
  telefone_contato?: string;
  plano: string;
  status: 'ativo' | 'suspenso' | string;
  limite_disparos_mensal: number;
  created_at: string;
  evolution_instance_name: string;
  whatsapp: {
    connected: boolean;
    jid: string;
    phone: string;
  };
  metrics: {
    patients: number;
    appointments: number;
    messages: number;
    users_count: number;
  };
  users: TenantUser[];
}

export const SuperAdminPage: React.FC = () => {
  const { user, switchTenant } = useAuth();
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [activeQrTenant, setActiveQrTenant] = useState<TenantItem | null>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [qrPairingCode, setQrPairingCode] = useState<string | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);

  // Form de Nova Clínica
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email_contato: '',
    telefone_contato: '',
    plano: 'PRO',
    limite_disparos_mensal: 1000,
    responsavel_nome: '',
    gemini_custom_prompt: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Carregar dados
  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/tenants');
      if (Array.isArray(res.data)) {
        setTenants(res.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar lista de clínicas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  // Gerar slug automaticamente ao digitar o nome
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const generatedSlug = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    setFormData(prev => ({
      ...prev,
      name: val,
      slug: prev.slug === '' || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]/g, '-') ? generatedSlug : prev.slug
    }));
  };

  // Submeter cadastro de nova clínica
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      await api.post('/tenants', formData);
      setIsNewModalOpen(false);
      setFormData({
        name: '',
        slug: '',
        email_contato: '',
        telefone_contato: '',
        plano: 'PRO',
        limite_disparos_mensal: 1000,
        responsavel_nome: '',
        gemini_custom_prompt: ''
      });
      await loadTenants();
    } catch (err: any) {
      console.error('Falha ao cadastrar clínica:', err);
      setFormError(err.response?.data?.error || 'Erro ao cadastrar clínica. Verifique os dados informados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar status ativo / suspenso
  const handleToggleStatus = async (tenant: TenantItem) => {
    const newStatus = tenant.status === 'ativo' ? 'suspenso' : 'ativo';
    const actionName = newStatus === 'suspenso' ? 'suspender' : 'reativar';
    if (!window.confirm(`Tem certeza que deseja ${actionName} a clínica "${tenant.name}"?`)) {
      return;
    }

    try {
      await api.put(`/tenants/${tenant.id}`, { status: newStatus });
      await loadTenants();
    } catch (err: any) {
      alert('Erro ao atualizar status: ' + (err.response?.data?.error || err.message));
    }
  };

  // Abrir modal de QR Code
  const handleOpenQrModal = async (tenant: TenantItem) => {
    setActiveQrTenant(tenant);
    setIsQrModalOpen(true);
    setQrCodeBase64(null);
    setQrPairingCode(null);
    setIsQrLoading(true);

    try {
      const res = await api.get(`/tenants/${tenant.id}/qrcode`);
      if (res.data.base64) {
        const raw = res.data.base64;
        const clean = raw.includes('|') ? raw.split('|')[0] : raw;
        setQrCodeBase64(clean);
      }
      if (res.data.code) {
        setQrPairingCode(res.data.code);
      }
    } catch (err) {
      console.error('Erro ao buscar QR code do WhatsApp:', err);
    } finally {
      setIsQrLoading(false);
    }
  };

  // Desconectar WhatsApp de uma clínica
  const handleDisconnectWhatsapp = async (tenant: TenantItem) => {
    if (!window.confirm(`Deseja desconectar o WhatsApp da clínica "${tenant.name}"?`)) return;

    try {
      await api.post(`/tenants/${tenant.id}/disconnect`);
      await loadTenants();
    } catch (err: any) {
      alert('Erro ao desconectar WhatsApp: ' + (err.response?.data?.error || err.message));
    }
  };

  // Excluir clínica
  const handleDeleteTenant = async (tenant: TenantItem) => {
    if (['acessaronline', 'clinica-elo', 'crmninja'].includes(tenant.id)) {
      alert('Não é permitido excluir o inquilino principal do sistema.');
      return;
    }

    if (!window.confirm(`ATENÇÃO: Deseja realmente excluir permanentemente a clínica "${tenant.name}" e todos os seus dados? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await api.delete(`/tenants/${tenant.id}`);
      await loadTenants();
    } catch (err: any) {
      alert('Erro ao excluir clínica: ' + (err.response?.data?.error || err.message));
    }
  };

  // Métricas agregadas
  const totalClinicas = tenants.length;
  const clinicasAtivas = tenants.filter(t => t.status === 'ativo').length;
  const whatsAppConectados = tenants.filter(t => t.whatsapp.connected).length;
  const totalPacientes = tenants.reduce((acc, t) => acc + (t.metrics.patients || 0), 0);
  const totalMensagens = tenants.reduce((acc, t) => acc + (t.metrics.messages || 0), 0);

  // Filtro de busca
  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.email_contato && t.email_contato.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 select-none max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Central Master Super Admin
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-400" />
            Gestão de Clínicas & Instâncias
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Controle total sobre inquilinos SaaS, conexões de WhatsApp e permissões de acesso.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadTenants}
            className="p-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-2xl border border-white/10 transition-all flex items-center gap-2 text-xs font-bold"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            Nova Clínica
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-xs font-semibold">Total de Clínicas</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalClinicas}</span>
            <span className="text-[11px] text-emerald-400 ml-2 font-bold">{clinicasAtivas} ativas</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-xs font-semibold">WhatsApp Conectados</span>
            <Smartphone className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{whatsAppConectados}</span>
            <span className="text-[11px] text-white/40 ml-2">de {totalClinicas} instâncias</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-xs font-semibold">Total Prospects</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalPacientes}</span>
            <span className="text-[11px] text-white/40 ml-2">cadastrados</span>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-xs font-semibold">Mensagens Disparadas</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalMensagens}</span>
            <span className="text-[11px] text-cyan-400 ml-2 font-bold">Total geral</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtro */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar por clínica, subdomínio ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        <span className="text-xs text-white/40 font-medium">
          Exibindo {filteredTenants.length} clínica(s)
        </span>
      </div>

      {/* Grid de Clínicas */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Carregando instâncias...</p>
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-white/40 border border-white/5">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <h3 className="text-lg font-bold text-white mb-1">Nenhuma clínica encontrada</h3>
          <p className="text-xs max-w-sm mx-auto">
            Não encontramos nenhum resultado com os termos buscados. Clique em "Nova Clínica" para cadastrar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTenants.map((clinic) => {
            const isConnected = clinic.whatsapp.connected;
            const isSuspended = clinic.status === 'suspenso';
            const isRoot = ['acessaronline', 'clinica-elo', 'crmninja'].includes(clinic.id);

            return (
              <div 
                key={clinic.id} 
                className={`glass-card rounded-3xl p-6 border transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSuspended 
                    ? 'border-red-500/20 bg-red-950/10' 
                    : 'border-white/5 hover:border-indigo-500/30'
                }`}
              >
                {/* Linha Superior */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {clinic.name}
                        </h3>
                        {isRoot && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                            Root
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-indigo-400 font-mono">
                        {clinic.id}.acessaronline.com.br
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isSuspended
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {clinic.status}
                    </span>
                  </div>

                  {/* Informações de Contato & Plano */}
                  <div className="space-y-1 text-xs text-white/50 mb-4 pb-4 border-b border-white/5">
                    {clinic.email_contato && (
                      <div className="truncate">📧 {clinic.email_contato}</div>
                    )}
                    {clinic.telefone_contato && (
                      <div>📞 {clinic.telefone_contato}</div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold text-white/70">Plano:</span>
                      <span className="text-[11px] bg-white/5 px-2 py-0.5 rounded-md text-white font-semibold">
                        {clinic.plano}
                      </span>
                    </div>
                  </div>

                  {/* Status WhatsApp */}
                  <div className="mb-4 bg-white/5 p-3 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Smartphone className={`w-4 h-4 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {isConnected ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              WhatsApp Online
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                              Desconectado
                            </>
                          )}
                        </div>
                        <div className="text-[10px] text-white/40">
                          Instância: {clinic.evolution_instance_name}
                          {isConnected && clinic.whatsapp.phone ? ` (${clinic.whatsapp.phone})` : ''}
                        </div>
                      </div>
                    </div>

                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnectWhatsapp(clinic)}
                        className="px-2.5 py-1 text-[11px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors font-medium"
                        title="Desconectar WhatsApp"
                      >
                        Desconectar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenQrModal(clinic)}
                        className="px-2.5 py-1 text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-colors font-bold flex items-center gap-1"
                      >
                        <QrCode className="w-3 h-3" />
                        Conectar
                      </button>
                    )}
                  </div>

                  {/* Métricas da Clínica */}
                  <div className="grid grid-cols-3 gap-2 text-center mb-5">
                    <div className="bg-white/5 py-2 px-1 rounded-xl">
                      <span className="block text-sm font-black text-white">{clinic.metrics.patients}</span>
                      <span className="text-[10px] text-white/40">Prospects</span>
                    </div>
                    <div className="bg-white/5 py-2 px-1 rounded-xl">
                      <span className="block text-sm font-black text-white">{clinic.metrics.appointments}</span>
                      <span className="text-[10px] text-white/40">APNs</span>
                    </div>
                    <div className="bg-white/5 py-2 px-1 rounded-xl">
                      <span className="block text-sm font-black text-white">{clinic.metrics.messages}</span>
                      <span className="text-[10px] text-white/40">Mensagens</span>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação na Base */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => switchTenant(clinic.id, clinic.name)}
                    className="flex-1 py-2.5 px-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    title="Alternar sessão para gerenciar esta clínica"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Acessar Painel
                  </button>

                  <button
                    onClick={() => handleToggleStatus(clinic)}
                    className={`p-2.5 rounded-xl text-xs transition-colors ${
                      isSuspended
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                    }`}
                    title={isSuspended ? 'Reativar Clínica' : 'Suspender Clínica'}
                  >
                    <Power className="w-4 h-4" />
                  </button>

                  {!isRoot && (
                    <button
                      onClick={() => handleDeleteTenant(clinic)}
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Excluir Clínica"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Nova Clínica */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-card max-w-lg w-full rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 mb-2">
              <Building2 className="w-6 h-6 text-indigo-400" />
              Cadastrar Nova Clínica SaaS
            </h2>
            <p className="text-xs text-white/50 mb-6">
              A nova clínica receberá uma instância própria isolada e seu próprio subdomínio.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">
                  Nome da Clínica *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Clínica FisioLife - Fisioterapia"
                  value={formData.name}
                  onChange={handleNameChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">
                  Identificador / Subdomínio *
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    placeholder="ex: fisiolife"
                    value={formData.slug}
                    onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '')})}
                    className="flex-1 bg-white/5 border border-white/10 rounded-l-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500 font-mono"
                  />
                  <span className="bg-white/10 border border-l-0 border-white/10 py-3 px-3 rounded-r-xl text-xs text-white/40 font-mono">
                    .acessaronline.com.br
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1">
                    E-mail do Administrador *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contato@fisiolife.com.br"
                    value={formData.email_contato}
                    onChange={(e) => setFormData({...formData, email_contato: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1">
                    WhatsApp de Contato
                  </label>
                  <input
                    type="tel"
                    placeholder="(46) 99999-0000"
                    value={formData.telefone_contato}
                    onChange={(e) => setFormData({...formData, telefone_contato: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1">
                    Plano Mensal
                  </label>
                  <select
                    value={formData.plano}
                    onChange={(e) => setFormData({...formData, plano: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-indigo-500"
                  >
                    <option value="START" className="bg-slate-900">START (R$ 197/mês)</option>
                    <option value="PRO" className="bg-slate-900">PRO (R$ 297/mês)</option>
                    <option value="PREMIUM" className="bg-slate-900">PREMIUM (R$ 497/mês)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1">
                    Limite Mensal de Disparos
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={formData.limite_disparos_mensal}
                    onChange={(e) => setFormData({...formData, limite_disparos_mensal: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">
                  Prompt Customizado da IA (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Você é a assistente da Clínica FisioLife especializada em Fisioterapia e Pilates. Seja acolhedora..."
                  value={formData.gemini_custom_prompt}
                  onChange={(e) => setFormData({...formData, gemini_custom_prompt: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/30 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando Instância...
                    </>
                  ) : (
                    'Criar Instância'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QR Code WhatsApp */}
      {isQrModalOpen && activeQrTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-card max-w-sm w-full rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl text-center relative">
            <h3 className="text-xl font-black text-white tracking-tight mb-1">
              Conectar WhatsApp
            </h3>
            <p className="text-xs text-white/50 mb-6">
              {activeQrTenant.name} ({activeQrTenant.evolution_instance_name})
            </p>

            <div className="flex flex-col items-center justify-center my-4 min-h-[220px]">
              {isQrLoading ? (
                <div className="flex flex-col items-center gap-3 text-white/40">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="text-xs">Gerando QR Code...</p>
                </div>
              ) : qrCodeBase64 ? (
                <div className="space-y-4">
                  <div className="p-3 bg-white rounded-2xl shadow-xl inline-block">
                    <img
                      src={qrCodeBase64.startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <p className="text-xs text-emerald-300 font-medium">
                    Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho
                  </p>
                  {qrPairingCode && (
                    <div className="text-[11px] text-white/50 font-mono bg-white/5 py-1 px-3 rounded-lg">
                      Código: {qrPairingCode}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-amber-400">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-xs text-white/70">
                    Não foi possível obter o QR Code. A instância pode já estar conectada ou inicializando.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-white/5">
              <button
                onClick={() => handleOpenQrModal(activeQrTenant)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar QR
              </button>
              <button
                onClick={() => {
                  setIsQrModalOpen(false);
                  loadTenants();
                }}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPage;
