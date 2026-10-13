import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Trash2, 
  Search, 
  CalendarX, 
  Send, 
  AlertTriangle, 
  Loader2, 
  Check, 
  MessageCircle, 
  Upload, 
  FileSpreadsheet,
  Zap,
  Pencil 
} from 'lucide-react';
import api from '../lib/api';

interface DBAppointment {
  id: string;
  tenant_id: string;
  patient_id: string;
  user_id: string;
  treatment: string;
  horario_consulta: string;
  horario_mensagem: string;
  status_envio: 'Aguardando' | 'Processando' | 'Enviado' | 'Confirmado' | 'Reagendar' | 'Erro';
  ai_message_preview: string;
  event_id: string | null;
  logs: string;
  patient_name?: string;
  patient_phone?: string;
  user_name?: string;
}

export default function ListaIaPage() {
  const [appointments, setAppointments] = useState<DBAppointment[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'Aguardando' | 'Enviado' | 'Confirmado' | 'Reagendar'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isDispatchingAll, setIsDispatchingAll] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingIdsRef = useRef<Set<string>>(new Set());

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/appointments');
      setAppointments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erro ao buscar agendamentos:", err);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatchQueue = async () => {
    setIsDispatchingAll(true);
    try {
      const res = await api.post('/cron');
      const data = res.data;
      const enviados = data?.enviados ?? 0;
      const erros = data?.erros ?? 0;
      const msg = data?.message || '';
      if (enviados > 0) {
        alert(`Sucesso! ${enviados} disparo(s) entregue(s) no WhatsApp via Evolution Go!`);
      } else if (erros > 0) {
        alert(`Processamento concluído com ${erros} erro(s). Verifique os logs de conexão do WhatsApp.`);
      } else {
        alert(`Fila verificada: ${msg || 'Nenhum disparo pendente para este horário.'}`);
      }
      await fetchAppointments();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Falha ao acionar motor de disparos.';
      alert(`Erro no motor de disparos: ${errorMsg}`);
    } finally {
      setIsDispatchingAll(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    // Auto-tick a cada 30 segundos para disparar a fila automaticamente em segundo plano
    const timer = setInterval(() => {
      api.post('/cron').then(() => fetchAppointments()).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const appointmentsRef = useRef(appointments);
  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  // Filter list
  const filtered = appointments.filter(s => {
    const patientName = s.patient_name || 'N/A';
    const patientPhone = s.patient_phone || '';
    const matchSearch = patientName.toLowerCase().includes(search.toLowerCase()) || patientPhone.includes(search);
    const matchFilter = filter === 'all' ? true : s.status_envio === filter;
    return matchSearch && matchFilter;
  });

  const handleDownloadTemplate = () => {
    const headers = "nome;telefone;horario_mensagem;horario_consulta;profissional;categoria;comando\r\n";
    const sample1 = "Rodrigo Silva;5511999998888;2026-10-15T19:00;2026-10-15T20:00;Salésio Ninja;APN Apresentação;Confirmar presença na APN online sobre o Plano Atlântica Natural e oportunidade de negócio.\r\n";
    const sample2 = "Camila Ferreira;5511977776666;2026-10-16T14:00;2026-10-16T15:00;Líder Diamante;Fechamento Kit;Follow-up após assistir o vídeo do Plano de 90 dias e tirar dúvidas do Kit Bronze ou Ouro.\r\n";
    const csvContent = headers + sample1 + sample2;
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_agenda_prospects.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          throw new Error("O arquivo CSV está vazio ou não possui cabeçalhos.");
        }

        const headerLine = lines[0].trim();
        const delimiter = headerLine.includes(';') ? ';' : ',';
        const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

        const requiredHeaders = ['nome', 'telefone', 'horario_mensagem', 'horario_consulta'];
        const missing = requiredHeaders.filter(req => !headers.includes(req));

        if (missing.length > 0) {
          throw new Error(`Colunas obrigatórias ausentes no CSV: ${missing.join(', ')}`);
        }

        const batch: any[] = [];
        const timestamp = Date.now();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });

          if (!row.nome || !row.telefone || !row.horario_mensagem || !row.horario_consulta) {
            continue;
          }

          batch.push({
            nome: row.nome,
            telefone: row.telefone.replace(/\D/g, ''),
            horarioMensagem: row.horario_mensagem,
            horarioConsulta: row.horario_consulta,
            profissional: row.profissional || 'Dra Eloiza Beal - Osteopata',
            categoria: row.categoria || 'Osteopatia',
            comando: row.comando || 'Lembrete de consulta geral.'
          });
        }

        if (batch.length === 0) {
          throw new Error("Nenhum registro válido extraído do CSV.");
        }

        if (window.confirm(`Deseja importar os ${batch.length} agendamentos da planilha para o banco de dados multi-tenant?`)) {
          setIsLoading(true);
          
          // Fetch único de pacientes prévio ao loop (Elimina o gargalo N+1)
          const patientsRes = await api.get('/patients');
          const existingPatients: any[] = Array.isArray(patientsRes.data) ? patientsRes.data : [];

          // Estrutura de busca O(1) em memória por telefone limpo e nome
          const patientMapByPhone = new Map<string, any>();
          const patientMapByName = new Map<string, any>();

          existingPatients.forEach((p: any) => {
            const cleanP = p.phone ? p.phone.replace(/\D/g, '') : '';
            if (cleanP) patientMapByPhone.set(cleanP, p);
            if (p.name) patientMapByName.set(p.name.toLowerCase().trim(), p);
          });

          // Fetch único de profissionais do tenant para associação dinâmica O(1)
          let tenantUsers: any[] = [];
          try {
            const usersRes = await api.get('/users');
            if (Array.isArray(usersRes.data)) {
              tenantUsers = usersRes.data;
            }
          } catch (e) {
            console.error("Erro ao carregar usuários da clínica:", e);
          }

          const profMapByName = new Map<string, string>();
          tenantUsers.forEach((u: any) => {
            if (u.name) {
              const normName = u.name.toLowerCase().trim();
              profMapByName.set(normName, u.id);
              const firstName = normName.split(' ')[0];
              if (firstName && !profMapByName.has(firstName)) {
                profMapByName.set(firstName, u.id);
              }
            }
          });

          const defaultUserId = tenantUsers[0]?.id || 'p1';

          for (const item of batch) {
            const cleanPhone = item.telefone.replace(/\D/g, '');
            const lowerName = item.nome.toLowerCase().trim();

            // Consulta local O(1) ao Map de pacientes
            let patient = patientMapByPhone.get(cleanPhone) || patientMapByName.get(lowerName);
            let patientId = '';

            if (!patient) {
              const newPatientRes = await api.post('/patients', {
                name: item.nome,
                phone: item.telefone,
                email: `${item.nome.toLowerCase().replace(/\s+/g, '')}@exemplo.com`,
                crm_status: 'Agendado'
              });
              patientId = newPatientRes.data.id;
              patient = { id: patientId, name: item.nome, phone: item.telefone };
              if (cleanPhone) patientMapByPhone.set(cleanPhone, patient);
              if (lowerName) patientMapByName.set(lowerName, patient);
            } else {
              patientId = patient.id;
            }

            // 2. Determinar Profissional (user_id) de forma 100% dinâmica O(1)
            const rawProf = item.profissional ? item.profissional.toLowerCase().trim() : '';
            const cleanProfName = rawProf.split(' - ')[0].trim();
            const userId = profMapByName.get(cleanProfName) || profMapByName.get(rawProf) || defaultUserId;

            // 3. Criar agendamento no banco
            await api.post('/appointments', {
              patient_id: patientId,
              user_id: userId,
              treatment: `${item.categoria} com ${item.profissional.split(' - ')[0]}`,
              horario_consulta: item.horarioConsulta,
              horario_mensagem: item.horarioMensagem,
              status_envio: 'Aguardando',
              ai_message_preview: '' // Será gerado na varredura ou sob demanda
            });
          }

          alert(`${batch.length} agendamentos integrados com sucesso no banco de dados!`);
          fetchAppointments();
        }
      } catch (err: any) {
        alert("Erro ao processar planilha: " + err.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsLoading(false);
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleExport = () => {
    if (appointments.length === 0) return alert('Sem dados para exportar');
    let csv = "Paciente,Contato,Horario Disparo,Horario Consulta,Doutor,Procedimento,Status\r\n";
    appointments.forEach(s => {
      csv += `"${s.patient_name || ''}","${s.patient_phone || ''}","${s.horario_mensagem}","${s.horario_consulta}","${s.user_name || ''}","${s.treatment}","${s.status_envio}"\r\n`;
    });
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'fila_disparos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearAll = async () => {
    if (!window.confirm("Deseja apagar permanentemente todos os registros de agendamento desta clínica?")) return;
    setIsLoading(true);
    try {
      await api.delete('/appointments');
      setAppointments([]);
      alert("Fila de agendamentos limpa com sucesso!");
    } catch (err: any) {
      alert("Erro ao limpar agendamentos: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPhone = async (appt: DBAppointment) => {
    const currentPhone = appt.patient_phone || '';
    const newPhone = window.prompt(
      `Corrigir número do WhatsApp de ${appt.patient_name || 'Prospect'}:\nExemplo: 5546999765576 ou (46) 99976-5576`,
      currentPhone
    );
    if (!newPhone || newPhone.trim() === currentPhone.trim()) return;

    let clean = newPhone.replace(/\D/g, '');
    if (clean.startsWith('55') && clean.length >= 12) {
      // Já possui 55
    } else if (clean.length === 10 || clean.length === 11) {
      clean = '55' + clean;
    }

    if (clean.length < 12 || clean.length > 13) {
      alert(`⚠️ Número inválido! Deve conter DDD + 8 ou 9 dígitos (total 10 ou 11 dígitos sem o 55).\nVocê digitou ${clean.length} dígitos.`);
      return;
    }

    try {
      await api.put(`/appointments/${appt.id}`, {
        patient_phone: clean,
        status_envio: 'Aguardando',
        status_message: 'Aguardando',
        logs: `Telefone corrigido para ${clean} por usuário.`
      });
      alert(`✓ Telefone corrigido para ${clean}! O agendamento voltou para a fila 'Aguardando'.`);
      await fetchAppointments();
    } catch (err: any) {
      alert("Erro ao salvar número corrigido: " + (err.response?.data?.error || err.message));
    }
  };

  const handleForceDispatch = async (id: string) => {
    if (processingIdsRef.current.has(id)) return;

    const sched = appointmentsRef.current.find(s => s.id === id);
    if (!sched) return;

    const digits = (sched.patient_phone || '').replace(/\D/g, '');
    if (digits.length > 13) {
      alert(`⚠️ O número cadastrado (${sched.patient_phone}) possui ${digits.length} dígitos e foi recusado pelo WhatsApp.\nClique no botão com o lápis para corrigir o número antes de disparar.`);
      return;
    }

    // 1. Validação estrita do texto da mensagem da IA
    if (!sched.ai_message_preview || !sched.ai_message_preview.trim()) {
      alert("Aviso: O texto de prévia da mensagem de IA não está preenchido para este agendamento. Aguarde a geração antes de disparar.");
      return;
    }

    processingIdsRef.current.add(id);
    setProcessingIds(prev => new Set(prev).add(id));

    // 2. Atualizar estado local e DB para 'Processando'
    setAppointments(prev => prev.map(s => s.id === id ? { ...s, status_envio: 'Processando' } : s));
    try {
      await api.put(`/appointments/${id}`, { status_envio: 'Processando' });
    } catch (e) {
      // ignore state transition warning
    }

    try {
      // 3. Executa a chamada HTTP POST para a rota de disparo de mensageria real (WhatsApp)
      const messageContent = sched.ai_message_preview;
      await api.post('/messages', {
        patient_id: sched.patient_id,
        phone: sched.patient_phone,
        content: messageContent
      });

      // 4. Em caso de SUCESSO na API de mensageria:
      const timestampStr = new Date().toLocaleString('pt-BR');
      const successLog = `Disparo manual entregue com sucesso via WhatsApp em ${timestampStr}.`;

      await api.put(`/appointments/${id}`, {
        status_envio: 'Enviado',
        status_message: 'Enviado',
        crm_status: 'Agendado',
        status_crm: 'Agendado',
        logs: successLog
      });

      setAppointments(prev => prev.map(s => s.id === id ? {
        ...s,
        status_envio: 'Enviado',
        logs: successLog
      } : s));

      alert(`Lembrete disparado com sucesso para ${sched.patient_name || 'o prospect'}!`);

    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Falha ao conectar com o servidor de mensageria.';
      const errorLog = `Erro no disparo manual (${new Date().toLocaleTimeString()}): ${errorMsg}`;

      console.error("Falha no disparo de mensagem:", err);

      // Em caso de ERRO: NÃO altera o status para 'Enviado'
      setAppointments(prev => prev.map(s => s.id === id ? {
        ...s,
        status_envio: 'Erro',
        logs: errorLog
      } : s));

      await api.put(`/appointments/${id}`, {
        status_envio: 'Erro',
        logs: errorLog
      });

      alert(`Falha ao disparar mensagem no WhatsApp: ${errorMsg}`);
    } finally {
      processingIdsRef.current.delete(id);
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este agendamento?")) return;
    try {
      await api.delete(`/appointments/${id}`);
      setAppointments(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert("Erro ao deletar agendamento: " + err.message);
    }
  };

  const formatDateTime = (str: string) => {
    if (!str) return "N/A";
    const d = new Date(str);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 select-none pb-20">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-lg">
            Fila Ativa de Lembretes & Follow-up
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mt-4 italic">Agenda de Disparos de Prospecção</h2>
          <p className="text-sm text-white/40 mt-1 uppercase tracking-widest font-semibold">Gerencie a fila de envio de mensagens para prospects e acompanhe os status.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 shrink-0">
          <button 
            onClick={handleDownloadTemplate} 
            className="bg-white/5 hover:bg-white/10 text-white/80 px-4 py-3 rounded-2xl border border-white/5 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Modelo CSV
          </button>

          <button 
            onClick={handleDispatchQueue} 
            disabled={isDispatchingAll}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black px-5 py-3 rounded-2xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-950/30 disabled:opacity-50"
          >
            {isDispatchingAll ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Zap className="w-4 h-4 fill-current text-amber-300" />}
            Disparar Fila Agora
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="bg-white/10 hover:bg-white/15 text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 border border-white/5"
          >
            <Upload className="w-4 h-4 text-emerald-400" /> Importar Planilha
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />

          <button 
            onClick={handleExport} 
            className="bg-white/5 hover:bg-white/10 text-white/80 px-4 py-3 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 border border-white/5 uppercase tracking-wider active:scale-95"
          >
            <Download className="w-4 h-4 text-sky-400" /> Exportar CSV
          </button>
          
          <button 
            onClick={handleClearAll} 
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-4 py-3 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 border border-rose-500/20 uppercase tracking-wider active:scale-95"
          >
            <Trash2 className="w-4 h-4" /> Limpar Fila
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card p-4 rounded-[24px] flex flex-col md:flex-row items-center justify-between gap-4 border border-white/5 bg-white/5 backdrop-blur-md">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input 
            type="text" 
            placeholder="Pesquisar prospect ou contato..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/20 outline-none focus:border-emerald-500 transition-colors" 
          />
        </div>
        
        <div className="flex gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {([
            { id: 'all', label: 'Todos' },
            { id: 'Aguardando', label: 'Aguardando' },
            { id: 'Enviado', label: 'Enviado' },
            { id: 'Confirmado', label: 'Confirmados' },
            { id: 'Reagendar', label: 'Reagendar' }
          ] as const).map(f => (
            <button 
              key={f.id} 
              onClick={() => setFilter(f.id)} 
              className={`text-[10px] uppercase font-black px-4 py-2.5 rounded-xl transition-all shrink-0 tracking-wider ${
                filter === f.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/20' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fila Table Grid */}
      <div className="glass-card rounded-[32px] overflow-hidden border border-white/5">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-white/5 text-white/30 uppercase tracking-widest font-black text-[9px] border-b border-white/5">
              <tr>
                <th className="py-4 px-6 font-extrabold">Prospect / Convidado</th>
                <th className="py-4 px-6 font-extrabold">Contato WhatsApp</th>
                <th className="py-4 px-6 font-extrabold">Horário Disparo</th>
                <th className="py-4 px-6 font-extrabold">Horário APN / Reunião</th>
                <th className="py-4 px-6 font-extrabold">Líder & Objetivo</th>
                <th className="py-4 px-6 font-extrabold">Status</th>
                <th className="py-4 px-6 text-center font-extrabold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="py-20 text-center flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-white/5 text-white/20 rounded-2xl flex items-center justify-center mb-4 border border-white/5">
                        <CalendarX className="w-8 h-8" />
                      </div>
                      <h3 className="text-white/30 font-bold text-sm uppercase tracking-widest">Fila de Disparos Vazia</h3>
                      <p className="text-[10px] text-white/20 mt-1">Nenhum agendamento programado para os critérios selecionados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-4 px-6 font-extrabold text-white text-xs">{s.patient_name || 'N/A'}</td>
                    <td className="py-4 px-6 font-semibold font-mono text-[11px]">
                      {s.patient_phone ? (
                        s.patient_phone.replace(/\D/g, '').length > 13 ? (
                          <div className="flex items-center gap-1.5 text-rose-400 font-bold" title={`Número com dígitos a mais (${s.patient_phone.replace(/\D/g, '').length} dígitos). Clique no lápis para corrigir.`}>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                            <span>{s.patient_phone}</span>
                            <span className="text-[9px] bg-rose-500/20 px-1.5 py-0.5 rounded text-rose-300 uppercase tracking-tight font-sans">14 dígitos (inválido)</span>
                          </div>
                        ) : (
                          <span className="text-white/70">{s.patient_phone}</span>
                        )
                      ) : 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-white/60 font-mono text-[11px]">{formatDateTime(s.horario_mensagem)}</td>
                    <td className="py-4 px-6 text-white/60 font-mono text-[11px]">{formatDateTime(s.horario_consulta)}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-white">{s.user_name || 'Salésio Ninja'}</span>
                        <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold leading-none">{s.treatment}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {s.status_envio === 'Aguardando' && (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Aguardando
                        </span>
                      )}
                      {s.status_envio === 'Processando' && (
                        <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Disparando
                        </span>
                      )}
                      {s.status_envio === 'Enviado' && (
                        <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                          <Check className="w-3 h-3" /> Enviado
                        </span>
                      )}
                      {s.status_envio === 'Confirmado' && (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                          <Check className="w-3 h-3" /> Confirmado
                        </span>
                      )}
                      {s.status_envio === 'Reagendar' && (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Reagendar
                        </span>
                      )}
                      {s.status_envio === 'Erro' && (
                        <span 
                          title={s.logs ? `Motivo da falha:\n${s.logs.trim()}\n(Clique para ver mais)` : "Falha no disparo via WhatsApp. Clique para ver detalhes."}
                          onClick={() => {
                            const detail = s.logs ? s.logs.trim() : "Sem logs detalhados disponíveis.";
                            alert(`📋 Detalhes da Falha no WhatsApp:\n\n${detail}\n\nDica: Se o número estiver incorreto ou com dígitos extras, clique no ícone do LÁPIS para corrigir.`);
                          }}
                          className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer hover:bg-red-500/25 transition-all"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Falhou
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {(s.status_envio === 'Aguardando' || s.status_envio === 'Erro') && (
                          <button 
                            onClick={() => handleForceDispatch(s.id)} 
                            disabled={processingIds.has(s.id)}
                            title="Disparar Agora" 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                          >
                            {processingIds.has(s.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                          </button>
                        )}
                        <button 
                          onClick={() => handleEditPhone(s)} 
                          title="Corrigir número do WhatsApp" 
                          className="bg-white/5 hover:bg-amber-950/30 text-white/40 hover:text-amber-400 w-7 h-7 rounded-xl flex items-center justify-center transition-all border border-white/5 active:scale-90"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <a 
                          href={`https://wa.me/${s.patient_phone?.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          title="Abrir WhatsApp" 
                          className="bg-white/5 hover:bg-white/10 text-white/40 hover:text-white w-7 h-7 rounded-xl flex items-center justify-center transition-all border border-white/5 active:scale-90"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                        <button 
                          onClick={() => handleDelete(s.id)} 
                          title="Excluir Lembrete" 
                          className="bg-white/5 hover:bg-rose-950/20 text-white/40 hover:text-rose-400 w-7 h-7 rounded-xl flex items-center justify-center transition-all border border-white/5 active:scale-90"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
