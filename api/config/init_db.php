<?php
// api/config/init_db.php - Inicializador de Banco de Dados MMN Atlântica Natural

if (!function_exists('get_env_var')) {
    function get_env_var($key, $default = null) {
        $val = getenv($key);
        if ($val !== false && $val !== '') return $val;
        if (isset($_ENV[$key]) && $_ENV[$key] !== '') return $_ENV[$key];
        if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') return $_SERVER[$key];

        static $env_data = null;
        if ($env_data === null) {
            $env_data = [];
            $env_path = __DIR__ . '/../../.env';
            if (file_exists($env_path)) {
                $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    if (strpos(trim($line), '#') === 0) continue;
                    if (strpos($line, '=') !== false) {
                        list($name, $value) = explode('=', $line, 2);
                        $env_data[trim($name)] = trim($value, " \t\n\r\0\x0B\"'");
                    }
                }
            }
        }
        return $env_data[$key] ?? $default;
    }
}

$driver = strtolower(get_env_var('DB_CONNECTION', 'pgsql'));
$host   = get_env_var('DB_HOST', 'postgres');
$port   = get_env_var('DB_PORT', ($driver === 'pgsql' ? '5432' : '3306'));
$dbName = get_env_var('DB_NAME', 'crm_atlantica');
$user   = get_env_var('DB_USER', 'crm_admin');
$pass   = get_env_var('DB_PASSWORD', 'Max031184');

echo "=== INICIALIZADOR DE BANCO DE DADOS: CRM MMN ATLÂNTICA NATURAL ===\n";
echo "Driver: {$driver} | Host: {$host}:{$port} | Banco: {$dbName}\n";

// Validação de segurança para execução via web
$expectedSecret = get_env_var('DIAG_SECRET', get_env_var('VITE_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
$providedSecret = $_GET['secret'] ?? ($_GET['key'] ?? ($_SERVER['HTTP_X_DIAG_SECRET'] ?? ''));
if (php_sapi_name() !== 'cli' && (empty($providedSecret) || $providedSecret !== $expectedSecret)) {
    http_response_code(403);
    echo "Acesso negado. Forneça o parâmetro secret=? na URL.\n";
    exit(1);
}

try {
    if ($driver === 'pgsql' || $driver === 'postgres' || $driver === 'postgresql') {
        $dsn = "pgsql:host={$host};port={$port};dbname={$dbName}";
        $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        echo "Conexão com PostgreSQL realizada com sucesso!\n";

        $candidates = [
            __DIR__ . '/../database_pg.sql',
            __DIR__ . '/../../database_pg.sql',
            __DIR__ . '/database_pg.sql',
            '/var/www/html/api/database_pg.sql',
            '/var/www/html/database_pg.sql'
        ];
        $sqlFile = null;
        foreach ($candidates as $cand) {
            if (file_exists($cand)) {
                $sqlFile = $cand;
                break;
            }
        }

        if ($sqlFile) {
            echo "Executando DDL e seeds a partir de {$sqlFile}...\n";
            $sql = file_get_contents($sqlFile);
            $statements = array_filter(array_map('trim', explode(';', $sql)));
            foreach ($statements as $st) {
                if (empty($st)) continue;
                try {
                    $pdo->exec($st);
                } catch (Throwable $eStmt) {
                    // Silently ignore or print notice for idempotent objects
                    $firstLine = trim(explode("\n", $st)[0]);
                    echo "Nota DDL: {$firstLine} -> " . $eStmt->getMessage() . "\n";
                }
            }
        } else {
            echo "Arquivo database_pg.sql não encontrado nos diretórios. Executando migração direta via DDL inline...\n";
            $pdo->exec("
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
                ALTER TABLE scheduled_dispatches ADD COLUMN IF NOT EXISTS patient_id VARCHAR(50);
                ALTER TABLE scheduled_dispatches ADD COLUMN IF NOT EXISTS treatment_command TEXT;
                ALTER TABLE scheduled_dispatches ADD COLUMN IF NOT EXISTS ai_message_preview TEXT;
                ALTER TABLE scheduled_dispatches ADD COLUMN IF NOT EXISTS status_message VARCHAR(50) DEFAULT 'Aguardando';
                ALTER TABLE scheduled_dispatches ADD COLUMN IF NOT EXISTS logs TEXT;
                ALTER TABLE scheduled_dispatches ALTER COLUMN prospect_id DROP NOT NULL;

                CREATE TABLE IF NOT EXISTS messages (
                    id VARCHAR(50) PRIMARY KEY,
                    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    patient_id VARCHAR(50),
                    prospect_id VARCHAR(50),
                    direction VARCHAR(20) NOT NULL,
                    content TEXT NOT NULL,
                    sender_name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                ALTER TABLE messages ADD COLUMN IF NOT EXISTS patient_id VARCHAR(50);
                ALTER TABLE messages ALTER COLUMN prospect_id DROP NOT NULL;

                CREATE TABLE IF NOT EXISTS patient_interactions (
                    id SERIAL PRIMARY KEY,
                    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    patient_id VARCHAR(50) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                INSERT INTO tenant_settings (tenant_id, evolution_api_url, evolution_api_key, evolution_instance_name)
                VALUES ('atlanticanatural', 'https://evogo.acessaronline.com.br', 'd7b87fcfca7d42cfb7692298bc6d42ef', 'atlanticanatural')
                ON CONFLICT (tenant_id) DO UPDATE SET 
                    evolution_api_url = EXCLUDED.evolution_api_url,
                    evolution_api_key = EXCLUDED.evolution_api_key,
                    evolution_instance_name = EXCLUDED.evolution_instance_name;
            ");
        }

        // Migrações e sincronizações essenciais que SEMPRE devem rodar
        $pdo->exec("
            ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255) DEFAULT 'primary';
            CREATE TABLE IF NOT EXISTS deleted_google_events (
                event_id VARCHAR(255) PRIMARY KEY,
                deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO users (id, tenant_id, email, name, nome, role, perfil, status, ativo)
            VALUES 
            ('usr_lider_01', 'atlanticanatural', 'salesioninja@gmail.com', 'Professor Salésio - Líder Atlântica', 'Professor Salésio', 'superadmin', 'superadmin', 'Ativo', 1),
            ('usr_lider_02', 'atlanticanatural', 'suporteninja1@gmail.com', 'Salésio Ninja - Suporte Master', 'Salésio Ninja', 'superadmin', 'superadmin', 'Ativo', 1)
            ON CONFLICT (tenant_id, email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, perfil = EXCLUDED.perfil, status = 'Ativo', ativo = 1;

            UPDATE users 
            SET google_access_token = u2.google_access_token,
                google_refresh_token = u2.google_refresh_token,
                google_token_expires = u2.google_token_expires
            FROM (SELECT google_access_token, google_refresh_token, google_token_expires 
                  FROM users 
                  WHERE google_refresh_token IS NOT NULL AND google_refresh_token <> '' 
                  LIMIT 1) u2
            WHERE users.tenant_id = 'atlanticanatural' 
              AND (users.google_refresh_token IS NULL OR users.google_refresh_token = '');
        ");

        echo "Tabelas, views, google_calendar_id e tokens sincronizados com sucesso no PostgreSQL!\n";

        // Exibir status dos usuários
        $stmtUsers = $pdo->query("SELECT id, name, email, (google_refresh_token IS NOT NULL AND google_refresh_token <> '') as google_ok FROM users WHERE tenant_id = 'atlanticanatural' ORDER BY id ASC");
        $uList = $stmtUsers ? $stmtUsers->fetchAll(PDO::FETCH_ASSOC) : [];
        echo "=== STATUS DAS CONTAS GOOGLE (MMN ATLÂNTICA) ===\n";
        foreach ($uList as $u) {
            $status = !empty($u['google_ok']) ? 'CONECTADO COM GOOGLE CALENDAR' : 'SEM GOOGLE';
            echo "- {$u['id']} ({$u['name']} / {$u['email']}): {$status}\n";
        }

        // Sincronizar retroativamente agendamentos pendentes
        try {
            require_once __DIR__ . '/bootstrap.php';
            if (function_exists('sync_google_calendar_event')) {
                $stmtPend = $pdo->query("SELECT id FROM appointments WHERE (tenant_id = 'atlanticanatural') AND (event_id IS NULL OR event_id = '') ORDER BY created_at DESC LIMIT 20");
                $pIds = $stmtPend ? $stmtPend->fetchAll(PDO::FETCH_COLUMN) : [];
                $syncCount = 0;
                foreach ($pIds as $pId) {
                    if (sync_google_calendar_event($pdo, $pId, 'atlanticanatural', 'create')) {
                        $syncCount++;
                    }
                }
                echo "Agendamentos pendentes sincronizados com Google Calendar: {$syncCount} de " . count($pIds) . "\n";
            }
        } catch (Throwable $eSyncInit) {
            echo "Aviso ao sincronizar agendamentos pendentes: " . $eSyncInit->getMessage() . "\n";
        }
    } else {
        $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        echo "Conexão com MySQL realizada com sucesso!\n";

        $candidates = [
            __DIR__ . '/../database.sql',
            __DIR__ . '/../../database.sql',
            __DIR__ . '/database.sql',
            '/var/www/html/api/database.sql',
            '/var/www/html/database.sql'
        ];
        $sqlFile = null;
        foreach ($candidates as $cand) {
            if (file_exists($cand)) {
                $sqlFile = $cand;
                break;
            }
        }
        if ($sqlFile) {
            echo "Executando DDL e seeds a partir de {$sqlFile}...\n";
            $sql = file_get_contents($sqlFile);
            $pdo->exec($sql);
            echo "Tabelas e seeds do MySQL criados com sucesso!\n";
        }
    }

    echo "=== BANCO DE DADOS INICIALIZADO COM SUCESSO! ===\n";
} catch (Throwable $e) {
    echo "\nERRO GRAVE NA INICIALIZAÇÃO DO BANCO: " . $e->getMessage() . "\n";
    exit(1);
}
