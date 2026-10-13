import { motion, AnimatePresence } from 'motion/react';
import { Search, Folder, FileText, ChevronRight, User, ArrowLeft, Calendar, ShieldCheck, HeartPulse, Plus, Camera, Image as ImageIcon, Trash2, Download, Save, Edit, Check, X, Phone, Mail, Eye } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Client } from '../types';

interface RecordsPageProps {
  clients: Client[];
  onUpdate: (updatedClient: Client) => void;
  onBack: () => void;
}

export default function RecordsPage({ clients, onUpdate, onBack }: RecordsPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Lightbox Preview Modal State
  const [previewModal, setPreviewModal] = useState<{ url: string; title: string; type?: string; date?: string } | null>(null);

  // Edit Patient Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    responsibleProf: '',
    patientSince: '',
    skinCondition: '',
    allergiesStr: '',
    isPregnant: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  const [editingNotes, setEditingNotes] = useState(selectedClient?.clinicalNotes || '');

  useEffect(() => {
    setEditingNotes(selectedClient?.clinicalNotes || '');
  }, [selectedClient]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const triggerVisualSave = (customMsg?: string) => {
    setSaveStatus('saving');
    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setTimeout(() => {
      setSaveStatus('saved');
      setLastSavedTime(nowStr);
      showToast(customMsg || `✓ Alterações e ficha do prospect salvas no banco de dados às ${nowStr}!`);
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3500);
    }, 400);
  };

  // Canvas image compression (max 800x800, qualidade 0.75) to prevent MySQL payload overflow
  const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSaveNotes = () => {
    if (!selectedClient) return;
    onUpdate({
      ...selectedClient,
      clinicalNotes: editingNotes
    });
    triggerVisualSave('✓ Histórico de follow-up e notas de prospecção salvas no banco de dados!');
  };

  const handleSaveCompleteRecord = () => {
    if (!selectedClient) return;
    onUpdate({
      ...selectedClient,
      clinicalNotes: editingNotes
    });
    triggerVisualSave('✓ Ficha completa do prospect, comprovantes, documentos e notas salvas com sucesso!');
  };

  const handleSaveDocumentsSection = () => {
    if (!selectedClient) return;
    onUpdate({
      ...selectedClient,
      clinicalNotes: editingNotes
    });
    triggerVisualSave('✓ Documentos e anexos de cadastro sincronizados no banco de dados!');
  };

  const handleSavePhotosSection = () => {
    if (!selectedClient) return;
    onUpdate({
      ...selectedClient,
      clinicalNotes: editingNotes
    });
    triggerVisualSave('✓ Galeria de comprovantes e fotos sincronizada no banco de dados!');
  };

  const handleOpenEditModal = () => {
    if (!selectedClient) return;
    setEditFormData({
      name: selectedClient.name || '',
      phone: selectedClient.phone || '',
      email: selectedClient.email || '',
      responsibleProf: selectedClient.responsibleProf || 'Salésio Ninja - Líder Executivo',
      patientSince: selectedClient.patientSince || 'Out de 2024',
      skinCondition: selectedClient.skinCondition || 'Renda Extra (R$ 2.000 - R$ 5.000/mês)',
      allergiesStr: selectedClient.allergies ? selectedClient.allergies.join(', ') : '',
      isPregnant: !!selectedClient.isPregnant
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    const updated = {
      ...selectedClient,
      name: editFormData.name,
      phone: editFormData.phone,
      email: editFormData.email,
      responsibleProf: editFormData.responsibleProf,
      patientSince: editFormData.patientSince,
      skinCondition: editFormData.skinCondition,
      allergies: editFormData.allergiesStr.split(',').map(s => s.trim()).filter(Boolean),
      isPregnant: editFormData.isPregnant
    };

    onUpdate(updated);
    setIsEditModalOpen(false);
    showToast('✓ Dados do prospect e líder patrocinador atualizados com sucesso!');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedClient) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const addedFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          date: new Date().toLocaleDateString('pt-BR'),
          size: file.size > 1024 * 1024 
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
            : `${(file.size / 1024).toFixed(0)} KB`,
          url: reader.result as string
        };
        
        const updated = {
          ...selectedClient,
          files: [...(selectedClient.files || []), addedFile]
        };
        
        onUpdate(updated);
        triggerVisualSave('✓ Documento anexado e salvo no banco de dados!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    if (!selectedClient) return;
    const updated = {
      ...selectedClient,
      files: selectedClient.files?.filter(f => f.id !== fileId)
    };
    onUpdate(updated);
    triggerVisualSave('✓ Documento removido e banco atualizado!');
  };

  const handleOpenDocument = (f: { name: string; url: string }) => {
    if (!f.url || f.url === '#') {
      alert('Este arquivo não contém dados para visualização.');
      return;
    }
    if (f.url.startsWith('data:image')) {
      setPreviewModal({ url: f.url, title: f.name });
    } else {
      const win = window.open();
      if (win) {
        win.document.write(`
          <html>
            <head><title>Visualizar Documento - ${f.name}</title></head>
            <body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center; height:100vh;">
              <iframe src="${f.url}" frameborder="0" style="width:100%; height:100%; border:none;"></iframe>
            </body>
          </html>
        `);
      } else {
        const a = document.createElement('a');
        a.href = f.url;
        a.download = f.name;
        a.click();
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedClient) return;
    const file = e.target.files?.[0];
    if (file) {
      const type = prompt('Qual o tipo da foto? (Antes / Depois / Evolução)', 'Antes');
      if (!type) return;
      
      const compressedUrl = await compressImage(file);
      const addedPhoto = {
        id: Math.random().toString(36).substr(2, 9),
        type: type,
        date: new Date().toLocaleDateString('pt-BR'),
        url: compressedUrl
      };
      
      const updated = {
        ...selectedClient,
        photos: [...(selectedClient.photos || []), addedPhoto]
      };
      
      onUpdate(updated);
      triggerVisualSave('✓ Foto da galeria adicionada e salva no banco de dados!');
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    if (!selectedClient) return;
    if (confirm('Tem certeza que deseja excluir esta foto da galeria?')) {
      const updated = {
        ...selectedClient,
        photos: selectedClient.photos?.filter(p => p.id !== photoId)
      };
      onUpdate(updated);
      triggerVisualSave('✓ Foto excluída e galeria atualizada!');
    }
  };

  const handleExport = () => {
    if (!selectedClient) return;
    const docContent = `
=========================================
FICHA DE QUALIFICAÇÃO MMN: ${selectedClient.name.toUpperCase()}
=========================================
ID: ${selectedClient.id}
Estágio no Funil: ${selectedClient.status}
E-mail: ${selectedClient.email || 'Não informado'}
Telefone/WhatsApp: ${selectedClient.phone || 'Não informado'}
Último Contato: ${selectedClient.lastVisit}
Líder/Patrocinador: ${selectedClient.responsibleProf || 'Salésio Ninja'}

PERFIL DE NEGÓCIO & QUALIFICAÇÃO:
- Perfil / Objetivo Principal: ${selectedClient.skinCondition || 'Renda Extra'}
- Objeções Identificadas: ${selectedClient.allergies?.join(', ') || 'Nenhuma objeção impeditiva'}
- Decisor Rápido / Alta Prioridade: ${selectedClient.isPregnant ? 'SIM' : 'NÃO'}

HISTÓRICO DE FOLLOW-UP & ANOTAÇÕES:
"${selectedClient.clinicalNotes || 'Sem anotações de evolução.'}"

ARQUIVOS & COMPROVANTES ANEXADOS:
${selectedClient.files?.map(f => `- ${f.name} (${f.date} - ${f.size})`).join('\n') || '- Nenhum arquivo anexado.'}

Sincronizado via CRM MMN Atlântica Natural em ${new Date().toLocaleString('pt-BR')}.
    `;
    
    const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ficha_prospect_${selectedClient.name.toLowerCase().replace(/\s+/g, '_')}.txt`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-surface-bg text-white relative h-screen overflow-hidden flex flex-col">
      {/* Decorative Background */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-5%] left-[-5%] w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Header */}
      <header className="min-h-24 glass-header border-b border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between px-4 sm:px-8 md:px-12 py-4 md:py-0 gap-4 relative z-20 shrink-0">
        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={onBack}
            className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/60 hover:text-white shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">Arquivo & Fichas de Qualificação</h1>
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mt-0.5">Fichas Go Pro, Follow-ups e Documentos</p>
          </div>
        </div>

        <div className="flex items-center bg-white/5 px-4 md:px-6 py-2.5 md:py-3 rounded-2xl w-full max-w-md group focus-within:bg-white/10 transition-all border border-white/10 focus-within:border-emerald-500/50">
          <Search size={18} className="text-white/40 mr-3 shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar prospect por nome ou e-mail..."
            className="bg-transparent border-none focus:ring-0 text-white text-xs md:text-sm w-full placeholder:text-white/30 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 relative z-10 overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar/List Panel */}
        <div className={`w-full md:w-1/3 border-r border-white/5 flex flex-col overflow-hidden ${selectedClientId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 sm:p-6 md:p-8 border-b border-white/5">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.25em]">Todos os Prospects ({filteredClients.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-3">
            {filteredClients.map(client => (
              <motion.button
                layout
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                className={`w-full text-left p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] transition-all flex items-center gap-4 group ${
                  selectedClientId === client.id 
                    ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 active:scale-95' 
                    : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
                }`}
              >
                <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border transition-colors ${
                  selectedClientId === client.id ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 group-hover:border-white/10'
                }`}>
                  {client.avatar ? (
                    <img src={client.avatar} alt={client.name} className="h-full w-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                  ) : (
                    client.name.split(' ').map(n => n[0]).join('')
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold truncate ${selectedClientId === client.id ? 'text-white' : 'text-white/80'}`}>{client.name}</p>
                  <p className={`text-[10px] mt-0.5 tracking-wide ${selectedClientId === client.id ? 'text-white/60' : 'text-white/30'}`}>
                    ID: {client.id} • {client.status}
                  </p>
                </div>
                <ChevronRight size={18} className={selectedClientId === client.id ? 'text-white opacity-100' : 'opacity-0 group-hover:opacity-100 transition-all text-white/40'} />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Details Panel */}
        <div className={`w-full md:flex-1 bg-white/[0.02] overflow-y-auto p-4 sm:p-8 md:p-12 no-scrollbar scroll-smooth ${!selectedClientId ? 'hidden md:block' : 'block'}`}>
          {selectedClientId && (
            <button 
              onClick={() => setSelectedClientId(null)}
              className="md:hidden flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 mb-6 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 w-fit active:scale-95 transition-all"
            >
              <ArrowLeft size={16} /> Voltar aos Prospects
            </button>
          )}

          <AnimatePresence mode="wait">
            {selectedClient ? (
              <motion.div
                key={selectedClient.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="max-w-4xl mx-auto"
              >
                {/* Toast Notification Banner */}
                <AnimatePresence>
                  {toastMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="mb-6 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-6 py-3.5 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-xl backdrop-blur-md"
                    >
                      <Check size={18} className="text-emerald-400 shrink-0" />
                      <span>{toastMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Record Header Card */}
                <div className="glass-card rounded-[48px] p-8 sm:p-10 mb-12 flex flex-col md:flex-row items-center gap-8 md:gap-10 border-white/5 relative overflow-hidden">
                  <div className="absolute top-[-50%] left-[-20%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[80px]"></div>
                  
                  <div className="h-36 w-36 sm:h-40 sm:w-40 rounded-[40px] bg-slate-900 border-4 border-white/10 shadow-2xl relative z-10 shrink-0">
                    {selectedClient.avatar ? (
                      <img src={selectedClient.avatar} alt={selectedClient.name} className="h-full w-full object-cover rounded-[36px]" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-bold text-5xl text-white/10">{selectedClient.name[0]}</div>
                    )}
                  </div>
                  
                  <div className="relative z-10 text-center md:text-left flex-1 w-full">
                    <div className="flex flex-wrap items-center justify-center md:justify-between gap-3 mb-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                          <ShieldCheck size={14} className="mr-2" /> Ficha Ativa
                        </div>
                        {lastSavedTime && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                            <Check size={12} className="text-emerald-400" /> Sincronizado às {lastSavedTime}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleOpenEditModal}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold uppercase tracking-[0.15em] transition-all active:scale-95 cursor-pointer"
                        >
                          <Edit size={12} /> Editar Dados
                        </button>

                        <button
                          onClick={handleSaveCompleteRecord}
                          disabled={saveStatus === 'saving'}
                          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-xl active:scale-95 cursor-pointer border ${
                            saveStatus === 'saved'
                              ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-500/40 ring-2 ring-emerald-400/50 scale-105'
                              : saveStatus === 'saving'
                              ? 'bg-emerald-700 border-emerald-400 text-white/80 cursor-wait'
                              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 border-emerald-400/40 text-white shadow-emerald-500/30 hover:shadow-emerald-500/50'
                          }`}
                        >
                          {saveStatus === 'saving' ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Salvando...</span>
                            </>
                          ) : saveStatus === 'saved' ? (
                            <>
                              <Check size={16} className="text-white" />
                              <span>SALVO COM SUCESSO!</span>
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              <span>SALVAR FICHA</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter leading-tight mb-3 italic">{selectedClient.name}</h2>
                    
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5 text-xs text-white/60">
                        <Calendar size={14} className="text-emerald-400 shrink-0" />
                        Prospect desde: <span className="text-white font-semibold">{selectedClient.patientSince || 'Out de 2024'}</span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5 text-xs text-white/60">
                        <User size={14} className="text-amber-400 shrink-0" />
                        Líder / Patrocinador: <span className="text-white font-semibold">{selectedClient.responsibleProf || 'Salésio Ninja'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-sections Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <section className="glass-card rounded-[40px] p-8 border-white/5">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
                        <HeartPulse size={20} />
                      </div>
                      <h4 className="font-bold text-lg">Qualificação de Negócio & Metas</h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Perfil / Objetivo Principal</p>
                        <p className="text-sm font-medium text-white/80">{selectedClient.skinCondition || 'Renda Extra & Venda Direta'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Objeções Identificadas</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedClient.allergies?.length ? selectedClient.allergies.map(a => (
                            <span key={a} className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-[10px] font-bold border border-amber-500/20">
                              {a}
                            </span>
                          )) : <p className="text-xs text-white/20 italic">Nenhuma objeção impeditiva</p>}
                        </div>
                      </div>
                      {selectedClient.isPregnant && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                          <p className="text-[10px] font-bold text-emerald-400 uppercase">Contato Quente - Decisor Rápido</p>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="glass-card rounded-[40px] p-8 border-white/5">
                    <div className="flex items-center justify-between gap-2 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                          <Folder size={20} />
                        </div>
                        <h4 className="font-bold text-lg">Documentos & Fotos</h4>
                      </div>
                      <button
                        onClick={handleSaveDocumentsSection}
                        className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Salvar seções de documentos"
                      >
                        <Save size={12} /> Salvar Anexos
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 max-h-[170px] overflow-y-auto pr-1 no-scrollbar">
                      {selectedClient.files?.map(f => (
                        <div 
                          key={f.id} 
                          className="aspect-square bg-white/5 hover:bg-white/10 transition-all rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-1.5 p-3 text-center relative group/file cursor-pointer"
                          onClick={() => handleOpenDocument(f)}
                        >
                          <FileText className="text-indigo-400 group-hover/file:scale-110 transition-transform" size={24} />
                          <span className="text-[10px] font-bold text-white/80 group-hover/file:text-indigo-300 transition-colors truncate w-full px-1">{f.name}</span>
                          <span className="text-[8px] text-white/40">{f.size}</span>
                          
                          <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover/file:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenDocument(f); }}
                              className="p-1.5 rounded-lg bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg"
                              title="Visualizar Documento"
                            >
                              <Eye size={12} /> Ver
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRemoveFile(f.id); }}
                              className="p-1.5 rounded-lg bg-rose-500/80 text-white hover:bg-rose-600 transition-colors"
                              title="Excluir Documento"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square bg-white/5 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-all cursor-pointer group"
                      >
                        <Plus className="text-white/20 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Anexar Novo</span>
                      </div>
                    </div>
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                  </section>
                </div>

                {/* Gallery Section */}
                <section className="glass-card rounded-[40px] p-8 border-white/5 mb-12">
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                        <Camera size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Comprovantes & Evidências de Ativação</h4>
                        <p className="text-[10px] text-white/40">Comprovantes de pagamento de kit, termos ou fotos de treinamento</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSavePhotosSection}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                      >
                        <Save size={12} /> Salvar Fotos
                      </button>
                      <button 
                        onClick={() => photoInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        <Plus size={14} /> Novo Anexo
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {selectedClient.photos?.map((photo) => (
                      <div 
                        key={photo.id} 
                        className="group relative aspect-square rounded-3xl overflow-hidden border border-white/5 bg-white/5 cursor-pointer"
                        onClick={() => setPreviewModal({ url: photo.url, title: `Foto ${photo.type}`, type: photo.type, date: photo.date })}
                      >
                        <img src={photo.url} alt={photo.type} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
                          <div className="flex justify-between items-end pointer-events-auto">
                            <button
                              onClick={() => setPreviewModal({ url: photo.url, title: `Foto ${photo.type}`, type: photo.type, date: photo.date })}
                              className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-md flex items-center gap-1.5"
                            >
                              <Eye size={14} /> Ampliar
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRemovePhoto(photo.id); }}
                              className="h-8 w-8 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="absolute top-4 left-4">
                          <span className="px-2.5 py-1 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white uppercase tracking-tighter">
                            {photo.type}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    <div 
                      onClick={() => photoInputRef.current?.click()}
                      className="aspect-square rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-3 text-white/20 hover:text-white/40 hover:border-white/10 transition-all cursor-pointer"
                    >
                      <ImageIcon size={32} />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center">Adicionar foto<br/>ou comprovante</span>
                    </div>
                  </div>
                  
                  <input 
                    type="file" 
                    ref={photoInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handlePhotoUpload} 
                  />
                </section>

                {/* Detailed Follow-up History Section */}
                <section className="glass-card rounded-[40px] p-10 border-white/5 mb-20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8">
                    <div className="h-24 w-24 border-t-2 border-r-2 border-emerald-500/20 rounded-tr-[32px] group-hover:scale-110 group-hover:border-emerald-500/50 transition-all duration-700"></div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-10 bg-emerald-500 rounded-full"></div>
                      <h4 className="text-3xl font-black italic text-white tracking-tight">Histórico de Follow-ups & Fechamento</h4>
                    </div>
                    <button
                      onClick={handleSaveNotes}
                      disabled={saveStatus === 'saving'}
                      className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 active:scale-95 border cursor-pointer ${
                        saveStatus === 'saved'
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/50'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/30'
                      }`}
                    >
                      <Save size={14} /> {saveStatus === 'saved' ? 'HISTÓRICO SALVO! ✓' : 'SALVAR HISTÓRICO'}
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <textarea
                      rows={5}
                      className="w-full bg-white/5 border border-white/10 rounded-3xl p-5 text-sm text-white/90 placeholder-white/20 outline-none focus:border-emerald-500 transition-colors leading-relaxed resize-y"
                      placeholder="Registre as reuniões de APN realizadas, objeções superadas, kit de adesão pretendido e combinados de follow-up..."
                      value={editingNotes}
                      onChange={e => setEditingNotes(e.target.value)}
                    />
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Sincronizado via CRM MMN na Nuvem</p>
                    <button 
                      onClick={handleExport}
                      className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <Download size={12} /> Exportar Ficha do Prospect
                    </button>
                  </div>
                </section>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-12">
                <div className="mb-10 relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-[60px] animate-pulse"></div>
                  <Folder size={120} className="text-white/5 relative z-10" />
                </div>
                <h3 className="text-4xl font-extrabold text-white/20 italic mb-6">Nenhum prospect selecionado</h3>
                <p className="text-white/30 max-w-sm text-sm font-medium leading-relaxed">
                  Utilize o painel à esquerda para buscar e abrir o arquivo e ficha de qualificação de um prospect.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal de Edição dos Dados do Paciente */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-[32px] p-6 sm:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Edit size={18} className="text-emerald-400" />
                    Editar Ficha do Prospect
                  </h3>
                  <p className="text-xs text-white/40 mt-1">Atualize as informações de contato, líder patrocinador e perfil de negócio</p>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEditModal} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1.5">
                    Nome Completo do Prospect
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    value={editFormData.name}
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1.5">
                      Telefone (WhatsApp)
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                      value={editFormData.phone}
                      onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1.5">
                      E-mail
                    </label>
                    <input
                      type="email"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                      value={editFormData.email}
                      onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1.5">
                      Líder / Patrocinador
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Salésio Ninja"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                      value={editFormData.responsibleProf}
                      onChange={e => setEditFormData({ ...editFormData, responsibleProf: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1.5">
                      Contato Desde
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Out de 2024"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                      value={editFormData.patientSince}
                      onChange={e => setEditFormData({ ...editFormData, patientSince: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1.5">
                    Perfil / Objetivo Principal no MMN
                  </label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    value={editFormData.skinCondition}
                    onChange={e => setEditFormData({ ...editFormData, skinCondition: e.target.value })}
                  >
                    <option className="bg-slate-900" value="Renda Extra (R$ 1.500 - R$ 3.000/mês)">Renda Extra (R$ 1.500 - R$ 3.000/mês)</option>
                    <option className="bg-slate-900" value="Venda Direta / Lucro 100% no Varejo">Venda Direta / Lucro 100% no Varejo</option>
                    <option className="bg-slate-900" value="Carreira & Liderança (Diamante / Royal)">Carreira & Liderança (Diamante / Royal)</option>
                    <option className="bg-slate-900" value="Consumo Inteligente (50% de Desconto)">Consumo Inteligente (50% de Desconto)</option>
                    <option className="bg-slate-900" value="Expansão de Franquias & Ponto de Apoio (PA)">Expansão de Franquias & Ponto de Apoio (PA)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1.5">
                    Objeções / Dúvidas a Contornar (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Sem tempo, Não sabe vender, Quer entender o bônus de equipe"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                    value={editFormData.allergiesStr}
                    onChange={e => setEditFormData({ ...editFormData, allergiesStr: e.target.value })}
                  />
                </div>

                <div 
                  onClick={() => setEditFormData({ ...editFormData, isPregnant: !editFormData.isPregnant })}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all mt-2"
                >
                  <div>
                    <p className="text-xs font-bold text-white">Contato Quente / Decisor Rápido</p>
                    <p className="text-[10px] text-white/40">Marca o prospect como alta prioridade para fechamento imediato de Kit</p>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${editFormData.isPregnant ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editFormData.isPregnant ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-5 py-3 rounded-2xl text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-2 active:scale-95 transition-all"
                  >
                    <Save size={14} /> Salvar Ficha
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Preview Modal de Imagens / Documentos */}
      <AnimatePresence>
        {previewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl w-full bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-white text-base">{previewModal.title}</h4>
                  {previewModal.date && <p className="text-xs text-white/40">{previewModal.date}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={previewModal.url}
                    download="comprovante_prospect.jpg"
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider transition-colors shadow-lg"
                    title="Baixar Foto / Documento"
                  >
                    <Download size={14} /> Download
                  </a>
                  <button
                    onClick={() => setPreviewModal(null)}
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center text-white/60 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="p-6 flex-1 overflow-auto flex items-center justify-center bg-black/50">
                <img 
                  src={previewModal.url} 
                  alt={previewModal.title} 
                  className="max-h-[72vh] max-w-full object-contain rounded-2xl border border-white/10 shadow-2xl" 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
