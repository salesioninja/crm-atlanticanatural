import { Phone, Edit, X, Plus, Save, MessageCircle, Trash2, Camera, Image as ImageIcon, FileText, Eye, Download } from 'lucide-react';
import { Client } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { formatWhatsAppLink, MESSAGES } from '../lib/whatsapp';

interface ClientDetailProps {
  client: Client;
  onUpdate: (updatedClient: Client) => void;
  onDelete?: (clientId: string) => void;
}

export default function ClientDetail({ client, onUpdate, onDelete }: ClientDetailProps) {
  const [editedNotes, setEditedNotes] = useState(client.clinicalNotes || '');
  const [skinCondition, setSkinCondition] = useState(client.skinCondition || '');
  const [isPregnant, setIsPregnant] = useState(client.isPregnant || false);

  const [activeTab, setActiveTab] = useState<'anamnese' | 'historico' | 'arquivos' | 'galeria'>('anamnese');
  
  // Lightbox Preview Modal State
  const [previewModal, setPreviewModal] = useState<{ url: string; title: string; type?: string; date?: string } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Helper para comprimir imagens em Canvas JPEG (max 800x800, qualidade 0.75) para salvar sem estouro no MySQL
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = prompt('Qual o tipo da foto? (Antes / Depois / Evolução)', 'Antes');
      if (!type) return;
      
      const compressedDataUrl = await compressImage(file);
      const addedPhoto = {
        id: Math.random().toString(36).substr(2, 9),
        type: type,
        date: new Date().toLocaleDateString('pt-BR'),
        url: compressedDataUrl
      };
      
      onUpdate({
        ...client,
        photos: [...(client.photos || []), addedPhoto]
      });
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    if (confirm('Tem certeza que deseja excluir esta foto da galeria?')) {
      onUpdate({
        ...client,
        photos: client.photos?.filter(p => p.id !== photoId)
      });
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressedAvatar = await compressImage(file, 400, 400, 0.8);
      onUpdate({
        ...client,
        avatar: compressedAvatar
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        onUpdate({
          ...client,
          files: [...(client.files || []), addedFile]
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    onUpdate({
      ...client,
      files: client.files?.filter(f => f.id !== fileId)
    });
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

  // Reset fields when client changes
  useEffect(() => {
    setEditedNotes(client.clinicalNotes || '');
    setSkinCondition(client.skinCondition || '');
    setIsPregnant(client.isPregnant || false);
    setActiveTab('anamnese');
  }, [client]);

  const handleSave = () => {
    onUpdate({
      ...client,
      clinicalNotes: editedNotes,
      skinCondition: skinCondition,
      isPregnant: isPregnant
    });
  };

  const handleWhatsAppDirect = () => {
    const message = MESSAGES.WELCOME(client.name);
    const link = formatWhatsAppLink(client.phone, message);
    window.open(link, '_blank');
  };

  const handleAddAllergy = () => {
    const allergy = prompt('Digite a objeção ou dúvida do prospect (ex: sem tempo, sem dinheiro, não sabe vender):');
    if (allergy) {
      onUpdate({
        ...client,
        allergies: [...(client.allergies || []), allergy]
      });
    }
  };

  const handleRemoveAllergy = (name: string) => {
    onUpdate({
      ...client,
      allergies: client.allergies?.filter(a => a !== name)
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      key={client.id}
      className="glass-card rounded-[40px] overflow-hidden sticky top-24"
    >
      {/* Profile Header */}
      <div className="relative h-32 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600">
        <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-[20px] border-4 border-white/10 overflow-hidden shadow-2xl bg-slate-900">
          {client.avatar ? (
            <img 
              src={client.avatar} 
              alt={client.name} 
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-white/5 text-white font-bold text-2xl">
              {client.name.split(' ').map(n => n[0]).join('')}
            </div>
          )}
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <button 
            onClick={handleWhatsAppDirect}
            className="bg-emerald-500 text-white p-2 rounded-2xl hover:bg-emerald-400 transition-all shadow-lg active:scale-95 flex items-center gap-2 px-4"
          >
            <MessageCircle size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">WhatsApp</span>
          </button>
          <button 
            onClick={() => avatarInputRef.current?.click()}
            className="bg-white/10 backdrop-blur-md text-white border border-white/20 p-2 rounded-2xl hover:bg-white/20 transition-all active:scale-95"
            title="Alterar Foto"
          >
            <Edit size={16} />
          </button>
          {onDelete && (
            <button 
              onClick={() => onDelete(client.id)}
              className="bg-rose-500/20 backdrop-blur-md text-rose-300 hover:text-white border border-rose-500/30 p-2 rounded-2xl hover:bg-rose-600 transition-all active:scale-95"
              title="Excluir Prospect"
            >
              <Trash2 size={16} />
            </button>
          )}
          <input 
            type="file" 
            ref={avatarInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleAvatarChange} 
          />
        </div>
      </div>

      <div className="px-8 pt-14 pb-8 space-y-8">
        <div>
          <h3 className="text-2xl font-bold text-white tracking-tight">{client.name}</h3>
          <p className="text-white/40 flex items-center gap-2 mt-1 text-sm font-medium">
            <Phone size={14} className="text-emerald-400" />
            {client.phone}
          </p>
        </div>

        {/* Custom Tabs */}
        <div className="flex gap-6 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('anamnese')}
            className={`pb-3 text-[11px] font-bold tracking-widest uppercase transition-all ${
              activeTab === 'anamnese' ? 'text-white border-b-2 border-emerald-500' : 'text-white/30 hover:text-white/60'
            }`}
          >
            Qualificação
          </button>
          <button 
            onClick={() => setActiveTab('historico')}
            className={`pb-3 text-[11px] font-bold tracking-widest uppercase transition-all ${
              activeTab === 'historico' ? 'text-white border-b-2 border-emerald-500' : 'text-white/30 hover:text-white/60'
            }`}
          >
            Histórico
          </button>
          <button 
            onClick={() => setActiveTab('arquivos')}
            className={`pb-3 text-[11px] font-bold tracking-widest uppercase transition-all ${
              activeTab === 'arquivos' ? 'text-white border-b-2 border-emerald-500' : 'text-white/30 hover:text-white/60'
            }`}
          >
            Arquivos ({client.files?.length || 0})
          </button>
          <button 
            onClick={() => setActiveTab('galeria')}
            className={`pb-3 text-[11px] font-bold tracking-widest uppercase transition-all ${
              activeTab === 'galeria' ? 'text-white border-b-2 border-emerald-500' : 'text-white/30 hover:text-white/60'
            }`}
          >
            Comprovantes ({client.photos?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="relative">
          {activeTab === 'anamnese' && (
            <motion.div 
              key="anamnese"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">
                  Perfil / Objetivo de Negócio
                </label>
                <div className="relative group">
                  <select 
                    value={skinCondition}
                    onChange={(e) => setSkinCondition(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 appearance-none outline-none group-hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <option className="bg-slate-900" value="Renda Extra (R$ 1.500 - R$ 3.000/mês)">Renda Extra (R$ 1.500 - R$ 3.000/mês)</option>
                    <option className="bg-slate-900" value="Venda Direta / Lucro 100% no Varejo">Venda Direta / Lucro 100% no Varejo</option>
                    <option className="bg-slate-900" value="Carreira & Liderança (Diamante / Royal)">Carreira & Liderança (Diamante / Royal)</option>
                    <option className="bg-slate-900" value="Consumo Inteligente (50% de Desconto)">Consumo Inteligente (50% de Desconto)</option>
                    <option className="bg-slate-900" value="Expansão de Franquias & Ponto de Apoio (PA)">Expansão de Franquias & Ponto de Apoio (PA)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">
                  Objeções & Desafios Identificados
                </label>
                <div className="flex flex-wrap gap-2">
                  {client.allergies?.map((allergy) => (
                    <span 
                      key={allergy}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-300 text-[10px] font-bold uppercase tracking-widest border border-amber-500/20"
                    >
                      {allergy} <X size={12} className="cursor-pointer hover:text-white transition-colors" onClick={() => handleRemoveAllergy(allergy)} />
                    </span>
                  ))}
                  <button 
                    onClick={handleAddAllergy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-white/10 text-white/40 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all hover:border-white/20"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
              </div>

              <div 
                onClick={() => setIsPregnant(!isPregnant)}
                className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all"
              >
                <div>
                  <p className="text-sm font-bold text-white">Contato Quente / Decisor Rápido</p>
                  <p className="text-[10px] text-white/30 font-medium tracking-wide">Prioridade alta para fechamento de Kit</p>
                </div>
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all cursor-pointer ${isPregnant ? 'bg-emerald-500' : 'bg-white/10 border border-white/10'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${isPregnant ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">
                  Anotações de Follow-up & Objeções
                </label>
                <textarea 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 placeholder:text-white/20 outline-none resize-none hover:bg-white/10 transition-all h-28"
                  placeholder="Registre o interesse, kits apresentados, objeções contornadas e próximos passos..."
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                ></textarea>
              </div>

              <button 
                onClick={handleSave}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-[11px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-[0.98]"
              >
                <Save size={16} />
                Atualizar Qualificação
              </button>
            </motion.div>
          )}

          {activeTab === 'historico' && (
            <motion.div 
              key="historico"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 py-4"
            >
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-xs font-bold text-white">Apresentação de Negócios (APN 1 a 1)</p>
                <p className="text-[10px] text-emerald-400 mt-1 uppercase tracking-wider">Apresentado Plano de Carreira e Linha de Produtos</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-xs font-bold text-white">Envio de Material & Catálogo em PDF</p>
                <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">Prospect avaliando Kit de Adesão e Margem 100%</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'arquivos' && (
            <motion.div 
              key="arquivos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center pb-2">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Documentos & Contratos ({client.files?.length || 0})</span>
                <label className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest cursor-pointer flex items-center gap-1">
                  <Plus size={12} /> Adicionar PDF/Foto
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={handleFileUpload} 
                  />
                </label>
              </div>
              
              {client.files && client.files.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                  {client.files.map((f) => (
                    <div key={f.id} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 flex justify-between items-center group transition-all">
                      <div 
                        onClick={() => handleOpenDocument(f)}
                        className="flex items-center gap-3 truncate cursor-pointer flex-1"
                      >
                        <FileText className="text-emerald-400 shrink-0" size={18} />
                        <div className="truncate">
                          <p className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">{f.name}</p>
                          <p className="text-[9px] text-white/30">{f.date} • {f.size}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                          onClick={() => handleOpenDocument(f)}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/30 text-emerald-300 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1"
                          title="Visualizar Documento"
                        >
                          <Eye size={12} /> Ver
                        </button>
                        <button 
                          onClick={() => handleRemoveFile(f.id)}
                          className="text-white/20 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                          title="Excluir"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 p-6">
                  <Plus className="text-white/10 mb-2" size={32} />
                  <p className="text-xs font-bold text-white/40 mb-1">Nenhum documento anexado</p>
                  <p className="text-[9px] text-white/25 max-w-[200px]">Adicione contratos, termos de adesão ou fichas cadastrais.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'galeria' && (
            <motion.div 
              key="galeria"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center pb-2">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Comprovantes & Fotos ({client.photos?.length || 0})</span>
                <label className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest cursor-pointer flex items-center gap-1">
                  <Camera size={12} /> Adicionar Foto
                  <input 
                    type="file" 
                    ref={photoInputRef}
                    className="hidden" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                  />
                </label>
              </div>

              {client.photos && client.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-1 no-scrollbar">
                  {client.photos.map((photo) => (
                    <div key={photo.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-white/5 bg-white/5 cursor-pointer">
                      <img 
                        src={photo.url} 
                        alt={photo.type} 
                        onClick={() => setPreviewModal({ url: photo.url, title: `Foto ${photo.type}`, type: photo.type, date: photo.date })}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        referrerPolicy="no-referrer" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 pointer-events-none">
                        <div className="flex justify-between items-end pointer-events-auto">
                          <button 
                            onClick={() => setPreviewModal({ url: photo.url, title: `Foto ${photo.type}`, type: photo.type, date: photo.date })}
                            className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-md"
                          >
                            <Eye size={10} /> Ampliar
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemovePhoto(photo.id); }}
                            className="h-6 w-6 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="absolute top-2 left-2">
                        <span className="px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-md border border-white/10 text-[9px] font-bold text-white uppercase tracking-tighter">
                          {photo.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div 
                  onClick={() => photoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center py-10 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 p-6 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <ImageIcon className="text-white/20 mb-2" size={32} />
                  <p className="text-xs font-bold text-white/40 mb-1">Nenhum comprovante cadastrado</p>
                  <p className="text-[9px] text-white/25 max-w-[200px]">Clique aqui para adicionar comprovantes de pagamento do kit ou fotos de eventos.</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Lightbox / Preview Modal */}
      <AnimatePresence>
        {previewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-3xl w-full bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-white text-sm">{previewModal.title}</h4>
                  {previewModal.date && <p className="text-[10px] text-white/40">{previewModal.date}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewModal.url}
                    download="comprovante_prospect.jpg"
                    className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                    title="Baixar Foto"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    onClick={() => setPreviewModal(null)}
                    className="h-8 w-8 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center text-white/60 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/40">
                <img 
                  src={previewModal.url} 
                  alt={previewModal.title} 
                  className="max-h-[70vh] w-auto object-contain rounded-2xl border border-white/10 shadow-2xl" 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
