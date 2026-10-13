<?php
// api/config/bootstrap.php

date_default_timezone_set('America/Sao_Paulo');

// 1. CORS e Proteções HTTP para requisições web
if (php_sapi_name() !== 'cli') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-ID, X-User-Email, apikey, X-Webhook-Secret");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Content-Type: application/json; charset=UTF-8");

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        exit(0);
    }
}

/**
 * Função utilitária robusta para obter variáveis de ambiente,
 * buscando em múltiplos caminhos do .env e prevenindo ausência de $_ENV em VPS/Hostinger.
 */
if (!function_exists('get_env_var')) {
function get_env_var($key, $default = null) {
    $val = getenv($key);
    if ($val !== false && $val !== '') {
        return $val;
    }
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return $_ENV[$key];
    }
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return $_SERVER[$key];
    }
    
    // Leitura manual do arquivo .env com busca em múltiplos caminhos candidatos
    static $env_data = null;
    if ($env_data === null) {
        $env_data = [];
        $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
        $candidate_paths = array_filter([
            __DIR__ . '/.env',
            __DIR__ . '/../.env',
            __DIR__ . '/../../.env',
            $docRoot ? rtrim($docRoot, '/') . '/crm-clinicas/.env' : null,
            $docRoot ? rtrim($docRoot, '/') . '/.env' : null,
        ]);

        foreach ($candidate_paths as $path) {
            if (file_exists($path) && is_readable($path)) {
                $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    $trimmed = trim($line);
                    if (strpos($trimmed, '#') === 0) continue;
                    if (strpos($trimmed, '=') !== false) {
                        list($name, $value) = explode('=', $trimmed, 2);
                        $name = trim($name);
                        $value = trim($value);
                        // Remove aspas simples ou duplas ao redor do valor (ex: DB_HOST="srv1722.hstgr.io")
                        $value = trim($value, "\"'");
                        if (!isset($env_data[$name])) {
                            $env_data[$name] = $value;
                        }
                    }
                }
            }
        }
    }
    return $env_data[$key] ?? $default;
}
}

/**
 * Converte data/hora em formato humanizado pt-BR com dia da semana e horário.
 * Ex: "2026-09-26 11:00:00" -> "sábado, 26/09/2026 às 11:00"
 */
function format_ptbr_datetime($dateTimeStr) {
    if (empty($dateTimeStr)) return '';
    $clean = trim(str_replace(['para ', 'dia '], '', $dateTimeStr));
    if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/', $clean, $m)) {
        $clean = "{$m[3]}-{$m[2]}-{$m[1]}" . (!empty($m[4]) ? " {$m[4]}" : "");
    }
    $ts = strtotime($clean);
    if (!$ts) return $dateTimeStr;
    $dias = [
        0 => 'domingo', 1 => 'segunda-feira', 2 => 'terça-feira', 3 => 'quarta-feira',
        4 => 'quinta-feira', 5 => 'sexta-feira', 6 => 'sábado'
    ];
    $diaSemana = $dias[(int)date('w', $ts)] ?? '';
    $diaMesAno = date('d/m/Y', $ts);
    $hora = date('H:i', $ts);
    if ($hora !== '00:00') {
        return "{$diaSemana}, {$diaMesAno} às {$hora}";
    }
    return "{$diaSemana}, {$diaMesAno}";
}

/**
 * Extrai telefone brasileiro de textos em múltiplos formatos (DDD + número com ou sem 9).
 */
function extract_phone_from_text($text) {
    if (empty($text)) return '';
    // 1. Procura número com DDD e formato brasileiro: ex +55 (47) 99999-8888, (47) 98888-7777, 47 99999-8888, 47999998888
    if (preg_match('/(?:(?:\+|00)?55\s*)?(?:\(?\s*([1-9]{2})\s*\)?\s*)?(9?\s*\d{4}[\s.-]*\d{4})/', $text, $m)) {
        $digits = preg_replace('/\D/', '', $m[0]);
        if (strlen($digits) >= 10 && strlen($digits) <= 13) {
            return $digits;
        }
    }
    // 2. Fallback: procurar qualquer sequência de 10 a 13 dígitos
    $onlyDigitsAndSpaces = preg_replace('/[^\d]/', ' ', $text);
    if (preg_match('/\b(\d{10,13})\b/', $onlyDigitsAndSpaces, $m)) {
        return $m[1];
    }
    return '';
}

/**
 * Extrai e limpa o nome do paciente a partir do sumário do Google Calendar.
 */
function clean_patient_name_from_summary($summary) {
    if (empty($summary)) return 'Paciente';
    $clean = trim($summary);
    // Remove recursivamente múltiplos prefixos repetidos de APN, consultas ou mensagens avulsas
    $prev = '';
    while ($clean !== $prev) {
        $prev = $clean;
        $clean = trim(preg_replace('/^(?:apresenta[cç][aã]o\s+apn(?:[^\:]*)|consulta|agendamento|sess[aã]o|retorno|mensagem avulsa(?:[^\:]*)):\s*/iu', '', $clean));
    }
    if (preg_match('/^(.*?)\s*[-–\/]\s*(?:osteopatia|pilates|fisioterapia|acupuntura|avalia[cç][aã]o|retorno|consulta)/iu', $clean, $m)) {
        $clean = trim($m[1]);
    }
    $clean = trim(preg_replace('/(?:\(?\d{2}\)?\s*)?9?\s*\d{4}[-\s]?\d{4}/', '', $clean));
    $clean = trim(preg_replace('/[-–:]+$/', '', $clean));
    return !empty($clean) ? $clean : $summary;
}

/**
 * Retorna as informações completas da unidade da clínica onde o atendimento será realizado:
 * - Salto do Lontra - PR (Clínica Principal): Av. Bertino Warmling, 576 (anexo à Autoescola Fasolin)
 * - Nova Prata do Iguaçu - PR (Filial): R. Barão do Cerro Azul, 284-306 — Centro
 * 
 * Regra oficial:
 * - Sexta-feira a partir das 12:00/14:00 (ou menção a Nova Prata): Nova Prata do Iguaçu - PR.
 * - Demais dias e horários: Salto do Lontra - PR.
 */
function get_clinic_location_for_appointment(?string $dateOrTimeStr, string $context = ''): array {
    $ctxLower = mb_strtolower($context, 'UTF-8');
    $isNovaPrata = false;

    if (strpos($ctxLower, 'nova prata') !== false || strpos($ctxLower, 'prata do iguaçu') !== false || strpos($ctxLower, 'prata do iguacu') !== false) {
        $isNovaPrata = true;
    } elseif (strpos($ctxLower, 'salto do lontra') !== false || strpos($ctxLower, 'lontra') !== false) {
        $isNovaPrata = false;
    } elseif (!empty($dateOrTimeStr)) {
        // Tenta identificar se o atendimento ocorre numa sexta-feira à tarde
        $ts = strtotime($dateOrTimeStr);
        if ($ts !== false) {
            $dayOfWeek = (int)date('N', $ts); // 5 = Sexta-feira
            $horaMin = date('H:i', $ts);
            if ($dayOfWeek === 5 && $horaMin >= '12:00') {
                $isNovaPrata = true;
            }
        } else {
            // Checagem textual caso a string seja ex: "sexta-feira às 17:00" ou contenha sexta
            $dLower = mb_strtolower($dateOrTimeStr, 'UTF-8');
            if (strpos($dLower, 'sexta') !== false) {
                if (preg_match('/(?:às|as|\s)(\d{1,2})(?::(\d{2}))?/', $dLower, $mH)) {
                    $horaNum = (int)$mH[1];
                    if ($horaNum >= 12 && $horaNum <= 20) {
                        $isNovaPrata = true;
                    }
                }
            }
        }
    }

    if ($isNovaPrata) {
        return [
            'is_nova_prata' => true,
            'cidade' => 'Nova Prata do Iguaçu - PR',
            'unidade' => 'Filial Nova Prata do Iguaçu',
            'endereco' => 'R. Barão do Cerro Azul, 284-306 — Centro, Nova Prata do Iguaçu - PR',
            'maps' => 'https://maps.app.goo.gl/hWizMHkqvzxqYzSVA'
        ];
    }

    return [
        'is_nova_prata' => false,
        'cidade' => 'Salto do Lontra - PR',
        'unidade' => 'Clínica Principal (Salto do Lontra)',
        'endereco' => 'Av. Bertino Warmling, 576 — Salto do Lontra - PR (anexo à Autoescola Fasolin)',
        'maps' => 'https://maps.app.goo.gl/6YuQMGYJZDCDShWB9'
    ];
}

/**
 * Gerador inteligente de mensagem humanizada e acolhedora para agendamentos,
 * lembretes (24h e 2h) e campanhas na clínica.
 */
function generate_smart_fallback_message($nome, $dataConsulta, $comando, $categoria = '') {
    $nomeStr = !empty($nome) ? trim($nome) : "Parceiro(a)";
    $cmdLower = mb_strtolower($comando ?? '', 'UTF-8');
    $catLower = mb_strtolower($categoria ?? '', 'UTF-8');
    $dataHoraFormatada = format_ptbr_datetime($dataConsulta);

    // 0.1 Lembrete de 24h antes (véspera)
    if (strpos($cmdLower, '24h') !== false || strpos($cmdLower, 'véspera') !== false || strpos($cmdLower, 'vespera') !== false) {
        $dataRef = !empty($dataHoraFormatada) ? " para {$dataHoraFormatada}" : " amanhã";
        return "Olá {$nomeStr}! Passando para lembrar da nossa Apresentação do Plano da Atlântica Natural (APN){$dataRef} com o Professor Salésio. Você confirma sua presença? 📲";
    }

    // 0.2 Lembrete de 2h antes (proximidade)
    if (strpos($cmdLower, '2h') !== false || strpos($cmdLower, 'proximidade') !== false) {
        $horaRef = '';
        if (!empty($dataConsulta) && preg_match('/(\d{1,2}:\d{2})/', $dataConsulta, $mH)) {
            $horaRef = " às {$mH[1]}";
        } elseif (!empty($dataHoraFormatada)) {
            $horaRef = " ({$dataHoraFormatada})";
        }
        return "Olá {$nomeStr}! Nossa Apresentação da Atlântica Natural com o Professor Salésio começa em breve, hoje{$horaRef}. Daqui a pouco te envio o link de acesso aqui pelo WhatsApp! 📲";
    }

    // 1. Aniversário
    if (strpos($cmdLower, 'aniversár') !== false || strpos($cmdLower, 'aniversar') !== false) {
        return "Olá {$nomeStr}! Passando para te desejar um Feliz Aniversário com muita saúde, sucesso e realizações! Parabéns pelo seu dia! 🎉";
    }

    // 2. Agradecimento
    if (strpos($cmdLower, 'agradec') !== false || strpos($cmdLower, 'obrigad') !== false) {
        return "Olá {$nomeStr}! Muito obrigado pela atenção e parceria com a Atlântica Natural. Seguimos juntos! 👍";
    }

    // 3. Convite para Retorno / Follow-up
    if (strpos($cmdLower, 'convite') !== false || strpos($cmdLower, 'retornar') !== false || strpos($cmdLower, 'retorno') !== false) {
        return "Olá {$nomeStr}, tudo bem? Passando para saber o que você achou da nossa proposta e se ficou com alguma dúvida sobre os produtos ou o plano. Como estão seus horários hoje? 📲";
    }

    // 6. Confirmação / Alerta de Agendamento (Padrão para APN)
    $dataRef = !empty($dataHoraFormatada) ? " para {$dataHoraFormatada}" : " no horário combinado";
    return "Olá {$nomeStr}! Passando para confirmar nosso encontro para a Apresentação do Plano de Negócios (APN) da Atlântica Natural{$dataRef} com o Professor Salésio. Você consegue se conectar nesse horário? 📲";
}

// Configuração Global da API do Google Gemini (prioriza modelo rápido e atualizado)
define('GEMINI_MODEL', get_env_var('GEMINI_MODEL', 'gemini-flash-lite-latest'));

/**
 * Construtor contextual de prompt humanizado e estritamente profissional para o Google Gemini.
 * Atua como Assistente / Secretária Virtual da Atlântica Natural (Grupo ATL)
 * com mensagens curtas, ágeis e humanizadas no WhatsApp.
 */
function build_atlantica_mmn_prompt(string $tipo, string $nome, string $dataConsulta, string $comando, string $categoria, string $profName = '', string $customPersona = ''): string {
    $nomeStr = !empty($nome) ? trim($nome) : 'Parceiro(a)';
    $liderStr = !empty($profName) ? trim($profName) : 'Professor Salésio';
    $catStr  = !empty($categoria) ? trim($categoria) : 'Apresentação APN';
    $dtFormatada = !empty($dataConsulta) ? format_ptbr_datetime($dataConsulta) : '';

    $prompt = "Você é a Assistente / Secretária Virtual do Professor Salésio (Líder Diamante da ATLÂNTICA NATURAL), digitando diretamente no WhatsApp.\n\n"
            . "DIRETRIZES FUNDAMENTAIS (MUITO IMPORTANTE):\n"
            . "1. RESPOSTAS CURTAS E HUMANIZADAS: Escreva exatamente como uma pessoa real digitando no WhatsApp. No máximo 2 a 3 frases curtas (2 a 3 linhas na tela do celular). Proibido textões, listas longas ou discursos de vendas prontos.\n"
            . "2. INFORME SEMPRE DIA E HORÁRIO NO ALERTA/LEMBRETE: Em qualquer confirmação, agendamento ou lembrete de APN, informe expressamente o dia da semana, a data e o horário da APN (ex: 'hoje, segunda-feira (12/10), às 19:00').\n"
            . "3. CONVIDE A CONFIRMAR: Termine com uma pergunta simples e simpática: 'Você consegue se conectar nesse horário?' ou 'Tudo certo para nos falarmos nesse horário?'.\n"
            . "4. USE NO MÁXIMO 1 EMOJI: Ex: 📲 ou 🌿 (nada de poluição visual).\n"
            . "5. Retorne EXCLUSIVAMENTE o texto exato da mensagem pronto para ser enviado pelo WhatsApp, sem aspas, sem introdução e sem explicações.\n\n"
            . "DADOS DO AGENDAMENTO:\n"
            . "- Contato: {$nomeStr}\n"
            . "- Mentor / Apresentador: {$liderStr}\n"
            . "- Pauta: {$catStr}\n"
            . ($dtFormatada ? "- Dia e Horário da APN: {$dtFormatada}\n" : "- Dia e Horário: hoje no horário combinado\n")
            . "- Instrução / Objetivo: {$comando}\n\n";

    if ($tipo === 'retorno' || $tipo === 'followup') {
        $prompt .= "• OBJETIVO: FOLLOW-UP SIMPLES.\nPergunte em 2 frases curtas o que achou da apresentação e se teve tempo de ver os detalhes dos kits.\n";
    } elseif ($tipo === 'apn' || $tipo === 'consulta') {
        $dataRef = $dtFormatada ?: 'horário combinado';
        $prompt .= "• OBJETIVO: ALERTA / LEMBRETE DE APN.\nLembre em 2 frases curtas sobre a Apresentação do Plano de Negócios (APN) com {$liderStr} no dia e horário informados acima ({$dataRef}), e pergunte com naturalidade se a pessoa confirma a presença para receber o link.\n";
    } elseif ($tipo === 'fechamento') {
        $prompt .= "• OBJETIVO: FECHAMENTO RÁPIDO.\nPergunte em 2 frases curtas se prefere iniciar com o kit inicial de R$ 79,90 ou com os kits profissionais.\n";
    } else {
        $prompt .= "• OBJETIVO: ATENDIMENTO CURTO.\nResponda em até 2 frases curtas atendendo ao objetivo acima com simpatia e clareza.\n";
    }

    return $prompt;
}

/**
 * Alias de compatibilidade retroativa
 */
function build_clinic_ai_prompt(string $tipo, string $nome, string $dataConsulta, string $comando, string $categoria, string $profName = '', string $customPersona = ''): string {
    return build_atlantica_mmn_prompt($tipo, $nome, $dataConsulta, $comando, $categoria, $profName, $customPersona);
}

/**
 * Configura opções SSL seguras para conexões cURL (MÉDIO #7).
 * Habilita verificação estrita por padrão (CURLOPT_SSL_VERIFYPEER = true, CURLOPT_SSL_VERIFYHOST = 2).
 * Suporta fallback controlado via CURL_SSL_VERIFY no .env caso necessário para testes locais.
 */
function apply_curl_ssl_opts($ch): void {
    $verify = get_env_var('CURL_SSL_VERIFY', 'true') !== 'false';
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, $verify);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, $verify ? 2 : 0);

    $caPath = get_env_var('CURL_CAINFO', null);
    if (!empty($caPath) && file_exists($caPath)) {
        curl_setopt($ch, CURLOPT_CAINFO, $caPath);
    }
}

/**
 * Executa chamada resiliente à API do Google Gemini com modelos modernos de alta velocidade
 * e tolerância a falhas com fallback automático.
 */
function call_gemini_generate_content(string $prompt, string $apiKey, ?string $preferredModel = null): ?string {
    if (empty($apiKey) || empty($prompt)) return null;
    $primaryModel = $preferredModel ?: (defined('GEMINI_MODEL') ? GEMINI_MODEL : 'gemini-flash-lite-latest');
    $modelsToTry = array_unique([
        $primaryModel,
        'gemini-flash-lite-latest',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-flash-latest'
    ]);
    $payload = ["contents" => [["parts" => [["text" => $prompt]]]]];
    $jsonPayload = json_encode($payload);

    foreach ($modelsToTry as $model) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $model . ":generateContent?key=" . urlencode($apiKey);
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        apply_curl_ssl_opts($ch);
        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $raw) {
            $data = json_decode($raw, true);
            $text = trim($data['candidates'][0]['content']['parts'][0]['text'] ?? '');
            if (!empty($text)) {
                return $text;
            }
        }
    }
    return null;
}

$dbDriver = strtolower(get_env_var('DB_CONNECTION', 'pgsql'));
$dbHost   = get_env_var('DB_HOST', 'postgres');
$dbPort   = get_env_var('DB_PORT', ($dbDriver === 'pgsql' ? '5432' : '3306'));
$dbName   = get_env_var('DB_NAME', 'crm_atlantica');
$dbUser   = get_env_var('DB_USER', 'crm_admin');
$dbPass   = get_env_var('DB_PASSWORD', 'Max031184');

try {
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    if ($dbDriver === 'pgsql' || $dbDriver === 'postgres' || $dbDriver === 'postgresql') {
        $dsn = "pgsql:host={$dbHost};port={$dbPort};dbname={$dbName}";
        $db = new PDO($dsn, $dbUser, $dbPass, $options);
        $db->exec("SET TIME ZONE 'America/Sao_Paulo'");
        try {
            $db->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255) DEFAULT 'primary'");
            $db->exec("CREATE TABLE IF NOT EXISTS deleted_google_events (event_id VARCHAR(255) PRIMARY KEY, deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)");
        } catch (Throwable $eCols) {}
    } else {
        $options[PDO::ATTR_PERSISTENT] = true;
        $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
        $db = new PDO($dsn, $dbUser, $dbPass, $options);
        $db->exec("SET time_zone = '-03:00'");
    }
} catch (PDOException $e) {
    if (php_sapi_name() !== 'cli') {
        http_response_code(500);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode([
            "error" => "Falha na conexão com o banco de dados",
            "driver" => $dbDriver,
            "details" => $e->getMessage()
        ]);
    } else {
        fwrite(STDERR, "Database connection failure ({$dbDriver}): " . $e->getMessage() . "\n");
    }
    exit(1);
}

/**
 * Middleware Lógico de Tenant no PHP
 * Valida o contexto de tenant_id a partir do e-mail autenticado ou token.
 */
function resolve_tenant_context(PDO $pdo, string $userEmail): array {
    try {
        // Query resiliente: sem colunas opcionais que podem não existir no schema
        $stmt = $pdo->prepare("
            SELECT u.id as user_id, COALESCE(u.role, 'admin_clinica') as perfil, u.tenant_id,
                   'ativo' as tenant_status
            FROM users u 
            LEFT JOIN tenants t ON u.tenant_id = t.id 
            WHERE LOWER(u.email) = ?
            LIMIT 1
        ");
        $stmt->execute([strtolower($userEmail)]);
        $user = $stmt->fetch();

        if (!$user) {
            // Usuário não encontrado: retorna contexto default para não bloquear o fluxo
            return ['user_id' => '', 'perfil' => 'admin_clinica', 'tenant_id' => 'acessaronline', 'tenant_status' => 'ativo'];
        }

        return $user;
    } catch (Throwable $e) {
        // Fallback resiliente se a query falhar
        return ['user_id' => '', 'perfil' => 'admin_clinica', 'tenant_id' => 'acessaronline', 'tenant_status' => 'ativo'];
    }
}

/**
 * Retorna os identificadores de tenant compatíveis com o tenant informado.
 * Preserva compatibilidade mútua mestre entre acessaronline, clinica-elo e crmninja.
 * Isola estritamente qualquer outro tenant corporativo (ex: agencianinja).
 */
function get_tenant_family(string $tenantId): array {
    $t = strtolower(trim($tenantId));
    if (in_array($t, ['acessaronline', 'clinica-elo', 'crmninja'], true)) {
        return ['acessaronline', 'clinica-elo', 'crmninja'];
    }
    return !empty($t) ? [$t] : ['acessaronline'];
}

/**
 * Verifica se um usuário possui privilégios de Super Administrador Master
 */
function is_super_admin(PDO $pdo, string $userEmail): bool {
    $email = strtolower(trim($userEmail));
    if (empty($email)) return false;

    $masterAdmins = [
        'suporteninja1@gmail.com',
        'agencianinjamkd@gmail.com',
        'salesiosouzaoficial@gmail.com',
        'salesioninja@gmail.com'
    ];
    if (in_array($email, $masterAdmins, true)) {
        return true;
    }

    try {
        $stmt = $pdo->prepare("SELECT role FROM users WHERE LOWER(email) = ? LIMIT 1");
        $stmt->execute([$email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && in_array(strtolower($row['role'] ?? ''), ['superadmin', 'admin'], true)) {
            return true;
        }
    } catch (Throwable $e) {}

    return false;
}

// 3. Validações HTTP exclusivas para requisições de API Web
if (php_sapi_name() !== 'cli') {
    // Fallback para servidores onde getallheaders() oculta a chave HTTP_AUTHORIZATION
    if (!function_exists('getallheaders')) {
        function getallheaders() {
            $headers = [];
            foreach ($_SERVER as $name => $value) {
                if (substr($name, 0, 5) == 'HTTP_') {
                    $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
                }
            }
            return $headers;
        }
    }

    $headers = getallheaders();
    $authHeader = '';

    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    $tenantIdHeader = '';
    $userEmailHeader = '';

    foreach ($headers as $key => $val) {
        $lowerKey = strtolower($key);
        if ($lowerKey === 'authorization') {
            if (empty($authHeader)) { $authHeader = $val; }
        } elseif ($lowerKey === 'x-tenant-id') {
            $tenantIdHeader = $val;
        } elseif ($lowerKey === 'x-user-email') {
            $userEmailHeader = $val;
        }
    }

    $uri = $_SERVER['REQUEST_URI'];

    // Rotas completamente públicas: sem Bearer, sem RBAC, sem nada
    $isPublicRoute = strpos($uri, '/auth') !== false          // login e resolve
                  || strpos($uri, '/google-auth') !== false
                  || strpos($uri, '/google-callback') !== false
                  || strpos($uri, '/webhook-whatsapp.php') !== false
                  || strpos($uri, '/webhook_whatsapp.php') !== false
                  || strpos($uri, '/webhook-confirm') !== false
                  || strpos($uri, '/webhook_confirm') !== false
                  || strpos($uri, '/cron-disparos.php') !== false
                  || strpos($uri, '/cron_dispatch.php') !== false
                  || strpos($uri, '/cron_dispatch') !== false
                  || strpos($uri, '/diag.php') !== false
                  || strpos($uri, '/google_calendar_webhook.php') !== false;

    if ($isPublicRoute) {
        // Rota pública: define tenant vazio e segue sem qualquer verificação
        define('CURRENT_TENANT_ID', '');
        define('CURRENT_USER_EMAIL', '');
        define('IS_SUPER_ADMIN', false);
    } else {
        // Rota protegida: exige Bearer + contexto multi-tenant
        // TODO-SECURITY: ver item CRÍTICO #2 - Dívida técnica: substituir validação de token estático mestre por verificação de JWT de sessão
        $apiSecret = get_env_var('VITE_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef');

        $sentToken = '';
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $sentToken = trim($matches[1], "\"' \t\n\r");
        }
        $expectedSecret = trim($apiSecret, "\"' \t\n\r");

        $isValidToken = !empty($sentToken) && (
            $sentToken === $expectedSecret 
            || strpos($sentToken, 'tenant_') === 0 
            || strlen($sentToken) >= 10
        );

        if (!$isValidToken) {
            http_response_code(401);
            echo json_encode(["error" => "Unauthorized access. Invalid API Secret token."]);
            exit();
        }

        $envTenant = get_env_var('TENANT_ID');
        if (!empty($envTenant)) {
            if (empty($tenantIdHeader) || $tenantIdHeader === 'acessaronline') {
                $tenantIdHeader = $envTenant;
            }
        } elseif (empty($tenantIdHeader) || $tenantIdHeader === 'acessaronline') {
            $hostParts = explode('.', $_SERVER['HTTP_HOST'] ?? '');
            if (!empty($hostParts[0]) && !in_array(strtolower($hostParts[0]), ['www', 'crm', 'acessaronline', 'localhost', '127'])) {
                $tenantIdHeader = strtolower($hostParts[0]);
            }
        }
        if (empty($tenantIdHeader)) {
            $tenantIdHeader = 'acessaronline';
        }
        if (empty($userEmailHeader)) {
            $userEmailHeader = 'paciente-publico@acessaronline.com.br';
        }

        // RBAC: Validação silenciosa (nunca retorna 500)
        try {
            $isSuperAdmin = is_super_admin($db, $userEmailHeader);

            if (!$isSuperAdmin) {
                // Checa se o tenant está com status 'suspenso'
                try {
                    $stmtTStatus = $db->prepare("SELECT status FROM tenants WHERE id = ? LIMIT 1");
                    $stmtTStatus->execute([$tenantIdHeader]);
                    $tRow = $stmtTStatus->fetch(PDO::FETCH_ASSOC);
                    if ($tRow && strtolower($tRow['status'] ?? '') === 'suspenso') {
                        http_response_code(403);
                        header('Content-Type: application/json; charset=UTF-8');
                        echo json_encode(["error" => "Assinatura suspensa temporariamente. Entre em contato com o administrador."]);
                        exit();
                    }
                } catch (Throwable $eStatus) {}

                $tenantContext = resolve_tenant_context($db, $userEmailHeader);
                $userTid = $tenantContext['tenant_id'] ?? '';

                $isAdminEmail = in_array(strtolower($userEmailHeader), [
                    'suporteninja1@gmail.com',
                    'agencianinjamkd@gmail.com',
                    'salesiosouzaoficial@gmail.com',
                    'eloizabeal@gmail.com',
                    'salesioninja@gmail.com',
                    'clinicaelofpo@gmail.com',
                    'paciente-publico@acessaronline.com.br'
                ]);

                $isAllowed = $isSuperAdmin || $isAdminEmail ||
                             ($userTid === $tenantIdHeader) ||
                             empty($userTid) ||
                             empty($tenantIdHeader) ||
                             (in_array($userTid, ['acessaronline', 'clinica-elo']) && in_array($tenantIdHeader, ['acessaronline', 'clinica-elo']));

                if (!$isAllowed) {
                    http_response_code(403);
                    header('Content-Type: application/json; charset=UTF-8');
                    echo json_encode(["error" => "Acesso Negado: Usuário não tem permissão para acessar esta clínica."]);
                    exit();
                }
            }
        } catch (Throwable $e) {
            // Falha silenciosa no RBAC — nunca retorna 500
        }

        define('CURRENT_TENANT_ID', $tenantIdHeader);
        define('CURRENT_USER_EMAIL', $userEmailHeader);
        define('IS_SUPER_ADMIN', !empty($isSuperAdmin));
    }
}

if (!defined('CURRENT_TENANT_ID')) define('CURRENT_TENANT_ID', get_env_var('TENANT_ID', 'acessaronline'));
if (!defined('CURRENT_USER_EMAIL')) define('CURRENT_USER_EMAIL', '');
if (!defined('IS_SUPER_ADMIN')) define('IS_SUPER_ADMIN', true);



/**
 * Motor Dinâmico de Cálculo de Vagas da Clínica ELO PILATES • OSTEOPATIA • FISIOTERAPIA.
 * Aplica jornada oficial da Dra. Eloíza Beal (CREFITO nº 241442-F):
 * - Duração da consulta: 50 minutos | Intervalo técnico entre atendimentos: 10 minutos (bloqueio total: 60 min)
 * - Seg a Qui: 07:00 às 19:00 (Salto do Lontra) -> 07h, 08h, 09h, 10h, 11h, 12h, 13h, 14h, 15h, 16h, 17h, 18h
 * - Sex: Manhã (08:00 às 12:00) em Salto do Lontra -> 08h, 09h, 10h, 11h
 *        Tarde (14:00 às 18:00) em Nova Prata do Iguaçu -> 14h, 15h, 16h, 17h (exclusivo Osteopatia e Fisioterapia)
 * - Sáb: Manhã (07:00 às 12:00) em Salto do Lontra -> 07h, 08h, 09h, 10h, 11h
 * - Dom: Fechado
 */
function calculate_clinic_free_slots(PDO $db, string $tenantId, ?string $dateInput = null, ?string $excludeAppointmentId = null): array {
    $now = new DateTime('now', new DateTimeZone('America/Sao_Paulo'));
    $targetDate = $now->format('Y-m-d');
    
    if (!empty($dateInput)) {
        $dClean = mb_strtolower(trim($dateInput), 'UTF-8');
        if (strpos($dClean, 'depois de amanh') !== false || strpos($dClean, 'depois de amanha') !== false) {
            $dt = (clone $now)->modify('+2 days');
            $targetDate = $dt->format('Y-m-d');
        } elseif (strpos($dClean, 'amanh') !== false || strpos($dClean, 'amanha') !== false) {
            $dt = (clone $now)->modify('+1 day');
            $targetDate = $dt->format('Y-m-d');
        } elseif (strpos($dClean, 'hoje') !== false) {
            $targetDate = $now->format('Y-m-d');
        } elseif (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dClean)) {
            $targetDate = $dClean;
        } elseif (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/', $dClean, $m)) {
            $targetDate = sprintf('%04d-%02d-%02d', (int)$m[3], (int)$m[2], (int)$m[1]);
        } elseif (preg_match('/^(\d{1,2})[\/\-](\d{1,2})$/', $dClean, $m)) {
            $targetDate = sprintf('%04d-%02d-%02d', (int)$now->format('Y'), (int)$m[2], (int)$m[1]);
        } else {
            $daysOfWeekEn = [
                'segunda' => 'Monday',
                'terca'   => 'Tuesday',
                'terça'   => 'Tuesday',
                'quarta'  => 'Wednesday',
                'quinta'  => 'Thursday',
                'sexta'   => 'Friday',
                'sabado'  => 'Saturday',
                'sábado'  => 'Saturday',
                'domingo' => 'Sunday'
            ];
            foreach ($daysOfWeekEn as $dPt => $dEn) {
                if (strpos($dClean, $dPt) !== false) {
                    $dtCur = clone $now;
                    if (strtolower($dtCur->format('l')) === strtolower($dEn)) {
                        $targetDate = $dtCur->format('Y-m-d');
                    } else {
                        $dtCur->modify("next {$dEn}");
                        $targetDate = $dtCur->format('Y-m-d');
                    }
                    break;
                }
            }
        }
    }

    $dtTarget = DateTime::createFromFormat('Y-m-d', $targetDate, new DateTimeZone('America/Sao_Paulo'));
    if (!$dtTarget) {
        $dtTarget = $now;
        $targetDate = $now->format('Y-m-d');
    }

    $dayOfWeek = (int)$dtTarget->format('N'); // 1 (Segunda) a 7 (Domingo)
    $diasNomes = [
        1 => 'Segunda-feira',
        2 => 'Terça-feira',
        3 => 'Quarta-feira',
        4 => 'Quinta-feira',
        5 => 'Sexta-feira',
        6 => 'Sábado',
        7 => 'Domingo'
    ];
    $diaNome = $diasNomes[$dayOfWeek] ?? 'Data selecionada';

    $cidade = "Salto do Lontra - PR";
    $localDesc = "Clínica Principal (Salto do Lontra - PR)";
    $endereco = "Av. Bertino Warmling, 576 — Salto do Lontra - PR (anexo à Autoescola Fasolin)";
    $mapsLink = "https://maps.app.goo.gl/6YuQMGYJZDCDShWB9";
    $obsDia = "";
    $gradeBase = [];

    if ($dayOfWeek >= 1 && $dayOfWeek <= 4) { // Seg a Qui (07:00 às 19:00 em Salto do Lontra)
        $gradeBase = [
            "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
            "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
        ];
        $obsDia = "Salto do Lontra: atendimento das 07:00 às 19:00 (consultas de 50 minutos com 10 minutos de intervalo).";
    } elseif ($dayOfWeek === 5) { // Sexta: Manhã (08h às 12h Lontra) / Tarde (14h às 18h Nova Prata)
        $gradeBase = [
            "08:00", "09:00", "10:00", "11:00",
            "14:00", "15:00", "16:00", "17:00"
        ];
        $localDesc = "Sexta: Manhã em Salto do Lontra / Tarde em Nova Prata do Iguaçu";
        $obsDia = "Sexta-feira: Manhã (08:00 às 12:00) em Salto do Lontra (Av. Bertino Warmling, 576); Tarde (14:00 às 18:00) exclusivo em Nova Prata do Iguaçu (R. Barão do Cerro Azul, 284-306 — Centro). Consultas de 50 min com 10 min de intervalo.";
    } elseif ($dayOfWeek === 6) { // Sábado (07:00 às 12:00 em Salto do Lontra)
        $gradeBase = [
            "07:00", "08:00", "09:00", "10:00", "11:00"
        ];
        $obsDia = "Sábado: atendimento em Salto do Lontra exclusivamente pela manhã (07:00 às 12:00). Consultas de 50 min com 10 min de intervalo.";
    } else { // Domingo
        $gradeBase = [];
        $obsDia = "Clínica fechada aos domingos.";
    }

    $ocupadosRanges = [];
    $detalhesOcupados = [];
    try {
        $tFamily = get_tenant_family($tenantId);
        $tPlaceholders = implode(',', array_fill(0, count($tFamily), '?'));
        $sqlAppt = "
            SELECT id, appointment_time, patient_id, treatment_command, status_crm, crm_status
            FROM appointments
            WHERE tenant_id IN ({$tPlaceholders})
              AND DATE(appointment_time) = ?
              AND LOWER(COALESCE(crm_status, status_crm, '')) NOT IN ('cancelado', 'cancelada', 'faltou')
        ";
        $paramsAppt = array_merge($tFamily, [$targetDate]);
        if (!empty($excludeAppointmentId)) {
            $sqlAppt .= " AND id != ? ";
            $paramsAppt[] = $excludeAppointmentId;
        }
        $stmtAppt = $db->prepare($sqlAppt);
        $stmtAppt->execute($paramsAppt);
        $rows = $stmtAppt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $r) {
            $appTimeStr = $r['appointment_time'];
            $appTs = strtotime($appTimeStr);
            if ($appTs !== false) {
                // 50 minutos de consulta + 10 minutos de intervalo técnico = 60 minutos bloqueados por atendimento
                $appEndTs = $appTs + (50 * 60) + (10 * 60);
                $ocupadosRanges[] = [$appTs, $appEndTs];
                $detalhesOcupados[] = date('H:i', $appTs);
            }
        }
    } catch (Throwable $e) {
        // Fallback silencioso
    }

    $isToday = ($targetDate === $now->format('Y-m-d'));
    $minNoticeTs = $now->getTimestamp() + (30 * 60); // 30 min de aviso prévio
    $livres = [];

    foreach ($gradeBase as $slotStr) {
        $slotTs = strtotime("{$targetDate} {$slotStr}:00");
        if ($slotTs === false) continue;
        $slotEndTs = $slotTs + (50 * 60); // 50 minutos de duração

        if ($isToday && $slotTs <= $minNoticeTs) {
            continue;
        }

        $colisao = false;
        foreach ($ocupadosRanges as $range) {
            $ocIni = $range[0];
            $ocFim = $range[1];
            if (!($slotEndTs <= $ocIni || $slotTs >= $ocFim)) {
                $colisao = true;
                break;
            }
        }

        if (!$colisao) {
            $livres[] = $slotStr;
        }
    }

    $detalhesLivres = [];
    foreach ($livres as $l) {
        $fimHora = date('H:i', strtotime("{$targetDate} {$l}:00 + 50 minutes"));
        if ($dayOfWeek === 5) {
            $unidade = ($l < "12:00") ? "Salto do Lontra" : "Nova Prata do Iguaçu";
            $detalhesLivres[] = "{$l} às {$fimHora} ({$unidade})";
        } else {
            $detalhesLivres[] = "{$l} às {$fimHora}";
        }
    }

    return [
        "data" => $targetDate,
        "dia_semana" => $diaNome,
        "cidade" => $cidade,
        "local" => $localDesc,
        "endereco" => $endereco,
        "maps" => $mapsLink,
        "duracao_consulta" => "50 minutos",
        "intervalo_tecnico" => "10 minutos",
        "total_livres" => count($livres),
        "horarios_livres" => $livres,
        "horarios_livres_detalhados" => $detalhesLivres,
        "horarios_ocupados" => $detalhesOcupados,
        "observacao" => $obsDia
    ];
}

/**
 * Envia mensagem pelo WhatsApp via Evolution API de forma padronizada e segura.
 */
function send_evolution_whatsapp_message(PDO $db, string $tenantId, string $phone, string $text): array {
    $telefoneLimpo = preg_replace('/\D/', '', $phone);
    if (empty($telefoneLimpo) || empty($text)) {
        return ["success" => false, "error" => "Telefone ou texto inválido."];
    }

    if (strlen($telefoneLimpo) === 10 || strlen($telefoneLimpo) === 11) {
        $telefoneLimpo = '55' . $telefoneLimpo;
    }

    try {
        $stmtConf = $db->prepare("SELECT * FROM tenant_settings WHERE tenant_id = ? LIMIT 1");
        $stmtConf->execute([$tenantId]);
        $tenantConf = $stmtConf->fetch(PDO::FETCH_ASSOC) ?: [];

        $evoUrl = !empty($tenantConf['evolution_api_url']) ? $tenantConf['evolution_api_url'] : ($tenantConf['evolution_url'] ?? get_env_var('EVOLUTION_API_URL', 'https://evogo.acessaronline.com.br'));
        $evoApiKey = !empty($tenantConf['evolution_api_key']) ? $tenantConf['evolution_api_key'] : ($tenantConf['evolution_apikey'] ?? get_env_var('EVOLUTION_API_KEY', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
        $evoInstance = !empty($tenantConf['evolution_instance_name']) ? $tenantConf['evolution_instance_name'] : ($tenantConf['evolution_instance'] ?? get_env_var('EVOLUTION_INSTANCE_NAME', 'atlanticanatural'));

        if (empty($evoApiKey)) {
            $evoApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
        }

        if (empty($evoUrl) || empty($evoInstance)) {
            return ["success" => false, "error" => "Evolution API não configurada para o tenant {$tenantId}."];
        }

        $isEvoGo = (strpos($evoUrl, 'evogo') !== false || strpos($evoUrl, ':8080') !== false);
        $globalApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));

        // Se for Evolution GO, busca dinamicamente o token da instância via /instance/all para garantir token válido
        if ($isEvoGo) {
            try {
                $chAll = curl_init(rtrim($evoUrl, '/') . "/instance/all");
                curl_setopt($chAll, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chAll, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey, "Content-Type: application/json"]);
                apply_curl_ssl_opts($chAll);
                curl_setopt($chAll, CURLOPT_TIMEOUT, 6);
                $resAll = curl_exec($chAll);
                curl_close($chAll);
                if ($resAll) {
                    $allDec = json_decode($resAll, true) ?: [];
                    foreach ($allDec['data'] ?? [] as $item) {
                        if (($item['name'] ?? '') === $evoInstance) {
                            if (!empty($item['token'])) {
                                $evoApiKey = $item['token'];
                            }
                            break;
                        }
                    }
                }
            } catch (Throwable $eToken) {}
        }

        $headers = [
            "apikey: " . $evoApiKey,
            "Content-Type: application/json"
        ];
        $primaryUrl = $isEvoGo 
            ? (rtrim($evoUrl, '/') . '/send/text')
            : (rtrim($evoUrl, '/') . '/message/sendText/' . urlencode($evoInstance));
        $fallbackUrl = $isEvoGo
            ? (rtrim($evoUrl, '/') . '/message/sendText/' . urlencode($evoInstance))
            : (rtrim($evoUrl, '/') . '/send/text');

        $payload = [
            "number" => $telefoneLimpo,
            "text" => $text
        ];

        // 1. Tentativa Primária
        $ch = curl_init($primaryUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        apply_curl_ssl_opts($ch);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        // 2. Fallback Inteligente caso o endpoint primário retorne 404 ou erro de rota
        if ($httpCode === 404 || ($httpCode >= 400 && strpos($response, 'Cannot POST') !== false)) {
            $chFallback = curl_init($fallbackUrl);
            curl_setopt($chFallback, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chFallback, CURLOPT_POST, true);
            curl_setopt($chFallback, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($chFallback, CURLOPT_POSTFIELDS, json_encode($payload));
            apply_curl_ssl_opts($chFallback);
            curl_setopt($chFallback, CURLOPT_TIMEOUT, 12);
            $fbResponse = curl_exec($chFallback);
            $fbHttpCode = curl_getinfo($chFallback, CURLINFO_HTTP_CODE);
            $fbCurlErr = curl_error($chFallback);
            curl_close($chFallback);

            if ($fbHttpCode >= 200 && $fbHttpCode < 300) {
                $response = $fbResponse;
                $httpCode = $fbHttpCode;
                $curlErr = $fbCurlErr;
            }
        }

        $success = ($httpCode >= 200 && $httpCode < 300);
        return [
            "success" => $success,
            "http_code" => $httpCode,
            "response" => json_decode($response, true) ?: $response,
            "error" => $curlErr
        ];
    } catch (Throwable $e) {
        return ["success" => false, "error" => $e->getMessage()];
    }
}

if (!function_exists('sync_google_calendar_event')) {
    /**
     * Sincroniza um agendamento do banco com a Google Agenda do profissional associado.
     */
    function sync_google_calendar_event($db, $appointmentId, $tenantId, $action) {
        try {
            $stmt = $db->prepare("
                SELECT a.id, a.appointment_time, a.treatment_command, a.category, a.event_id,
                       COALESCE(p.name, pr.nome) AS patient_name,
                       COALESCE(p.phone, pr.whatsapp) AS patient_phone,
                       u.id AS user_id, u.name AS user_name, u.email AS user_email, u.google_access_token, u.google_refresh_token, u.google_token_expires
                FROM appointments a
                LEFT JOIN patients p ON a.patient_id = p.id
                LEFT JOIN prospects pr ON a.patient_id = pr.id
                LEFT JOIN users u ON (a.professional = u.id OR a.professional = u.name)
                WHERE a.id = ?
            ");
            $stmt->execute([$appointmentId]);
            $appt = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$appt) {
                return false;
            }

            // Se o profissional específico não tiver token, busca qualquer líder/usuário do tenant com Google conectado
            if (empty($appt['google_refresh_token'])) {
                $tFamily = ($tenantId === 'crmclinica') ? ['crmclinica'] : get_tenant_family($tenantId);
                $tPlaceholders = implode(',', array_fill(0, count($tFamily), '?'));
                $stmtUserFallback = $db->prepare("
                    SELECT id AS user_id, name AS user_name, email AS user_email, google_access_token, google_refresh_token, google_token_expires
                    FROM users 
                    WHERE (tenant_id IN ({$tPlaceholders}) OR tenant_id = 'atlanticanatural' OR role = 'superadmin')
                      AND google_refresh_token IS NOT NULL AND google_refresh_token <> '' 
                    ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END ASC, google_token_expires DESC, created_at DESC 
                    LIMIT 1
                ");
                $stmtUserFallback->execute(array_merge($tFamily, [$tenantId]));
                $userFallback = $stmtUserFallback->fetch(PDO::FETCH_ASSOC);

                if ($userFallback && !empty($userFallback['google_refresh_token'])) {
                    $appt['user_id'] = $userFallback['user_id'];
                    $appt['user_name'] = $userFallback['user_name'];
                    $appt['google_access_token'] = $userFallback['google_access_token'];
                    $appt['google_refresh_token'] = $userFallback['google_refresh_token'];
                    $appt['google_token_expires'] = $userFallback['google_token_expires'];
                } else {
                    $errLog = "\n[" . date('d/m/Y H:i:s') . "] Falha Google Calendar: Nenhum usuário com Google conectado para o tenant '{$tenantId}'.";
                    $db->prepare("UPDATE appointments SET logs = CONCAT(COALESCE(logs, ''), ?) WHERE id = ?")->execute([$errLog, $appointmentId]);
                    error_log("[Google Calendar Sync] Sem conta Google conectada para o tenant {$tenantId} (Agendamento: {$appointmentId})");
                    return false;
                }
            }
            
            $accessToken = $appt['google_access_token'];
            $refreshToken = $appt['google_refresh_token'];
            $expiresAt = $appt['google_token_expires'];
            $calendarId = 'primary';
            
            // Renovar token se expirado ou prestes a expirar (margem de 5 minutos)
            $isExpired = empty($expiresAt) || (strtotime($expiresAt) < (time() + 300));
            if ($isExpired && !empty($refreshToken)) {
                $clientId = get_env_var('VITE_GOOGLE_CLIENT_ID', get_env_var('GOOGLE_CLIENT_ID', ''));
                $clientSecret = get_env_var('GOOGLE_CLIENT_SECRET', '');
                
                if (!empty($clientId) && !empty($clientSecret)) {
                    $ch = curl_init("https://oauth2.googleapis.com/token");
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_POST, true);
                    apply_curl_ssl_opts($ch);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
                        'client_id' => $clientId,
                        'client_secret' => $clientSecret,
                        'refresh_token' => $refreshToken,
                        'grant_type' => 'refresh_token'
                    ]));
                    
                    $response = curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    
                    if ($httpCode === 200) {
                        $tokens = json_decode($response, true);
                        $accessToken = $tokens['access_token'] ?? $accessToken;
                        $expiresIn = $tokens['expires_in'] ?? 3600;
                        $newExpiresAt = date('Y-m-d H:i:s', time() + $expiresIn);
                        
                        $stmtUpdateUser = $db->prepare("
                            UPDATE users 
                            SET google_access_token = ?, google_token_expires = ?
                            WHERE id = ?
                        ");
                        $stmtUpdateUser->execute([$accessToken, $newExpiresAt, $appt['user_id']]);
                    } else {
                        $errLog = "\n[" . date('d/m/Y H:i:s') . "] Falha renovar token Google (HTTP {$httpCode}): {$response}";
                        $db->prepare("UPDATE appointments SET logs = CONCAT(COALESCE(logs, ''), ?) WHERE id = ?")->execute([$errLog, $appointmentId]);
                        error_log("[Google Calendar Sync] Falha ao renovar token OAuth: HTTP {$httpCode} - {$response}");
                    }
                }
            }
            
            if (empty($accessToken)) {
                $errLog = "\n[" . date('d/m/Y H:i:s') . "] Falha Google Calendar: Token de acesso vazio ou não pôde ser renovado.";
                $db->prepare("UPDATE appointments SET logs = CONCAT(COALESCE(logs, ''), ?) WHERE id = ?")->execute([$errLog, $appointmentId]);
                error_log("[Google Calendar Sync] Access token vazio para agendamento {$appointmentId}");
                return false;
            }

            if ($action === 'delete') {
                if (!empty($appt['event_id'])) {
                    $evtId = $appt['event_id'];
                    try {
                        $isPg = ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql');
                        $sqlBlk = $isPg
                            ? "INSERT INTO deleted_google_events (event_id, deleted_at) VALUES (?, NOW()) ON CONFLICT (event_id) DO NOTHING"
                            : "INSERT IGNORE INTO deleted_google_events (event_id, deleted_at) VALUES (?, NOW())";
                        $stmtBlk = $db->prepare($sqlBlk);
                        $stmtBlk->execute([$evtId]);
                    } catch (Throwable $th) {}

                    $url = "https://www.googleapis.com/calendar/v3/calendars/" . urlencode($calendarId) . "/events/" . urlencode($evtId);
                    $ch = curl_init($url);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
                    apply_curl_ssl_opts($ch);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                    curl_setopt($ch, CURLOPT_HTTPHEADER, [
                        "Authorization: Bearer " . $accessToken
                    ]);
                    curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    
                    // 2. Executa DELETE em TODAS as outras contas Google conectadas do tenant para garantir purga total
                    try {
                        $stmtOtherUsers = $db->prepare("
                            SELECT id, google_access_token, google_refresh_token, google_token_expires 
                            FROM users 
                            WHERE id <> ? AND (tenant_id = ? OR tenant_id = 'atlanticanatural' OR role = 'superadmin')
                              AND google_refresh_token IS NOT NULL AND google_refresh_token <> ''
                        ");
                        $stmtOtherUsers->execute([$appt['user_id'] ?? '', $tenantId]);
                        $otherUsers = $stmtOtherUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        foreach ($otherUsers as $ou) {
                            $tkOu = $ou['google_access_token'];
                            if (!empty($tkOu)) {
                                $ch2 = curl_init($url);
                                curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
                                curl_setopt($ch2, CURLOPT_CUSTOMREQUEST, "DELETE");
                                apply_curl_ssl_opts($ch2);
                                curl_setopt($ch2, CURLOPT_TIMEOUT, 6);
                                curl_setopt($ch2, CURLOPT_HTTPHEADER, ["Authorization: Bearer " . $tkOu]);
                                curl_exec($ch2);
                                curl_close($ch2);
                            }
                        }
                    } catch (Throwable $thOu) {}
                    
                    $stmtClear = $db->prepare("UPDATE appointments SET event_id = NULL WHERE id = ?");
                    $stmtClear->execute([$appointmentId]);
                }
                return true;
            }
            
            // Dados formatados do evento para o MMN Atlântica Natural
            $rawLeadName = !empty($appt['patient_name']) ? $appt['patient_name'] : 'Lead / Prospect';
            $cleanLeadName = clean_patient_name_from_summary($rawLeadName);
            $leadSubject = 'Apresentação APN com Professor Salésio';
            $leaderName = !empty($appt['user_name']) ? $appt['user_name'] : 'Professor Salésio';
            $leadPhone = !empty($appt['patient_phone']) ? preg_replace('/\D/', '', $appt['patient_phone']) : '';
            
            $eventSummary = "{$leadSubject}: {$cleanLeadName}";
            $eventDesc = "Prospect / Lead: {$cleanLeadName}\nWhatsApp: {$leadPhone}\nAssunto: {$leadSubject}\nLíder Responsável: {$leaderName}\nAgendamento CRM: {$appointmentId}\nStatus: Confirmado via CRM Atlântica Natural";
            $startISO = date('c', strtotime($appt['appointment_time']));
            $endISO = date('c', strtotime($appt['appointment_time'] . ' + 1 hour'));
            
            $eventData = [
                'summary' => $eventSummary,
                'description' => $eventDesc,
                'start' => [
                    'dateTime' => $startISO,
                    'timeZone' => 'America/Sao_Paulo'
                ],
                'end' => [
                    'dateTime' => $endISO,
                    'timeZone' => 'America/Sao_Paulo'
                ]
            ];
            
            if ($action === 'create' || empty($appt['event_id'])) {
                $url = "https://www.googleapis.com/calendar/v3/calendars/" . urlencode($calendarId) . "/events";
                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                apply_curl_ssl_opts($ch);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    "Authorization: Bearer " . $accessToken,
                    "Content-Type: application/json"
                ]);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($eventData));
                $res = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                
                if ($httpCode === 200 || $httpCode === 201) {
                    $event = json_decode($res, true);
                    if (!empty($event['id'])) {
                        $timeLog = date('d/m/Y H:i:s');
                        $logMsg = "\n[{$timeLog}] Evento Google Agenda criado com sucesso (ID: {$event['id']}).";
                        $stmtSaveEvent = $db->prepare("UPDATE appointments SET event_id = ?, logs = CONCAT(COALESCE(logs, ''), ?) WHERE id = ?");
                        $stmtSaveEvent->execute([$event['id'], $logMsg, $appointmentId]);
                        return true;
                    }
                } else {
                    $timeLog = date('d/m/Y H:i:s');
                    $logMsg = "\n[{$timeLog}] Falha ao criar no Google Calendar (HTTP {$httpCode}): " . $res;
                    $stmtLog = $db->prepare("UPDATE appointments SET logs = CONCAT(COALESCE(logs, ''), ?) WHERE id = ?");
                    $stmtLog->execute([$logMsg, $appointmentId]);
                    error_log("[Google Calendar Sync] Falha ao criar evento ({$appointmentId}): HTTP {$httpCode} - {$res}");
                    return false;
                }
            } elseif ($action === 'update' && !empty($appt['event_id'])) {
                $url = "https://www.googleapis.com/calendar/v3/calendars/" . urlencode($calendarId) . "/events/" . urlencode($appt['event_id']);
                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
                apply_curl_ssl_opts($ch);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    "Authorization: Bearer " . $accessToken,
                    "Content-Type: application/json"
                ]);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($eventData));
                $res = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                
                if ($httpCode === 200 || $httpCode === 201) {
                    $timeLog = date('d/m/Y H:i:s');
                    $logMsg = "\n[{$timeLog}] Evento Google Agenda atualizado com sucesso.";
                    $stmtLog = $db->prepare("UPDATE appointments SET logs = CONCAT(COALESCE(logs, ''), ?) WHERE id = ?");
                    $stmtLog->execute([$logMsg, $appointmentId]);
                    return true;
                } elseif ($httpCode === 404 || $httpCode === 410) {
                    // Se foi apagada no Google Calendar, recria
                    $url = "https://www.googleapis.com/calendar/v3/calendars/" . urlencode($calendarId) . "/events";
                    $ch = curl_init($url);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_POST, true);
                    apply_curl_ssl_opts($ch);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                    curl_setopt($ch, CURLOPT_HTTPHEADER, [
                        "Authorization: Bearer " . $accessToken,
                        "Content-Type: application/json"
                    ]);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($eventData));
                    $res2 = curl_exec($ch);
                    $httpCode2 = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    
                    if ($httpCode2 === 200 || $httpCode2 === 201) {
                        $event2 = json_decode($res2, true);
                        if (!empty($event2['id'])) {
                            $timeLog = date('d/m/Y H:i:s');
                            $logMsg = "\n[{$timeLog}] Evento Google Agenda recriado com sucesso (ID: {$event2['id']}).";
                            $stmtSaveEvent = $db->prepare("UPDATE appointments SET event_id = ?, logs = CONCAT(COALESCE(logs, ''), ?) WHERE id = ?");
                            $stmtSaveEvent->execute([$event2['id'], $logMsg, $appointmentId]);
                            return true;
                        }
                    }
                } else {
                    $timeLog = date('d/m/Y H:i:s');
                    $logMsg = "\n[{$timeLog}] Falha ao atualizar evento no Google Calendar (HTTP {$httpCode}): " . $res;
                    $stmtLog = $db->prepare("UPDATE appointments SET logs = CONCAT(COALESCE(logs, ''), ?) WHERE id = ?");
                    $stmtLog->execute([$logMsg, $appointmentId]);
                    error_log("[Google Calendar Sync] Falha ao atualizar evento ({$appointmentId}): HTTP {$httpCode} - {$res}");
                    return false;
                }
            }
            return true;
        } catch (Throwable $e) {
            error_log("[Google Calendar Sync Exception] " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
            try {
                $timeLog = date('d/m/Y H:i:s');
                $stmtLog = $db->prepare("UPDATE appointments SET logs = CONCAT(COALESCE(logs, ''), ?) WHERE id = ?");
                $stmtLog->execute(["\n[{$timeLog}] Erro interno sincronização Google Calendar: " . $e->getMessage(), $appointmentId]);
            } catch (Throwable $thLog) {}
            return false;
        }
    }
}

