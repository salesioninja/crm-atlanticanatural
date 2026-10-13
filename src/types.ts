export type FunnelStage = 
  | 'Novo Lead'
  | 'Qualificação'
  | 'APN Enviada'
  | 'Follow-up / Objeções'
  | 'Fechamento / Kit'
  | 'Cadastrado'
  | 'Ativado (1º Pedido)'
  | 'Acompanhamento Futuro';

export type CrmStatus = 
  | FunnelStage
  | 'Novo Contato'
  | 'Agendado'
  | 'Confirmado'
  | 'Faltou'
  | 'Cancelado'
  | 'Alta/Concluído'
  | 'Alta';

export interface Prospect {
  id: string;
  name: string;
  nome?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  avatar: string;
  lastVisit?: string;
  status: 'Ativo' | 'Em Atendimento' | 'Pendente';
  bot_status?: 'active' | 'paused';
  perfil_interesse?: 'Consumidor' | 'Revendedor' | 'Lider_Rede';
  temperatura?: 'Frio' | 'Morno' | 'Quente';
  fase_funil?: FunnelStage;
  kit_interesse?: string;
  meta_renda?: string;
  origem?: string;
  patrocinador?: string;
  notas_qualificacao?: string;
  clinicalNotes?: string;
  crm_status?: CrmStatus;
  files?: Array<{ id: string; name: string; date: string; url: string; size: string }>;
  photos?: Array<{ id: string; type: string; date: string; url: string }>;
  responsibleProf?: string;
  patientSince?: string;
}

// Alias de retrocompatibilidade
export type Client = Prospect;

export interface ChatMessage {
  id: string;
  tenant_id: string;
  patient_id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  sender_name: 'Prospect' | 'IA' | 'Humano' | 'Paciente';
  created_at: string;
}

export interface Appointment {
  id: string;
  treatmentName: string;
  time: string;
  clientName: string;
  icon: string;
  type: 'primary' | 'secondary';
  link_reuniao?: string;
}

export interface CrmCard {
  id: string;
  tenant_id?: string;
  patient_id?: string;
  nome: string;
  telefone: string;
  professional: string;
  categoria: string;
  price?: number;
  pontos_pv?: number;
  perfil_interesse?: 'Consumidor' | 'Revendedor' | 'Lider_Rede';
  temperatura?: 'Frio' | 'Morno' | 'Quente';
  kit_interesse?: string;
  horarioConsulta: string;
  horarioMensagem: string;
  status_envio: 'Aguardando' | 'Enviado' | 'Falhou' | 'Processando' | 'Erro';
  crm_status: CrmStatus;
  aiMessagePreview?: string;
  treatment_command?: string;
  logs?: string;
  created_at?: string;
}

export interface Product {
  id: string;
  nome: string;
  linha: 'Nutracêuticos' | 'Linha Ozônio' | 'Chás Funcionais' | 'Perfumaria Fina' | 'Cosméticos';
  preco_cliente: number;
  preco_distribuidor: number;
  pontos_pv: number;
  descricao?: string;
  beneficios?: string;
  modo_uso?: string;
  link_loja?: string;
  ativo?: boolean;
}

export interface Kit {
  id: string;
  nome: string;
  valor: number;
  pontos_pv: number;
  lucro_estimado: number;
  itens_inclusos: string;
  beneficios: string;
  destaque?: boolean;
}

export type WhatsappConnectionState = 'open' | 'connecting' | 'close' | 'loading' | 'error';

export interface WhatsappStatusResponse {
  state: WhatsappConnectionState;
  instanceName?: string;
  status?: string;
  base64?: string;
  code?: string;
}
