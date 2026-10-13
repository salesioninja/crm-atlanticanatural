import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User, 
  Phone, 
  Clock, 
  Stethoscope, 
  Bot, 
  CalendarCheck, 
  Eraser, 
  Smartphone, 
  ArrowLeft, 
  Video, 
  EllipsisVertical, 
  Wand2, 
  Paperclip, 
  Smile, 
  Mic, 
  Tag, 
  UserPlus,
  MessageSquare, 
  Send, 
  Sparkles, 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  X, 
  Loader2, 
  AlertCircle,
  Users,
  ShieldCheck,
  Shuffle,
  Copy,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import api from '../lib/api';

const TEMPLATES: Record<string, { label: string; text: string; mode: 'consulta' | 'diversos'; cat: string }> = {
  apn: {
    label: "Lembrete APN",
    text: "Confirmação e lembrete profissional de Apresentação de Negócios (APN) com data, horário e link/local, solicitando confirmação do prospect.",
    mode: "consulta",
    cat: "Apresentação APN"
  },
  retorno: {
    label: "Follow-up 24h/48h",
    text: "Mensagem de follow-up pós-APN na metodologia Go Pro: saber o que mais chamou atenção no plano, esclarecer dúvidas e apresentar opções de kits de adesão.",
    mode: "diversos",
    cat: "Follow-up de Fechamento"
  },
  convite: {
    label: "Convite Profissional",
    text: "Convite Go Pro direto ou indireto: apresentar a expansão de mercado da Atlântica Natural na região e convidar para avaliar o plano de negócio sem compromisso.",
    mode: "diversos",
    cat: "Convite Go Pro"
  },
  conscientizacao: {
    label: "Benefícios Produtos",
    text: "Mensagem informativa sobre os benefícios da Curcumina Ouro, Óleo Ozonizado ou Chás Atlântica Natural para saúde, energia e bem-estar.",
    mode: "diversos",
    cat: "Nutracêuticos & Saúde"
  },
  agradecimento: {
    label: "Boas-Vindas à Rede",
    text: "Mensagem de boas-vindas e parabéns ao novo distribuidor pela decisão de empreender na Atlântica Natural, com orientações do Primeiro Passo e Plano de 90 dias.",
    mode: "diversos",
    cat: "Boas-Vindas & Ativação"
  },
  promocao: {
    label: "Campanha / Lançamento",
    text: "Comunicado de lançamentos de produtos, campanhas de pontuação em dobro e eventos oficiais da Atlântica Natural.",
    mode: "diversos",
    cat: "Campanhas & Eventos"
  },
  geral: {
    label: "Geral",
    text: "Confirmação amigável de reunião ou alinhamento. Peça para o prospect confirmar presença.",
    mode: "diversos",
    cat: "Mensagem Geral"
  }
};

const FALLBACK_PROFISSIONAIS = [
  { id: 'p_salesio', name: "Salésio Ninja - Líder Executivo" },
  { id: 'p_diamante', name: "Líder Diamante Atlântica" },
  { id: 'p_produtos', name: "Especialista em Nutracêuticos" }
];

const CATEGORIAS = [
  "Apresentação APN",
  "Follow-up de Fechamento",
  "Convite Go Pro",
  "Nutracêuticos & Saúde",
  "Boas-Vindas & Ativação",
  "Campanhas & Eventos",
  "Mensagem Geral"
];

interface ParsedContact {
  name: string;
  phone: string;
  original: string;
  customConsulta?: string;
  customEnvio?: string;
  customMessage?: string;
}

export default function Scheduler() {
  // Modalidade de Envio
  const [tipoDisparo, setTipoDisparo] = useState<'consulta' | 'diversos'>('consulta');
  
  // Modo de Destinatários: Individual ou Múltiplos
  const [modoDestinatario, setModoDestinatario] = useState<'individual' | 'multiplo'>('individual');
  
  // Contato Individual
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  // Múltiplos Contatos (Colar Lista)
  const [multiInput, setMultiInput] = useState('');
  const [showAllContactsPreview, setShowAllContactsPreview] = useState(false);

  // Horários e Parâmetros
  const [horarioMensagem, setHorarioMensagem] = useState('');
  const [horarioConsulta, setHorarioConsulta] = useState('');
  const [comando, setComando] = useState(TEMPLATES.apn.text);
  const [profissionais, setProfissionais] = useState<{ id: string, name: string }[]>([]);
  const [profissionalId, setProfissionalId] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);

  // Preview e Simulação IA
  const [previewText, setPreviewText] = useState("Preencha o formulário para visualizar como o texto final humanizado será estruturado pela IA.");
  const [warningText, setWarningText] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Instâncias ativas da EvoGo para exibição de status Anti-Ban
  const [evoInstances, setEvoInstances] = useState<string[]>(['atlanticanatural', 'Teste-disparo-maximo']);

  // Estados para Importação em Massa de Planilha
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSpreadsheetData, setImportSpreadsheetData] = useState<ParsedContact[]>([]);
  const [importUseFormCommand, setImportUseFormCommand] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number; log: string[] } | null>(null);

  // Carregar profissionais e instâncias da clínica
  useEffect(() => {
    const fetchProfissionais = async () => {
      try {
        const res = await api.get('/users');
        if (res.data && res.data.length > 0) {
          const list = res.data.map((u: any) => ({
            id: u.id,
            name: `${u.name} - ${u.role || 'Profissional'}`
          }));
          setProfissionais(list);
          setProfissionalId(list[0].id);
        } else {
          setProfissionais(FALLBACK_PROFISSIONAIS);
          setProfissionalId(FALLBACK_PROFISSIONAIS[0].id);
        }
      } catch (err) {
        setProfissionais(FALLBACK_PROFISSIONAIS);
        setProfissionalId(FALLBACK_PROFISSIONAIS[0].id);
      }
    };

    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data?.evolution_instance_name) {
          const list = res.data.evolution_instance_name
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean);
          if (list.length > 0) setEvoInstances(list);
        }
      } catch (err) {}
    };

    fetchProfissionais();
    fetchSettings();
  }, []);

  const formatSafeDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatIsoForBackend = (dtStr: string) => {
    if (!dtStr) return '';
    const clean = dtStr.replace('T', ' ');
    return clean.length === 16 ? `${clean}:00` : clean;
  };

  // Parser inteligente de texto colado com múltiplos contatos
  const { validContacts, invalidLines } = useMemo(() => {
    if (!multiInput.trim()) return { validContacts: [], invalidLines: [] };
    
    const valid: Array<{ name: string; phone: string; original: string }> = [];
    const invalid: string[] = [];

    const lines = multiInput.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    // Regex que identifica o telefone brasileiro na linha (com ou sem DDD, com ou sem DDI 55)
    const phonePattern = /(?:(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*))?(?:9\s*\d{4}[-\s]?\d{4}|\d{4,5}[-\s]?\d{4})/;

    for (const line of lines) {
      const match = line.match(phonePattern);
      if (!match) {
        invalid.push(line);
        continue;
      }

      const matchedPhoneStr = match[0];
      const digits = matchedPhoneStr.replace(/\D/g, '');
      let normalizedPhone = '';

      if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        normalizedPhone = digits;
      } else if (digits.length === 10 || digits.length === 11) {
        normalizedPhone = '55' + digits;
      } else if (digits.length === 8 || digits.length === 9) {
        normalizedPhone = '5546' + digits;
      }

      if (!normalizedPhone || normalizedPhone.length < 12 || normalizedPhone.length > 13) {
        invalid.push(line);
        continue;
      }

      // Extrai o nome associado da linha removendo EXATAMENTE o trecho casado do telefone
      let possibleName = (line.slice(0, match.index) + ' ' + line.slice((match.index || 0) + matchedPhoneStr.length))
        .replace(/[\-–—,:;|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!possibleName || possibleName.length < 2) {
        possibleName = 'Prospect';
      }

      valid.push({
        name: possibleName,
        phone: normalizedPhone,
        original: line
      });
    }

    return { validContacts: valid, invalidLines: invalid };
  }, [multiInput]);

  // Contato de referência para o Live Preview no celular
  const previewLeadName = useMemo(() => {
    if (modoDestinatario === 'multiplo') {
      return validContacts[0]?.name || 'Prospect';
    }
    return nome || 'Prospect';
  }, [modoDestinatario, validContacts, nome]);

  // Debounced API call para simulação de IA
  useEffect(() => {
    const effectiveName = previewLeadName;
    if (!effectiveName || !comando || !profissionalId) return;

    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      setIsLoadingPreview(true);
      try {
        const profName = profissionais.find(p => p.id === profissionalId)?.name || '';
        const effectiveDateStr = (tipoDisparo === 'consulta') ? (horarioConsulta || horarioMensagem) : '';
        const formattedDate = effectiveDateStr ? formatSafeDate(effectiveDateStr) : '';
        const catLower = categoria.toLowerCase();
        const cmdLower = comando.toLowerCase();
        let tipo = 'avulso';
        if (tipoDisparo === 'consulta') {
          tipo = 'consulta';
        } else if (catLower.includes('retorno') || cmdLower.includes('retorno') || cmdLower.includes('convite')) {
          tipo = 'retorno';
        } else if (catLower.includes('conscienti') || cmdLower.includes('conscienti') || cmdLower.includes('regularidade') || cmdLower.includes('preven')) {
          tipo = 'conscientizacao';
        } else if (catLower.includes('aniversar') || cmdLower.includes('aniversar')) {
          tipo = 'aniversario';
        } else if (catLower.includes('agradec') || cmdLower.includes('agradec')) {
          tipo = 'agradecimento';
        }

        const res = await api.post('/generate-message', {
          nome: effectiveName,
          dataConsulta: formattedDate,
          horarioMensagem: horarioMensagem ? formatSafeDate(horarioMensagem) : '',
          comando,
          categoria,
          profName,
          tipo
        }, { signal: controller.signal });
        
        let genMsg = res.data.message;

        // Substituição das tags se houver
        if (genMsg) {
          const primeiroNome = effectiveName.split(' ')[0];
          genMsg = genMsg
            .replace(/{nome}/gi, effectiveName)
            .replace(/{primeiro_nome}/gi, primeiroNome)
            .replace(/{data}/gi, formattedDate ? formattedDate.split(' ')[0] : 'hoje')
            .replace(/{horario}|{hora}/gi, formattedDate ? formattedDate.split(' ')[1] : '19:00');
        }

        setPreviewText(genMsg);
        setWarningText(res.data.warning || null);
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          return;
        }
        const effectiveDateStr = (tipoDisparo === 'consulta') ? (horarioConsulta || horarioMensagem) : '';
        const dataStr = effectiveDateStr ? ` agendada para ${formatSafeDate(effectiveDateStr)}` : '';
        let fallback = `Olá ${effectiveName}, tudo bem? Entramos em contato referente ao seu acompanhamento em ${categoria}${dataStr}. Como podemos lhe auxiliar?`;
        
        if (comando && !comando.toLowerCase().includes('sugira')) {
          fallback = `Olá ${effectiveName}, tudo bem? ${comando}. Caso tenha dúvidas ou precise agendar, estamos à disposição.`;
        }
        setPreviewText(fallback);
      } finally {
        setIsLoadingPreview(false);
      }
    }, 800);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [previewLeadName, horarioConsulta, horarioMensagem, comando, profissionalId, categoria, tipoDisparo]);

  const formatPhoneInput = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2);
    }
    digits = digits.slice(0, 11);

    if (digits.length <= 2) {
      return digits.length > 0 ? `(${digits}` : '';
    }
    if (digits.length <= 6) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const getCleanE164Phone = (val: string): { valid: boolean; phone: string; error?: string } => {
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      return { valid: true, phone: digits };
    }
    if (digits.length === 10 || digits.length === 11) {
      return { valid: true, phone: '55' + digits };
    }
    return { 
      valid: false, 
      phone: digits, 
      error: digits.length > 13 
        ? 'O número possui dígitos a mais (máximo 11 dígitos com DDD).' 
        : 'Número de WhatsApp incompleto. Digite DDD + número (ex: 46 99976-5576).' 
    };
  };

  // Inserir tag rápida no comando
  const handleInsertTag = (tag: string) => {
    setComando(prev => prev + ' ' + tag);
  };

  // Personaliza mensagem individualmente para cada contato a partir do template ou prévia da IA
  const personalizeMessageForContact = (
    template: string, 
    contactName: string, 
    referenceName: string = '', 
    dateStr: string = ''
  ) => {
    let msg = template || '';
    const cleanContactName = contactName.trim() || 'Prospect';
    const contactFirstName = cleanContactName.split(' ')[0] || cleanContactName;
    const cleanRefName = referenceName.trim();
    const refFirstName = cleanRefName.split(' ')[0] || '';

    // Se o template tem o nome de referência (usado na prévia da IA), substitui pelo nome do contato atual
    if (cleanRefName && cleanRefName !== cleanContactName && msg.includes(cleanRefName)) {
      msg = msg.split(cleanRefName).join(cleanContactName);
    } else if (refFirstName && refFirstName !== contactFirstName && msg.includes(refFirstName)) {
      msg = msg.split(refFirstName).join(contactFirstName);
    }

    // Substitui tags dinâmicas padrão {nome}, {primeiro_nome}, {data}, {horario}
    const formattedApptDate = dateStr ? formatSafeDate(dateStr) : '';
    const dateOnly = formattedApptDate ? formattedApptDate.split(' ')[0] : 'hoje';
    const timeOnly = formattedApptDate ? (formattedApptDate.split(' ')[1] || '19:00') : '19:00';

    return msg
      .replace(/{nome}/gi, cleanContactName)
      .replace(/{primeiro_nome}/gi, contactFirstName)
      .replace(/{data}/gi, dateOnly)
      .replace(/{horario}|{hora}/gi, timeOnly);
  };

  // Submissão do Formulário Principal (Individual ou Múltiplo)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const selectedProf = profissionais.find(p => p.id === profissionalId);
      const treatmentLabel = tipoDisparo === 'diversos'
        ? `Mensagem Avulsa: ${categoria}`
        : `${categoria} com ${selectedProf?.name.split(' - ')[0] || 'Líder'}`;

      const effectiveApptTime = (tipoDisparo === 'consulta' && horarioConsulta)
        ? formatIsoForBackend(horarioConsulta)
        : formatIsoForBackend(horarioMensagem);

      if (modoDestinatario === 'individual') {
        // Envio Individual
        const phoneValidation = getCleanE164Phone(telefone);
        if (!phoneValidation.valid) {
          alert(`⚠️ ${phoneValidation.error}`);
          setIsSubmitting(false);
          return;
        }

        const cleanPhone = phoneValidation.phone;
        const placeholder = "Preencha o formulário para visualizar como o texto final humanizado será estruturado pela IA.";
        const finalMessage = (previewText === placeholder || !previewText.trim())
          ? `Olá ${nome}, tudo bem? Passando para entrar em contato referente ao seu acompanhamento em ${categoria}. Como podemos ajudar?`
          : previewText;

        await api.post('/appointments', {
          patient_name: nome,
          patient_phone: cleanPhone,
          user_id: profissionalId,
          treatment: treatmentLabel,
          category: categoria,
          tipo_disparo: tipoDisparo,
          horario_consulta: effectiveApptTime,
          horario_mensagem: formatIsoForBackend(horarioMensagem),
          status_envio: 'Aguardando',
          ai_message_preview: finalMessage
        });

        // Aciona fila em segundo plano
        api.post('/cron').catch(() => {});

        alert(tipoDisparo === 'diversos'
          ? "✓ Mensagem avulsa programada com sucesso! O Anti-Ban e a rotação de chips já foram acionados."
          : "✓ Agendamento programado com sucesso! O Anti-Ban e a rotação de chips já foram acionados.");
        
        resetForm();
      } else {
        // Envio Múltiplo (Lista de Números)
        if (validContacts.length === 0) {
          alert("⚠️ Nenhum contato válido encontrado na lista. Cole pelo menos um telefone com DDD.");
          setIsSubmitting(false);
          return;
        }

        const placeholder = "Preencha o formulário para visualizar como o texto final humanizado será estruturado pela IA.";
        const baseMsg = (previewText === placeholder || !previewText.trim()) ? comando : previewText;
        const firstLeadName = validContacts[0]?.name || '';
        const effectiveDateStr = (tipoDisparo === 'consulta') ? (horarioConsulta || horarioMensagem) : '';

        const items = validContacts.map(c => ({
          name: c.name,
          phone: c.phone,
          user_id: profissionalId,
          treatment: treatmentLabel,
          category: categoria,
          tipo_disparo: tipoDisparo,
          horario_consulta: effectiveApptTime,
          horario_mensagem: formatIsoForBackend(horarioMensagem),
          ai_message_preview: personalizeMessageForContact(baseMsg, c.name, firstLeadName, effectiveDateStr)
        }));

        // Envia em chunks de 50 contatos para o backend
        const chunkSize = 50;
        let totalInserted = 0;

        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const res = await api.post('/appointments/bulk', { items: chunk });
          totalInserted += (res.data?.inserted || chunk.length);
        }

        // Aciona fila do cron
        api.post('/cron').catch(() => {});

        alert(`✓ Sucesso! ${totalInserted} contatos foram colocados na fila de disparo seguro.\n\n🛡️ O motor Anti-Ban vai distribuir os envios entre as instâncias da EvoGo (${evoInstances.join(', ')}) com intervalos humanos de 15 a 45 segundos.`);
        resetForm();
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      alert(`Erro ao programar disparos: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNome('');
    setTelefone('');
    setMultiInput('');
    setHorarioMensagem('');
    setHorarioConsulta('');
    setTipoDisparo('consulta');
    setComando(TEMPLATES.apn.text);
    setProfissionalId(profissionais[0]?.id || '');
    setCategoria(CATEGORIAS[0]);
    setPreviewText("Preencha o formulário para visualizar como o texto final humanizado será estruturado pela IA.");
    setWarningText(null);
  };

  // Download do Modelo CSV de Agendamento da Semana
  const handleDownloadTemplate = () => {
    const headers = "Nome do Prospect;WhatsApp;Data/Horario da APN;Data/Horario do Disparo;Líder;Objetivo;Mensagem\r\n";
    const sample1 = "Rodrigo Silva;5511999998888;10/10/2026 19:00;10/10/2026 14:00;Salésio Ninja;Apresentação APN;Olá Rodrigo, tudo bem? Passando para confirmar sua presença na APN de hoje!\r\n";
    const sample2 = "Camila Ferreira;5546999765576;11/10/2026 20:00;11/10/2026 09:00;Líder Diamante;Follow-up Go Pro;Olá Camila! Como está seu dia? Segue nosso material exclusivo da Atlântica Natural.\r\n";
    const csvContent = headers + sample1 + sample2;
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'modelo_prospects_atlantica.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseDateTimeToBackend = (dtStr: string): string => {
    if (!dtStr) return '';
    const trimmed = dtStr.trim();
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (brMatch) {
      const day = brMatch[1].padStart(2, '0');
      const month = brMatch[2].padStart(2, '0');
      const year = brMatch[3];
      const hr = (brMatch[4] || '19').padStart(2, '0');
      const min = (brMatch[5] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hr}:${min}:00`;
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      const hr = (isoMatch[4] || '19').padStart(2, '0');
      const min = (isoMatch[5] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hr}:${min}:00`;
    }
    return trimmed;
  };

  // Leitura e Pré-Visualização da Planilha
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) {
        alert("O arquivo selecionado está vazio.");
        return;
      }

      try {
        let delimiter = ';';
        if (text.includes('\t')) delimiter = '\t';
        else if (text.includes(';') && (text.match(/;/g)?.length || 0) >= (text.match(/,/g)?.length || 0)) delimiter = ';';
        else if (text.includes(',')) delimiter = ',';

        const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
        if (lines.length <= 1) {
          alert("Nenhum registro encontrado na planilha além do cabeçalho.");
          return;
        }

        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
        const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));
        
        const idxNome = findCol(['nome', 'lead', 'prospect', 'paciente', 'cliente', 'name']);
        const idxPhone = findCol(['whatsapp', 'telefone', 'celular', 'phone', 'contato', 'zap', 'tel']);
        const idxConsulta = findCol(['consulta', 'apn', 'reunião', 'horario da consulta', 'data consulta', 'horario apn']);
        const idxEnvio = findCol(['envio', 'disparo', 'horario do envio', 'data envio']);
        const idxMsg = findCol(['mensagem', 'comando', 'texto', 'recado', 'obs']);

        const parsedRows: ParsedContact[] = [];

        for (let i = 1; i < lines.length; i++) {
          const currentLine = lines[i];
          const values: string[] = [];
          let insideQuote = false;
          let entry = '';

          for (let c = 0; c < currentLine.length; c++) {
            const char = currentLine[c];
            if (char === '"') {
              insideQuote = !insideQuote;
            } else if (char === delimiter && !insideQuote) {
              values.push(entry.trim().replace(/^["']|["']$/g, ''));
              entry = '';
            } else {
              entry += char;
            }
          }
          values.push(entry.trim().replace(/^["']|["']$/g, ''));

          const getVal = (idx: number) => (idx >= 0 && idx < values.length) ? values[idx].trim() : '';

          const patName = getVal(idxNome) || 'Prospect';
          let rawPhoneDigits = getVal(idxPhone).replace(/\D/g, '');

          if (rawPhoneDigits.startsWith('55') && rawPhoneDigits.length >= 12) {
            // ok
          } else if (rawPhoneDigits.length === 10 || rawPhoneDigits.length === 11) {
            rawPhoneDigits = '55' + rawPhoneDigits;
          }

          if (rawPhoneDigits.length >= 12 && rawPhoneDigits.length <= 13) {
            parsedRows.push({
              name: patName,
              phone: rawPhoneDigits,
              original: currentLine,
              customConsulta: parseDateTimeToBackend(getVal(idxConsulta)),
              customEnvio: parseDateTimeToBackend(getVal(idxEnvio)),
              customMessage: getVal(idxMsg)
            });
          }
        }

        if (parsedRows.length === 0) {
          alert("Não foi possível identificar números válidos de telefone na planilha. Certifique-se de que há uma coluna com telefones (com DDD).");
          return;
        }

        setImportSpreadsheetData(parsedRows);
        setImportSummary(null);
        setIsImportModalOpen(true);
      } catch (err: any) {
        alert(`Falha ao ler planilha: ${err.message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  // Disparo em lote da planilha confirmada
  const handleConfirmSpreadsheetImport = async () => {
    if (importSpreadsheetData.length === 0) return;

    setIsImporting(true);
    setImportSummary(null);

    const total = importSpreadsheetData.length;
    setImportProgress({ current: 0, total });

    const selectedProf = profissionais.find(p => p.id === profissionalId);
    const treatmentLabel = tipoDisparo === 'diversos'
      ? `Mensagem Avulsa: ${categoria}`
      : `${categoria} com ${selectedProf?.name.split(' - ')[0] || 'Líder'}`;

    const effectiveApptTime = (tipoDisparo === 'consulta' && horarioConsulta)
      ? formatIsoForBackend(horarioConsulta)
      : formatIsoForBackend(horarioMensagem);

    const baseMsg = (previewText.includes("Preencha o formulário") || !previewText.trim()) ? comando : previewText;
    const firstRowName = importSpreadsheetData[0]?.name || '';

    const items = importSpreadsheetData.map(row => {
      const rawTemplate = (importUseFormCommand || !row.customMessage) ? baseMsg : row.customMessage;
      const rowApptTime = row.customConsulta || effectiveApptTime;
      return {
        name: row.name,
        phone: row.phone,
        user_id: profissionalId,
        treatment: treatmentLabel,
        category: categoria,
        tipo_disparo: tipoDisparo,
        horario_consulta: rowApptTime,
        horario_mensagem: row.customEnvio || formatIsoForBackend(horarioMensagem),
        ai_message_preview: personalizeMessageForContact(rawTemplate, row.name, firstRowName, rowApptTime)
      };
    });

    let successCount = 0;
    let failedCount = 0;
    const logs: string[] = [];
    const chunkSize = 50;

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      try {
        const res = await api.post('/appointments/bulk', { items: chunk });
        successCount += (res.data?.inserted || chunk.length);
        if (res.data?.failed) failedCount += res.data.failed;
        if (res.data?.errors && res.data.errors.length > 0) {
          logs.push(...res.data.errors);
        }
      } catch (err: any) {
        failedCount += chunk.length;
        logs.push(`Lote ${Math.floor(i / chunkSize) + 1}: ${err.message}`);
      }
      setImportProgress({ current: Math.min(i + chunkSize, total), total });
    }

    // Aciona a fila no background
    api.post('/cron').catch(() => {});

    setIsImporting(false);
    setImportSummary({
      success: successCount,
      failed: failedCount,
      log: logs
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header com ações de planilha e modelo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-lg">
            Atlântica Natural • Motor Anti-Ban
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mt-3 italic">Agenda de Disparos & APNs</h2>
          <p className="text-sm text-white/40 mt-1 uppercase tracking-widest font-semibold">
            Envio inteligente para múltiplos contatos e planilhas com rotação de chips.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="bg-white/5 hover:bg-white/10 text-emerald-400 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border border-emerald-500/20 flex items-center gap-2 active:scale-95"
            title="Baixar modelo de planilha CSV pronto para preencher"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Modelo CSV
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 border border-emerald-400/30 active:scale-95"
          >
            <Upload className="w-4 h-4" /> Importar Planilha (Massa)
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv, .tsv, .txt"
            className="hidden"
          />
        </div>
      </div>

      {/* Banner Informativo Anti-Ban & Multi-Chip */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900/40 border border-emerald-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Sistema Anti-Ban & Rotação Multi-Chip Ativo
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                24/7 Fila Ativa
              </span>
            </div>
            <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
              Disparos distribuídos em rodízio entre as instâncias <strong className="text-emerald-400">{evoInstances.join(' ⇄ ')}</strong> com intervalos humanos aleatórios de 15 a 45 seg.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400/80 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5 shrink-0">
          <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
          <span>{evoInstances.length} Chip{evoInstances.length > 1 ? 's' : ''} em Alternância</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 glass-card p-6 flex flex-col gap-5 border border-white/5 rounded-[32px]">
          
          {/* Seletor 1: Modalidade do Disparo (Consulta / Mensagem Avulsa) */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 gap-1">
            <button
              type="button"
              onClick={() => setTipoDisparo('consulta')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                tipoDisparo === 'consulta'
                  ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" /> Lembrete de APN / Reunião
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoDisparo('diversos');
                setHorarioConsulta('');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                tipoDisparo === 'diversos'
                  ? 'bg-emerald-600 text-white shadow-lg border border-emerald-400/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-200" /> Mensagem Avulsa / Follow-up
            </button>
          </div>

          {/* Seletor 2: Modo de Destinatários (Contato Único vs Múltiplos Contatos) */}
          <div className="bg-black/30 p-1.5 rounded-2xl border border-white/5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModoDestinatario('individual')}
              className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                modoDestinatario === 'individual'
                  ? 'bg-white/15 text-white shadow-sm border border-white/10'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <User className="w-3.5 h-3.5 text-indigo-400" /> Contato Único
            </button>

            <button
              type="button"
              onClick={() => setModoDestinatario('multiplo')}
              className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                modoDestinatario === 'multiplo'
                  ? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/30 font-black'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Múltiplos Contatos (Colar Lista)</span>
              {validContacts.length > 0 && (
                <span className="bg-emerald-500 text-black text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ml-1">
                  {validContacts.length}
                </span>
              )}
            </button>
          </div>

          {/* Seção de Entrada dos Contatos */}
          {modoDestinatario === 'individual' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5 text-indigo-400" /> Nome Completo *
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: João da Silva" 
                  value={nome} 
                  onChange={e => setNome(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white placeholder-white/20 outline-none focus:border-indigo-500 transition-colors" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp do Prospect *
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="(DDD) 99999-9999" 
                  value={telefone} 
                  onChange={e => setTelefone(formatPhoneInput(e.target.value))}
                  maxLength={16}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white placeholder-white/20 outline-none focus:border-indigo-500 transition-colors font-mono" 
                />
                <p className="text-[9px] text-emerald-400/60 mt-1">Ex: (46) 99976-5576. DDI (+55) automático.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" /> Colar Lista de Múltiplos Contatos *
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    validContacts.length > 0 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-white/5 text-white/40'
                  }`}>
                    {validContacts.length} contato{validContacts.length !== 1 ? 's' : ''} válido{validContacts.length !== 1 ? 's' : ''}
                  </span>
                  {invalidLines.length > 0 && (
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-500/30">
                      {invalidLines.length} inválido{invalidLines.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <textarea
                required
                rows={5}
                value={multiInput}
                onChange={e => setMultiInput(e.target.value)}
                placeholder={"Cole vários contatos, um por linha. Exemplos aceitos:\n(46) 99976-5576 - Rodrigo Silva\n5511999998888, Camila Santos\n47988887777\nLucas Pereira 11977776666"}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-3.5 text-xs text-white/90 placeholder-white/20 outline-none focus:border-emerald-500 transition-colors font-mono leading-relaxed resize-y"
              />

              {/* Prévia dos contatos identificados */}
              {validContacts.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[10px] text-white/40 mb-1.5 font-bold uppercase tracking-wider">
                    <span>Contatos detectados na lista:</span>
                    {validContacts.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllContactsPreview(!showAllContactsPreview)}
                        className="text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        {showAllContactsPreview ? 'Recolher' : `Ver todos (${validContacts.length})`}
                        {showAllContactsPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {(showAllContactsPreview ? validContacts : validContacts.slice(0, 5)).map((c, idx) => (
                      <span key={idx} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-mono">
                        <User className="w-3 h-3 text-emerald-400" />
                        <strong className="text-white font-sans">{c.name}</strong>: {c.phone}
                      </span>
                    ))}
                    {!showAllContactsPreview && validContacts.length > 5 && (
                      <span className="text-[10px] text-white/30 self-center pl-1 font-bold">
                        +{validContacts.length - 5} adicionais
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seleção de Profissional e Categoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <UserPlus className="w-3.5 h-3.5 text-indigo-400" /> Líder / Especialista Atlântica *
              </label>
              <select 
                required 
                value={profissionalId} 
                onChange={e => setProfissionalId(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors appearance-none"
              >
                {profissionais.map(p => <option key={p.id} value={p.id} className="bg-[#121214]">{p.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Tag className="w-3.5 h-3.5 text-purple-400" /> Categoria do Contato *
              </label>
              <select 
                required 
                value={categoria} 
                onChange={e => setCategoria(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors appearance-none"
              >
                {CATEGORIAS.map(c => <option key={c} value={c} className="bg-[#121214]">{c}</option>)}
              </select>
            </div>
          </div>

          {/* Horários */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Horário Inicial do Envio *
              </label>
              <input 
                type="datetime-local" 
                required 
                value={horarioMensagem} 
                onChange={e => {
                  const val = e.target.value;
                  setHorarioMensagem(val);
                  if (tipoDisparo === 'consulta' && !horarioConsulta) {
                    setHorarioConsulta(val);
                  }
                }}
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors" 
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Stethoscope className="w-3.5 h-3.5 text-sky-400" /> Horário da APN / Reunião {tipoDisparo === 'diversos' ? <span className="text-emerald-400/60 lowercase">(desativado para mensagens avulsas)</span> : <span className="text-white/20 lowercase">(opcional)</span>}
              </label>
              <input 
                type="datetime-local" 
                disabled={tipoDisparo === 'diversos'}
                value={horarioConsulta} 
                onChange={e => setHorarioConsulta(e.target.value)}
                className={`w-full border rounded-2xl px-4 py-3.5 text-xs transition-colors ${
                  tipoDisparo === 'diversos' 
                    ? 'bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-white/5 border-white/5 text-white outline-none focus:border-indigo-500'
                }`} 
              />
            </div>
          </div>

          {/* Templates e Comando Base para IA */}
          <div className="space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-emerald-400" /> Comando Base para a IA *
              </label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(TEMPLATES).map(([k, v]) => (
                  <button 
                    key={k} 
                    type="button" 
                    onClick={() => {
                      setComando(v.text);
                      setTipoDisparo(v.mode);
                      setCategoria(v.cat);
                      if (v.mode === 'diversos') setHorarioConsulta('');
                    }} 
                    className={`text-[9px] px-2.5 py-1 rounded-lg border uppercase font-bold transition-all ${
                      comando === v.text 
                        ? (v.mode === 'diversos' ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm' : 'bg-indigo-600 border-indigo-500 text-white shadow-sm')
                        : 'bg-white/5 hover:bg-white/10 text-white/60 border-white/5'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea 
              required 
              rows={3} 
              value={comando} 
              onChange={e => setComando(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white/80 outline-none focus:border-indigo-500 transition-colors resize-none italic"
            />

            {/* Tags Dinâmicas para Personalização */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[9px] text-white/30 uppercase font-bold tracking-wider mr-1">Inserir Tag:</span>
              <button
                type="button"
                onClick={() => handleInsertTag('{nome}')}
                className="text-[9px] bg-white/5 hover:bg-white/10 text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-mono transition-colors"
                title="Insere o nome completo de cada prospect"
              >
                + &#123;nome&#125;
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{primeiro_nome}')}
                className="text-[9px] bg-white/5 hover:bg-white/10 text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-mono transition-colors"
                title="Insere apenas o primeiro nome"
              >
                + &#123;primeiro_nome&#125;
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{data}')}
                className="text-[9px] bg-white/5 hover:bg-white/10 text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-mono transition-colors"
                title="Insere a data da APN"
              >
                + &#123;data&#125;
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{horario}')}
                className="text-[9px] bg-white/5 hover:bg-white/10 text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-mono transition-colors"
                title="Insere o horário da APN"
              >
                + &#123;horario&#125;
              </button>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex flex-wrap justify-end gap-3 mt-auto">
            <button 
              type="button" 
              onClick={resetForm} 
              className="bg-white/5 hover:bg-white/10 text-white/60 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 active:scale-95 border border-white/5"
            >
              <Eraser className="w-4 h-4" /> Limpar
            </button>

            {modoDestinatario === 'multiplo' ? (
              <button 
                type="submit" 
                disabled={isSubmitting || validContacts.length === 0} 
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-7 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 disabled:opacity-50 border border-emerald-400/30"
              >
                <Send className="w-4 h-4" /> 
                {isSubmitting 
                  ? 'Programando Lote...' 
                  : `DISPARAR PARA OS ${validContacts.length} CONTATOS (ANTI-BAN)`}
              </button>
            ) : tipoDisparo === 'diversos' ? (
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50 border border-emerald-400/30"
              >
                <Send className="w-4 h-4" /> {isSubmitting ? 'Programando...' : 'DISPARAR MENSAGEM AVULSA'}
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50 border border-indigo-400/30"
              >
                <CalendarCheck className="w-4 h-4" /> {isSubmitting ? 'Agendando...' : 'AGENDAR APN & DISPARO'}
              </button>
            )}
          </div>
        </form>

        {/* Live Preview Smartphone Mockup */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Simulação de WhatsApp Humanizado
          </span>

          {modoDestinatario === 'multiplo' && validContacts.length > 0 && (
            <div className="mb-3 text-[10px] bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/20 font-medium">
              Simulando para 1º da lista: <strong>{validContacts[0].name}</strong>
            </div>
          )}
          
          <div className="w-full max-w-[300px] h-[520px] bg-black border-[6px] border-zinc-800 rounded-[40px] relative overflow-hidden shadow-2xl flex flex-col">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-zinc-800 rounded-b-xl z-20 flex items-center justify-around px-4">
              <span className="w-1 h-1 rounded-full bg-black"></span>
              <span className="w-10 h-1 bg-black rounded-full"></span>
            </div>

            <div className="bg-[#075e54] pt-8 pb-3 px-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                  <User className="text-white/60 w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-tight truncate w-32">{previewLeadName}</h4>
                  <span className="text-[9px] text-white opacity-80 font-semibold">Assistente Atlântica IA</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Video className="w-4 h-4" />
                <Smartphone className="w-4 h-4" />
                <EllipsisVertical className="w-4 h-4" />
              </div>
            </div>

            <div className="flex-1 bg-[#0b141a] p-3 flex flex-col justify-end relative overflow-hidden">
              <div className="bg-[#005c4b] text-[11px] text-white p-3 rounded-lg rounded-tr-none self-end max-w-[85%] shadow-sm relative z-10 space-y-1">
                <div className="text-[9px] text-emerald-300 font-bold uppercase flex items-center gap-1 mb-1">
                  {isLoadingPreview ? <Clock className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  Texto Humanizado com Tags
                </div>
                <p className="leading-relaxed whitespace-pre-wrap break-words">{previewText}</p>
                <span className="text-[9px] text-white/60 block text-right mt-1">
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="h-12 bg-[#202c33] p-2 flex items-center gap-2 shrink-0">
              <div className="flex-1 bg-[#2a3942] rounded-full px-4 h-full flex items-center justify-between text-zinc-400 text-sm">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4" />
                  <span className="text-xs">Mensagem...</span>
                </div>
                <Paperclip className="w-4 h-4" />
              </div>
              <div className="bg-[#00a884] text-white w-8 h-8 rounded-full flex items-center justify-center">
                <Mic className="w-4 h-4" />
              </div>
            </div>
          </div>
          
          <div className="mt-6 px-6 text-center space-y-2">
            {warningText && (
              <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center shadow-sm">
                <p className="text-[10px] text-amber-300 font-medium leading-relaxed">⚠️ {warningText}</p>
              </div>
            )}
            <p className="text-[10px] text-white/30 font-medium">
              ⚡ Anti-Ban: intervalos aleatórios entre 15s e 45s programados por padrão.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Avançado de Importação de Planilha */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-white/10 rounded-[32px] p-6 max-w-2xl w-full shadow-2xl relative space-y-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Importação em Massa de Planilha</h3>
                  <p className="text-[10px] text-white/40 font-semibold uppercase tracking-widest">
                    Disparo com motor Anti-Ban e rotação multi-chip EvoGo
                  </p>
                </div>
              </div>
              {!isImporting && (
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="text-white/40 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {isImporting ? (
              <div className="py-12 text-center space-y-4 my-auto">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-spin">
                  <Loader2 className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Enviando Contatos para a Fila Anti-Ban...</p>
                  <p className="text-xs text-white/40 mt-1 font-mono">
                    Gravando {importProgress.current} de {importProgress.total} contatos
                  </p>
                </div>
                <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/5 max-w-md mx-auto">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            ) : importSummary ? (
              <div className="space-y-4 my-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-1" />
                    <span className="text-3xl font-black text-emerald-400">{importSummary.success}</span>
                    <p className="text-[10px] font-bold text-emerald-300/60 uppercase tracking-wider mt-0.5">Enfileirados com Sucesso</p>
                  </div>

                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-center">
                    <AlertCircle className="w-7 h-7 text-rose-400 mx-auto mb-1" />
                    <span className="text-3xl font-black text-rose-400">{importSummary.failed}</span>
                    <p className="text-[10px] font-bold text-rose-300/60 uppercase tracking-wider mt-0.5">Falhas / Ignorados</p>
                  </div>
                </div>

                <div className="bg-black/30 p-3 rounded-2xl border border-white/5 text-xs text-white/60 space-y-1">
                  <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Proteção Anti-Ban Iniciada:
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Os contatos entraram na fila <code>scheduled_dispatches</code>. O disparo será realizado em rodízio com intervalos humanos de 15s a 45s.
                  </p>
                </div>

                {importSummary.log.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Ocorrências:</label>
                    <div className="max-h-32 overflow-y-auto bg-black/40 border border-white/5 rounded-2xl p-3 text-xs text-white/60 space-y-1 font-mono">
                      {importSummary.log.map((item, idx) => (
                        <p key={idx} className="leading-tight text-rose-300/80">{item}</p>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg transition-all"
                >
                  Concluir e Voltar
                </button>
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-xs">
                  <span className="text-emerald-300 font-bold">
                    📊 Planilha identificou {importSpreadsheetData.length} contatos válidos!
                  </span>
                  <span className="text-[10px] text-white/40">DDI (+55) normalizado</span>
                </div>

                {/* Opções de mensagem */}
                <div className="bg-black/30 p-3 rounded-2xl border border-white/5 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80">
                    <input
                      type="checkbox"
                      checked={importUseFormCommand}
                      onChange={e => setImportUseFormCommand(e.target.checked)}
                      className="rounded bg-white/10 border-white/20 text-emerald-500 focus:ring-0"
                    />
                    <span>Aplicar o comando/texto da IA configurado no formulário atual para todos os contatos</span>
                  </label>
                </div>

                {/* Tabela de Preview */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">
                    Prévia dos Primeiros Contatos da Planilha:
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-white/5 rounded-2xl bg-black/20">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Nome</th>
                          <th className="p-2.5">WhatsApp</th>
                          <th className="p-2.5">Data APN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-white/70 font-mono text-[11px]">
                        {importSpreadsheetData.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="p-2.5 text-white/30">{idx + 1}</td>
                            <td className="p-2.5 font-sans font-bold text-white truncate max-w-[120px]">{row.name}</td>
                            <td className="p-2.5 text-emerald-400">{row.phone}</td>
                            <td className="p-2.5 text-white/50">{row.customConsulta || 'Conforme Formulário'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importSpreadsheetData.length > 10 && (
                    <p className="text-[10px] text-white/30 text-center pt-1 font-mono">
                      + {importSpreadsheetData.length - 10} outros contatos prontos para envio
                    </p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="bg-white/5 hover:bg-white/10 text-white/60 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors border border-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSpreadsheetImport}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all border border-emerald-400/30 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Confirmar e Disparar ({importSpreadsheetData.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
