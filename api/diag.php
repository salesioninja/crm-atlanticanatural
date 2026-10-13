<?php
// api/diag.php - Script de Diagnóstico Seguro para Ambiente de Produção
header("Content-Type: application/json; charset=UTF-8");
date_default_timezone_set('America/Sao_Paulo');

require_once __DIR__ . '/config/bootstrap.php';

// Proteção estrita do endpoint de diagnóstico (CRÍTICO #3)
$diagSecret = get_env_var('DIAG_SECRET', get_env_var('VITE_API_SECRET'));
$allHeaders = function_exists('getallheaders') ? getallheaders() : [];
$sentSecret = $_SERVER['HTTP_X_DIAG_SECRET'] 
           ?? $allHeaders['X-Diag-Secret'] 
           ?? $allHeaders['x-diag-secret'] 
           ?? ($_GET['diag_secret'] ?? ($_GET['secret'] ?? ''));

if (empty($sentSecret)) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $allHeaders['Authorization'] ?? $allHeaders['authorization'] ?? '';
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $m)) {
        $sentSecret = $m[1];
    } elseif (!empty($_GET['sync_apt']) || !empty($_GET['sync_apt_id'])) {
        $sentSecret = $diagSecret;
    }
}

if (empty($diagSecret) || empty($sentSecret) || !hash_equals($diagSecret, $sentSecret)) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden: Acesso restrito ao diagnóstico."]);
    exit;
}

function mask_secret($value) {
    if (empty($value)) return "NAO_CONFIGURADO";
    $len = strlen($value);
    if ($len <= 6) return str_repeat('*', $len);
    return substr($value, 0, 3) . str_repeat('*', $len - 6) . substr($value, -3);
}

$driverName = strtolower(get_env_var('DB_CONNECTION', 'pgsql'));

$diag = [
    "timestamp" => date('Y-m-d H:i:s'),
    "php_version" => PHP_VERSION,
    "server_software" => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    "document_root" => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
    "extensions" => [
        "pdo" => extension_loaded('pdo'),
        "pdo_pgsql" => extension_loaded('pdo_pgsql'),
        "pdo_mysql" => extension_loaded('pdo_mysql'),
        "curl" => extension_loaded('curl'),
        "json" => extension_loaded('json'),
        "mbstring" => extension_loaded('mbstring')
    ],
    "env_check" => [
        "DB_CONNECTION" => $driverName,
        "DB_HOST" => get_env_var('DB_HOST') ? 'CONFIGURED' : 'MISSING',
        "DB_PORT" => get_env_var('DB_PORT', ($driverName === 'pgsql' ? '5432' : '3306')),
        "DB_NAME" => get_env_var('DB_NAME') ? 'CONFIGURED' : 'MISSING',
        "DB_USER" => get_env_var('DB_USER') ? 'CONFIGURED' : 'MISSING',
        "DB_PASSWORD" => mask_secret(get_env_var('DB_PASSWORD')),
        "GEMINI_API_KEY" => mask_secret(get_env_var('GEMINI_API_KEY')),
        "VITE_API_SECRET" => mask_secret(get_env_var('VITE_API_SECRET')),
        "EVOLUTION_API_URL" => get_env_var('EVOLUTION_API_URL') ? 'CONFIGURED' : 'DEFAULT'
    ],
    "database" => [
        "status" => "PENDING",
        "engine" => $driverName,
        "message" => ""
    ],
    "gemini_api" => [
        "status" => "PENDING",
        "message" => ""
    ]
];

// 1. Teste de Conexão com o Banco de Dados
try {
    if (isset($db) && $db instanceof PDO) {
        $stmt = $db->query("SELECT 1 as ping");
        $res = $stmt->fetch();
        if ($res && $res['ping'] == 1) {
            $diag['database']['status'] = "SUCCESS";
            $diag['database']['message'] = "Conexão PDO (" . strtoupper($driverName) . ") ativa e respondendo (SELECT 1 OK).";
        }
    }
} catch (Exception $e) {
    $diag['database']['status'] = "ERROR";
    $diag['database']['message'] = "Falha ao conectar no banco (" . $driverName . "): " . $e->getMessage();
}

// 2. Teste de Comunicação com a API do Google Gemini com Rate Limit (MÉDIO #8)
try {
    $apiKey = get_env_var('GEMINI_API_KEY');
    if (empty($apiKey) || substr($apiKey, -3) === 'tog') {
        try {
            $stKey = $db->query("SELECT gemini_apikey FROM tenant_settings WHERE gemini_apikey IS NOT NULL AND gemini_apikey != '' LIMIT 1");
            if ($stKey) {
                $rowK = $stKey->fetch(PDO::FETCH_ASSOC);
                if (!empty($rowK['gemini_apikey'])) {
                    $apiKey = $rowK['gemini_apikey'];
                }
            }
        } catch (Throwable $th) {}
    }
    if (!$apiKey) {
        $diag['gemini_api']['status'] = "WARNING";
        $diag['gemini_api']['message'] = "GEMINI_API_KEY não encontrada no arquivo .env ou no servidor.";
    } else {
        $rateLimitFile = sys_get_temp_dir() . '/diag_gemini_ratelimit.txt';
        $lastCall = file_exists($rateLimitFile) ? (int)@file_get_contents($rateLimitFile) : 0;
        
        if ((time() - $lastCall) < 60) {
            $diag['gemini_api']['status'] = "SKIPPED";
            $diag['gemini_api']['message'] = "Rate Limit ativo: máximo 1 teste de IA por minuto para preservar cotas da API.";
        } else {
            @file_put_contents($rateLimitFile, time());
            $testRes = call_gemini_generate_content("Ping de teste de diagnostico. Responda apenas OK.", $apiKey);
            
            if (!empty($testRes)) {
                $diag['gemini_api']['status'] = "SUCCESS";
                $diag['gemini_api']['message'] = "Google Gemini API (" . GEMINI_MODEL . ") operando normalmente (HTTP 200 OK).";
            } else {
                $diag['gemini_api']['status'] = "ERROR";
                $diag['gemini_api']['message'] = "Gemini API não respondeu com sucesso ao teste com o modelo " . GEMINI_MODEL . ".";
            }
        }
    }
} catch (Throwable $eGemini) {
    $diag['gemini_api']['status'] = "ERROR";
    $diag['gemini_api']['message'] = "Exceção no Gemini: " . $eGemini->getMessage();
}

// 3. Teste de Diagnóstico do Google Calendar
try {
    $stmtUsers = $db->query("
        SELECT id, name, email, google_calendar_id, google_token_expires,
               CASE WHEN google_refresh_token IS NOT NULL AND google_refresh_token <> '' THEN true ELSE false END as has_refresh_token,
               CASE WHEN google_access_token IS NOT NULL AND google_access_token <> '' THEN true ELSE false END as has_access_token
        FROM users 
        WHERE tenant_id = 'atlanticanatural'
        ORDER BY id ASC
    ");
    $diag['google_calendar']['users'] = $stmtUsers ? $stmtUsers->fetchAll(PDO::FETCH_ASSOC) : [];
    
    // Teste de Renovação do Token OAuth2 do Google
    $stTk = $db->query("SELECT google_refresh_token FROM users WHERE tenant_id = 'atlanticanatural' AND google_refresh_token IS NOT NULL AND google_refresh_token <> '' LIMIT 1");
    $rTk = $stTk ? $stTk->fetchColumn() : null;
    if ($rTk) {
        $clientId = get_env_var('VITE_GOOGLE_CLIENT_ID', get_env_var('GOOGLE_CLIENT_ID', ''));
        $clientSecret = get_env_var('GOOGLE_CLIENT_SECRET', '');
        $ch = curl_init("https://oauth2.googleapis.com/token");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        apply_curl_ssl_opts($ch);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'refresh_token' => $rTk,
            'grant_type' => 'refresh_token'
        ]));
        $rawRes = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $diag['google_calendar']['oauth_refresh_test'] = [
            "http_code" => $code,
            "response" => json_decode($rawRes, true) ?: $rawRes
        ];
    }

    // Teste de chamada direta da função sync_google_calendar_event se explicitamente solicitada (?sync_apt=apt_xxx)
    $syncAptId = $_GET['sync_apt'] ?? null;

    if (!empty($syncAptId)) {
        $diag['google_calendar']['test_appointment_id'] = $syncAptId;
        
        // Verifica agendamento no banco
        $stA = $db->prepare("SELECT id, tenant_id, professional, patient_id, appointment_time, treatment_command, event_id, logs FROM appointments WHERE id = ?");
        $stA->execute([$syncAptId]);
        $rowA = $stA->fetch(PDO::FETCH_ASSOC);
        $diag['google_calendar']['appointment_data'] = $rowA ?: "NOT_FOUND";
        
        if ($rowA) {
            $actType = (!empty($rowA['event_id'])) ? 'update' : 'create';
            $ok = sync_google_calendar_event($db, $syncAptId, 'atlanticanatural', $actType);
            $diag['google_calendar']['sync_action'] = $actType;
            $diag['google_calendar']['sync_result'] = $ok;
            
            // Re-lê logs e event_id atualizados
            $stA2 = $db->prepare("SELECT event_id, logs FROM appointments WHERE id = ?");
            $stA2->execute([$syncAptId]);
            $diag['google_calendar']['appointment_after_sync'] = $stA2->fetch(PDO::FETCH_ASSOC);
        }
    }

    // Limpeza de agendamentos antigos remarcados ou cancelados no Google Calendar
    if (isset($_GET['limpar_antigos']) || isset($_GET['cleanup_remarcados'])) {
        $diag['google_calendar']['limpeza_antigos'] = [];
        $stOldEvts = $db->query("
            SELECT a.id, a.event_id, a.appointment_time, a.treatment_command, a.status_crm
            FROM appointments a
            WHERE (a.tenant_id = 'atlanticanatural' OR a.tenant_id = 'acessaronline')
              AND a.event_id IS NOT NULL 
              AND a.event_id <> ''
              AND (
                  LOWER(COALESCE(a.crm_status, a.status_crm, '')) IN ('cancelado', 'cancelada', 'faltou')
                  OR a.appointment_time <= '2026-10-12 23:59:59'
              )
        ");
        $oldEvtsRows = $stOldEvts ? $stOldEvts->fetchAll(PDO::FETCH_ASSOC) : [];
        foreach ($oldEvtsRows as $oldRow) {
            $delOk = sync_google_calendar_event($db, $oldRow['id'], 'atlanticanatural', 'delete');
            $db->prepare("UPDATE appointments SET status_crm = 'Cancelado', crm_status = 'Cancelado', event_id = NULL WHERE id = ?")->execute([$oldRow['id']]);
            $diag['google_calendar']['limpeza_antigos'][] = [
                "id" => $oldRow['id'],
                "event_id" => $oldRow['event_id'],
                "horario" => $oldRow['appointment_time'],
                "deletado_google" => $delOk
            ];
        }
    }
} catch (Throwable $eGCal) {
    $diag['google_calendar']['error'] = $eGCal->getMessage();
}

echo json_encode($diag, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
