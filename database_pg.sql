-- ========================================================
-- BANCO DE DADOS POSTGRESQL 16: CRM MMN ATLÂNTICA NATURAL
-- ========================================================

-- 1. Tabela de Tenants (Organizações / Franquias / Líderes)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    nome_empresa VARCHAR(255),
    cnpj VARCHAR(20),
    email_contato VARCHAR(255),
    telefone_contato VARCHAR(50),
    plano VARCHAR(50) NOT NULL DEFAULT 'DIAMANTE',
    status VARCHAR(30) NOT NULL DEFAULT 'ativo',
    active BOOLEAN DEFAULT TRUE,
    limite_disparos_mensal INT NOT NULL DEFAULT 10000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Usuários (Liderança e Consultores)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    nome VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'consultor', -- 'superadmin', 'lider_diamante', 'consultor', 'operador'
    perfil VARCHAR(50) NOT NULL DEFAULT 'consultor',
    status VARCHAR(20) DEFAULT 'Ativo',
    ativo SMALLINT NOT NULL DEFAULT 1,
    avatar_url VARCHAR(500),
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expires TIMESTAMP WITH TIME ZONE,
    google_calendar_id VARCHAR(255) DEFAULT 'primary',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT u_tenant_email UNIQUE (tenant_id, email)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255) DEFAULT 'primary';

CREATE TABLE IF NOT EXISTS deleted_google_events (
    event_id VARCHAR(255) PRIMARY KEY,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_email ON users(tenant_id, email);

-- 3. Configurações de Integrações e Inteligência Artificial
CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id VARCHAR(50) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    id VARCHAR(50),
    evolution_url VARCHAR(255),
    evolution_api_url VARCHAR(255),
    evolution_apikey VARCHAR(255),
    evolution_api_key VARCHAR(255),
    evolution_instance VARCHAR(100),
    evolution_instance_name VARCHAR(100),
    n8n_webhook_url VARCHAR(255),
    gemini_apikey VARCHAR(255),
    gemini_custom_prompt TEXT,
    dias_antecedencia_lembrete INT NOT NULL DEFAULT 1,
    horario_padrao_envio VARCHAR(10) DEFAULT '09:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Prospects (Leads de MMN & Clientes de Produtos)
CREATE TABLE IF NOT EXISTS prospects (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(50) NOT NULL,
    email VARCHAR(255) DEFAULT 'N/A',
    perfil_interesse VARCHAR(50) DEFAULT 'Revendedor', -- 'Consumidor', 'Revendedor', 'Lider_Rede'
    temperatura VARCHAR(20) DEFAULT 'Morno',            -- 'Frio', 'Morno', 'Quente'
    fase_funil VARCHAR(50) DEFAULT 'Novo Lead',        -- 7 Passos Go Pro
    kit_interesse VARCHAR(100) DEFAULT 'Kit Adesão R$ 79,90',
    meta_renda VARCHAR(100) DEFAULT 'R$ 2.000 a R$ 5.000/mês',
    origem VARCHAR(100) DEFAULT 'WhatsApp Direto',     -- 'Instagram', 'Indicação', 'Lista Quente', 'Tráfego Pago', 'Link Bio'
    patrocinador VARCHAR(255) DEFAULT 'Líder Oficial',
    notas_qualificacao TEXT,
    bot_status VARCHAR(20) DEFAULT 'active',           -- 'active' (IA atendendo) ou 'paused' (humano assumiu)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prospect_tenant_phone ON prospects(tenant_id, whatsapp);
CREATE INDEX IF NOT EXISTS idx_prospect_fase ON prospects(tenant_id, fase_funil);

-- 5. Catálogo de Produtos da Atlântica Natural
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    linha VARCHAR(100) NOT NULL,                       -- 'Nutracêuticos', 'Linha Ozônio', 'Chás Funcionais', 'Perfumaria Fina', 'Cosméticos'
    preco_cliente NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    preco_distribuidor NUMERIC(10,2) NOT NULL DEFAULT 0.00, -- 50% de desconto (100% margem)
    pontos_pv INT NOT NULL DEFAULT 0,
    descricao TEXT,
    beneficios TEXT,
    modo_uso TEXT,
    link_loja VARCHAR(500),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, linha);

-- 6. Kits de Adesão e Pacotes de Início Rápido
CREATE TABLE IF NOT EXISTS kits (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    valor NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    pontos_pv INT NOT NULL DEFAULT 0,
    lucro_estimado NUMERIC(10,2) DEFAULT 0.00,
    itens_inclusos TEXT,
    beneficios TEXT,
    destaque BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabela de APNs / Apresentações e Reuniões Agendadas
CREATE TABLE IF NOT EXISTS apns (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prospect_id VARCHAR(50) NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    tipo VARCHAR(50) DEFAULT 'APN Online (Zoom/Meet)', -- 'APN 1 a 1', 'APN Online', 'Demonstração de Produtos', 'Alinhamento 48h'
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    link_reuniao VARCHAR(500),
    status VARCHAR(50) DEFAULT 'Agendada',             -- 'Agendada', 'Confirmada', 'Realizada', 'Remarcada', 'Cancelada'
    notas TEXT,
    ai_message_preview TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apns_tenant_data ON apns(tenant_id, data_hora);

-- 8. Tabela de Mensagens Omnichannel (Chat WhatsApp)
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id VARCHAR(50),
    prospect_id VARCHAR(50),
    direction VARCHAR(20) NOT NULL,                    -- 'inbound' ou 'outbound'
    content TEXT NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_prospect ON messages(tenant_id, prospect_id);
CREATE INDEX IF NOT EXISTS idx_messages_patient ON messages(tenant_id, patient_id);

-- 9. Tabela de Disparos Programados de Follow-up (Motor de Disparo)
CREATE TABLE IF NOT EXISTS scheduled_dispatches (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id VARCHAR(50),
    prospect_id VARCHAR(50),
    appointment_id VARCHAR(50),
    apn_id VARCHAR(50) REFERENCES apns(id) ON DELETE SET NULL,
    dispatch_type VARCHAR(50) NOT NULL,                -- 'followup_24h', 'lembrete_apn', 'immediate', 'custom'
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'Aguardando',           -- 'Aguardando', 'Processando', 'Enviado', 'Erro'
    status_message VARCHAR(50) DEFAULT 'Aguardando',
    message_content TEXT,
    treatment_command TEXT,
    ai_message_preview TEXT,
    logs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispatches_status ON scheduled_dispatches(tenant_id, status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_dispatches_appt ON scheduled_dispatches(tenant_id, appointment_id);

-- 10. Histórico de Interações do Prospect (Linha do Tempo Comercial)
CREATE TABLE IF NOT EXISTS prospect_interactions (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prospect_id VARCHAR(50) NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,                         -- 'whatsapp_in', 'whatsapp_out', 'apn_assistida', 'kit_apresentado', 'nota_consultor'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Pacientes / Contatos Legados
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255) DEFAULT 'N/A',
    clinical_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id VARCHAR(50) NOT NULL,
    professional VARCHAR(255),
    category VARCHAR(100) DEFAULT 'Geral',
    price NUMERIC(10,2) DEFAULT 0.00,
    valor_consulta NUMERIC(10,2) DEFAULT 0.00,
    appointment_time TIMESTAMP WITH TIME ZONE,
    data_consulta DATE,
    message_time TIMESTAMP WITH TIME ZONE,
    status_message VARCHAR(50) DEFAULT 'Aguardando',
    status_envio VARCHAR(50) DEFAULT 'Aguardando',
    status_crm VARCHAR(50) DEFAULT 'Agendado',
    crm_status VARCHAR(50) DEFAULT 'Agendado',
    treatment_command TEXT,
    ai_message_preview TEXT,
    logs TEXT,
    event_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_time ON appointments(tenant_id, appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(tenant_id, status_message, message_time);

ALTER TABLE scheduled_dispatches ADD COLUMN IF NOT EXISTS appointment_id VARCHAR(50);
ALTER TABLE scheduled_dispatches ADD COLUMN IF NOT EXISTS treatment_command TEXT;
ALTER TABLE scheduled_dispatches ADD COLUMN IF NOT EXISTS ai_message_preview TEXT;
ALTER TABLE scheduled_dispatches ADD COLUMN IF NOT EXISTS logs TEXT;

CREATE TABLE IF NOT EXISTS patient_interactions (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_calendar_sync (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
    channel_id VARCHAR(100) NOT NULL UNIQUE,
    resource_id VARCHAR(255) NULL,
    sync_token TEXT NULL,
    expiration_timestamp BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ativo',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_channel_token ON google_calendar_sync(channel_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant ON google_calendar_sync(user_id, tenant_id);

-- ========================================================
-- SEEDS INICIAIS: ATLÂNTICA NATURAL
-- ========================================================

-- Inquilino Principal
INSERT INTO tenants (id, name, nome_empresa, plano, status, active, limite_disparos_mensal)
VALUES ('atlanticanatural', 'Atlântica Natural - Líder Pro', 'Atlântica Natural Oficial', 'DIAMANTE', 'ativo', TRUE, 10000)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Usuários Administradores
INSERT INTO users (id, tenant_id, email, name, nome, role, perfil, status, ativo)
VALUES 
('usr_lider_01', 'atlanticanatural', 'salesioninja@gmail.com', 'Professor Salésio - Líder Atlântica', 'Professor Salésio', 'superadmin', 'superadmin', 'Ativo', 1),
('usr_lider_02', 'atlanticanatural', 'suporteninja1@gmail.com', 'Salésio Ninja - Suporte Master', 'Salésio Ninja', 'superadmin', 'superadmin', 'Ativo', 1)
ON CONFLICT (tenant_id, email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, perfil = EXCLUDED.perfil;

-- Configurações de IA e WhatsApp
INSERT INTO tenant_settings (
    tenant_id,
    evolution_api_url,
    evolution_api_key,
    evolution_instance_name,
    gemini_custom_prompt,
    dias_antecedencia_lembrete,
    horario_padrao_envio
) VALUES (
    'atlanticanatural',
    'https://evogo.acessaronline.com.br',
    'd7b87fcfca7d42cfb7692298bc6d42ef',
    'atlanticanatural',
    'Você é o Agente Especialista e Mentor de Negócios da Atlântica Natural. Auxilie prospects com foco em saúde e oportunidade de renda extra com a metodologia Go Pro.',
    1,
    '09:00'
) ON CONFLICT (tenant_id) DO UPDATE SET 
    evolution_api_url = EXCLUDED.evolution_api_url,
    evolution_api_key = EXCLUDED.evolution_api_key,
    evolution_instance_name = EXCLUDED.evolution_instance_name;

-- Kits Oficiais de Adesão
INSERT INTO kits (id, tenant_id, nome, valor, pontos_pv, lucro_estimado, itens_inclusos, beneficios, destaque) VALUES
('kit_adesao', 'atlanticanatural', 'Kit Adesão Inicial', 79.90, 40, 79.90, 'Produtos à escolha no valor de R$ 79,90 + Escritório Virtual', '100% de margem no lucro + Acesso imediato à plataforma oficial', FALSE),
('kit_bronze', 'atlanticanatural', 'Kit Start Bronze', 399.00, 200, 399.00, 'Mix de Nutracêuticos campeões (Curcumina, Ômega 3, Chás Detox)', 'Ativação imediata no plano de carreira + Material de Apoio Go Pro', FALSE),
('kit_prata', 'atlanticanatural', 'Kit Empreendedor Prata', 799.00, 450, 799.00, 'Mix completo de Saúde, Ozônio e Perfumaria Fina', 'Maior pontuação para graduação + Loja virtual personalizada ativa', TRUE),
('kit_ouro', 'atlanticanatural', 'Kit Líder Ouro', 1499.00, 900, 1499.00, 'Estoque profissional completo com demonstrador de perfumes', 'Máxima comissão de equipe + Bonificação acelerada de liderança', FALSE),
('kit_diamante', 'atlanticanatural', 'Kit Master Diamante VIP', 2999.00, 2000, 2999.00, 'Franquia completa de produtos + Vagas em Imersões e Treinamentos VIP', 'Melhor custo-benefício por ponto + Reconhecimento oficial da liderança', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Produtos Campeões da Atlântica Natural
INSERT INTO products (id, tenant_id, nome, linha, preco_cliente, preco_distribuidor, pontos_pv, descricao, beneficios) VALUES
('prod_curcumina', 'atlanticanatural', 'Curcumina Ouro Anti-inflamatória', 'Nutracêuticos', 131.98, 65.99, 45, 'Extrato concentrado de curcumina com pimenta preta para máxima absorção.', 'Alívio rápido de dores nas articulações, artrite, artrose e ação antioxidante celular.'),
('prod_omega3', 'atlanticanatural', 'Ômega 3 Ultra Concentrado', 'Nutracêuticos', 119.98, 59.99, 40, 'Óleo de peixe de águas profundas e purificadas com alta concentração de EPA e DHA.', 'Proteção cardiovascular, memória, foco mental e regulação de triglicerídeos.'),
('prod_colageno', 'atlanticanatural', 'Colágeno Verisol com Ácido Hialurônico', 'Nutracêuticos', 142.98, 71.49, 50, 'Peptídeos bioativos de colágeno específico para a derme humana.', 'Redução visível de rugas, elasticidade da pele, fortalecimento de unhas e cabelos.'),
('prod_ozonio', 'atlanticanatural', 'Óleo Ozonizado Terapêutico Girassol', 'Linha Ozônio', 89.98, 44.99, 30, 'Óleo vegetal puro submetido a ozonização ativa medicinal.', 'Potente germicida, fungicida, cicatrizante para queimaduras, dermatites e feridas.'),
('prod_chasb', 'atlanticanatural', 'Chá SB Turbo Detox Emagrecedor', 'Chás Funcionais', 69.98, 34.99, 25, 'Blend exclusivo de ervas medicinais diuréticas e digestivas.', 'Aceleração do metabolismo, combate à retenção de líquidos e alívio do inchaço abdominal.'),
('prod_melatonina', 'atlanticanatural', 'Melatonina Gotas Sublingual CalmaVip', 'Nutracêuticos', 59.98, 29.99, 20, 'Gotas sublinguais de rápida absorção para indução do sono.', 'Sono profundo reparador, combate à insônia e despertar com energia renovada.'),
('prod_perfume_empire', 'atlanticanatural', 'Perfume Empire Royal 100ml', 'Perfumaria Fina', 153.98, 76.99, 50, 'Fragrância marcante amadeirada com 33% de essência pura e fixação 24h.', 'Presença marcante, alta sofisticação e fixação extrema comprovada.')
ON CONFLICT (id) DO NOTHING;

-- Prospects Modelo para Testes e Demonstração
INSERT INTO prospects (id, tenant_id, nome, whatsapp, email, perfil_interesse, temperatura, fase_funil, kit_interesse, meta_renda, origem, patrocinador, notas_qualificacao) VALUES
('prsp_01', 'atlanticanatural', 'Rodrigo Silva', '46999112233', 'rodrigo.invest@email.com', 'Lider_Rede', 'Quente', 'Follow-up / Objeções', 'Kit Empreendedor Prata', 'R$ 5.000 a R$ 10.000/mês', 'Instagram', 'Professor Salésio', 'Já trabalhou com vendas diretas. Adorou a margem de 100% de lucro. Quer agendar chamada para tirar dúvida sobre bônus de equipe.'),
('prsp_02', 'atlanticanatural', 'Camila Ferreira', '46998877665', 'camila.estetica@email.com', 'Revendedor', 'Quente', 'Fechamento / Kit', 'Kit Adesão R$ 79,90', 'R$ 2.000 a R$ 3.000/mês', 'Indicação', 'Professor Salésio', 'Tem clínica de estética e quer revender colágeno e a linha de ozônio para as clientes.'),
('prsp_03', 'atlanticanatural', 'Marcos Aurélio', '11987654321', 'marcos.a@gmail.com', 'Consumidor', 'Morno', 'Abordagem & Qualificação', 'Curcumina Ouro', 'Consumo Próprio', 'WhatsApp Direto', 'Professor Salésio', 'Reclamou de fortes dores no joelho e coluna. Quer saber posologia e preço com frete para São Paulo.'),
('prsp_04', 'atlanticanatural', 'Juliana Mendes', '41991234567', 'juliana.mendes@uol.com.br', 'Lider_Rede', 'Quente', 'Cadastrado', 'Kit Líder Ouro', 'Acima de R$ 15.000/mês', 'Tráfego Pago', 'Professor Salésio', 'Cadastro realizado no Escritório Virtual. Aguardando compensação do pagamento do kit.')
ON CONFLICT (id) DO NOTHING;
