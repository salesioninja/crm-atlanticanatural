import { Prospect, Appointment, Product, Kit } from './types';

export const MOCK_CLIENTS: Prospect[] = [
  {
    id: '1',
    name: 'Rodrigo Silva',
    email: 'rodrigo.invest@email.com',
    phone: '+55 46 99911-2233',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    lastVisit: 'Hoje, 15:30',
    status: 'Ativo',
    perfil_interesse: 'Lider_Rede',
    temperatura: 'Quente',
    fase_funil: 'Follow-up / Objeções',
    kit_interesse: 'Kit Empreendedor Prata',
    meta_renda: 'R$ 5.000 a R$ 10.000/mês',
    origem: 'Instagram (@agencia.ninja.mkd)',
    patrocinador: 'Professor Salésio',
    notas_qualificacao: 'Já atuou com vendas diretas e tem rede de contatos forte. Adorou a margem de 100% de lucro. Quer alinhar estratégias de expansão de equipe.',
    clinicalNotes: 'Já atuou com vendas diretas e tem rede de contatos forte. Adorou a margem de 100% de lucro.',
    files: [
      { id: 'f1', name: 'Plano_Carreira_Atlantica_2026.pdf', date: '10/10/2026', url: '#', size: '2.4 MB' }
    ],
    photos: []
  },
  {
    id: '2',
    name: 'Camila Ferreira',
    email: 'camila.estetica@email.com',
    phone: '+55 46 99887-7665',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    lastVisit: 'Hoje, 11:20',
    status: 'Em Atendimento',
    perfil_interesse: 'Revendedor',
    temperatura: 'Quente',
    fase_funil: 'Fechamento / Kit',
    kit_interesse: 'Kit Adesão R$ 79,90',
    meta_renda: 'R$ 2.000 a R$ 3.000/mês',
    origem: 'Indicação',
    patrocinador: 'Professor Salésio',
    notas_qualificacao: 'Proprietária de clínica de estética. Quer revender Colágeno Verisol e Óleo Ozonizado diretamente para suas clientes.',
    clinicalNotes: 'Proprietária de clínica de estética. Quer revender Colágeno Verisol e Óleo Ozonizado.',
    files: [],
    photos: []
  },
  {
    id: '3',
    name: 'Marcos Aurélio',
    email: 'marcos.a@gmail.com',
    phone: '+55 11 98765-4321',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    lastVisit: 'Ontem',
    status: 'Pendente',
    perfil_interesse: 'Consumidor',
    temperatura: 'Morno',
    fase_funil: 'Abordagem & Qualificação' as any,
    kit_interesse: 'Curcumina Ouro + Ômega 3',
    meta_renda: 'Consumo Próprio',
    origem: 'WhatsApp Direto',
    patrocinador: 'Professor Salésio',
    notas_qualificacao: 'Relatou fortes dores na coluna lombar e joelho. Quer saber se a Curcumina Ouro realmente substitui anti-inflamatórios convencionais.',
    clinicalNotes: 'Dores articulares severas na coluna e joelhos. Foco em alívio natural.',
    files: [],
    photos: []
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'a1',
    treatmentName: 'Apresentação de Negócio (APN Online)',
    time: 'Hoje, 19:30 • Rodrigo Silva',
    clientName: 'Rodrigo Silva',
    icon: 'TrendingUp',
    type: 'primary',
    link_reuniao: 'https://meet.google.com/atl-mmn-pro'
  },
  {
    id: 'a2',
    treatmentName: 'Alinhamento de Início Rápido (48 Horas)',
    time: 'Amanhã, 14:00 • Camila Ferreira',
    clientName: 'Camila Ferreira',
    icon: 'Sparkles',
    type: 'secondary',
    link_reuniao: 'https://meet.google.com/atl-start-48h'
  }
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod_curcumina',
    nome: 'Curcumina Ouro Anti-inflamatória',
    linha: 'Nutracêuticos',
    preco_cliente: 131.98,
    preco_distribuidor: 65.99,
    pontos_pv: 45,
    descricao: 'Extrato concentrado de curcumina com pimenta preta para absorção máxima.',
    beneficios: 'Alívio rápido de dores articulares, artrite, artrose e ação antioxidante celular.'
  },
  {
    id: 'prod_omega3',
    nome: 'Ômega 3 Ultra Concentrado',
    linha: 'Nutracêuticos',
    preco_cliente: 119.98,
    preco_distribuidor: 59.99,
    pontos_pv: 40,
    descricao: 'Óleo de peixe de águas profundas purificado com alto EPA e DHA.',
    beneficios: 'Proteção cardiovascular, memória, foco e controle de triglicerídeos.'
  },
  {
    id: 'prod_colageno',
    nome: 'Colágeno Verisol com Ácido Hialurônico',
    linha: 'Nutracêuticos',
    preco_cliente: 142.98,
    preco_distribuidor: 71.49,
    pontos_pv: 50,
    descricao: 'Peptídeos bioativos de colágeno específicos para derme humana.',
    beneficios: 'Redução de rugas, elasticidade e firmeza da pele, unhas e cabelos.'
  },
  {
    id: 'prod_ozonio',
    nome: 'Óleo Ozonizado Terapêutico Girassol',
    linha: 'Linha Ozônio',
    preco_cliente: 89.98,
    preco_distribuidor: 44.99,
    pontos_pv: 30,
    descricao: 'Óleo vegetal puro enriquecido com oxigênio ativo medicinal.',
    beneficios: 'Ação cicatrizante, germicida, fungicida e regenerador de pele.'
  },
  {
    id: 'prod_chasb',
    nome: 'Chá SB Turbo Detox Emagrecedor',
    linha: 'Chás Funcionais',
    preco_cliente: 69.98,
    preco_distribuidor: 34.99,
    pontos_pv: 25,
    descricao: 'Blend exclusivo de ervas diuréticas e digestivas.',
    beneficios: 'Acelera metabolismo, elimina retenção hídrica e alivia inchaço.'
  },
  {
    id: 'prod_empire',
    nome: 'Perfume Empire Royal 100ml',
    linha: 'Perfumaria Fina',
    preco_cliente: 153.98,
    preco_distribuidor: 76.99,
    pontos_pv: 50,
    descricao: 'Fragrância amadeirada marcante com 33% de essência pura.',
    beneficios: 'Fixação 24 horas comprovada e presença marcante inconfundível.'
  }
];

export const MOCK_KITS: Kit[] = [
  {
    id: 'kit_adesao',
    nome: 'Kit Adesão Inicial',
    valor: 79.90,
    pontos_pv: 40,
    lucro_estimado: 79.90,
    itens_inclusos: 'R$ 79,90 em produtos à escolha + Escritório Virtual',
    beneficios: '100% de margem no lucro + Acesso imediato à plataforma'
  },
  {
    id: 'kit_bronze',
    nome: 'Kit Start Bronze',
    valor: 399.00,
    pontos_pv: 200,
    lucro_estimado: 399.00,
    itens_inclusos: 'Mix de Nutracêuticos (Curcumina, Ômega 3, Chás Detox)',
    beneficios: 'Ativação imediata no plano de carreira + Treinamento Go Pro'
  },
  {
    id: 'kit_prata',
    nome: 'Kit Empreendedor Prata',
    valor: 799.00,
    pontos_pv: 450,
    lucro_estimado: 799.00,
    itens_inclusos: 'Mix completo de Saúde, Linha Ozônio e Perfumaria Fina',
    beneficios: 'Maior pontuação para graduação + Loja virtual personalizada',
    destaque: true
  },
  {
    id: 'kit_ouro',
    nome: 'Kit Líder Ouro',
    valor: 1499.00,
    pontos_pv: 900,
    lucro_estimado: 1499.00,
    itens_inclusos: 'Estoque profissional completo + Mostrador de Perfumes',
    beneficios: 'Comissões aceleradas de equipe + Bônus de Liderança'
  },
  {
    id: 'kit_diamante',
    nome: 'Kit Master Diamante VIP',
    valor: 2999.00,
    pontos_pv: 2000,
    lucro_estimado: 2999.00,
    itens_inclusos: 'Franquia completa de produtos + Vagas em Imersões VIP',
    beneficios: 'Máximo retorno por ponto + Reconhecimento especial'
  }
];

export const THEME = {
  colors: {
    primary: '#059669', // Emerald Green Atlântica
    primaryDim: '#047857',
    primaryContainer: '#d1fae5',
    secondary: '#d97706', // Gold Atlântica
    secondaryContainer: '#fef3c7',
    surface: '#0f172a',
    surfaceContainerLow: '#1e293b',
    surfaceContainerLowest: '#0b0f19',
    onSurface: '#f8fafc',
    onSurfaceVariant: '#94a3b8',
    outlineVariant: '#334155',
    error: '#ef4444',
    errorContainer: '#fee2e2'
  },
  radius: '0.75rem'
};
