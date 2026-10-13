-- ========================================================
-- BANCO DE DADOS: CRM MMN ATLÂNTICA NATURAL (MYSQL / MARIADB)
-- ========================================================

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    nome VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'consultor',
    perfil VARCHAR(50) NOT NULL DEFAULT 'consultor',
    status VARCHAR(20) DEFAULT 'Ativo',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    avatar_url VARCHAR(500),
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expires DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT u_tenant_email UNIQUE (tenant_id, email),
    INDEX idx_tenant_email (tenant_id, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id VARCHAR(50) PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospects (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(50) NOT NULL,
    email VARCHAR(255) DEFAULT 'N/A',
    perfil_interesse VARCHAR(50) DEFAULT 'Revendedor',
    temperatura VARCHAR(20) DEFAULT 'Morno',
    fase_funil VARCHAR(50) DEFAULT 'Novo Lead',
    kit_interesse VARCHAR(100) DEFAULT 'Kit Adesão R$ 79,90',
    meta_renda VARCHAR(100) DEFAULT 'R$ 2.000 a R$ 5.000/mês',
    origem VARCHAR(100) DEFAULT 'WhatsApp Direto',
    patrocinador VARCHAR(255) DEFAULT 'Líder Oficial',
    notas_qualificacao TEXT,
    bot_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_prospect_phone (tenant_id, whatsapp),
    INDEX idx_prospect_fase (tenant_id, fase_funil)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    linha VARCHAR(100) NOT NULL,
    preco_cliente DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    preco_distribuidor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    pontos_pv INT NOT NULL DEFAULT 0,
    descricao TEXT,
    beneficios TEXT,
    modo_uso TEXT,
    link_loja VARCHAR(500),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kits (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    pontos_pv INT NOT NULL DEFAULT 0,
    lucro_estimado DECIMAL(10,2) DEFAULT 0.00,
    itens_inclusos TEXT,
    beneficios TEXT,
    destaque BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apns (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    prospect_id VARCHAR(50) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'APN Online (Zoom/Meet)',
    data_hora DATETIME NOT NULL,
    link_reuniao VARCHAR(500),
    status VARCHAR(50) DEFAULT 'Agendada',
    notas TEXT,
    ai_message_preview TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    prospect_id VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scheduled_dispatches (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    prospect_id VARCHAR(50) NOT NULL,
    apn_id VARCHAR(50) NULL,
    dispatch_type VARCHAR(50) NOT NULL,
    scheduled_time DATETIME NOT NULL,
    status VARCHAR(50) DEFAULT 'Aguardando',
    message_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospect_interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    prospect_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seeds Obrigatórias
INSERT INTO tenants (id, name, nome_empresa, plano, status, active, limite_disparos_mensal)
VALUES ('atlanticanatural', 'Atlântica Natural - Líder Pro', 'Atlântica Natural Oficial', 'DIAMANTE', 'ativo', 1, 10000)
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO users (id, tenant_id, email, name, nome, role, perfil, status, ativo)
VALUES ('usr_lider_01', 'atlanticanatural', 'salesioninja@gmail.com', 'Professor Salésio - Líder Atlântica', 'Professor Salésio', 'lider_diamante', 'lider_diamante', 'Ativo', 1)
ON DUPLICATE KEY UPDATE name=name;
