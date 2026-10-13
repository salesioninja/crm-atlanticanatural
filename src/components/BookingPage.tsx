import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Clock, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  Calendar as CalendarIcon, 
  User, 
  Phone, 
  Mail, 
  CheckCircle2,
  ArrowLeft,
  Star,
  UserCheck,
  Ban,
  ShieldCheck,
  Check,
  MessageCircle,
  FileText,
  Stethoscope
} from 'lucide-react';
import { Appointment } from '../types';
import api from '../lib/api';

export interface ServiceItem {
  id: string;
  name: string;
  duration: string;
  price: string;
  rawPrice: number;
  description: string;
  specialistKey: string;
}

const SERVICES: ServiceItem[] = [
  { 
    id: 's1', 
    name: 'Apresentação de Negócios (APN 1 a 1) - Atlântica Natural', 
    duration: '45 min', 
    price: 'Gratuito', 
    rawPrice: 0,
    description: 'Apresentação completa do Plano de Carreira Atlântica Natural, 100% de margem no varejo, bônus unilevel e kits de adesão.',
    specialistKey: 'salesio'
  },
  { 
    id: 's2', 
    name: 'Demonstração de Produtos (Nutracêuticos & Linha Ozônio)', 
    duration: '40 min', 
    price: 'Gratuito', 
    rawPrice: 0,
    description: 'Apresentação detalhada da linha de alta demanda: Curcumina Ouro 95%, Ômegas, Chás SB, Perfumaria fina e Cosméticos ozonizados.',
    specialistKey: 'produtos'
  },
  { 
    id: 's3', 
    name: 'Sessão de Fechamento de Kit & Plano de 90 Dias', 
    duration: '30 min', 
    price: 'Gratuito', 
    rawPrice: 0,
    description: 'Tire todas as dúvidas sobre margens de lucro, escolha o Kit ideal (Bronze, Prata, Ouro ou Diamante) e trace metas de ganhos.',
    specialistKey: 'salesio'
  },
  { 
    id: 's4', 
    name: 'Mentoria de Início Rápido Go Pro (Novos Distribuidores)', 
    duration: '60 min', 
    price: 'Gratuito', 
    rawPrice: 0,
    description: 'Treinamento das 7 habilidades do Eric Worre: Lista de contatos, convite profissional, fechamento e duplicação rápida na rede.',
    specialistKey: 'diamante'
  }
];

export interface Professional {
  id: string;
  name: string;
  role: string;
  primarySpecialty: string;
  tags: string[];
  rating: number;
  reviewsCount: number;
  avatar: string;
  specialistKey: string;
}

// Líderes e Mentores Oficiais Atlântica Natural
const CANONICAL_SPECIALISTS: Professional[] = [
  {
    id: 'usr_357cbe1ddf129d8c', // Vinculado ao admin agencianinjamkd@gmail.com
    name: 'Salésio Ninja',
    role: 'Líder Executivo & Mentor MMN',
    primarySpecialty: 'Apresentação de Plano & Fechamento de Kits',
    tags: ['Liderança MMN', 'Go Pro', 'Vendas Diretas'],
    rating: 5.0,
    reviewsCount: 184,
    avatar: 'https://acessaronline.com.br/wp-content/uploads/2025/10/WhatsApp-Image-2025-10-24-at-15.08.46-270x300.jpeg',
    specialistKey: 'salesio'
  },
  {
    id: 'usr_diamante',
    name: 'Líder Diamante Atlântica',
    role: 'Mentor de Linha Ascendente',
    primarySpecialty: 'Desenvolvimento de Redes & Duplicação',
    tags: ['Carreira Royal', 'Plano 90 Dias', 'Bônus Unilevel'],
    rating: 4.9,
    reviewsCount: 142,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256',
    specialistKey: 'diamante'
  },
  {
    id: 'usr_produtos',
    name: 'Especialista em Nutracêuticos',
    role: 'Consultoria de Produtos & Saúde Natural',
    primarySpecialty: 'Curcumina, Ozônio e Linha Fitoterápica',
    tags: ['Nutracêuticos', 'Saúde Integrativa', 'Cosméticos'],
    rating: 4.9,
    reviewsCount: 97,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256&h=256',
    specialistKey: 'produtos'
  }
];

const AGENCY_SERVICES: ServiceItem[] = [
  { 
    id: 'a1', 
    name: 'Reunião de Diagnóstico de Vendas & IA', 
    duration: '30 min', 
    price: 'Gratuito', 
    rawPrice: 0,
    description: 'Sessão estratégica online para mapear gargalos de vendas, atendimento e desenhar a automação com Inteligência Artificial para sua empresa.',
    specialistKey: 'salesio'
  },
  { 
    id: 'a2', 
    name: 'Consultoria de Implantação de Agente IA & BioNinja', 
    duration: '45 min', 
    price: 'R$ 297', 
    rawPrice: 297,
    description: 'Planejamento e parametrização do seu Agente de IA para WhatsApp e estruturação da página BioNinja de alta conversão.',
    specialistKey: 'salesio'
  },
  { 
    id: 'a3', 
    name: 'Plaquinhas Inteligentes NFC Google & Avaliações', 
    duration: '30 min', 
    price: 'R$ 150', 
    rawPrice: 150,
    description: 'Apresentação e configuração das plaquinhas por aproximação NFC para multiplicar avaliações 5 estrelas no Google Meu Negócio.',
    specialistKey: 'salesio'
  },
  { 
    id: 'a4', 
    name: 'Outdoor Virtual Regional & Anúncios de Tráfego', 
    duration: '30 min', 
    price: 'R$ 350', 
    rawPrice: 350,
    description: 'Estratégia de anúncios geolocalizados de alto impacto para dominar a sua cidade e região no Google e Redes Sociais.',
    specialistKey: 'salesio'
  }
];

const AGENCY_SPECIALISTS: Professional[] = [
  {
    id: 'usr_agencianinja_admin',
    name: 'Prof. Salésio',
    role: 'Fundador & Especialista Comercial',
    primarySpecialty: 'Diagnóstico Comercial & Agentes de IA',
    tags: ['Estrategista Ninja', 'Agentes IA', 'Tráfego Local'],
    rating: 5.0,
    reviewsCount: 148,
    avatar: 'https://acessaronline.com.br/wp-content/uploads/2025/10/WhatsApp-Image-2025-10-24-at-15.08.46-270x300.jpeg',
    specialistKey: 'salesio'
  }
];

interface BookingPageProps {
  onBackToAdmin?: () => void;
  onConfirmBooking?: (apt: Appointment) => void;
  isPublicAccess?: boolean;
  tenantId?: string;
  tenantName?: string;
}

export default function BookingPage({ 
  onBackToAdmin, 
  onConfirmBooking, 
  isPublicAccess = false,
  tenantId: propTenantId,
  tenantName: propTenantName 
}: BookingPageProps) {
  const getActiveTenantId = () => {
    if (propTenantId) return propTenantId.toLowerCase().trim();
    const urlParams = new URLSearchParams(window.location.search);
    const qTenant = urlParams.get('tenant') || urlParams.get('tenant_id');
    if (qTenant) return qTenant.toLowerCase().trim();
    const sessionTenant = sessionStorage.getItem('tenant_id');
    if (sessionTenant) return sessionTenant.toLowerCase().trim();
    const host = window.location.hostname;
    const parts = host.split('.');
    if (parts.length > 1) {
      if (parts[0] === 'www' && parts.length > 2) {
        return parts[1].toLowerCase().trim();
      }
      return parts[0].toLowerCase().trim();
    }
    return 'acessaronline';
  };

  const activeTenant = getActiveTenantId();
  const isAgency = activeTenant === 'agencianinja';
  const availableServices = isAgency ? AGENCY_SERVICES : SERVICES;

  // Novo fluxo dinâmico:
  // Step 1: Especialista, Procedimento, Data e Horário (Tudo na 1ª tela!)
  // Step 2: Dados do Paciente e Confirmação
  // Step 3: Tela de Sucesso
  const [step, setStep] = useState(1);

  const getInitialDate = () => {
    const today = new Date();
    if (today.getDay() === 0) {
      today.setDate(today.getDate() + 1);
    }
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getQuickDates = () => {
    const list: { label: string; date: string }[] = [];
    const base = new Date();
    let count = 0;
    let offset = 0;

    while (count < 4 && offset < 14) {
      const target = new Date();
      target.setDate(base.getDate() + offset);
      if (target.getDay() !== 0) {
        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, '0');
        const d = String(target.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        let label = '';
        if (offset === 0) label = 'Hoje';
        else if (offset === 1) label = 'Amanhã';
        else {
          const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
          label = `${dayNames[target.getDay()]} (${d}/${m})`;
        }
        list.push({ label, date: dateStr });
        count++;
      }
      offset++;
    }
    return list;
  };

  const [selectedProfId, setSelectedProfId] = useState<string>(
    isAgency ? AGENCY_SPECIALISTS[0].id : CANONICAL_SPECIALISTS[0].id
  );
  const [selectedService, setSelectedService] = useState<string>(
    isAgency ? 'a1' : 's1'
  );
  const [selectedDate, setSelectedDate] = useState<string>(getInitialDate());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' });

  const [professionals, setProfessionals] = useState<Professional[]>(
    isAgency ? AGENCY_SPECIALISTS : CANONICAL_SPECIALISTS
  );
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar profissionais e agendamentos existentes do MySQL com sanitização rigorosa
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const profRes = await api.get('/users');
        if (Array.isArray(profRes.data) && profRes.data.length > 0) {
          const dbUsers = profRes.data;

          if (isAgency) {
            const mapped = dbUsers.map((u: any) => ({
              id: u.id,
              name: u.name || 'Prof. Salésio',
              role: u.role || 'Fundador & Especialista Comercial',
              primarySpecialty: u.role || 'Diagnóstico Comercial & Agentes de IA',
              tags: ['Estrategista Ninja', 'Agentes IA', 'Vendas'],
              rating: 5.0,
              reviewsCount: 148,
              avatar: u.avatar_url || 'https://acessaronline.com.br/wp-content/uploads/2025/10/WhatsApp-Image-2025-10-24-at-15.08.46-270x300.jpeg',
              specialistKey: 'salesio'
            }));
            setProfessionals(mapped);
            if (mapped.length > 0) {
              setSelectedProfId(mapped[0].id);
            }
          } else {
            const mappedProfessionals = CANONICAL_SPECIALISTS.map(canonical => {
              let matchedUser: any = null;

              if (canonical.specialistKey === 'eloiza') {
                matchedUser = dbUsers.find((u: any) => 
                  u.id === 'user_6a976a6a6b7ca' || 
                  u.id === 'usr_627b7cad1dcb182c' ||
                  u.id === 'p1' || 
                  (u.email && u.email.toLowerCase().includes('clinicaelofpo')) ||
                  (u.name && u.name.toLowerCase().includes('elo'))
                );
              } else if (canonical.specialistKey === 'salesio') {
                // Vincula explicitamente o Prof. Salésio ao admin agencianinjamkd@gmail.com
                matchedUser = dbUsers.find((u: any) => 
                  u.id === 'usr_357cbe1ddf129d8c' || 
                  (u.email && u.email.toLowerCase().includes('agencianinjamkd')) ||
                  (u.name && u.name.toLowerCase().includes('agencianinjamkd'))
                );
                if (!matchedUser) {
                  matchedUser = dbUsers.find((u: any) => u.id === 'usr_ninja_01');
                }
              } else if (canonical.specialistKey === 'marilia') {
                matchedUser = dbUsers.find((u: any) => 
                  u.id === 'p2' || 
                  (u.name && u.name.toLowerCase().includes('marilia'))
                );
              } else if (canonical.specialistKey === 'gisele') {
                matchedUser = dbUsers.find((u: any) => 
                  u.id === 'p3' || 
                  (u.name && u.name.toLowerCase().includes('gisele'))
                );
              } else if (canonical.specialistKey === 'psico') {
                matchedUser = dbUsers.find((u: any) => 
                  (u.role && u.role.toLowerCase().includes('psico')) || 
                  (u.name && u.name.toLowerCase().includes('psico'))
                );
              }

              return {
                ...canonical,
                id: matchedUser ? matchedUser.id : canonical.id,
                avatar: (matchedUser && matchedUser.avatar_url) ? matchedUser.avatar_url : canonical.avatar
              };
            });

            setProfessionals(mappedProfessionals);
            if (mappedProfessionals.length > 0 && !selectedProfId) {
              setSelectedProfId(mappedProfessionals[0].id);
            }
          }
        } else {
          setProfessionals(isAgency ? AGENCY_SPECIALISTS : CANONICAL_SPECIALISTS);
          setSelectedProfId(isAgency ? AGENCY_SPECIALISTS[0].id : CANONICAL_SPECIALISTS[0].id);
        }

        const aptRes = await api.get('/appointments');
        if (Array.isArray(aptRes.data)) {
          setExistingAppointments(aptRes.data);
        }
      } catch (err) {
        console.error("Erro ao carregar dados de agendamento:", err);
        setProfessionals(isAgency ? AGENCY_SPECIALISTS : CANONICAL_SPECIALISTS);
        setSelectedProfId(isAgency ? AGENCY_SPECIALISTS[0].id : CANONICAL_SPECIALISTS[0].id);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [activeTenant, isAgency]);

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // Horários de atendimento:
  // Segunda a Sexta: 07:00 às 19:00
  // Sábado: 07:00 às 12:00
  // Domingo: Fechado
  const getAvailableTimeSlotsForDate = (dateStr: string | null): string[] => {
    if (!dateStr) return [];
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = d.getDay(); // 0 = Domingo, 6 = Sábado

    if (dayOfWeek === 0) return [];
    if (dayOfWeek === 6) {
      return ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00'];
    }
    return [
      '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
      '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
    ];
  };

  // Trava de choques de horários com agendamentos existentes no banco de dados
  const getOccupiedTimeSlots = (dateStr: string, profId: string): string[] => {
    if (!dateStr) return [];
    const availableSlots = getAvailableTimeSlotsForDate(dateStr);
    const occupied: string[] = [];

    existingAppointments.forEach((apt: any) => {
      const rawTime = apt.horario_consulta || apt.appointment_time || '';
      if (!rawTime) return;

      const aptDate = rawTime.slice(0, 10);
      const statusCrm = apt.crm_status || apt.status_crm || '';

      if (statusCrm === 'Cancelado' || statusCrm === 'Faltou') return;

      if (aptDate === dateStr) {
        const aptProf = apt.user_id || apt.professional || '';
        
        // Verifica se o agendamento pertence ao profissional selecionado
        const isSameProf = !profId || !aptProf || aptProf === profId ||
          (profId === 'usr_agencianinja_admin' && (aptProf === 'usr_agencianinja_admin' || aptProf === 'usr_357cbe1ddf129d8c')) ||
          (profId === 'usr_357cbe1ddf129d8c' && (aptProf === 'usr_357cbe1ddf129d8c' || aptProf === 'usr_ninja_01')) ||
          (profId === 'user_6a976a6a6b7ca' && (aptProf === 'user_6a976a6a6b7ca' || aptProf === 'p1')) ||
          (profId === 'p2' && aptProf === 'p2') ||
          (profId === 'p3' && aptProf === 'p3');

        if (isSameProf) {
          const timePart = rawTime.slice(11, 16);
          const aptHour = timePart.slice(0, 2);

          availableSlots.forEach(slot => {
            const slotHour = slot.slice(0, 2);
            if (aptHour === slotHour || slot === timePart) {
              if (!occupied.includes(slot)) {
                occupied.push(slot);
              }
            }
          });
        }
      }
    });

    return occupied;
  };

  const currentAvailableSlots = selectedDate ? getAvailableTimeSlotsForDate(selectedDate) : [];
  const occupiedSlots = selectedDate ? getOccupiedTimeSlots(selectedDate, selectedProfId) : [];

  const currentProf = professionals.find(p => p.id === selectedProfId) || professionals[0];
  const currentService = availableServices.find(s => s.id === selectedService) || availableServices[0];

  // Quando troca o profissional, auto-seleciona o procedimento correspondente
  const handleSelectProfessional = (prof: Professional) => {
    setSelectedProfId(prof.id);
    const matchingService = availableServices.find(s => s.specialistKey === prof.specialistKey);
    if (matchingService) {
      setSelectedService(matchingService.id);
    }
  };

  const handleBooking = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    let realAptId = 'apt_' + Math.random().toString(36).substr(2, 9);

    try {
      const cleanPhone = formData.phone.replace(/\D/g, '');
      const patientsRes = await api.get('/patients');
      let patient = Array.isArray(patientsRes.data) 
        ? patientsRes.data.find((p: any) => p.phone && p.phone.replace(/\D/g, '') === cleanPhone) 
        : null;
      
      let patientId = '';

      if (!patient) {
        const newPatRes = await api.post('/patients', {
          name: formData.name,
          email: formData.email,
          phone: cleanPhone
        });
        patientId = newPatRes.data.id || ('pat_' + Math.random().toString(36).substr(2, 9));
      } else {
        patientId = patient.id;
      }

      const appointmentTime = `${selectedDate} ${selectedTime}:00`;
      
      const aptRes = await api.post('/appointments', {
        patient_id: patientId,
        user_id: selectedProfId || currentProf.id,
        professional: selectedProfId || currentProf.id,
        treatment: currentService?.name || 'Tratamento',
        treatment_command: currentService?.name || 'Tratamento',
        horario_consulta: appointmentTime,
        horario_mensagem: appointmentTime,
        status_envio: 'Aguardando',
        crm_status: 'Agendado'
      });

      if (aptRes.data && aptRes.data.id) {
        realAptId = aptRes.data.id;
      }
    } catch (err) {
      console.error("Falha ao salvar agendamento no servidor:", err);
    } finally {
      setIsSubmitting(false);
    }

    const newApt: Appointment = {
      id: realAptId,
      treatmentName: currentService?.name || 'Tratamento',
      clientName: formData.name,
      time: `${selectedDate} ${selectedTime} • ${formData.name}`,
      icon: 'Clock',
      type: 'primary'
    };

    if (onConfirmBooking) {
      onConfirmBooking(newApt);
    }
    nextStep();
  };

  const formatDateLabel = (dateStr: string | null) => {
    if (!dateStr) return 'Data a definir';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const isSundaySelected = selectedDate ? (new Date(selectedDate + 'T12:00:00').getDay() === 0) : false;
  const quickDates = getQuickDates();

  return (
    <div className="w-full min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8 font-sans relative selection:bg-indigo-500 selection:text-white">
      
      {/* Botão Voltar ao CRM (Exibido apenas dentro da recepção autenticada) */}
      {!isPublicAccess && onBackToAdmin && (
        <div className="w-full max-w-2xl mb-3">
          <button 
            onClick={onBackToAdmin}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl border border-white/10 shadow-sm"
          >
            <ArrowLeft size={14} /> Voltar ao Painel Administrativo
          </button>
        </div>
      )}

      {/* Card Principal Compacto (Estilo Imagem de Referência - Cabe Tudo em 1 Tela) */}
      <div className="w-full max-w-2xl bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        
        {/* Header Escuro Clean */}
        <div className="bg-slate-950 text-white p-5 sm:p-6 border-b border-slate-800 relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-400 text-[11px] font-extrabold uppercase tracking-widest">
              <CalendarIcon size={15} /> {isAgency ? 'SESSÃO ESTRATÉGICA & IA' : 'AGENDAMENTO DE CONSULTA'}
            </div>
            <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              Passo {step} de 2
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5">
            {isAgency ? 'Agende sua Sessão Estratégica' : 'Reserve sua Consulta'}
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            {isAgency ? 'Agência Ninja MKD • Atendimento Estratégico Online & Presencial' : 'Salto do Lontra - PR • Atendimento Presencial Especializado'}
          </p>

          {/* Stepper Compacto */}
          {step < 3 && (
            <div className="flex items-center gap-2 mt-4">
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
            </div>
          )}
        </div>

        {/* Corpo Interativo */}
        <div className="p-5 sm:p-7">
          <AnimatePresence mode="wait">
            
            {/* ETAPA 1: SELEÇÃO EM CAIXAS (ESPECIALISTA, PROCEDIMENTO, DATA E HORÁRIO NA MESMA TELA) */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                {/* 1. SELEÇÃO DO ESPECIALISTA (CAIXA / DROPDOWN) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <UserCheck size={15} className="text-indigo-600" /> {isAgency ? '1. Selecione o Especialista Comercial' : '1. Selecione o Especialista Clínico'}
                    </span>
                    <span className="text-[10px] text-indigo-600 font-semibold lowercase">
                      {professionals.length} especialistas
                    </span>
                  </label>
                  
                  <div className="relative">
                    <select
                      value={selectedProfId}
                      onChange={(e) => {
                        const prof = professionals.find(p => p.id === e.target.value);
                        if (prof) handleSelectProfessional(prof);
                      }}
                      className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-300 rounded-xl py-2.5 pl-3.5 pr-10 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer shadow-2xs appearance-none"
                    >
                      {professionals.map(prof => (
                        <option key={prof.id} value={prof.id}>
                          {prof.name} — {prof.primarySpecialty} (⭐ {prof.rating})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-3 text-slate-500 pointer-events-none" size={16} />
                  </div>

                  {/* Preview Compacto do Especialista Selecionado */}
                  <div className="mt-2 p-2.5 bg-indigo-50/40 rounded-xl border border-indigo-100/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img 
                        src={currentProf.avatar} 
                        alt={currentProf.name} 
                        className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0" 
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                      <div className="truncate">
                        <p className="font-bold text-xs text-slate-900 truncate leading-tight">{currentProf.name}</p>
                        <p className="text-[11px] text-indigo-700 truncate">{currentProf.primarySpecialty}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                      <Star size={10} className="fill-amber-400 text-amber-400" /> {currentProf.rating}
                    </span>
                  </div>
                </div>

                {/* 2. SELEÇÃO DO PROCEDIMENTO / TRATAMENTO (CAIXA / DROPDOWN) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {isAgency ? <Sparkles size={15} className="text-indigo-600" /> : <Stethoscope size={15} className="text-indigo-600" />} {isAgency ? '2. Selecione o Serviço / Consultoria' : '2. Selecione o Procedimento / Tratamento'}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {currentService.price}
                    </span>
                  </label>
                  
                  <div className="relative">
                    <select
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-300 rounded-xl py-2.5 pl-3.5 pr-10 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer shadow-2xs appearance-none"
                    >
                      {availableServices.map(srv => {
                        const isRec = currentProf && srv.specialistKey === currentProf.specialistKey;
                        return (
                          <option key={srv.id} value={srv.id}>
                            {srv.name} ({srv.duration}) — {srv.price} {isRec ? '★ [Indicado]' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-3 text-slate-500 pointer-events-none" size={16} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 pl-1 line-clamp-1 leading-snug">
                    {currentService.description}
                  </p>
                </div>

                {/* 3 & 4. DATA E HORÁRIOS (GRADE COMPACTA LADO A LADO) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 items-start">
                  
                  {/* Caixa 3: Data da Consulta */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <CalendarIcon size={15} className="text-indigo-600" /> {isAgency ? '3. Data da Reunião' : '3. Data da Consulta'}
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={selectedDate || ''}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedTime(null);
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer shadow-2xs"
                    />

                    {/* Atalhos Rápidos de Data */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {quickDates.map(qd => {
                        const isSel = selectedDate === qd.date;
                        return (
                          <button
                            key={qd.date}
                            type="button"
                            onClick={() => {
                              setSelectedDate(qd.date);
                              setSelectedTime(null);
                            }}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                              isSel 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-white'
                            }`}
                          >
                            {qd.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Caixa 4: Horários Disponíveis */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={15} className="text-indigo-600" /> 4. Horário Disponível
                      </label>
                      {occupiedSlots.length > 0 && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {occupiedSlots.length} ocupado(s)
                        </span>
                      )}
                    </div>

                    {isSundaySelected ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                        <p className="text-[11px] font-bold text-amber-800">Clínica fechada aos domingos.</p>
                        <p className="text-[10px] text-amber-700">Atendimento de Seg a Sáb.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {currentAvailableSlots.map(time => {
                          const isBooked = occupiedSlots.includes(time);
                          const isSel = selectedTime === time;

                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={isBooked}
                              onClick={() => setSelectedTime(time)}
                              title={isBooked ? 'Horário já reservado na agenda clínica' : 'Horário livre para agendamento'}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                                isBooked
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 line-through cursor-not-allowed opacity-60'
                                  : isSel
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-500'
                                    : 'bg-slate-50 border-slate-200 hover:border-indigo-400 hover:bg-white text-slate-700'
                              }`}
                            >
                              {!isBooked && (
                                <span className={`w-1 h-1 rounded-full ${isSel ? 'bg-white' : 'bg-emerald-500'}`}></span>
                              )}
                              <span>{time}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* BARRA INFERIOR DE RESUMO E AVANÇO (TUDO NA MESMA TELA) */}
                <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-left w-full sm:w-auto">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                      {selectedDate && selectedTime 
                        ? `${formatDateLabel(selectedDate)} às ${selectedTime} • ${currentProf.name}` 
                        : 'Selecione a data e o horário acima'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-slate-900">{currentService.price}</span>
                      <span className="text-[11px] text-slate-500 font-medium">({currentService.duration})</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedDate || !selectedTime || isSundaySelected}
                    onClick={nextStep}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Continuar para Identificação <ChevronRight size={15} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ETAPA 2: IDENTIFICAÇÃO DO PACIENTE */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <User className="text-emerald-600" size={17} /> 2. Identificação do Convidado / Prospect
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Preencha seus dados para confirmação do horário da apresentação:</p>
                  </div>
                  <button
                    type="button"
                    onClick={prevStep}
                    className="text-xs font-semibold text-emerald-600 hover:underline"
                  >
                    ← Alterar dados
                  </button>
                </div>

                <form onSubmit={handleBooking} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nome Completo *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: Maria da Silva"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        WhatsApp com DDD *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
                        <input 
                          required
                          type="tel" 
                          placeholder="Ex: 5546999998888"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Confirmação instantânea enviada no WhatsApp.
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        E-mail *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
                        <input 
                          required
                          type="email" 
                          placeholder="Ex: maria@email.com"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Observações ou Queixa (Opcional)
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
                      <textarea 
                        rows={2}
                        placeholder="Descreva brevemente sintomas, histórico ou observações importantes..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400 resize-none"
                        value={formData.notes}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Resumo da Consulta */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{currentProf.name} • {currentService.name}</p>
                      <p className="text-slate-500 text-[11px]">{formatDateLabel(selectedDate)} às {selectedTime}</p>
                    </div>
                    <span className="font-extrabold text-sm text-slate-900">{currentService.price}</span>
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span>Gravando e Sincronizando com a Agenda...</span>
                      ) : (
                        <>
                          <ShieldCheck size={16} /> Confirmar Agendamento Seguro
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ETAPA 3: SUCESSO */}
            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center"
              >
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm">
                  <CheckCircle2 size={36} strokeWidth={2.5} />
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">
                  Reunião / APN Confirmada!
                </h2>
                <p className="text-slate-500 text-xs max-w-sm mx-auto">
                  Olá <span className="font-bold text-slate-900">{formData.name}</span>, sua reunião de apresentação do plano / produtos com <span className="font-bold text-slate-900">{currentProf?.name}</span> foi registrada com sucesso!
                </p>

                <div className="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2.5 max-w-sm mx-auto text-xs">
                  <div className="flex justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-slate-500">Objetivo / Sessão:</span>
                    <span className="font-bold text-slate-900">{currentService?.name}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-slate-500">Líder / Apresentador:</span>
                    <span className="font-bold text-slate-900">{currentProf?.name}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-slate-500">Data:</span>
                    <span className="font-bold text-slate-900">{formatDateLabel(selectedDate)}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-slate-500">Horário:</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      {selectedTime}
                    </span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-slate-500">Investimento da Sessão:</span>
                    <span className="font-extrabold text-slate-900">{currentService?.price}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 mt-4 max-w-sm mx-auto">
                  <MessageCircle size={15} />
                  <span>Confirmação enviada para o WhatsApp ({formData.phone}).</span>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setSelectedTime(null);
                    setFormData({ name: '', email: '', phone: '', notes: '' });
                  }}
                  className="mt-6 inline-flex items-center justify-center py-2.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs tracking-wider uppercase transition-all shadow-sm"
                >
                  Realizar Outro Agendamento
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Rodapé Interno do Card */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-600" /> Agenda Sincronizada
          </span>
          <span>Atlântica Natural • Grupo ATL • Expansão Oficial</span>
        </div>
      </div>
    </div>
  );
}
