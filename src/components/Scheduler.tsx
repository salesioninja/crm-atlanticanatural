import { useState, useEffect, useRef } from 'react';
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
  Download,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle
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

export default function Scheduler() {
  const [tipoDisparo, setTipoDisparo] = useState<'consulta' | 'diversos'>('consulta');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [horarioMensagem, setHorarioMensagem] = useState('');
  const [horarioConsulta, setHorarioConsulta] = useState('');
  const [comando, setComando] = useState(TEMPLATES.apn.text);
  const [profissionais, setProfissionais] = useState<{ id: string, name: string }[]>([]);
  const [profissionalId, setProfissionalId] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);

  const [previewText, setPreviewText] = useState("Preencha o formulário para visualizar como o texto final humanizado será estruturado pela IA.");
  const [warningText, setWarningText] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para Importação em Massa de Planilha
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importSummary, setImportSummary] = useState<{ success: number; failed: number; log: string[] } | null>(null);

  // Carregar profissionais da clínica dinamicamente
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
        console.error("Erro ao carregar profissionais:", err);
        setProfissionais(FALLBACK_PROFISSIONAIS);
        setProfissionalId(FALLBACK_PROFISSIONAIS[0].id);
      }
    };
    fetchProfissionais();
  }, []);

  const formatSafeDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Debounced API call for preview com AbortController para cancelamento de requisições pendentes
  useEffect(() => {
    if (!nome || !comando || !profissionalId) return;

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
          nome,
          dataConsulta: formattedDate,
          horarioMensagem: horarioMensagem ? formatSafeDate(horarioMensagem) : '',
          comando,
          categoria,
          profName,
          tipo
        }, { signal: controller.signal });
        
        setPreviewText(res.data.message);
        if (res.data.warning) {
          setWarningText(res.data.warning);
        } else {
          setWarningText(null);
        }
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          return;
        }
        console.error(err);
        const effectiveDateStr = (tipoDisparo === 'consulta') ? (horarioConsulta || horarioMensagem) : '';
        const dataStr = effectiveDateStr ? ` agendada para ${formatSafeDate(effectiveDateStr)}` : '';
        const cmdLower = comando.toLowerCase();
        const catLower = categoria.toLowerCase();
        let fallback = `Olá ${nome}, tudo bem? Entramos em contato referente ao seu acompanhamento em ${categoria}${dataStr}. Como podemos lhe auxiliar?`;
        if (cmdLower.includes('aniversár') || cmdLower.includes('aniversar') || cmdLower.includes('parabén') || cmdLower.includes('parabens')) {
          fallback = `Olá ${nome}, tudo bem? A equipe da nossa clínica deseja a você um Feliz Aniversário, com muita saúde, paz e realizações neste novo ciclo!`;
        } else if (cmdLower.includes('agradec') || cmdLower.includes('obrigad')) {
          fallback = `Olá ${nome}, tudo bem? Agradecemos pela sua confiança em nosso trabalho e na clínica. Permanecemos à disposição para cuidar da sua saúde e bem-estar.`;
        } else if (cmdLower.includes('promoç') || cmdLower.includes('promoc') || cmdLower.includes('desconto')) {
          fallback = `Olá ${nome}, tudo bem? ${comando}. Caso deseje mais detalhes ou queira agendar seu horário, estamos à disposição.`;
        } else if (cmdLower.includes('convite') || cmdLower.includes('retornar') || cmdLower.includes('retorno')) {
          fallback = `Olá ${nome}, tudo bem? Entramos em contato para verificar como você tem se sentido e lembrar da importância da continuidade do seu tratamento de saúde. Como está sua agenda para marcarmos seu retorno nesta semana?`;
        } else if (cmdLower.includes('conscienti') || cmdLower.includes('regularidade') || cmdLower.includes('preven') || catLower.includes('conscienti')) {
          fallback = `Olá ${nome}, tudo bem? Cuidar da postura e da saúde articular de forma preventiva é a forma mais eficaz de evitar dores e manter sua qualidade de vida. Nossa clínica permanece à sua disposição.`;
        } else if (comando && !comando.toLowerCase().includes('sugira')) {
          fallback = `Olá ${nome}, tudo bem? ${comando}. Caso tenha dúvidas ou precise agendar, estamos à disposição.`;
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
  }, [nome, horarioConsulta, horarioMensagem, comando, profissionalId, categoria, tipoDisparo]);

  const formatPhoneInput = (val: string) => {
    let digits = val.replace(/\D/g, '');
    // Se colou com 55 e tem 12 ou 13 dígitos, remove o 55 inicial para aplicar a máscara padrão
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2);
    }
    // Trava em no máximo 11 dígitos (DDD + 9 dígitos)
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
    let digits = val.replace(/\D/g, '');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const phoneValidation = getCleanE164Phone(telefone);
      if (!phoneValidation.valid) {
        alert(`⚠️ ${phoneValidation.error}`);
        setIsSubmitting(false);
        return;
      }
      const cleanPhone = phoneValidation.phone;
      let patientId = '';

      try {
        const searchRes = await api.get('/patients?phone=' + cleanPhone);
        if (Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          const matched = searchRes.data.find((p: any) => p.phone && p.phone.replace(/\D/g, '') === cleanPhone);
          if (matched) patientId = matched.id;
        }
      } catch (e) {}

      if (!patientId) {
        const newPatientRes = await api.post('/patients', {
          name: nome,
          phone: cleanPhone,
          email: `${nome.toLowerCase().replace(/\s+/g, '')}@exemplo.com`,
          crm_status: 'Agendado'
        });
        patientId = newPatientRes.data.id;
      }

      const selectedProf = profissionais.find(p => p.id === profissionalId);
      const placeholder = "Preencha o formulário para visualizar como o texto final humanizado será estruturado pela IA.";
      const finalMessage = previewText === placeholder 
        ? (tipoDisparo === 'diversos' 
            ? `Olá ${nome}, tudo bem? Passando para entrar em contato referente ao seu acompanhamento na clínica. Como podemos ajudar?`
            : `Olá ${nome}, tudo bem? Passando para entrar em contato referente ao seu acompanhamento em ${categoria}. Como podemos ajudar?`)
        : previewText;

      const formatIsoForBackend = (dtStr: string) => {
        if (!dtStr) return '';
        const clean = dtStr.replace('T', ' ');
        return clean.length === 16 ? `${clean}:00` : clean;
      };

      const treatmentLabel = tipoDisparo === 'diversos'
        ? `Mensagem Avulsa: ${categoria}`
        : `${categoria} com ${selectedProf?.name.split(' - ')[0]}`;

      const effectiveApptTime = (tipoDisparo === 'consulta' && horarioConsulta)
        ? formatIsoForBackend(horarioConsulta)
        : formatIsoForBackend(horarioMensagem);

      await api.post('/appointments', {
        patient_id: patientId,
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

      // Dispara a fila do WhatsApp imediatamente em background
      api.post('/cron').catch(() => {});

      alert(tipoDisparo === 'diversos'
        ? "✓ Mensagem avulsa programada com sucesso! O disparo já foi acionado para o WhatsApp."
        : "✓ Agendamento programado com sucesso! O disparo já foi acionado para o WhatsApp.");
      resetForm();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      alert(`Erro ao agendar envio: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNome('');
    setTelefone('');
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
    const headers = "Nome do Prospect;WhatsApp;Data/Horario da APN;Data/Horario do Disparo;Líder;Objetivo;Comando IA\r\n";
    const sample1 = "Rodrigo Silva;5511999998888;10/10/2026 19:00;10/10/2026 14:00;Salésio Ninja;Apresentação APN;Confirmar presença na APN online sobre o Plano Atlântica Natural.\r\n";
    const sample2 = "Camila Ferreira;5511988887777;11/10/2026 15:00;11/10/2026 09:00;Líder Diamante;Follow-up de Fechamento;Follow-up após assistir o vídeo do Plano de 90 dias e tirar dúvidas do Kit Bronze ou Ouro.\r\n";
    const csvContent = headers + sample1 + sample2;
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'modelo_prospects_semana.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseDateTimeToBackend = (dtStr: string): string => {
    if (!dtStr) return '';
    const trimmed = dtStr.trim();
    // Formato BR: DD/MM/YYYY HH:mm
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (brMatch) {
      const day = brMatch[1].padStart(2, '0');
      const month = brMatch[2].padStart(2, '0');
      const year = brMatch[3];
      const hr = (brMatch[4] || '08').padStart(2, '0');
      const min = (brMatch[5] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hr}:${min}:00`;
    }
    // Formato ISO: YYYY-MM-DD HH:mm ou YYYY-MM-DDTHH:mm
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      const hr = (isoMatch[4] || '08').padStart(2, '0');
      const min = (isoMatch[5] || '00').padStart(2, '0');
      return `${year}-${month}-${day} ${hr}:${min}:00`;
    }
    return trimmed;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportModalOpen(true);
    setIsImporting(true);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) {
        setIsImporting(false);
        setImportSummary({ success: 0, failed: 0, log: ['Arquivo vazio.'] });
        return;
      }

      try {
        const delimiter = text.includes(';') ? ';' : ',';
        const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
        if (lines.length <= 1) {
          setIsImporting(false);
          setImportSummary({ success: 0, failed: 0, log: ['Nenhum registro encontrado na planilha.'] });
          return;
        }

        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
        
        // Mapear índices dos cabeçalhos
        const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));
        
        const idxNome = findCol(['nome', 'paciente', 'client']);
        const idxPhone = findCol(['whatsapp', 'telefone', 'contato', 'celular', 'phone']);
        const idxConsulta = findCol(['consulta', 'horario da consulta', 'data consulta']);
        const idxEnvio = findCol(['envio', 'disparo', 'horario do envio', 'mensagem']);
        const idxProf = findCol(['profissional', 'doutor', 'medico', 'prof']);
        const idxCat = findCol(['categoria', 'procedimento', 'tratamento', 'servico']);
        const idxCmd = findCol(['comando', 'ia', 'lembrete', 'texto']);

        let successCount = 0;
        let failedCount = 0;
        const logs: string[] = [];
        const total = lines.length - 1;
        setImportProgress({ current: 0, total });

        for (let i = 1; i < lines.length; i++) {
          setImportProgress({ current: i, total });
          const currentLine = lines[i];

          // Parse de campos com aspas
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

          const patName = getVal(idxNome);
          let rawPhoneDigits = getVal(idxPhone).replace(/\D/g, '');
          if (rawPhoneDigits.startsWith('55') && rawPhoneDigits.length >= 12) {
            // Já possui DDI 55
          } else if (rawPhoneDigits.length === 10 || rawPhoneDigits.length === 11) {
            rawPhoneDigits = '55' + rawPhoneDigits;
          }

          if (!patName || !rawPhoneDigits || rawPhoneDigits.length < 12 || rawPhoneDigits.length > 13) {
            failedCount++;
            logs.push(`Linha ${i}: Número inválido (${getVal(idxPhone)}). Deve conter DDD + número com 10 ou 11 dígitos.`);
            continue;
          }
          const patPhone = rawPhoneDigits;

          const rawConsulta = getVal(idxConsulta);
          const rawEnvio = getVal(idxEnvio);
          const rawProf = getVal(idxProf);
          const rawCat = getVal(idxCat) || 'Apresentação APN';
          const rawCmd = getVal(idxCmd) || TEMPLATES.apn.text;

          const formattedConsulta = parseDateTimeToBackend(rawConsulta);
          let formattedEnvio = parseDateTimeToBackend(rawEnvio);

          // Se não informado o envio, calcula 24h antes da consulta ou agora
          if (!formattedEnvio && formattedConsulta) {
            const d = new Date(formattedConsulta.replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
              d.setDate(d.getDate() - 1);
              const yr = d.getFullYear();
              const mo = String(d.getMonth() + 1).padStart(2, '0');
              const dy = String(d.getDate()).padStart(2, '0');
              const hr = String(d.getHours()).padStart(2, '0');
              const mn = String(d.getMinutes()).padStart(2, '0');
              formattedEnvio = `${yr}-${mo}-${dy} ${hr}:${mn}:00`;
            }
          }

          if (!formattedEnvio) {
            const now = new Date();
            now.setHours(now.getHours() + 1);
            formattedEnvio = now.toISOString().slice(0, 19).replace('T', ' ');
          }

          // Encontrar ID do profissional
          let targetProfId = profissionalId || 'p1';
          if (rawProf) {
            const matchedProf = profissionais.find(p => p.name.toLowerCase().includes(rawProf.toLowerCase()));
            if (matchedProf) targetProfId = matchedProf.id;
          }

          try {
            // 1. Encontrar ou criar paciente
            let patientId = '';
            try {
              const pRes = await api.get('/patients?phone=' + patPhone);
              if (Array.isArray(pRes.data) && pRes.data.length > 0) {
                const matched = pRes.data.find((p: any) => p.phone && p.phone.replace(/\D/g, '') === patPhone);
                if (matched) patientId = matched.id;
              }
            } catch (e) {}

            if (!patientId) {
              const newPRes = await api.post('/patients', {
                name: patName,
                phone: patPhone,
                email: `${patName.toLowerCase().replace(/\s+/g, '')}@exemplo.com`,
                crm_status: 'Agendado'
              });
              patientId = newPRes.data.id;
            }

            // 2. Criar agendamento
            const profObj = profissionais.find(p => p.id === targetProfId);
            const treatmentLabel = `${rawCat} com ${profObj?.name.split(' - ')[0] || 'Profissional'}`;
            
            await api.post('/appointments', {
              patient_id: patientId,
              patient_name: patName,
              patient_phone: patPhone,
              user_id: targetProfId,
              treatment: treatmentLabel,
              category: rawCat,
              horario_consulta: formattedConsulta,
              horario_mensagem: formattedEnvio,
              status_envio: 'Aguardando',
              ai_message_preview: `Olá ${patName}, tudo bem? Passando para lembrar sobre seu atendimento de ${rawCat}. Como podemos ajudar?`
            });

            successCount++;
          } catch (err: any) {
            failedCount++;
            logs.push(`Linha ${i} (${patName}): Erro - ${err.message}`);
          }
        }

        setImportSummary({
          success: successCount,
          failed: failedCount,
          log: logs
        });
      } catch (err: any) {
        setImportSummary({
          success: 0,
          failed: 1,
          log: [`Falha crítica ao ler CSV: ${err.message}`]
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-lg">
            Agência Ninja
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mt-3 italic">Novo Agendamento Clínico</h2>
          <p className="text-sm text-white/40 mt-1 uppercase tracking-widest font-semibold">Programe o envio inteligente e gerencie lembretes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="bg-white/5 hover:bg-white/10 text-emerald-400 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all border border-emerald-500/20 flex items-center gap-2 active:scale-95"
            title="Baixar planilha modelo CSV para preencher a semana"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Modelo CSV
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 border border-emerald-400/30 active:scale-95"
          >
            <Upload className="w-4 h-4" /> Importar Planilha da Semana
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Formulário */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 glass-card p-6 flex flex-col gap-5 border border-white/5 rounded-[32px]">
          
          {/* Seletor de Modalidade de Disparo */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 gap-1 mb-1">
            <button
              type="button"
              onClick={() => {
                setTipoDisparo('consulta');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                tipoDisparo === 'consulta'
                  ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" /> Lembrete de Consulta
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
              <MessageSquare className="w-3.5 h-3.5 text-emerald-200" /> Mensagem Avulsa / Diversa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Nome Completo *
              </label>
              <input 
                type="text" 
                required 
                placeholder="Ex: Ana Maria Silva" 
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
              <p className="text-[9px] text-emerald-400/60 mt-1">Ex: (46) 99976-5576. O DDI (+55) é adicionado automaticamente.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <UserPlus className="w-3.5 h-3.5 text-indigo-400" /> Profissional Clínico *
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
                <Tag className="w-3.5 h-3.5 text-purple-400" /> Categoria da Consulta *
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Horário do Envio *
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
                <Stethoscope className="w-3.5 h-3.5 text-sky-400" /> Horário da Consulta {tipoDisparo === 'diversos' ? <span className="text-emerald-400/60 lowercase">(desativado para mensagens avulsas)</span> : <span className="text-white/20 lowercase">(opcional)</span>}
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
              rows={4} 
              value={comando} 
              onChange={e => setComando(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white/80 outline-none focus:border-indigo-500 transition-colors resize-none italic"
            />
          </div>

          <div className="pt-2 flex flex-wrap justify-end gap-3 mt-auto">
            <button 
              type="button" 
              onClick={resetForm} 
              className="bg-white/5 hover:bg-white/10 text-white/60 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 active:scale-95 border border-white/5"
            >
              <Eraser className="w-4 h-4" /> Limpar
            </button>

            {tipoDisparo === 'diversos' ? (
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
                <CalendarCheck className="w-4 h-4" /> {isSubmitting ? 'Agendando...' : 'AGENDAR CONSULTA & DISPARO'}
              </button>
            )}
          </div>
        </form>

        {/* Live Preview Smartphone Mockup */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Live Preview
          </span>
          
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
                  <h4 className="text-xs font-bold leading-tight truncate w-32">{nome || "Prospect"}</h4>
                  <span className="text-[9px] text-white opacity-80 font-semibold">Assistente IA</span>
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
                  Simulação do Agente GPT
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
          
          <div className="mt-8 px-6 text-center space-y-2">
            {warningText && (
              <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center shadow-sm">
                <p className="text-[10px] text-amber-300 font-medium leading-relaxed">⚠️ {warningText}</p>
              </div>
            )}
            <p className="text-[10px] text-white/20">Predictive Preview Engine uses Gemini to simulate carrier message formatting.</p>
          </div>
        </div>
      </div>

      {/* Modal de Progresso e Resultado da Importação */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-white/10 rounded-[32px] p-6 max-w-lg w-full shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Importação de Planilha</h3>
                  <p className="text-[10px] text-white/40 font-semibold uppercase tracking-widest">Processando agendamentos da semana</p>
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
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto animate-spin">
                  <Loader2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Importando Agendamentos...</p>
                  <p className="text-xs text-white/40 mt-1">
                    Processando registro {importProgress.current} de {importProgress.total}
                  </p>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            ) : importSummary && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <span className="text-2xl font-black text-emerald-400">{importSummary.success}</span>
                    <p className="text-[10px] font-bold text-emerald-300/60 uppercase tracking-wider mt-0.5">Agendados com Sucesso</p>
                  </div>

                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-center">
                    <AlertCircle className="w-6 h-6 text-rose-400 mx-auto mb-1" />
                    <span className="text-2xl font-black text-rose-400">{importSummary.failed}</span>
                    <p className="text-[10px] font-bold text-rose-300/60 uppercase tracking-wider mt-0.5">Falhas / Incompletos</p>
                  </div>
                </div>

                {importSummary.log.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Relatório de Ocorrências:</label>
                    <div className="max-h-36 overflow-y-auto bg-black/40 border border-white/5 rounded-2xl p-3 text-xs text-white/60 space-y-1 font-mono">
                      {importSummary.log.map((item, idx) => (
                        <p key={idx} className="leading-tight">{item}</p>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg transition-all"
                >
                  Concluir e Ver Agendamentos
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
