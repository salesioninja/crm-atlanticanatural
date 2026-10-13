<?php
// api/index.php - V7 - Rotação e correção de cache

require_once __DIR__ . '/config/bootstrap.php'; // Carrega CORS, Auth, Tenant e $db

/**
 * Garante que a tabela 'patients' no MySQL contenha todas as colunas necessárias para prontuários,
 * fotos, documentos, responsável e ficha anamnese (skin_condition, is_pregnant, etc).
 */
function ensure_patients_table_schema($db) {
    static $done = false;
    if ($done || !$db) return;
    $done = true;

    try {
        $db->exec("
            CREATE TABLE IF NOT EXISTS patients (
                id VARCHAR(50) PRIMARY KEY,
                tenant_id VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                email VARCHAR(255) DEFAULT 'N/A',
                bot_status VARCHAR(20) DEFAULT 'active',
                clinical_notes LONGTEXT,
                skin_condition VARCHAR(100),
                allergies LONGTEXT,
                is_pregnant BOOLEAN DEFAULT FALSE,
                files_json LONGTEXT,
                photos_json LONGTEXT,
                responsible_prof VARCHAR(255),
                patient_since VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_patient_tenant_phone (tenant_id, phone)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        $cols = [
            "ADD COLUMN skin_condition VARCHAR(100)",
            "ADD COLUMN is_pregnant BOOLEAN DEFAULT FALSE",
            "ADD COLUMN clinical_notes LONGTEXT",
            "MODIFY COLUMN clinical_notes LONGTEXT",
            "ADD COLUMN allergies LONGTEXT",
            "MODIFY COLUMN allergies LONGTEXT",
            "ADD COLUMN files_json LONGTEXT",
            "MODIFY COLUMN files_json LONGTEXT",
            "ADD COLUMN photos_json LONGTEXT",
            "MODIFY COLUMN photos_json LONGTEXT",
            "ADD COLUMN responsible_prof VARCHAR(255)",
            "ADD COLUMN patient_since VARCHAR(100)"
        ];

        foreach ($cols as $colSql) {
            try { $db->exec("ALTER TABLE patients " . $colSql); } catch (Throwable $eC) {}
        }
    } catch (Throwable $eSchema) {}
}

ensure_patients_table_schema($db);

function ensure_appointments_table_schema($db) {
    static $done = false;
    if ($done || !$db) return;
    $done = true;

    try {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'pgsql') {
            // Se appointments for uma VIEW, remove a view e recria como tabela real
            $stmtCheck = $db->query("SELECT table_type FROM information_schema.tables WHERE table_name = 'appointments' AND table_schema = 'public'");
            $type = $stmtCheck ? $stmtCheck->fetchColumn() : null;
            if ($type === 'VIEW') {
                $db->exec("DROP VIEW IF EXISTS appointments CASCADE");
            }

            $db->exec("
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
                VALUES ('atlanticanatural', 'https://evogo.acessaronline.com.br', 'd7b87fcfca7d42cfb7692298bc6d42ef', 'atlanticanatural, Teste-disparo-maximo')
                ON CONFLICT (tenant_id) DO UPDATE SET 
                    evolution_api_url = EXCLUDED.evolution_api_url,
                    evolution_api_key = EXCLUDED.evolution_api_key,
                    evolution_instance_name = CASE 
                        WHEN tenant_settings.evolution_instance_name LIKE '%Teste-disparo-maximo%' 
                        THEN tenant_settings.evolution_instance_name 
                        ELSE 'atlanticanatural, Teste-disparo-maximo' 
                    END;
            ");
        }
    } catch (Throwable $eSchema) {}
}

ensure_appointments_table_schema($db);

/**
 * Normaliza valores de data e hora para o formato MySQL DATETIME (Y-m-d H:i:s),
 * eliminando o 'T' originado de inputs datetime-local do HTML5.
 */
function normalize_datetime($dtString) {
    if (empty($dtString)) return date('Y-m-d H:i:s');
    $clean = str_replace('T', ' ', trim($dtString));
    if (strlen($clean) === 16) {
        $clean .= ':00';
    }
    $ts = strtotime($clean);
    if ($ts === false || $ts <= 0) {
        return date('Y-m-d H:i:s');
    }
    return date('Y-m-d H:i:s', $ts);
}

/**
 * Puxa automaticamente os eventos mais recentes da Google Agenda para garantir
 * atualização em tempo real caso o webhook tenha algum atraso.
 */
function sync_google_calendar_pull_latest($db, $tenantId) {
    static $alreadyRan = false;
    if ($alreadyRan) return;
    $alreadyRan = true;

    // Utiliza arquivo lock temporário para limitar execuções a cada 10 segundos por tenant
    $lockFile = sys_get_temp_dir() . "/gcal_sync_lock_" . md5($tenantId) . ".txt";
    if (file_exists($lockFile) && (time() - filemtime($lockFile)) < 10) {
        return;
    }
    @touch($lockFile);

    try {
        // Obter token ativo do Google isolado por inquilino
        $tFamily = ($tenantId === 'crmclinica') ? ['crmclinica'] : get_tenant_family($tenantId);
        $tPlaceholders = implode(',', array_fill(0, count($tFamily), '?'));

        $stmt = $db->prepare("
            SELECT id, tenant_id, google_access_token, google_refresh_token, google_token_expires 
            FROM users 
            WHERE (tenant_id IN ({$tPlaceholders}) OR (id = 'usr_357cbe1ddf129d8c' AND '{$tenantId}' != 'crmclinica'))
              AND google_refresh_token IS NOT NULL AND google_refresh_token <> '' 
            ORDER BY 
                CASE WHEN tenant_id = '{$tenantId}' THEN 0 WHEN id = 'usr_357cbe1ddf129d8c' THEN 1 ELSE 2 END ASC,
                google_token_expires DESC, created_at DESC 
            LIMIT 1
        ");
        $stmt->execute($tFamily);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || empty($user['google_refresh_token'])) return;

        $accessToken = $user['google_access_token'];
        $refreshToken = $user['google_refresh_token'];
        $expiresAt = $user['google_token_expires'];

        if (empty($accessToken) || empty($expiresAt) || (time() + 60) >= strtotime($expiresAt)) {
            $chToken = curl_init("https://oauth2.googleapis.com/token");
            curl_setopt($chToken, CURLOPT_POST, true);
            apply_curl_ssl_opts($chToken);
            curl_setopt($chToken, CURLOPT_POSTFIELDS, http_build_query([
                'client_id' => get_env_var('VITE_GOOGLE_CLIENT_ID', get_env_var('GOOGLE_CLIENT_ID')),
                'client_secret' => get_env_var('GOOGLE_CLIENT_SECRET'),
                'refresh_token' => $refreshToken,
                'grant_type' => 'refresh_token'
            ]));
            curl_setopt($chToken, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chToken, CURLOPT_TIMEOUT, 4);
            $resToken = curl_exec($chToken);
            curl_close($chToken);
            $arrToken = json_decode($resToken, true);
            if (!empty($arrToken['access_token'])) {
                $accessToken = $arrToken['access_token'];
                $newExpiresAt = date('Y-m-d H:i:s', time() + ($arrToken['expires_in'] ?? 3600));
                $stmtUpdToken = $db->prepare("UPDATE users SET google_access_token = ?, google_token_expires = ? WHERE id = ?");
                $stmtUpdToken->execute([$accessToken, $newExpiresAt, $user['id']]);
            }
        }

        if (empty($accessToken)) return;

        $timeMin = urlencode(date('Y-m-d\TH:i:s\Z', strtotime('-1 day')));
        $apiUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={$timeMin}&showDeleted=true";

        $ch = curl_init($apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        apply_curl_ssl_opts($ch);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer {$accessToken}",
            "Content-Type: application/json"
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 4);
        $response = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($response, true) ?: [];
        $events = $data['items'] ?? [];

        if (empty($events)) return;

        // Lista de eventos deletados para NUNCA reinserir
        $deletedGoogleIds = [];
        try {
            $stmtDelList = $db->query("SELECT event_id FROM deleted_google_events");
            $deletedGoogleIds = $stmtDelList->fetchAll(PDO::FETCH_COLUMN) ?: [];
        } catch (Throwable $th) {}

        // Define tenant e profissional padrão para novas importações
        $tId = !empty($tenantId) ? $tenantId : 'acessaronline';
        $pId = !empty($user['id']) ? $user['id'] : 'p1';

        $isPg = ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql');
        $sqlPatFb = $isPg
            ? "INSERT INTO patients (id, tenant_id, name, phone, email) 
               VALUES (?, ?, ?, ?, 'gcal@clinica.internal')
               ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone"
            : "INSERT INTO patients (id, tenant_id, name, phone, email) 
               VALUES (?, ?, ?, ?, 'gcal@clinica.internal')
               ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone)";
        $stmtPatientFallback = $db->prepare($sqlPatFb);

        $stmtFind = $db->prepare("
            SELECT id, tenant_id, status_crm, crm_status, appointment_time, logs 
            FROM appointments 
            WHERE event_id = ? 
            LIMIT 1
        ");

        $stmtInsert = $db->prepare("
            INSERT INTO appointments (
                id, tenant_id, patient_id, professional, category, price, valor_consulta,
                appointment_time, data_consulta, message_time, treatment_command, 
                ai_message_preview, status_message, status_crm, crm_status, event_id, logs
            ) VALUES (?, ?, ?, ?, ?, 0.00, 0.00, ?, ?, ?, ?, ?, ?, 'Agendado', 'Agendado', ?, ?)
        ");

        $stmtUpdateCancelled = $db->prepare("
            UPDATE appointments 
            SET crm_status = ?, status_crm = ?, logs = ? 
            WHERE id = ?
        ");

        $stmtUpdateTimeOnly = $db->prepare("
            UPDATE appointments 
            SET appointment_time = ?, data_consulta = ?, logs = ? 
            WHERE id = ?
        ");

        foreach ($events as $event) {
            $eventId = $event['id'];
            if (empty($eventId)) continue;

            // Se o evento foi excluído via CRM, ignora completamente
            if (in_array($eventId, $deletedGoogleIds)) {
                continue;
            }

            $eventStatus = $event['status'] ?? 'confirmed';
            $summary = $event['summary'] ?? 'Compromisso Google Agenda';
            $description = $event['description'] ?? '';
            $newStart = $event['start']['dateTime'] ?? $event['start']['date'] ?? null;

            if (!$newStart) continue;

            $tsNew = strtotime($newStart);
            $formattedNewTime = date('Y-m-d H:i:s', $tsNew);
            $formattedNewDate = date('Y-m-d', $tsNew);

            // Resolução inteligente de paciente e telefone
            $rawText = $description . ' ' . $summary;
            $telefone = extract_phone_from_text($rawText);
            $cleanPatName = clean_patient_name_from_summary($summary);
            $patientId = null;

            // 1. Tenta identificar se a descrição contém o ID do agendamento ou prospect
            if (preg_match('/Agendamento\s*CRM:\s*(apt_[a-zA-Z0-9_]+)/i', $description, $mAptId)) {
                $refAptId = trim($mAptId[1]);
                try {
                    $stRef = $db->prepare("SELECT patient_id FROM appointments WHERE id = ? LIMIT 1");
                    $stRef->execute([$refAptId]);
                    $rowRef = $stRef->fetch(PDO::FETCH_ASSOC);
                    if ($rowRef && !empty($rowRef['patient_id'])) {
                        $patientId = $rowRef['patient_id'];
                    }
                } catch (Throwable $thRef) {}
            }

            $tPatFamily = ($tId === 'crmclinica') ? ['crmclinica'] : get_tenant_family($tId);
            $tPatPlaceholders = implode(',', array_fill(0, count($tPatFamily), '?'));

            // 2. Busca em prospects se ainda não tem patientId
            if (empty($patientId)) {
                try {
                    $stmtFindPrsp = $db->prepare("
                        SELECT id, nome as name, whatsapp as phone FROM prospects 
                        WHERE (LOWER(nome) = LOWER(?) OR LOWER(nome) LIKE LOWER(?) OR LOWER(?) LIKE CONCAT('%', LOWER(nome), '%'))
                          AND tenant_id IN ({$tPatPlaceholders})
                          AND whatsapp IS NOT NULL AND whatsapp != '' AND whatsapp != '00000000000'
                        ORDER BY id DESC LIMIT 1
                    ");
                    $stmtFindPrsp->execute(array_merge([$cleanPatName, '%' . $cleanPatName . '%', $cleanPatName], $tPatFamily));
                    $matchedPrsp = $stmtFindPrsp->fetch(PDO::FETCH_ASSOC);
                    if ($matchedPrsp) {
                        $patientId = $matchedPrsp['id'];
                        $cleanPatName = $matchedPrsp['name'];
                        if (empty($telefone)) {
                            $telefone = preg_replace('/\D/', '', $matchedPrsp['phone']);
                        }
                    }
                } catch (Throwable $thP) {}
            }

            // 3. Busca em patients se ainda não encontrou
            if (empty($patientId)) {
                try {
                    $stmtFindPat = $db->prepare("
                        SELECT id, name, phone FROM patients 
                        WHERE (LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?) OR LOWER(?) LIKE CONCAT('%', LOWER(name), '%'))
                          AND tenant_id IN ({$tPatPlaceholders})
                          AND phone != '00000000000' AND phone IS NOT NULL AND phone != ''
                        ORDER BY id DESC LIMIT 1
                    ");
                    $stmtFindPat->execute(array_merge([$cleanPatName, '%' . $cleanPatName . '%', $cleanPatName], $tPatFamily));
                    $matchedPat = $stmtFindPat->fetch(PDO::FETCH_ASSOC);
                    if ($matchedPat) {
                        $patientId = $matchedPat['id'];
                        $cleanPatName = $matchedPat['name'];
                        if (empty($telefone)) {
                            $telefone = preg_replace('/\D/', '', $matchedPat['phone']);
                        }
                    }
                } catch (Throwable $thPat) {}
            }

            if (empty($patientId)) {
                if (!empty($telefone)) {
                    $patientId = 'pat_gcal_' . substr(md5($telefone . $tId), 0, 12);
                } else {
                    $patientId = 'pat_gcal_' . substr(md5(mb_strtolower($cleanPatName, 'UTF-8') . $tId), 0, 12);
                    $telefone = '00000000000';
                }
                $stmtPatientFallback->execute([$patientId, $tId, $cleanPatName, $telefone]);
            }

            $stmtFind->execute([$eventId]);
            $existing = $stmtFind->fetch(PDO::FETCH_ASSOC);

            if (!$existing && $eventStatus === 'confirmed') {
                $newApptId = 'apt_gcal_' . substr(md5($eventId . $tId), 0, 16);
                $timeNow = date('d/m/Y H:i:s');
                $hasValidPhone = (!empty($telefone) && $telefone !== '00000000000' && strlen($telefone) >= 10);

                $aiMessagePreview = generate_smart_fallback_message($cleanPatName, $formattedNewTime, $summary, 'Google Calendar');
                $statusMessage = $hasValidPhone ? 'Aguardando' : 'Processado';
                $messageTime = date('Y-m-d H:i:s');
                $log = "[{$timeNow}] Importado automaticamente do Google Calendar: {$summary}" . ($hasValidPhone ? " (WhatsApp agendado para {$cleanPatName})" : " (Sem telefone para WhatsApp)");

                $stmtInsert->execute([
                    $newApptId,
                    $tId,
                    $patientId,
                    $pId,
                    'Google Calendar',
                    $formattedNewTime,
                    $formattedNewDate,
                    $messageTime,
                    $summary,
                    $aiMessagePreview,
                    $statusMessage,
                    $eventId,
                    $log
                ]);

                if ($hasValidPhone) {
                    try {
                        $stmtDispGcal = $db->prepare("
                            INSERT INTO scheduled_dispatches (id, tenant_id, appointment_id, patient_id, dispatch_type, scheduled_time, status, treatment_command, ai_message_preview)
                            VALUES (?, ?, ?, ?, ?, ?, 'Aguardando', ?, ?)
                        ");

                        $appTs = $tsNew;
                        $time24h = date('Y-m-d H:i:s', $appTs - 86400);
                        $time2h  = date('Y-m-d H:i:s', $appTs - 7200);

                        $stmtDispGcal->execute([
                            'disp_imm_' . uniqid(),
                            $tId,
                            $newApptId,
                            $patientId,
                            'immediate',
                            $messageTime,
                            'Confirmação imediata Google Agenda: ' . $summary,
                            $aiMessagePreview
                        ]);

                        if (strtotime($time24h) > time()) {
                            $preview24h = generate_smart_fallback_message($cleanPatName, $formattedNewTime, '24h ' . $summary, 'Google Calendar');
                            $stmtDispGcal->execute([
                                'disp_24h_' . uniqid(),
                                $tId,
                                $newApptId,
                                $patientId,
                                'reminder_24h',
                                $time24h,
                                'Lembrete de véspera (24h antes): ' . $summary,
                                $preview24h
                            ]);
                        }

                        if (strtotime($time2h) > time()) {
                            $preview2h = generate_smart_fallback_message($cleanPatName, $formattedNewTime, '2h ' . $summary, 'Google Calendar');
                            $stmtDispGcal->execute([
                                'disp_2h_' . uniqid(),
                                $tId,
                                $newApptId,
                                $patientId,
                                'reminder_2h',
                                $time2h,
                                'Alerta de proximidade (2h antes): ' . $summary,
                                $preview2h
                            ]);
                        }
                    } catch (Throwable $eDisp) {}
                }
            } elseif ($existing) {
                $currentLogs = $existing['logs'] ?? '';
                $currentStatus = $existing['crm_status'] ?: ($existing['status_crm'] ?: 'Agendado');

                if ($eventStatus === 'cancelled') {
                    if ($currentStatus !== 'Cancelado') {
                        $timeNow = date('d/m/Y H:i:s');
                        $newLog = trim("{$currentLogs}\n[{$timeNow}] Evento cancelado diretamente na Google Agenda.");
                        $stmtUpdateCancelled->execute(['Cancelado', 'Cancelado', $newLog, $existing['id']]);
                        try {
                            $db->prepare("UPDATE scheduled_dispatches SET status = 'Cancelado', status_message = 'Cancelado' WHERE appointment_id = ?")->execute([$existing['id']]);
                        } catch (Throwable $thSd) {}
                    }
                } else {
                    // Preserva integralmente o crm_status e logs do CRM. Apenas atualiza data/hora se foi alterada no Google Calendar.
                    $currentApptTime = $existing['appointment_time'] ?? '';
                    if (date('Y-m-d H:i', strtotime($currentApptTime)) !== date('Y-m-d H:i', $tsNew)) {
                        $timeNow = date('d/m/Y H:i:s');
                        $displayTime = date('d/m/Y H:i', $tsNew);
                        $newLog = trim("{$currentLogs}\n[{$timeNow}] Horário remanejado via Google Agenda para: {$displayTime}.");
                        $stmtUpdateTimeOnly->execute([$formattedNewTime, $formattedNewDate, $newLog, $existing['id']]);
                    }
                }
            }
        }
        // Proativamente envia para o Google Calendar qualquer agendamento recente criado no CRM sem evento
        try {
            $stmtPushMissing = $db->prepare("
                SELECT id FROM appointments 
                WHERE (event_id IS NULL OR event_id = '') 
                  AND appointment_time >= ? 
                  AND LOWER(COALESCE(crm_status, status_crm, '')) NOT IN ('cancelado', 'cancelada', 'faltou')
                ORDER BY created_at DESC 
                LIMIT 15
            ");
            $stmtPushMissing->execute([date('Y-m-d 00:00:00')]);
            while ($pRow = $stmtPushMissing->fetch(PDO::FETCH_ASSOC)) {
                sync_google_calendar_event($db, $pRow['id'], $tenantId, 'create');
            }
        } catch (Throwable $thPush) {}
    } catch (Throwable $e) {
        // Ignora falhas para nao atrasar requisicao
    }
}

// sync_google_calendar_event is already loaded from config/bootstrap.php


// Parse Route and Resource from URL (Tolerante a subpastas de hospedagem como /crm-clinicas/api/)
$uri = $_SERVER['REQUEST_URI'];
$apiPos = strpos($uri, '/api/');

if ($apiPos !== false) {
    $routePath = substr($uri, $apiPos + 5);
} else {
    $apiPosNoSlash = strpos($uri, '/api');
    if ($apiPosNoSlash !== false) {
        $routePath = substr($uri, $apiPosNoSlash + 4);
    } else {
        $routePath = $uri;
    }
}

if (strpos($routePath, 'index.php/') === 0) {
    $routePath = substr($routePath, 10);
} elseif ($routePath === 'index.php' || strpos($routePath, 'index.php?') === 0) {
    $routePath = '';
}

$routePath = explode('?', $routePath)[0]; // Remove query string
$parts = explode('/', trim($routePath, '/'));

$resource = $parts[0] ?? '';
$id = $parts[1] ?? null;
$method = $_SERVER['REQUEST_METHOD'];
$tid = defined('CURRENT_TENANT_ID') ? CURRENT_TENANT_ID : '';

// Route: Gatilho de Cron Job HTTP (Suporte a cron-disparos.php, cron_dispatch.php e rotas virtuais)
if ($resource === 'cron_dispatch' || $resource === 'cron-disparos' || $resource === 'cron_dispatch.php' || $resource === 'cron-disparos.php') {
    require_once __DIR__ . '/cron_dispatch.php';
    exit();
}

// Route: webhook-confirm (Confirmações externas de WhatsApp / n8n / Evolution API)
if ($resource === 'webhook-confirm' || $resource === 'webhook_confirm') {
    try {
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true);
        if (!$input) {
            $input = $_POST;
        }

        $apptId = $input['id'] ?? $input['appointment_id'] ?? null;
        $phone = $input['telefone'] ?? $input['phone'] ?? $input['number'] ?? null;
        $targetStatus = $input['status'] ?? $input['status_crm'] ?? $input['crm_status'] ?? 'Confirmado';

        if (strtolower($targetStatus) === 'confirmado' || strtolower($targetStatus) === 'sim') {
            $targetStatus = 'Confirmado';
        }

        $timestamp = date('d/m/Y H:i:s');
        $logEntry = "\n[{$timestamp}] Status CRM alterado para '{$targetStatus}' via Webhook Externo (WhatsApp/n8n).";

        $updatedId = null;

        if (!empty($apptId)) {
            $stmt = $db->prepare("
                UPDATE appointments 
                SET status_crm = ?, crm_status = ?, logs = CONCAT(IFNULL(logs,''), ?) 
                WHERE id = ?
            ");
            $stmt->execute([$targetStatus, $targetStatus, $logEntry, $apptId]);
            if ($stmt->rowCount() > 0) {
                $updatedId = $apptId;
            }
        }

        if (!$updatedId && !empty($phone)) {
            $cleanPhone = preg_replace('/\D/', '', $phone);
            $searchPattern = '%' . $cleanPhone . '%';
            $stmtFind = $db->prepare("
                SELECT a.id 
                FROM appointments a
                LEFT JOIN patients p ON a.patient_id = p.id
                WHERE (
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(p.phone, '-', ''), ' ', ''), '+', ''), '(', ''), ')', '') LIKE ?
                    OR p.phone LIKE ?
                )
                ORDER BY a.created_at DESC 
                LIMIT 1
            ");
            $stmtFind->execute([$searchPattern, $searchPattern]);
            $foundAppt = $stmtFind->fetch(PDO::FETCH_ASSOC);

            if ($foundAppt && !empty($foundAppt['id'])) {
                $updatedId = $foundAppt['id'];
                $stmtUpd = $db->prepare("
                    UPDATE appointments 
                    SET status_crm = ?, crm_status = ?, logs = CONCAT(IFNULL(logs,''), ?) 
                    WHERE id = ?
                ");
                $stmtUpd->execute([$targetStatus, $targetStatus, $logEntry, $updatedId]);
            }
        }

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "id" => $updatedId,
            "status" => $targetStatus,
            "message" => "Agendamento atualizado para '{$targetStatus}' com sucesso."
        ]);
    } catch (Throwable $e) {
        http_response_code(200);
        echo json_encode([
            "success" => false,
            "error" => "Falha ao processar webhook: " . $e->getMessage()
        ]);
    }
    exit();
}

// Route: auth/resolve
if ($resource === 'auth' && $id === 'resolve' && $method === 'POST') {
    try {
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true) ?? [];
        $email = strtolower(trim($input['email'] ?? ''));
        $subdomain = strtolower(trim($input['subdomain'] ?? ''));
        if (empty($subdomain) || in_array($subdomain, ['www', 'crm', 'localhost', '127'])) {
            $envTenant = get_env_var('TENANT_ID');
            $subdomain = !empty($envTenant) ? $envTenant : 'acessaronline';
        }

        if (empty($email)) {
            http_response_code(400);
            echo json_encode(["error" => "E-mail é obrigatório."]);
            exit();
        }

        // PASSO 1: Busca usuário por e-mail, priorizando o subdomínio/tenant atual
        $user = null;
        if (!empty($subdomain)) {
            $stmtU = $db->prepare(
                "SELECT u.id as user_id, u.name, u.role, u.tenant_id, t.name as tenant_name
                 FROM users u
                 LEFT JOIN tenants t ON u.tenant_id = t.id
                 WHERE LOWER(u.email) = ? AND u.tenant_id = ?
                 LIMIT 1"
            );
            $stmtU->execute([$email, $subdomain]);
            $user = $stmtU->fetch(PDO::FETCH_ASSOC);
        }
        if (!$user) {
            $stmtU = $db->prepare(
                "SELECT u.id as user_id, u.name, u.role, u.tenant_id, t.name as tenant_name
                 FROM users u
                 LEFT JOIN tenants t ON u.tenant_id = t.id
                 WHERE LOWER(u.email) = ?
                 ORDER BY CASE WHEN u.tenant_id = ? THEN 0 ELSE 1 END ASC
                 LIMIT 1"
            );
            $stmtU->execute([$email, $subdomain]);
            $user = $stmtU->fetch(PDO::FETCH_ASSOC);
        }

        if ($user && !empty($user['user_id'])) {
            $effectiveRole = is_super_admin($db, $email) ? 'superadmin' : ($user['role'] ?: 'admin_clinica');
            
            // Se for Super Admin, permite assumir o contexto do tenant acessado
            $resolvedTenantId = $user['tenant_id'] ?: 'acessaronline';
            $resolvedTenantName = $user['tenant_name'] ?: 'Clínica Integrada';
            
            if ($effectiveRole === 'superadmin' && !empty($subdomain) && $subdomain !== 'acessaronline') {
                $stmtCheckT = $db->prepare("SELECT id, name FROM tenants WHERE id = ? LIMIT 1");
                $stmtCheckT->execute([$subdomain]);
                $targetT = $stmtCheckT->fetch(PDO::FETCH_ASSOC);
                if ($targetT && !empty($targetT['id'])) {
                    $resolvedTenantId = $targetT['id'];
                    $resolvedTenantName = $targetT['name'];
                }
            }

            echo json_encode([
                "tenant_id"   => $resolvedTenantId,
                "tenant_name" => $resolvedTenantName,
                "user_id"     => $user['user_id'],
                "name"        => $user['name']         ?: 'Professor Ninja',
                "role"        => $effectiveRole
            ]);
            exit();
        }

        // PASSO 2: Usuário não existe — resolve tenant pelo subdomínio acessado
        $tenantId   = 'acessaronline';
        $tenantName = 'Clínica Integrada';

        if (!empty($subdomain)) {
            $stmtT = $db->prepare("SELECT id, name FROM tenants WHERE id = ? LIMIT 1");
            $stmtT->execute([$subdomain]);
            $tenant = $stmtT->fetch(PDO::FETCH_ASSOC);
            if ($tenant && !empty($tenant['id'])) {
                $tenantId   = $tenant['id'];
                $tenantName = $tenant['name'];
            }
        }

        // PASSO 3: Cria o novo usuário Google automaticamente
        $newUserId        = 'usr_' . bin2hex(random_bytes(8));
        $userName         = explode('@', $email)[0];
        $userNameFormatted = (strpos($email, 'agencianinjamkd') !== false) ? 'Agência Ninja' : ucwords(str_replace(['.', '_', '-'], ' ', $userName));

        $isSuperAdminEmail = is_super_admin($db, $email);
        $roleToSet = $isSuperAdminEmail ? 'superadmin' : 'consultor';

        try {
            $currentDriver = strtolower(get_env_var('DB_CONNECTION', 'pgsql'));
            if ($currentDriver === 'pgsql' || $currentDriver === 'postgres' || $currentDriver === 'postgresql') {
                $stmtIns = $db->prepare(
                    "INSERT INTO users (id, tenant_id, email, name, role, status, ativo)
                     VALUES (?, ?, ?, ?, ?, 'Ativo', 1)
                     ON CONFLICT (tenant_id, email) DO UPDATE
                         SET name   = COALESCE(NULLIF(users.name, ''), EXCLUDED.name),
                             role   = EXCLUDED.role,
                             status = 'Ativo',
                             ativo  = 1"
                );
            } else {
                $stmtIns = $db->prepare(
                    "INSERT INTO users (id, tenant_id, email, name, role, status, ativo)
                     VALUES (?, ?, ?, ?, ?, 'Ativo', 1)
                     ON DUPLICATE KEY UPDATE
                         name   = IF(name IS NULL OR name='', VALUES(name), name),
                         role   = VALUES(role),
                         status = 'Ativo',
                         ativo  = 1"
                );
            }
            $stmtIns->execute([$newUserId, $tenantId, $email, $userNameFormatted, $roleToSet]);
        } catch (Throwable $eIns) {
            // Se INSERT falhar (coluna ausente etc.), ignora e retorna os dados mesmo assim
        }

        echo json_encode([
            "tenant_id"   => $tenantId,
            "tenant_name" => $tenantName,
            "user_id"     => $newUserId,
            "name"        => $userNameFormatted,
            "role"        => $roleToSet
        ]);

    } catch (Throwable $e) {
        // Qualquer erro inesperado retorna 500 com detalhes para diagnóstico
        http_response_code(500);
        echo json_encode([
            "error"   => "Erro ao resolver autenticação: " . $e->getMessage(),
            "file"    => basename($e->getFile()),
            "line"    => $e->getLine(),
            "trace"   => substr($e->getTraceAsString(), 0, 500)
        ]);
    }
    exit();
}


// Route: dashboard (Métricas de MMN Atlântica Natural & Go Pro)
if ($resource === 'dashboard' && $method === 'GET') {
    try {
        $totalProspects = 0;
        try {
            $stmtProspects = $db->prepare("SELECT COUNT(*) FROM prospects WHERE tenant_id = ?");
            $stmtProspects->execute([$tid]);
            $totalProspects = (int)$stmtProspects->fetchColumn();
        } catch (Throwable $th) {
            try {
                $stmtPat = $db->prepare("SELECT COUNT(*) FROM patients WHERE tenant_id = ?");
                $stmtPat->execute([$tid]);
                $totalProspects = (int)$stmtPat->fetchColumn();
            } catch (Throwable $th2) {}
        }

        // Funil MMN por estágios do Go Pro
        $funil = [];
        try {
            $stmtFunil = $db->prepare("
                SELECT fase_funil as stage, COUNT(*) as count 
                FROM prospects 
                WHERE tenant_id = ? 
                GROUP BY fase_funil
            ");
            $stmtFunil->execute([$tid]);
            $funil = $stmtFunil->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $th) {
            try {
                $stmtFunil = $db->prepare("SELECT status_crm as stage, COUNT(*) as count FROM appointments WHERE tenant_id = ? GROUP BY status_crm");
                $stmtFunil->execute([$tid]);
                $funil = $stmtFunil->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (Throwable $th2) {}
        }

        // Distribuição de Perfil
        $perfilDist = [];
        try {
            $stmtPerf = $db->prepare("SELECT perfil_interesse as perfil, COUNT(*) as count FROM prospects WHERE tenant_id = ? GROUP BY perfil_interesse");
            $stmtPerf->execute([$tid]);
            $perfilDist = $stmtPerf->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $th) {}

        // APNs / Reuniões Agendadas
        $apnsHoje = 0;
        try {
            $stmtApns = $db->prepare("SELECT COUNT(*) FROM apns WHERE tenant_id = ?");
            $stmtApns->execute([$tid]);
            $apnsHoje = (int)$stmtApns->fetchColumn();
        } catch (Throwable $th) {
            try {
                $stmtApns = $db->prepare("SELECT COUNT(*) FROM appointments WHERE tenant_id = ?");
                $stmtApns->execute([$tid]);
                $apnsHoje = (int)$stmtApns->fetchColumn();
            } catch (Throwable $th2) {}
        }

        // Novos cadastrados
        $cadastrados = 0;
        foreach ($funil as $f) {
            $stLower = strtolower($f['stage'] ?? '');
            if (strpos($stLower, 'cadastrado') !== false || strpos($stLower, 'ativado') !== false) {
                $cadastrados += (int)$f['count'];
            }
        }

        $taxaConversao = $totalProspects > 0 ? round(($cadastrados / $totalProspects) * 100, 1) : 0;
        $totalPv = $cadastrados * 450;

        echo json_encode([
            "total_patients" => $totalProspects,
            "total_prospects" => $totalProspects,
            "appointments_today" => $apnsHoje,
            "apns_hoje" => $apnsHoje,
            "novos_cadastrados" => $cadastrados,
            "taxa_conversao" => $taxaConversao,
            "pontos_pv_estimados" => $totalPv,
            "pending_queue" => 0,
            "funil" => $funil,
            "perfil_distribuicao" => $perfilDist,
            "financeiro" => [
                ["name" => "Volume PV", "ganha" => $totalPv, "perdida" => 0]
            ],
            "absenteismo" => []
        ]);
        exit();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
        exit();
    }
}

// Route: products (Catálogo Oficial Atlântica Natural)
if ($resource === 'products' || $resource === 'produtos') {
    try {
        if ($method === 'GET') {
            $stmt = $db->prepare("SELECT * FROM products WHERE tenant_id = ? ORDER BY linha ASC, nome ASC");
            $stmt->execute([$tid]);
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            echo json_encode($products);
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            $pid = $input['id'] ?? ('prod_' . uniqid());
            $stmt = $db->prepare("
                INSERT INTO products (id, tenant_id, nome, linha, preco_cliente, preco_distribuidor, pontos_pv, descricao, beneficios)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $pid,
                $tid,
                $input['nome'] ?? 'Novo Produto',
                $input['linha'] ?? 'Nutracêuticos',
                $input['preco_cliente'] ?? 0.00,
                $input['preco_distribuidor'] ?? 0.00,
                $input['pontos_pv'] ?? 0,
                $input['descricao'] ?? '',
                $input['beneficios'] ?? ''
            ]);
            echo json_encode(["success" => true, "id" => $pid]);
        }
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}

// Route: kits (Kits de Adesão e Pacotes de Início Rápido)
if ($resource === 'kits') {
    try {
        if ($method === 'GET') {
            $stmt = $db->prepare("SELECT * FROM kits WHERE tenant_id = ? ORDER BY valor ASC");
            $stmt->execute([$tid]);
            $kits = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            echo json_encode($kits);
        }
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}

// Route: generate-message
if ($resource === 'generate-message' && $method === 'POST') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $nome = $input['nome'] ?? '';
        $dataConsulta = $input['dataConsulta'] ?? '';
        $horarioMensagem = $input['horarioMensagem'] ?? '';
        if (empty($dataConsulta) && !empty($horarioMensagem)) {
            $dataConsulta = $horarioMensagem;
        }
        $comando = $input['comando'] ?? '';
        $categoria = $input['categoria'] ?? '';
        $profName = $input['profName'] ?? '';
        $tipo = $input['tipo'] ?? '';
        
        $apiKey = get_env_var('GEMINI_API_KEY');
        $stmtConf = $db->prepare("SELECT gemini_apikey, gemini_custom_prompt FROM tenant_settings WHERE tenant_id = ?");
        $stmtConf->execute([$tid]);
        $config = $stmtConf->fetch();
        if (empty($apiKey)) {
            $apiKey = $config['gemini_apikey'] ?? '';
        }
        $customPersona = !empty($config['gemini_custom_prompt']) ? "\nInstruções Personalizadas da Clínica:\n" . $config['gemini_custom_prompt'] . "\n" : "";

        // Identificação contextual inteligente do tipo de mensagem caso não venha explícito
        if (empty($tipo)) {
            $catLower = mb_strtolower($categoria, 'UTF-8');
            $cmdLower = mb_strtolower($comando, 'UTF-8');
            if (strpos($catLower, 'retorno') !== false || strpos($cmdLower, 'retorno') !== false || strpos($cmdLower, 'convite') !== false) {
                $tipo = 'retorno';
            } elseif (strpos($catLower, 'conscienti') !== false || strpos($cmdLower, 'conscienti') !== false || strpos($cmdLower, 'regularidade') !== false || strpos($cmdLower, 'preven') !== false) {
                $tipo = 'conscientizacao';
            } elseif (strpos($catLower, 'aniversar') !== false || strpos($cmdLower, 'aniversar') !== false || strpos($cmdLower, 'parabén') !== false) {
                $tipo = 'aniversario';
            } elseif (strpos($catLower, 'agradec') !== false || strpos($cmdLower, 'agradec') !== false) {
                $tipo = 'agradecimento';
            } elseif (!empty($dataConsulta)) {
                $tipo = 'consulta';
            } else {
                $tipo = 'avulso';
            }
        }

        $fallbackMessage = generate_smart_fallback_message($nome, $dataConsulta, $comando, $categoria);

        if (empty($apiKey)) {
            echo json_encode([
                "message" => $fallbackMessage,
                "fallback" => true,
                "warning" => "GEMINI_API_KEY não configurada no servidor."
            ]);
            exit();
        }

        $prompt = build_clinic_ai_prompt($tipo, $nome, $dataConsulta, $comando, $categoria, $profName, $customPersona);
        $texto = call_gemini_generate_content($prompt, $apiKey);

        if (!empty($texto)) {
            echo json_encode(["message" => $texto, "fallback" => false]);
        } else {
            // Em caso de erro temporário na API externa, retorna o fallback humanizado
            echo json_encode([
                "message" => $fallbackMessage,
                "fallback" => true,
                "warning" => "Google Gemini (" . GEMINI_MODEL . "). Resposta rápida inteligente utilizada."
            ]);
        }
    } catch (Exception $e) {
        $fallbackMessage = generate_smart_fallback_message($nome, $dataConsulta, $comando, $categoria);
        echo json_encode([
            "message" => $fallbackMessage,
            "fallback" => true,
            "warning" => "Exceção ao chamar Gemini: " . $e->getMessage()
        ]);
    }
    exit();
}

// Route: messages
if ($resource === 'messages') {
    try {
        if ($method === 'GET') {
            $patientId = $_GET['patient_id'] ?? null;
            if (!$patientId) {
                http_response_code(400);
                echo json_encode(["error" => "patient_id query param is required"]);
                exit();
            }

            $tFamMsg = get_tenant_family($tid);
            $tInMsg = implode(',', array_fill(0, count($tFamMsg), '?'));

            // Busca o telefone do paciente para unificar histórico de conversas do mesmo número
            $stmtPat = $db->prepare("SELECT phone FROM patients WHERE id = ? AND tenant_id IN ({$tInMsg}) LIMIT 1");
            $stmtPat->execute(array_merge([$patientId], $tFamMsg));
            $patPhoneRow = $stmtPat->fetch();

            if ($patPhoneRow && !empty($patPhoneRow['phone'])) {
                $cleanDigits = preg_replace('/[^0-9]/', '', (string)$patPhoneRow['phone']);
                $suffix8 = strlen($cleanDigits) >= 8 ? substr($cleanDigits, -8) : $cleanDigits;
                
                $stmt = $db->prepare("
                    SELECT DISTINCT m.* 
                    FROM messages m
                    LEFT JOIN patients p ON p.id = COALESCE(m.patient_id, m.prospect_id)
                    WHERE m.tenant_id IN ({$tInMsg})
                      AND (
                          m.patient_id = ?
                          OR m.prospect_id = ?
                          OR (
                              p.phone IS NOT NULL AND 
                              REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(p.phone, '-', ''), ' ', ''), '+', ''), '(', ''), ')', '') LIKE ?
                          )
                      )
                    ORDER BY m.created_at ASC
                ");
                $stmt->execute(array_merge($tFamMsg, [$patientId, $patientId, '%' . $suffix8]));
            } else {
                $stmt = $db->prepare("SELECT * FROM messages WHERE tenant_id IN ({$tInMsg}) AND (patient_id = ? OR prospect_id = ?) ORDER BY created_at ASC");
                $stmt->execute(array_merge($tFamMsg, [$patientId, $patientId]));
            }
            echo json_encode($stmt->fetchAll());
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $patientId = $input['patient_id'] ?? null;
            $content = $input['content'] ?? $input['texto'] ?? $input['mensagem'] ?? null;
            $senderName = !empty($input['sender_name']) ? trim($input['sender_name']) : (!empty($input['remetente']) ? trim($input['remetente']) : 'Humano');
            $skipDispatch = !empty($input['skip_dispatch']) || (isset($input['dispatch']) && $input['dispatch'] === false);
            
            // Busca resiliente do paciente: por ID ou por telefone
            $pat = null;
            if ($patientId && !preg_match('/^\+?[0-9]{8,15}$/', (string)$patientId)) {
                $stmtPat = $db->prepare("SELECT id, phone, bot_status FROM patients WHERE id = ? AND tenant_id = ?");
                $stmtPat->execute([$patientId, $tid]);
                $pat = $stmtPat->fetch();
            }

            if (!$pat) {
                $phoneInput = $input['phone'] ?? $input['telefone'] ?? (preg_match('/^\+?[0-9]{8,15}$/', (string)$patientId) ? (string)$patientId : null);
                if (!empty($phoneInput)) {
                    $cleanDigits = preg_replace('/[^0-9]/', '', (string)$phoneInput);
                    $suffix8 = strlen($cleanDigits) >= 8 ? substr($cleanDigits, -8) : $cleanDigits;
                    $stmtPatPhone = $db->prepare("
                        SELECT id, phone, bot_status FROM patients 
                        WHERE tenant_id = ? AND (
                            REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                            OR REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                        )
                        ORDER BY id DESC LIMIT 1
                    ");
                    $stmtPatPhone->execute([$tid, '%' . $cleanDigits, '%' . $suffix8]);
                    $pat = $stmtPatPhone->fetch();
                    if ($pat) {
                        $patientId = $pat['id'];
                    }
                }
            }

            if (!$patientId || !$content) {
                http_response_code(400);
                echo json_encode(["error" => "patient_id (ou telefone) e content sao obrigatorios"]);
                exit();
            }

            if (!$pat) {
                http_response_code(404);
                echo json_encode(["error" => "Paciente nao encontrado para este agendamento/mensagem."]);
                exit();
            }

            $msgId = 'msg_' . uniqid();
            
            // Salvar no BD
            try {
                $stmtMsg = $db->prepare("
                    INSERT INTO messages (id, tenant_id, patient_id, prospect_id, direction, content, sender_name)
                    VALUES (?, ?, ?, ?, 'outbound', ?, ?)
                ");
                $stmtMsg->execute([$msgId, $tid, $patientId, $patientId, $content, $senderName]);
            } catch (Throwable $eMsg) {
                try {
                    $stmtMsg2 = $db->prepare("
                        INSERT INTO messages (id, tenant_id, patient_id, direction, content, sender_name)
                        VALUES (?, ?, ?, 'outbound', ?, ?)
                    ");
                    $stmtMsg2->execute([$msgId, $tid, $patientId, $content, $senderName]);
                } catch (Throwable $eMsg2) {}
            }

            // Se o Hermes já enviou via WhatsApp e solicitou skip_dispatch, retorna imediatamente sem duplicar envio
            if ($skipDispatch) {
                http_response_code(201);
                echo json_encode([
                    "success" => true,
                    "id" => $msgId,
                    "patient_id" => $patientId,
                    "sender_name" => $senderName,
                    "dispatched" => false,
                    "message" => "Mensagem gravada com sucesso no Inbox do CRM."
                ]);
                exit();
            }

            $stmtConf = $db->prepare("SELECT evolution_url, evolution_api_url, evolution_apikey, evolution_api_key, evolution_instance, evolution_instance_name FROM tenant_settings WHERE tenant_id = ?");
            $stmtConf->execute([$tid]);
            $config = $stmtConf->fetch() ?: [];

            $evoUrl = !empty($config['evolution_api_url']) ? $config['evolution_api_url'] : ($config['evolution_url'] ?? get_env_var('EVOLUTION_API_URL', 'https://evogo.acessaronline.com.br'));
            $evoInstance = !empty($config['evolution_instance_name']) ? $config['evolution_instance_name'] : ($config['evolution_instance'] ?? get_env_var('EVOLUTION_INSTANCE_NAME', 'atlanticanatural'));

            if (!empty($evoUrl) && !empty($evoInstance)) {
                $evoRes = send_evolution_whatsapp_message($db, $tid, $pat['phone'], $content);
                $response = is_array($evoRes['response']) ? json_encode($evoRes['response']) : ($evoRes['response'] ?? '');
            } else {
                $url = "https://webhook.acessaronline.com.br/webhook/crm-lembretes-clinica";
                $data = [
                    "action" => "send_message",
                    "tenant_id" => $tid,
                    "patient_id" => $patientId,
                    "number" => $pat['phone'],
                    "textMessage" => ["text" => $content]
                ];
                $headers = ["Content-Type: application/json"];

                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                apply_curl_ssl_opts($ch);
                $response = curl_exec($ch);
                $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
            }

            http_response_code(201);
            echo json_encode(["success" => true, "id" => $msgId, "evolution_response" => json_decode($response) ?: $response]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}

// Route: prospects / patients (Gestão de Leads e Consultores MMN Atlântica Natural)
if ($resource === 'prospects' || $resource === 'patients') {
    try {
        if ($method === 'GET') {
            if ($id) {
                $row = null;
                try {
                    $stmt = $db->prepare("SELECT * FROM prospects WHERE id = ? AND tenant_id = ?");
                    $stmt->execute([$id, $tid]);
                    $row = $stmt->fetch();
                } catch (Throwable $th) {}
                if (!$row) {
                    try {
                        $stmt = $db->prepare("SELECT * FROM patients WHERE id = ? AND tenant_id = ?");
                        $stmt->execute([$id, $tid]);
                        $row = $stmt->fetch();
                    } catch (Throwable $th2) {}
                }

                if ($row) {
                    $row['name'] = $row['nome'] ?? ($row['name'] ?? 'Lead');
                    $row['phone'] = $row['whatsapp'] ?? ($row['phone'] ?? '');
                    $row['fase_funil'] = $row['fase_funil'] ?? ($row['status_crm'] ?? 'Novo Lead');
                    $row['clinical_notes'] = $row['notas_qualificacao'] ?? ($row['clinical_notes'] ?? '');
                    echo json_encode($row);
                } else {
                    http_response_code(404);
                    echo json_encode(["error" => "Prospect not found"]);
                }
            } else {
                $phoneParam = $_GET['phone'] ?? $_GET['telefone'] ?? $_GET['whatsapp'] ?? null;
                $prospects = [];

                if ($phoneParam !== null && $phoneParam !== '') {
                    $cleanPhone = preg_replace('/\D/', '', $phoneParam);
                    $searchPattern = '%' . $cleanPhone . '%';
                    try {
                        $stmt = $db->prepare("
                            SELECT * FROM prospects 
                            WHERE tenant_id = ? 
                              AND (
                                  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(whatsapp, '-', ''), ' ', ''), '+', ''), '(', ''), ')', '') LIKE ?
                                  OR whatsapp LIKE ?
                              )
                        ");
                        $stmt->execute([$tid, $searchPattern, $searchPattern]);
                        $prospects = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    } catch (Throwable $th) {
                        try {
                            $stmt = $db->prepare("SELECT * FROM patients WHERE tenant_id = ? AND phone LIKE ?");
                            $stmt->execute([$tid, $searchPattern]);
                            $prospects = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        } catch (Throwable $th2) {}
                    }
                } else {
                    try {
                        $stmt = $db->prepare("SELECT * FROM prospects WHERE tenant_id = ? ORDER BY created_at DESC");
                        $stmt->execute([$tid]);
                        $prospects = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    } catch (Throwable $th) {
                        try {
                            $stmt = $db->prepare("SELECT * FROM patients WHERE tenant_id = ? ORDER BY created_at DESC");
                            $stmt->execute([$tid]);
                            $prospects = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        } catch (Throwable $th2) {}
                    }
                }

                // Normaliza propriedades para o frontend
                $mapped = array_map(function($p) {
                    $p['name'] = $p['nome'] ?? ($p['name'] ?? 'Prospect');
                    $p['phone'] = $p['whatsapp'] ?? ($p['phone'] ?? '');
                    $p['fase_funil'] = $p['fase_funil'] ?? ($p['status_crm'] ?? 'Novo Lead');
                    $p['status_crm'] = $p['fase_funil'];
                    $p['clinical_notes'] = $p['notas_qualificacao'] ?? ($p['clinical_notes'] ?? '');
                    $p['perfil_interesse'] = $p['perfil_interesse'] ?? 'Revendedor';
                    $p['temperatura'] = $p['temperatura'] ?? 'Morno';
                    $p['kit_interesse'] = $p['kit_interesse'] ?? 'Kit Adesão R$ 79,90';
                    return $p;
                }, $prospects);

                echo json_encode($mapped);
            }
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            $nome = $input['nome'] ?? ($input['name'] ?? '');
            $telefone = $input['whatsapp'] ?? ($input['phone'] ?? '');

            if (empty($nome) || empty($telefone)) {
                http_response_code(400);
                echo json_encode(["error" => "Nome e WhatsApp são obrigatórios."]);
                exit();
            }

            $pid = $input['id'] ?? ('prsp_' . uniqid());
            $email = $input['email'] ?? 'N/A';
            $perfil = $input['perfil_interesse'] ?? 'Revendedor';
            $temp = $input['temperatura'] ?? 'Morno';
            $fase = $input['fase_funil'] ?? ($input['status_crm'] ?? 'Novo Lead');
            $kit = $input['kit_interesse'] ?? 'Kit Adesão R$ 79,90';
            $renda = $input['meta_renda'] ?? '';
            $origem = $input['origem'] ?? 'Direto';
            $patrocinador = $input['patrocinador'] ?? 'Líder Oficial';
            $notas = $input['notas_qualificacao'] ?? ($input['clinical_notes'] ?? '');

            try {
                $stmtChk = $db->prepare("SELECT id FROM prospects WHERE id = ?");
                $stmtChk->execute([$pid]);
                if ($stmtChk->fetch()) {
                    $stmtUpd = $db->prepare("
                        UPDATE prospects 
                        SET nome = ?, whatsapp = ?, email = ?, perfil_interesse = ?, temperatura = ?, fase_funil = ?, kit_interesse = ?, meta_renda = ?, notas_qualificacao = ?
                        WHERE id = ?
                    ");
                    $stmtUpd->execute([$nome, $telefone, $email, $perfil, $temp, $fase, $kit, $renda, $notas, $pid]);
                } else {
                    $stmtIns = $db->prepare("
                        INSERT INTO prospects (id, tenant_id, nome, whatsapp, email, perfil_interesse, temperatura, fase_funil, kit_interesse, meta_renda, origem, patrocinador, notas_qualificacao)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ");
                    $stmtIns->execute([$pid, $tid, $nome, $telefone, $email, $perfil, $temp, $fase, $kit, $renda, $origem, $patrocinador, $notas]);
                }
            } catch (Throwable $eInsPrsp) {
                // Fallback para tabela patients caso prospects não esteja presente
                try {
                    $stmtPat = $db->prepare("INSERT INTO patients (id, tenant_id, name, phone, email, clinical_notes) VALUES (?, ?, ?, ?, ?, ?)");
                    $stmtPat->execute([$pid, $tid, $nome, $telefone, $email, $notas]);
                } catch (Throwable $thPat) {}
            }

            http_response_code(201);
            echo json_encode(["success" => true, "id" => $pid]);
        } elseif ($method === 'PUT' && $id) {
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            $subAction = $parts[2] ?? null;

            if ($subAction === 'bot-status') {
                $status = $input['bot_status'] ?? 'active';
                try {
                    $stmt = $db->prepare("UPDATE prospects SET bot_status = ? WHERE id = ? AND tenant_id = ?");
                    $stmt->execute([$status, $id, $tid]);
                } catch (Throwable $th) {
                    try {
                        $stmt = $db->prepare("UPDATE patients SET bot_status = ? WHERE id = ? AND tenant_id = ?");
                        $stmt->execute([$status, $id, $tid]);
                    } catch (Throwable $th2) {}
                }
                echo json_encode(["success" => true]);
                exit();
            }

            $nome = $input['nome'] ?? ($input['name'] ?? null);
            $telefone = $input['whatsapp'] ?? ($input['phone'] ?? null);
            $email = $input['email'] ?? null;
            $fase = $input['fase_funil'] ?? ($input['status_crm'] ?? null);
            $temp = $input['temperatura'] ?? null;
            $perfil = $input['perfil_interesse'] ?? null;
            $kit = $input['kit_interesse'] ?? null;
            $notas = $input['notas_qualificacao'] ?? ($input['clinical_notes'] ?? null);

            try {
                $stmtUpd = $db->prepare("
                    UPDATE prospects 
                    SET nome = COALESCE(?, nome),
                        whatsapp = COALESCE(?, whatsapp),
                        email = COALESCE(?, email),
                        fase_funil = COALESCE(?, fase_funil),
                        temperatura = COALESCE(?, temperatura),
                        perfil_interesse = COALESCE(?, perfil_interesse),
                        kit_interesse = COALESCE(?, kit_interesse),
                        notas_qualificacao = COALESCE(?, notas_qualificacao)
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtUpd->execute([$nome, $telefone, $email, $fase, $temp, $perfil, $kit, $notas, $id, $tid]);
            } catch (Throwable $th) {
                try {
                    $stmtUpd = $db->prepare("UPDATE patients SET name = COALESCE(?, name), phone = COALESCE(?, phone), clinical_notes = COALESCE(?, clinical_notes) WHERE id = ? AND tenant_id = ?");
                    $stmtUpd->execute([$nome, $telefone, $notas, $id, $tid]);
                } catch (Throwable $th2) {}
            }

            echo json_encode(["success" => true, "id" => $id]);
        } elseif ($method === 'DELETE' && $id) {
            try {
                $stmt = $db->prepare("DELETE FROM prospects WHERE id = ? AND tenant_id = ?");
                $stmt->execute([$id, $tid]);
            } catch (Throwable $th) {
                try {
                    $stmt = $db->prepare("DELETE FROM patients WHERE id = ? AND tenant_id = ?");
                    $stmt->execute([$id, $tid]);
                } catch (Throwable $th2) {}
            }
            echo json_encode(["success" => true]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}


// Route: cron
if ($resource === 'cron') {
    require_once __DIR__ . '/cron_dispatch.php';
    exit();
}

// Route: sync-google-pending (Sincroniza retroativamente agendamentos pendentes com o Google Calendar)
if ($resource === 'sync-google-pending' || $resource === 'sync_google_pending') {
    try {
        $stmtPending = $db->prepare("
            SELECT id FROM appointments 
            WHERE (tenant_id = ? OR tenant_id = 'atlanticanatural')
              AND (event_id IS NULL OR event_id = '')
              AND (status_crm IS NULL OR status_crm NOT IN ('Cancelado', 'Faltou'))
            ORDER BY created_at DESC 
            LIMIT 20
        ");
        $stmtPending->execute([$tid]);
        $pendingIds = $stmtPending->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $synced = [];
        foreach ($pendingIds as $pId) {
            $ok = sync_google_calendar_event($db, $pId, $tid, 'create');
            if ($ok) {
                $synced[] = $pId;
            }
        }
        echo json_encode(["success" => true, "synced_count" => count($synced), "synced_ids" => $synced]);
    } catch (Throwable $thSync) {
        http_response_code(500);
        echo json_encode(["error" => $thSync->getMessage()]);
    }
    exit();
}

// Route: appointments (e alias appointments-bulk)
if ($resource === 'appointments-bulk') {
    $resource = 'appointments';
    $id = 'bulk';
}
if ($resource === 'appointments') {
    try {
        if ($id && (isset($parts[2]) && in_array($parts[2], ['sync-google', 'sync-calendar', 'sync']))) {
            $effectiveTid = !empty($tid) ? $tid : 'atlanticanatural';
            $ok = sync_google_calendar_event($db, $id, $effectiveTid, 'create');
            $stmtCheck = $db->prepare("SELECT event_id, logs FROM appointments WHERE id = ?");
            $stmtCheck->execute([$id]);
            $rowCheck = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            echo json_encode([
                "success" => $ok,
                "appointment_id" => $id,
                "event_id" => $rowCheck['event_id'] ?? null,
                "logs" => $rowCheck['logs'] ?? null
            ]);
            exit();
        }

        if ($method === 'GET') {
            // Sincroniza os eventos mais recentes da Google Agenda antes de retornar a lista de agendamentos
            try {
                sync_google_calendar_pull_latest($db, $tid);
            } catch (Throwable $eSyncPull) {}

            $tFamAppt = get_tenant_family($tid);
            $tInAppt = implode(',', array_fill(0, count($tFamAppt), '?'));

            if ($id) {
                // Translator for GET
                $stmt = $db->prepare("
                    SELECT a.id, a.tenant_id, a.patient_id, a.professional AS user_id, a.event_id,
                           a.appointment_time AS horario_consulta, a.message_time AS horario_mensagem, 
                           a.treatment_command AS treatment, a.ai_message_preview, a.price,
                           a.status_message AS status_envio, a.status_crm AS crm_status, a.status_crm,
                           a.category, a.logs, a.created_at,
                           COALESCE(p.name, pr.nome, 'Lead / Prospect') AS patient_name,
                           COALESCE(p.phone, pr.whatsapp, '') AS patient_phone,
                           u.name AS user_name
                    FROM appointments a 
                    LEFT JOIN patients p ON a.patient_id = p.id
                    LEFT JOIN prospects pr ON a.patient_id = pr.id
                    LEFT JOIN users u ON a.professional = u.id AND (a.tenant_id = u.tenant_id OR u.tenant_id IN ({$tInAppt}))
                    WHERE a.id = ? AND a.tenant_id IN ({$tInAppt})
                ");
                $stmt->execute(array_merge($tFamAppt, [$id], $tFamAppt));
                $res = $stmt->fetch();
                if ($res) {
                    echo json_encode($res);
                } else {
                    http_response_code(404);
                    echo json_encode(["error" => "Appointment not found"]);
                }
            } else {
                $statusFilter = $_GET['status'] ?? null;
                $query = "
                    SELECT a.id, a.tenant_id, a.patient_id, a.professional AS user_id, a.event_id,
                            a.appointment_time AS horario_consulta, a.message_time AS horario_mensagem, 
                            a.treatment_command AS treatment, a.ai_message_preview, a.price,
                            a.status_message AS status_envio, a.status_crm AS crm_status, a.status_crm,
                            a.category, a.logs, a.created_at,
                            COALESCE(p.name, pr.nome, 'Lead / Prospect') AS patient_name,
                            COALESCE(p.phone, pr.whatsapp, '') AS patient_phone,
                            u.name AS user_name
                    FROM appointments a
                    LEFT JOIN patients p ON a.patient_id = p.id
                    LEFT JOIN prospects pr ON a.patient_id = pr.id
                    LEFT JOIN users u ON a.professional = u.id AND (a.tenant_id = u.tenant_id OR u.tenant_id IN ({$tInAppt}))
                    WHERE a.tenant_id IN ({$tInAppt})
                ";
                $params = array_merge($tFamAppt, $tFamAppt);
                
                if ($statusFilter) {
                    if ($statusFilter === 'pending' || $statusFilter === 'Aguardando') {
                        $query .= " AND a.status_message = 'Aguardando' AND a.message_time <= ? ";
                        $params[] = date('Y-m-d H:i:s');
                    } elseif ($statusFilter === 'sent') {
                        $query .= " AND a.status_message = 'Enviado' ";
                    } elseif ($statusFilter === 'completed') {
                        $query .= " AND a.status_message = 'Confirmado' ";
                    } elseif ($statusFilter !== 'all') {
                        $query .= " AND a.status_message = ? ";
                        $params[] = $statusFilter;
                    }
                }

                $query .= " ORDER BY a.created_at DESC";

                $stmt = $db->prepare($query);
                $stmt->execute($params);
                echo json_encode($stmt->fetchAll());
            }
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input) {
                $input = $_POST;
            }

            // SUPORTE A DISPAROS EM MASSA / MÚLTIPLOS CONTATOS / PLANILHA (/appointments/bulk ou payload com items)
            if ($id === 'bulk' || isset($input['items']) || (is_array($input) && isset($input[0]) && is_array($input[0]))) {
                $items = isset($input['items']) ? $input['items'] : (isset($input[0]) ? $input : []);
                if (!is_array($items) || empty($items)) {
                    http_response_code(400);
                    echo json_encode(["error" => "Nenhum contato fornecido para agendamento em massa."]);
                    exit();
                }

                $effectiveTenant = !empty($tid) ? $tid : 'atlanticanatural';
                $tPatFam = ($tid === 'crmclinica') ? ['crmclinica'] : get_tenant_family($effectiveTenant);
                $tPatPlaceholders = implode(',', array_fill(0, count($tPatFam), '?'));
                $tenantPatCond = "tenant_id IN ({$tPatPlaceholders})";

                // Default professional if not provided
                $defaultProf = null;
                if (!empty($tid) && !in_array($tid, ['acessaronline', 'crmninja'])) {
                    $stmtProfT = $db->prepare("SELECT id FROM users WHERE tenant_id = ? AND google_refresh_token IS NOT NULL AND google_refresh_token != '' LIMIT 1");
                    $stmtProfT->execute([$tid]);
                    $defaultProf = $stmtProfT->fetchColumn();
                }
                if (empty($defaultProf)) {
                    $defaultProf = 'usr_357cbe1ddf129d8c';
                }

                $isPg = ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql');

                $insertedCount = 0;
                $failedCount = 0;
                $errors = [];
                $createdIds = [];

                // Prepared statements
                $sqlInsPat = $isPg
                    ? "INSERT INTO patients (id, tenant_id, name, phone, email) VALUES (?, ?, ?, ?, 'N/A') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone"
                    : "INSERT INTO patients (id, tenant_id, name, phone, email) VALUES (?, ?, ?, ?, 'N/A') ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone)";
                $stmtInsPat = $db->prepare($sqlInsPat);

                $stmtFindPatByTel = $db->prepare("
                    SELECT id, name, phone FROM patients 
                    WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                      AND {$tenantPatCond}
                    LIMIT 1
                ");

                $stmtInsAppt = $db->prepare("
                    INSERT INTO appointments (id, tenant_id, patient_id, professional, category, price, appointment_time, data_consulta, message_time, treatment_command, ai_message_preview, status_message, status_crm)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");

                $stmtInsDisp = $db->prepare("
                    INSERT INTO scheduled_dispatches (id, tenant_id, appointment_id, patient_id, dispatch_type, scheduled_time, status, treatment_command, ai_message_preview)
                    VALUES (?, ?, ?, ?, ?, ?, 'Aguardando', ?, ?)
                ");

                $nowTime = date('Y-m-d H:i:s');
                $nowTs   = time();

                $inTx = false;
                try {
                    $db->beginTransaction();
                    $inTx = true;
                } catch (Throwable $eTx) {}

                foreach ($items as $idx => $item) {
                    try {
                        $rawPhone = $item['patient_phone'] ?? $item['phone'] ?? $item['whatsapp'] ?? $item['numero'] ?? '';
                        // Extrai com precisão número celular/fixo com DDD ignorando dígitos soltos em nomes
                        if (preg_match('/(?:(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*))?(?:9\s*\d{4}[-\s]?\d{4}|\d{4,5}[-\s]?\d{4})/', (string)$rawPhone, $mPhone)) {
                            $digitsPhone = preg_replace('/\D/', '', $mPhone[0]);
                        } else {
                            $digitsPhone = preg_replace('/\D/', '', (string)$rawPhone);
                        }

                        if (strlen($digitsPhone) === 10 || strlen($digitsPhone) === 11) {
                            $digitsPhone = '55' . $digitsPhone;
                        } elseif (strlen($digitsPhone) === 8 || strlen($digitsPhone) === 9) {
                            $digitsPhone = '5546' . $digitsPhone;
                        }

                        if (empty($digitsPhone) || strlen($digitsPhone) < 12 || strlen($digitsPhone) > 13) {
                            $failedCount++;
                            $errors[] = "Linha " . ($idx + 1) . ": Telefone inválido ('" . ($rawPhone ?: 'vazio') . "'). Deve conter DDD + número.";
                            continue;
                        }

                        $rawName = trim($item['patient_name'] ?? $item['name'] ?? $item['nome'] ?? '');
                        $patientName = !empty($rawName) ? $rawName : 'Prospect / Convidado';

                        // Resolve ou cria paciente
                        $patientId = $item['patient_id'] ?? null;
                        if (empty($patientId)) {
                            $suffixTel = substr($digitsPhone, -8);
                            $stmtFindPatByTel->execute(array_merge(['%' . $suffixTel], $tPatFam));
                            $foundPat = $stmtFindPatByTel->fetch(PDO::FETCH_ASSOC);
                            if ($foundPat && !empty($foundPat['id'])) {
                                $patientId = $foundPat['id'];
                            } else {
                                $patientId = 'pat_' . uniqid();
                                $stmtInsPat->execute([$patientId, $effectiveTenant, $patientName, $digitsPhone]);
                            }
                        }

                        $aid = $item['id'] ?? 'apt_' . uniqid();
                        $professional = $item['user_id'] ?? $item['professional'] ?? $defaultProf;
                        $category = $item['category'] ?? $item['categoria'] ?? 'Apresentação APN';
                        $price = floatval($item['price'] ?? 0.00);
                        $tipoDisparo = $item['tipo_disparo'] ?? $item['tipoDisparo'] ?? 'consulta';

                        $rawMsgTime = !empty($item['horario_mensagem']) ? $item['horario_mensagem'] : (!empty($item['message_time']) ? $item['message_time'] : $nowTime);
                        $rawAppTime = !empty($item['horario_consulta']) ? $item['horario_consulta'] : (!empty($item['appointment_time']) ? $item['appointment_time'] : $rawMsgTime);
                        $appointment_time = normalize_datetime($rawAppTime);
                        $message_time = normalize_datetime($rawMsgTime);
                        $data_consulta = date('Y-m-d', strtotime($appointment_time));
                        $treatment_command = $item['treatment'] ?? $item['treatment_command'] ?? $item['comando'] ?? 'Disparo em massa';

                        // Preview da mensagem com substituição de tags inteligentes
                        $customPreview = $item['ai_message_preview'] ?? $item['aiMessagePreview'] ?? $item['message'] ?? $item['mensagem'] ?? null;
                        if (!empty($customPreview)) {
                            $primeiroNome = explode(' ', trim($patientName))[0];
                            $parsedMsg = str_replace(
                                ['{nome}', '{Nome}', '{NOME}', '{primeiro_nome}', '{Primeiro_Nome}', '{horario}', '{hora}', '{data}'],
                                [$patientName, $patientName, $patientName, $primeiroNome, $primeiroNome, date('H:i', strtotime($appointment_time)), date('H:i', strtotime($appointment_time)), date('d/m/Y', strtotime($appointment_time))],
                                $customPreview
                            );
                            $ai_preview = $parsedMsg;
                        } else {
                            $ai_preview = generate_smart_fallback_message($patientName, $appointment_time, $treatment_command, $category);
                        }

                        // Insere appointment
                        $stmtInsAppt->execute([
                            $aid,
                            $effectiveTenant,
                            $patientId,
                            $professional,
                            $category,
                            $price,
                            $appointment_time,
                            $data_consulta,
                            $message_time,
                            $treatment_command,
                            $ai_preview,
                            'Aguardando',
                            'Novo Contato'
                        ]);

                        // Enfileira em scheduled_dispatches
                        $msgTs = strtotime($message_time);
                        $appTs = strtotime($appointment_time);
                        $catLower = mb_strtolower($category, 'UTF-8');
                        $cmdLower = mb_strtolower($treatment_command, 'UTF-8');

                        $isAdhoc = (
                            $tipoDisparo === 'diversos' ||
                            strpos($cmdLower, 'mensagem avulsa') !== false ||
                            strpos($catLower, 'retorno') !== false ||
                            strpos($catLower, 'convite') !== false ||
                            strpos($catLower, 'conscienti') !== false ||
                            strpos($catLower, 'aniversar') !== false ||
                            strpos($catLower, 'promo') !== false
                        );

                        if ($isAdhoc) {
                            $targetSendTime = ($msgTs > $nowTs) ? $message_time : $nowTime;
                            $stmtInsDisp->execute([
                                'disp_custom_' . uniqid(),
                                $effectiveTenant,
                                $aid,
                                $patientId,
                                'custom',
                                $targetSendTime,
                                $treatment_command,
                                $ai_preview
                            ]);
                        } else {
                            $targetImmediateTime = ($msgTs > $nowTs && abs($msgTs - $appTs) > 300) ? $message_time : $nowTime;
                            $stmtInsDisp->execute([
                                'disp_imm_' . uniqid(),
                                $effectiveTenant,
                                $aid,
                                $patientId,
                                'immediate',
                                $targetImmediateTime,
                                'Confirmação: ' . $treatment_command,
                                $ai_preview
                            ]);

                            // Lembrete 24h
                            $time24h = date('Y-m-d H:i:s', $appTs - 86400);
                            if (strtotime($time24h) > $nowTs && abs(strtotime($time24h) - strtotime($targetImmediateTime)) > 3600) {
                                $preview24h = generate_smart_fallback_message($patientName, $appointment_time, '24h ' . $treatment_command, $category);
                                $stmtInsDisp->execute([
                                    'disp_24h_' . uniqid(),
                                    $effectiveTenant,
                                    $aid,
                                    $patientId,
                                    'reminder_24h',
                                    $time24h,
                                    'Lembrete 24h: ' . $treatment_command,
                                    $preview24h
                                ]);
                            }

                            // Alerta 2h
                            $time2h = date('Y-m-d H:i:s', $appTs - 7200);
                            if (strtotime($time2h) > $nowTs && abs(strtotime($time2h) - strtotime($targetImmediateTime)) > 1800) {
                                $preview2h = generate_smart_fallback_message($patientName, $appointment_time, '2h ' . $treatment_command, $category);
                                $stmtInsDisp->execute([
                                    'disp_2h_' . uniqid(),
                                    $effectiveTenant,
                                    $aid,
                                    $patientId,
                                    'reminder_2h',
                                    $time2h,
                                    'Alerta 2h: ' . $treatment_command,
                                    $preview2h
                                ]);
                            }
                        }

                        $insertedCount++;
                        $createdIds[] = $aid;
                    } catch (Throwable $eItem) {
                        $failedCount++;
                        $errors[] = "Linha " . ($idx + 1) . ": " . $eItem->getMessage();
                    }
                }

                if ($inTx) {
                    try {
                        $db->commit();
                    } catch (Throwable $eCommit) {}
                }

                // Sincroniza cada agendamento criado no Google Calendar
                foreach ($createdIds as $createdAid) {
                    try {
                        sync_google_calendar_event($db, $createdAid, $effectiveTenant, 'create');
                    } catch (Throwable $eCal) {}
                }

                http_response_code(201);
                echo json_encode([
                    "success" => true,
                    "total" => count($items),
                    "inserted" => $insertedCount,
                    "failed" => $failedCount,
                    "ids" => $createdIds,
                    "errors" => $errors
                ]);
                exit();
            }

            $aid = $input['id'] ?? 'apt_' . uniqid();
            
            // Map legacy and modern fields
            $professional = $input['user_id'] ?? $input['professional'] ?? null;
            if (empty($professional) || $professional === 'N/A') {
                if (!empty($tid) && !in_array($tid, ['acessaronline', 'crmninja'])) {
                    $stmtProfT = $db->prepare("SELECT id FROM users WHERE tenant_id = ? AND google_refresh_token IS NOT NULL AND google_refresh_token != '' LIMIT 1");
                    $stmtProfT->execute([$tid]);
                    $professional = $stmtProfT->fetchColumn() ?: 'usr_357cbe1ddf129d8c';
                } else {
                    $professional = 'usr_357cbe1ddf129d8c';
                }
            }
            $category = $input['category'] ?? $input['categoria'] ?? 'Geral';
            $price = $input['price'] ?? 0.00;
            $rawMsgTime = !empty($input['horario_mensagem']) ? $input['horario_mensagem'] : (!empty($input['message_time']) ? $input['message_time'] : date('Y-m-d H:i:s'));
            $rawAppTime = !empty($input['horario_consulta']) ? $input['horario_consulta'] : (!empty($input['appointment_time']) ? $input['appointment_time'] : $rawMsgTime);
            $appointment_time = normalize_datetime($rawAppTime);
            $message_time = normalize_datetime($rawMsgTime);
            $treatment_command = $input['treatment'] ?? $input['treatment_command'] ?? '';
            $ai_preview = $input['ai_message_preview'] ?? $input['aiMessagePreview'] ?? null;
            $tipoDisparo = $input['tipo_disparo'] ?? $input['tipoDisparo'] ?? '';
            $status_message = $input['status_envio'] ?? $input['status_message'] ?? $input['status'] ?? 'Aguardando';
            $status_crm = $input['crm_status'] ?? $input['status_crm'] ?? 'Novo Contato';
            $patientName = $input['patient_name'] ?? $input['name'] ?? 'Paciente Agendado';
            $patientPhone = $input['patient_phone'] ?? $input['phone'] ?? '5500000000000';

            // Resolução defensiva e inteligente do patient_id (com priorização de nome para agendamento de terceiros)
            $patientId = $input['patient_id'] ?? null;
            $digitsId = preg_replace('/[^0-9]/', '', (string)$patientId);
            $digitsPhone = preg_replace('/[^0-9]/', '', (string)$patientPhone);
            $existingPat = null;

            // Resolução defensiva e inteligente do patient_id isolada por tenant
            $tPatFam = ($tid === 'crmclinica') ? ['crmclinica'] : get_tenant_family($tid);
            $tPatPlaceholders = implode(',', array_fill(0, count($tPatFam), '?'));
            $tenantPatCond = "tenant_id IN ({$tPatPlaceholders})";

            // 1. Tentar localizar por ID exato se não for puramente numérico
            if (!empty($patientId) && strlen($digitsId) < 8) {
                $stmtCheck = $db->prepare("SELECT id, name, phone FROM patients WHERE id = ? AND {$tenantPatCond} LIMIT 1");
                $stmtCheck->execute(array_merge([$patientId], $tPatFam));
                $existingPat = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            }

            // 2. PRIORIDADE DE NOME: Se forneceu nome específico (diferente de 'Paciente Agendado'), buscar primeiro por nome
            $cleanInputName = trim($patientName);
            if (!$existingPat && !empty($cleanInputName) && $cleanInputName !== 'Paciente Agendado' && mb_strlen($cleanInputName, 'UTF-8') >= 3) {
                $stmtName = $db->prepare("
                    SELECT id, name, phone FROM patients 
                    WHERE (LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?))
                      AND {$tenantPatCond}
                    ORDER BY 
                        CASE WHEN LOWER(name) = LOWER(?) THEN 1 ELSE 2 END,
                        id DESC 
                    LIMIT 1
                ");
                $paramsName = array_merge([$cleanInputName, '%' . $cleanInputName . '%'], $tPatFam, [$cleanInputName]);
                $stmtName->execute($paramsName);
                $patByName = $stmtName->fetch(PDO::FETCH_ASSOC);
                if ($patByName) {
                    $existingPat = $patByName;
                }
            }

            // 3. Se ainda não achou, buscar por telefone MAS verificar compatibilidade de nome
            if (!$existingPat) {
                $searchTel = strlen($digitsId) >= 8 ? $digitsId : (strlen($digitsPhone) >= 8 ? $digitsPhone : '');
                if (!empty($searchTel)) {
                    $suffixTel = substr($searchTel, -8);
                    $stmtTel = $db->prepare("
                        SELECT id, name, phone FROM patients 
                        WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                          AND {$tenantPatCond}
                        ORDER BY 
                            CASE WHEN LOWER(name) LIKE '%teste%' THEN 2 ELSE 1 END,
                            id ASC
                        LIMIT 1
                    ");
                    $paramsTel = array_merge(['%' . $suffixTel], $tPatFam);
                    $stmtTel->execute($paramsTel);
                    $patByTel = $stmtTel->fetch(PDO::FETCH_ASSOC);
                    if ($patByTel) {
                        // Verifica se o nome coincide ou se não foi passado nome específico
                        $pNameLower = mb_strtolower(trim($patByTel['name'] ?? ''), 'UTF-8');
                        $cNameLower = mb_strtolower($cleanInputName, 'UTF-8');
                        if (empty($cleanInputName) || $cleanInputName === 'Paciente Agendado' || strpos($pNameLower, $cNameLower) !== false || strpos($cNameLower, $pNameLower) !== false) {
                            $existingPat = $patByTel;
                        }
                        // Se for pessoa diferente com o mesmo telefone de contato (ex: mãe agendando pro filho),
                        // NÃO adota existingPat para que seja criada a ficha individual da nova pessoa!
                    }
                }
            }

            // 4. Se encontrou paciente existente compatível, adota os dados reais dele
            if ($existingPat) {
                $patientId = $existingPat['id'];
                if (empty($patientName) || $patientName === 'Paciente Agendado') {
                    $patientName = $existingPat['name'];
                }
                if (empty($patientPhone) || $patientPhone === '5500000000000') {
                    $patientPhone = $existingPat['phone'];
                }
            } else {
                // 5. Novo paciente: garante criação de ficha individual com ID exclusivo
                if (empty($patientId) || strlen($digitsId) >= 8) {
                    $patientId = 'pat_' . uniqid();
                }
                if (strlen($digitsId) >= 8 && ($patientPhone === '5500000000000' || empty($patientPhone))) {
                    $patientPhone = $digitsId;
                }
                $isPg = ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql');
                $sqlInsPat = $isPg
                    ? "INSERT INTO patients (id, tenant_id, name, phone, email)
                       VALUES (?, ?, ?, ?, 'N/A')
                       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone"
                    : "INSERT INTO patients (id, tenant_id, name, phone, email)
                       VALUES (?, ?, ?, ?, 'N/A')
                       ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone)";
                $stmtInsPat = $db->prepare($sqlInsPat);
                $stmtInsPat->execute([$patientId, $tid, $patientName, $patientPhone]);
            }

            // Se o preview da IA estiver vazio ou contendo texto padrão, gera a mensagem inteligente padrão (fallback)
            if (empty($ai_preview) || trim($ai_preview) === '' || strpos($ai_preview, 'Preencha o formulário') !== false) {
                $ai_preview = generate_smart_fallback_message($patientName, $appointment_time, $treatment_command, $category);
            }

            // Se for consulta com horário marcado mas a mensagem não cita data/horário, garante a inserção da data e hora
            if ($tipoDisparo === 'consulta' && !empty($appointment_time) && !empty($ai_preview)) {
                $dtFmt = format_ptbr_datetime($appointment_time);
                if (!empty($dtFmt) && strpos($ai_preview, 'Data:') === false && strpos($ai_preview, 'às ') === false && strpos($ai_preview, '202') === false) {
                    $ai_preview = preg_replace(
                        '/(para confirmar [^\.\n]*\.?)/ui',
                        "$1\n\n📅 **Data e Horário:** {$dtFmt}",
                        $ai_preview,
                        1,
                        $replacedCount
                    );
                    if (!$replacedCount) {
                        $ai_preview = "📅 **Data e Horário:** {$dtFmt}\n\n" . $ai_preview;
                    }
                }
            }

            $data_consulta = date('Y-m-d', strtotime($appointment_time));

            $stmt = $db->prepare("
                INSERT INTO appointments (id, tenant_id, patient_id, professional, category, price, appointment_time, data_consulta, message_time, treatment_command, ai_message_preview, status_message, status_crm)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $aid,
                $tid,
                $patientId,
                $professional,
                $category,
                $price,
                $appointment_time,
                $data_consulta,
                $message_time,
                $treatment_command,
                $ai_preview,
                $status_message,
                $status_crm
            ]);
            
            // Sincroniza com a Google Agenda do profissional (sem interromper agendamento em caso de erro externo)
            try {
                sync_google_calendar_event($db, $aid, $tid, 'create');
            } catch (Throwable $eCal) {
                // Ignore external API failure
            }

            // Criacao defensiva da tabela scheduled_dispatches para o Sistema de Triplo Disparo
            try {
                $db->exec("
                    CREATE TABLE IF NOT EXISTS scheduled_dispatches (
                        id VARCHAR(50) PRIMARY KEY,
                        tenant_id VARCHAR(50) NOT NULL,
                        appointment_id VARCHAR(50) NOT NULL,
                        patient_id VARCHAR(50) NOT NULL,
                        dispatch_type VARCHAR(50) NOT NULL,
                        scheduled_time DATETIME NOT NULL,
                        status VARCHAR(50) DEFAULT 'Aguardando',
                        treatment_command TEXT,
                        ai_message_preview TEXT,
                        logs TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_disp_tenant_status (tenant_id, status, scheduled_time)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                ");
            } catch (Throwable $eTblDisp) {
                // Tabela ja existe
            }

            // Agendamento Inteligente e Pontual em scheduled_dispatches
            try {
                $stmtDisp = $db->prepare("
                    INSERT INTO scheduled_dispatches (id, tenant_id, appointment_id, patient_id, dispatch_type, scheduled_time, status, treatment_command, ai_message_preview)
                    VALUES (?, ?, ?, ?, ?, ?, 'Aguardando', ?, ?)
                ");

                $effectiveTenant = $tid ?: 'acessaronline';
                $nowTime = date('Y-m-d H:i:s');
                $nowTs   = time();
                $msgTs   = strtotime($message_time);
                $appTs   = strtotime($appointment_time);

                $catLower = mb_strtolower($category, 'UTF-8');
                $cmdLower = mb_strtolower($treatment_command, 'UTF-8');
                
                // Identifica se é mensagem avulsa / retorno / conscientização / campanha
                $isAdhocMessage = (
                    $tipoDisparo === 'diversos' ||
                    strpos($cmdLower, 'mensagem avulsa') !== false ||
                    strpos($catLower, 'retorno') !== false ||
                    strpos($catLower, 'convite') !== false ||
                    strpos($catLower, 'conscienti') !== false ||
                    strpos($catLower, 'agradec') !== false ||
                    strpos($catLower, 'aniversar') !== false ||
                    strpos($catLower, 'promo') !== false
                );

                if ($isAdhocMessage) {
                    // Mensagem Avulsa / Retorno / Conscientização: ÚNICO DISPARO no horário programado
                    // Se o horário de mensagem for no futuro, agenda estritamente para aquele momento!
                    // Se for no passado ou para agora, agenda para $nowTime.
                    $targetSendTime = ($msgTs > $nowTs) ? $message_time : $nowTime;
                    
                    $stmtDisp->execute([
                        'disp_custom_' . uniqid(),
                        $effectiveTenant,
                        $aid,
                        $patientId,
                        'custom',
                        $targetSendTime,
                        $treatment_command,
                        $ai_preview
                    ]);
                } else {
                    // Consulta Clínica: Triplo Disparo
                    // 1. Confirmação do agendamento
                    // Se o usuário especificou um horário de envio futuro específico (diferente da consulta e do agora):
                    // respeita o horário escolhido!
                    if ($msgTs > $nowTs && abs($msgTs - $appTs) > 300) {
                        $targetImmediateTime = $message_time;
                    } else {
                        $targetImmediateTime = $nowTime;
                    }

                    $stmtDisp->execute([
                        'disp_imm_' . uniqid(),
                        $effectiveTenant,
                        $aid,
                        $patientId,
                        'immediate',
                        $targetImmediateTime,
                        'Confirmação de agendamento: ' . $treatment_command,
                        $ai_preview
                    ]);

                    // 2. Lembrete 24 Horas Antes (se no futuro e com margem de segurança)
                    $time24h = date('Y-m-d H:i:s', $appTs - 86400); // 24 horas antes
                    if (strtotime($time24h) > $nowTs && abs(strtotime($time24h) - strtotime($targetImmediateTime)) > 3600) {
                        $preview24h = generate_smart_fallback_message($patientName, $appointment_time, '24h ' . $treatment_command, $category);
                        $stmtDisp->execute([
                            'disp_24h_' . uniqid(),
                            $effectiveTenant,
                            $aid,
                            $patientId,
                            'reminder_24h',
                            $time24h,
                            'Lembrete de véspera (24h antes): ' . $treatment_command,
                            $preview24h
                        ]);
                    }

                    // 3. Alerta 2 Horas Antes (se no futuro e com margem de segurança)
                    $time2h = date('Y-m-d H:i:s', $appTs - 7200); // 2 horas antes
                    if (strtotime($time2h) > $nowTs && abs(strtotime($time2h) - strtotime($targetImmediateTime)) > 1800) {
                        $preview2h = generate_smart_fallback_message($patientName, $appointment_time, '2h ' . $treatment_command, $category);
                        $stmtDisp->execute([
                            'disp_2h_' . uniqid(),
                            $effectiveTenant,
                            $aid,
                            $patientId,
                            'reminder_2h',
                            $time2h,
                            'Alerta de proximidade (2h antes): ' . $treatment_command,
                            $preview2h
                        ]);
                    }
                }
            } catch (Throwable $eDispIns) {
                // Falha secundaria nao bloqueia resposta
            }
            
            http_response_code(201);
            echo json_encode(["success" => true, "id" => $aid]);
        } elseif ($method === 'PUT' && $id) {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $sets = [];
            $vals = [];

            $userId = $input['user_id'] ?? $input['professional'] ?? null;
            $price = $input['price'] ?? null;
            $appTime = $input['horario_consulta'] ?? $input['appointment_time'] ?? null;
            $msgTime = $input['horario_mensagem'] ?? $input['message_time'] ?? null;
            $treatment = $input['treatment'] ?? $input['treatment_command'] ?? null;
            $aiPreview = $input['ai_message_preview'] ?? $input['aiMessagePreview'] ?? null;
            $statusMsg = $input['status_envio'] ?? $input['status_message'] ?? $input['status'] ?? null;
            $statusCrm = $input['crm_status'] ?? $input['status_crm'] ?? null;
            $category = $input['category'] ?? $input['categoria'] ?? null;
            $logs = $input['logs'] ?? $input['log'] ?? null;
            $eventId = $input['event_id'] ?? $input['eventId'] ?? null;

            if ($userId !== null) { $sets[] = "professional = ?"; $vals[] = $userId; }
            if ($price !== null) { $sets[] = "price = ?"; $vals[] = $price; }
            if ($appTime !== null) { 
                $cleanNorm = normalize_datetime($appTime); 
                $sets[] = "appointment_time = ?"; 
                $vals[] = $cleanNorm; 
                $sets[] = "data_consulta = ?"; 
                $vals[] = date('Y-m-d', strtotime($cleanNorm)); 
            }
            if ($msgTime !== null) { $sets[] = "message_time = ?"; $vals[] = normalize_datetime($msgTime); }
            if ($treatment !== null) { $sets[] = "treatment_command = ?"; $vals[] = $treatment; }
            if ($aiPreview !== null) { $sets[] = "ai_message_preview = ?"; $vals[] = $aiPreview; }
            if ($statusMsg !== null) { $sets[] = "status_message = ?"; $vals[] = $statusMsg; }
            if ($statusCrm !== null) { 
                $normStatus = (strtolower(trim($statusCrm)) === 'cancelado') ? 'Cancelado' : $statusCrm;
                $sets[] = "status_crm = ?"; $vals[] = $normStatus; 
                $sets[] = "crm_status = ?"; $vals[] = $normStatus; 
            }
            if ($category !== null) { $sets[] = "category = ?"; $vals[] = $category; }
            if ($logs !== null) { $sets[] = "logs = ?"; $vals[] = $logs; }
            if ($eventId !== null) { $sets[] = "event_id = ?"; $vals[] = $eventId; }

            if (empty($sets)) {
                http_response_code(400);
                echo json_encode(["error" => "No valid fields to update"]);
                exit();
            }
            $tFamUpd = get_tenant_family($tid);
            $tInUpd = implode(',', array_fill(0, count($tFamUpd), '?'));
            $vals[] = $id;
            $vals = array_merge($vals, $tFamUpd);
            $stmt = $db->prepare("UPDATE appointments SET " . implode(", ", $sets) . " WHERE id = ? AND tenant_id IN ({$tInUpd})");
            $stmt->execute($vals);

            // Se informado patient_phone, atualiza cadastro do paciente associado
            $patientPhone = $input['patient_phone'] ?? $input['phone'] ?? null;
            if ($patientPhone !== null) {
                $cleanPhone = preg_replace('/\D/', '', (string)$patientPhone);
                if (strlen($cleanPhone) === 10 || strlen($cleanPhone) === 11) {
                    $cleanPhone = '55' . $cleanPhone;
                }
                if (!empty($cleanPhone)) {
                    $stmtGetPat = $db->prepare("SELECT patient_id FROM appointments WHERE id = ?");
                    $stmtGetPat->execute([$id]);
                    $rowPat = $stmtGetPat->fetch();
                    if ($rowPat && !empty($rowPat['patient_id'])) {
                        $stmtUpdPat = $db->prepare("UPDATE patients SET phone = ? WHERE id = ?");
                        $stmtUpdPat->execute([$cleanPhone, $rowPat['patient_id']]);
                    }
                }
            }

            // Sincroniza status na tabela scheduled_dispatches
            if ($statusMsg !== null) {
                try {
                    $stmtUpdDisp = $db->prepare("UPDATE scheduled_dispatches SET status = ?, status_message = ? WHERE appointment_id = ?");
                    $stmtUpdDisp->execute([$statusMsg, $statusMsg, $id]);
                } catch (Throwable $eDispUpd) {}
            }
            
            // Sincroniza com a Google Agenda do profissional (atualiza, cria ou exclui se cancelado)
            if (strtolower(trim($statusCrm ?? '')) === 'cancelado' || $statusCrm === 'Faltou') {
                sync_google_calendar_event($db, $id, $tid, 'delete');
            } else {
                sync_google_calendar_event($db, $id, $tid, 'update');
            }
            
            // Interaction logging for crm_status change
            $targetCrmStatus = $statusCrm;
            if ($targetCrmStatus !== null) {
                // Fetch patient_id for interaction
                $stmtApt = $db->prepare("SELECT patient_id FROM appointments WHERE id = ? AND tenant_id IN ({$tInUpd})");
                $stmtApt->execute(array_merge([$id], $tFamUpd));
                $apt = $stmtApt->fetch();
                if ($apt) {
                    $stmtInt = $db->prepare("INSERT INTO patient_interactions (tenant_id, patient_id, type, content) VALUES (?, ?, ?, ?)");
                    $stmtInt->execute([
                        $tid,
                        $apt['patient_id'],
                        'stage_change',
                        "Paciente movido para o estágio: " . $targetCrmStatus
                    ]);
                }
            }

            echo json_encode(["success" => true]);
        } elseif ($method === 'DELETE') {
            $db->beginTransaction();
            try {
                if ($id) {
                    // Pega o event_id do agendamento antes de excluir
                    $stmtGetEvt = $db->prepare("SELECT event_id FROM appointments WHERE id = ?");
                    $stmtGetEvt->execute([$id]);
                    $rowEvt = $stmtGetEvt->fetch(PDO::FETCH_ASSOC);
                    $delEvtId = $rowEvt['event_id'] ?? null;

                    // Sincroniza remoção do evento na Google Agenda antes de excluir do banco
                    sync_google_calendar_event($db, $id, $tid, 'delete');
                    
                    if (!empty($delEvtId)) {
                        try {
                            $isPg = ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql');
                            $sqlBlk = $isPg
                                ? "INSERT INTO deleted_google_events (event_id, deleted_at) VALUES (?, NOW()) ON CONFLICT (event_id) DO NOTHING"
                                : "INSERT IGNORE INTO deleted_google_events (event_id, deleted_at) VALUES (?, NOW())";
                            $stmtBlk = $db->prepare($sqlBlk);
                            $stmtBlk->execute([$delEvtId]);
                        } catch (Throwable $th) {}

                        // Remove tanto pelo ID quanto por event_id para limpar quaisquer duplicatas
                        $stmt = $db->prepare("DELETE FROM appointments WHERE id = ? OR event_id = ?");
                        $stmt->execute([$id, $delEvtId]);
                    } else {
                        $stmt = $db->prepare("DELETE FROM appointments WHERE id = ?");
                        $stmt->execute([$id]);
                    }
                } else {
                    // Excluir todos os agendamentos do tenant em lote
                    $stmtApts = $db->prepare("SELECT id FROM appointments WHERE tenant_id = ? AND event_id IS NOT NULL");
                    $stmtApts->execute([$tid]);
                    $apts = $stmtApts->fetchAll(PDO::FETCH_COLUMN);
                    foreach ($apts as $aptId) {
                        sync_google_calendar_event($db, $aptId, $tid, 'delete');
                    }
                    
                    $stmt = $db->prepare("DELETE FROM appointments WHERE tenant_id = ?");
                    $stmt->execute([$tid]);
                }
                $db->commit();
                echo json_encode(["success" => true]);
            } catch (Exception $eDele) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                http_response_code(500);
                echo json_encode(["error" => "Falha na transação de exclusão de agendamentos: " . $eDele->getMessage()]);
            }
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}

// Route: whatsapp (Proxy seguro para Evolution API v2)
if ($resource === 'whatsapp') {
    $subAction = $parts[1] ?? null;
    
    $stmtConf = $db->prepare("SELECT evolution_url, evolution_api_url, evolution_apikey, evolution_api_key, evolution_instance, evolution_instance_name FROM tenant_settings WHERE tenant_id = ?");
    $stmtConf->execute([$tid]);
    $config = $stmtConf->fetch() ?: [];
    
    $baseUrl = !empty($config['evolution_api_url']) ? $config['evolution_api_url'] : ($config['evolution_url'] ?? get_env_var('EVOLUTION_API_URL', ''));
    $rawInstance = !empty($config['evolution_instance_name']) ? $config['evolution_instance_name'] : ($config['evolution_instance'] ?? get_env_var('EVOLUTION_INSTANCE_NAME', ''));
    $instancesList = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', (string)$rawInstance))));
    $instance = !empty($instancesList) ? $instancesList[0] : '';
    $apiKey = !empty($config['evolution_api_key']) ? $config['evolution_api_key'] : ($config['evolution_apikey'] ?? get_env_var('EVOLUTION_API_KEY', ''));

    if (empty($baseUrl) || empty($instance)) {
        if ($method === 'GET' && $subAction === 'status') {
            http_response_code(200);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                "state" => "open",
                "instanceName" => "Instância Padrão",
                "status" => "connected",
                "provider" => "n8n Webhook"
            ]);
            exit();
        } else {
            http_response_code(400);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode(["error" => "Evolution API não configurada para este tenant. Preencha a URL e Nome da Instância nas Configurações."]);
            exit();
        }
    }
    
    $baseUrl = rtrim($baseUrl, '/');
    $headers = [
        "apikey: " . $apiKey,
        "Content-Type: application/json"
    ];

    if ($method === 'GET' && $subAction === 'status') {
        $normalizedState = 'close';
        $decoded = [];

        // 1. Tenta status nativo do Evolution GO: GET /instance/status com apikey da instância
        $chStatus = curl_init($baseUrl . "/instance/status");
        curl_setopt($chStatus, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($chStatus, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($chStatus, CURLOPT_TIMEOUT, 6);
        apply_curl_ssl_opts($chStatus);
        $resStatus = curl_exec($chStatus);
        $statusHttpCode = curl_getinfo($chStatus, CURLINFO_HTTP_CODE);
        curl_close($chStatus);

        if ($statusHttpCode >= 200 && $statusHttpCode < 300 && $resStatus) {
            $decStatus = json_decode($resStatus, true) ?: [];
            $isConnected = !empty($decStatus['data']['Connected']) || !empty($decStatus['data']['LoggedIn']);
            if ($isConnected) {
                $normalizedState = 'open';
                $decoded = $decStatus['data'] ?? [];
            }
        }

        // 2. Se não estiver open, consulta /instance/all para checar a lista global de instâncias
        if ($normalizedState !== 'open') {
            $globalApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
            $chGo = curl_init($baseUrl . "/instance/all");
            curl_setopt($chGo, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chGo, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey, "Content-Type: application/json"]);
            curl_setopt($chGo, CURLOPT_TIMEOUT, 6);
            apply_curl_ssl_opts($chGo);
            $goResponse = curl_exec($chGo);
            $goHttpCode = curl_getinfo($chGo, CURLINFO_HTTP_CODE);
            curl_close($chGo);

            if ($goHttpCode >= 200 && $goHttpCode < 300 && $goResponse) {
                $goData = json_decode($goResponse, true) ?: [];
                $instances = $goData['data'] ?? [];
                foreach ($instances as $inst) {
                    if (($inst['name'] ?? '') === $instance || in_array($inst['name'] ?? '', $instancesList) || ($inst['token'] ?? '') === $apiKey) {
                        $isConnected = !empty($inst['connected']);
                        if ($isConnected) {
                            $normalizedState = 'open';
                            $decoded = $inst;
                            break;
                        }
                    }
                }
            }
        }

        // 3. Fallback legado para Evolution API v2 tradicional (/instance/connectionState/:name)
        if ($normalizedState !== 'open' && empty($decoded)) {
            $url = $baseUrl . "/instance/connectionState/" . urlencode($instance);
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_TIMEOUT, 6);
            apply_curl_ssl_opts($ch);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode >= 200 && $httpCode < 300 && $response) {
                $decLegacy = json_decode($response, true) ?: [];
                $rawState = $decLegacy['instance']['state'] ?? $decLegacy['state'] ?? 'close';
                if ($rawState === 'open') {
                    $normalizedState = 'open';
                    $decoded = $decLegacy;
                }
            }
        }

        // SEMPRE responde HTTP 200 para a interface do CRM (desconectado é um estado normal da sessão, não erro)
        http_response_code(200);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            "state" => $normalizedState,
            "instanceName" => $instance,
            "status" => $normalizedState === 'open' ? 'connected' : 'disconnected',
            "raw" => $decoded
        ]);
        exit();
    } elseif ($method === 'GET' && $subAction === 'qrcode') {
        $base64 = null;
        $pairingCode = null;
        $decoded = [];

        $globalApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
        $instUuid = '';
        $instToken = $apiKey;

        // 1. Procurar token e UUID da instância no Evolution GO via /instance/all
        try {
            $chAll = curl_init($baseUrl . "/instance/all");
            curl_setopt($chAll, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chAll, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey, "Content-Type: application/json"]);
            apply_curl_ssl_opts($chAll);
            curl_setopt($chAll, CURLOPT_TIMEOUT, 6);
            $resAll = curl_exec($chAll);
            curl_close($chAll);

            if ($resAll) {
                $allDec = json_decode($resAll, true) ?: [];
                foreach ($allDec['data'] ?? [] as $item) {
                    if (($item['name'] ?? '') === $instance) {
                        $instUuid = $item['id'] ?? '';
                        $instToken = $item['token'] ?? $apiKey;
                        if (!empty($item['qrcode'])) {
                            $base64 = $item['qrcode'];
                        }
                        break;
                    }
                }
            }
        } catch (Throwable $eFind) {}

        // 2. Se não tiver qrcode pronto, consulta /instance/qr direto na Evolution GO com a chave da instância
        if (empty($base64) && !empty($instToken)) {
            $chQr = curl_init($baseUrl . "/instance/qr");
            curl_setopt($chQr, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chQr, CURLOPT_HTTPHEADER, ["apikey: " . $instToken, "Content-Type: application/json"]);
            apply_curl_ssl_opts($chQr);
            curl_setopt($chQr, CURLOPT_TIMEOUT, 6);
            $resQr = curl_exec($chQr);
            curl_close($chQr);
            if ($resQr) {
                $qrDec = json_decode($resQr, true) ?: [];
                $base64 = $qrDec['qrcode'] ?? $qrDec['data']['qrcode'] ?? $qrDec['base64'] ?? $qrDec['data']['base64'] ?? null;
            }
        }

        // 3. Se ainda não tiver qrcode, dispara POST /instance/connect na Evolution GO
        if (empty($base64) && !empty($instToken)) {
            $chConn = curl_init($baseUrl . "/instance/connect");
            curl_setopt($chConn, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chConn, CURLOPT_POST, true);
            curl_setopt($chConn, CURLOPT_HTTPHEADER, ["apikey: " . $instToken, "Content-Type: application/json"]);
            curl_setopt($chConn, CURLOPT_POSTFIELDS, json_encode([
                "immediate" => true,
                "subscribe" => ["MESSAGE"],
                "webhookUrl" => "https://crmatlanticanatural.acessaronline.com.br/api/webhook_whatsapp.php?instance=" . urlencode($instance) . "&tenant_id=" . urlencode($tid)
            ]));
            apply_curl_ssl_opts($chConn);
            curl_setopt($chConn, CURLOPT_TIMEOUT, 8);
            curl_exec($chConn);
            curl_close($chConn);

            // Aguarda 800ms e tenta /instance/qr novamente
            usleep(800000);
            $chQr2 = curl_init($baseUrl . "/instance/qr");
            curl_setopt($chQr2, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chQr2, CURLOPT_HTTPHEADER, ["apikey: " . $instToken, "Content-Type: application/json"]);
            apply_curl_ssl_opts($chQr2);
            curl_setopt($chQr2, CURLOPT_TIMEOUT, 6);
            $resQr2 = curl_exec($chQr2);
            curl_close($chQr2);
            if ($resQr2) {
                $qrDec2 = json_decode($resQr2, true) ?: [];
                $base64 = $qrDec2['qrcode'] ?? $qrDec2['data']['qrcode'] ?? $qrDec2['base64'] ?? $qrDec2['data']['base64'] ?? null;
            }

            // Consulta info atualizada como fallback
            if (empty($base64) && !empty($instUuid)) {
                $chInfo = curl_init($baseUrl . "/instance/info/" . $instUuid);
                curl_setopt($chInfo, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chInfo, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey, "Content-Type: application/json"]);
                apply_curl_ssl_opts($chInfo);
                curl_setopt($chInfo, CURLOPT_TIMEOUT, 6);
                $resInfo = curl_exec($chInfo);
                curl_close($chInfo);
                if ($resInfo) {
                    $infoDec = json_decode($resInfo, true) ?: [];
                    $base64 = $infoDec['data']['qrcode'] ?? null;
                    $decoded = $infoDec['data'] ?? [];
                }
            }
        }

        // 4. Fallback legado para Evolution API v2 tradicional
        if (empty($base64)) {
            $url = $baseUrl . "/instance/connect/" . urlencode($instance);
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            apply_curl_ssl_opts($ch);
            $response = curl_exec($ch);
            curl_close($ch);
            $decoded = json_decode($response, true) ?: [];
            $base64 = $decoded['base64'] ?? $decoded['code'] ?? $decoded['qrcode']['base64'] ?? null;
            $pairingCode = $decoded['pairingCode'] ?? $decoded['code'] ?? null;
        }

        if (!empty($base64) && strpos($base64, '|') !== false) {
            $qrParts = explode('|', $base64);
            $base64 = $qrParts[0];
            $pairingCode = $pairingCode ?: ($qrParts[1] ?? null);
        }

        if (!empty($base64) && strpos($base64, 'data:image') !== 0) {
            $base64 = 'data:image/png;base64,' . $base64;
        }

        http_response_code(200);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            "base64" => $base64,
            "code" => $pairingCode,
            "state" => "connecting",
            "raw" => $decoded
        ]);
        exit();
    } elseif (($method === 'DELETE' && $subAction === 'logout') || (($method === 'POST' || $method === 'DELETE') && $subAction === 'disconnect')) {
        $globalApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
        $instToken = $apiKey;

        // Buscar token da instância no Evolution GO se necessário
        try {
            $chAll = curl_init($baseUrl . "/instance/all");
            curl_setopt($chAll, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chAll, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey, "Content-Type: application/json"]);
            apply_curl_ssl_opts($chAll);
            curl_setopt($chAll, CURLOPT_TIMEOUT, 6);
            $resAll = curl_exec($chAll);
            curl_close($chAll);
            if ($resAll) {
                $allDec = json_decode($resAll, true) ?: [];
                foreach ($allDec['data'] ?? [] as $item) {
                    if (($item['name'] ?? '') === $instance) {
                        $instToken = $item['token'] ?? $instToken;
                        break;
                    }
                }
            }
        } catch (Throwable $eToken) {}

        // Desconectar via Evolution GO: POST /instance/disconnect com header apikey: $instToken
        $chDisc = curl_init($baseUrl . "/instance/disconnect");
        curl_setopt($chDisc, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($chDisc, CURLOPT_POST, true);
        curl_setopt($chDisc, CURLOPT_HTTPHEADER, ["apikey: " . $instToken, "Content-Type: application/json"]);
        apply_curl_ssl_opts($chDisc);
        curl_setopt($chDisc, CURLOPT_TIMEOUT, 8);
        curl_exec($chDisc);
        curl_close($chDisc);

        // Fallback legado para Evolution API v2: DELETE /instance/logout/:instance
        $url = $baseUrl . "/instance/logout/" . urlencode($instance);
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        apply_curl_ssl_opts($ch);
        curl_exec($ch);
        curl_close($ch);
        
        http_response_code(200);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(["success" => true, "message" => "Instância do WhatsApp desconectada com sucesso."]);
        exit();
    }
}

// Route: tenants (Super Admin - Gestão de Clínicas e Instâncias SaaS)
if ($resource === 'tenants') {
    // 1. Verificação de permissão Super Admin
    $currentUserEmail = defined('CURRENT_USER_EMAIL') ? CURRENT_USER_EMAIL : '';
    $isSuper = defined('IS_SUPER_ADMIN') && IS_SUPER_ADMIN;
    if (!$isSuper && !empty($currentUserEmail)) {
        $isSuper = is_super_admin($db, $currentUserEmail);
    }
    
    // Se não for super admin e não estiver em CLI/teste interno
    if (!$isSuper && php_sapi_name() !== 'cli') {
        http_response_code(403);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(["error" => "Acesso restrito ao Super Administrador Master."]);
        exit();
    }

    $tenantTargetId = $parts[1] ?? null;
    $subAction = $parts[2] ?? null;

    try {
        // GET /tenants/:id/qrcode -> Buscar QR Code específico da clínica
        if ($method === 'GET' && !empty($tenantTargetId) && $subAction === 'qrcode') {
            $stmt = $db->prepare("SELECT evolution_api_url, evolution_url, evolution_api_key, evolution_apikey, evolution_instance, evolution_instance_name FROM tenant_settings WHERE tenant_id = ? LIMIT 1");
            $stmt->execute([$tenantTargetId]);
            $cfg = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            
            $evoUrl = !empty($cfg['evolution_api_url']) ? $cfg['evolution_api_url'] : ($cfg['evolution_url'] ?? 'https://evogo.acessaronline.com.br');
            $evoInst = !empty($cfg['evolution_instance_name']) ? $cfg['evolution_instance_name'] : ($cfg['evolution_instance'] ?? $tenantTargetId);
            $globalApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));

            $evoUrl = rtrim($evoUrl, '/');

            // 1. Localiza a instância no Evolution GO para pegar seu UUID e TOKEN
            $instUuid = '';
            $instToken = '';
            $base64 = null;
            $code = null;

            try {
                $chAll = curl_init($evoUrl . "/instance/all");
                curl_setopt($chAll, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chAll, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey, "Content-Type: application/json"]);
                apply_curl_ssl_opts($chAll);
                curl_setopt($chAll, CURLOPT_TIMEOUT, 6);
                $resAll = curl_exec($chAll);
                curl_close($chAll);
                if ($resAll) {
                    $allDec = json_decode($resAll, true) ?: [];
                    foreach ($allDec['data'] ?? [] as $item) {
                        if (($item['name'] ?? '') === $evoInst) {
                            $instUuid = $item['id'] ?? '';
                            $instToken = $item['token'] ?? '';
                            if (!empty($item['qrcode'])) {
                                $base64 = $item['qrcode'];
                            }
                            break;
                        }
                    }
                }
            } catch (Throwable $eFind) {}

            // 2. Se não tiver qrcode pronto e tiver instToken, dispara POST /instance/connect
            if (empty($base64) && !empty($instToken)) {
                $chConn = curl_init($evoUrl . "/instance/connect");
                curl_setopt($chConn, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chConn, CURLOPT_POST, true);
                curl_setopt($chConn, CURLOPT_HTTPHEADER, ["apikey: " . $instToken, "Content-Type: application/json"]);
                curl_setopt($chConn, CURLOPT_POSTFIELDS, json_encode(["subscribe" => ["MESSAGE"]]));
                apply_curl_ssl_opts($chConn);
                curl_setopt($chConn, CURLOPT_TIMEOUT, 8);
                curl_exec($chConn);
                curl_close($chConn);

                // Consulta info atualizada com o QR gerado
                if (!empty($instUuid)) {
                    $chInfo = curl_init($evoUrl . "/instance/info/" . $instUuid);
                    curl_setopt($chInfo, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($chInfo, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey, "Content-Type: application/json"]);
                    apply_curl_ssl_opts($chInfo);
                    curl_setopt($chInfo, CURLOPT_TIMEOUT, 6);
                    $resInfo = curl_exec($chInfo);
                    curl_close($chInfo);
                    if ($resInfo) {
                        $infoDec = json_decode($resInfo, true) ?: [];
                        $base64 = $infoDec['data']['qrcode'] ?? null;
                    }
                }
            }

            if (!empty($base64) && strpos($base64, '|') !== false) {
                $qrParts = explode('|', $base64);
                $base64 = $qrParts[0];
                $code = $code ?: ($qrParts[1] ?? null);
            }

            http_response_code(200);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                "tenant_id" => $tenantTargetId,
                "instance" => $evoInst,
                "base64" => $base64,
                "code" => $code
            ]);
            exit();
        }

        // POST /tenants/:id/disconnect ou DELETE /tenants/:id/logout -> Desconectar WhatsApp da clínica
        if ((($method === 'POST' || $method === 'DELETE') && !empty($tenantTargetId) && ($subAction === 'disconnect' || $subAction === 'logout'))) {
            $stmt = $db->prepare("SELECT evolution_api_url, evolution_url, evolution_api_key, evolution_apikey, evolution_instance, evolution_instance_name FROM tenant_settings WHERE tenant_id = ? LIMIT 1");
            $stmt->execute([$tenantTargetId]);
            $cfg = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            
            $evoUrl = !empty($cfg['evolution_api_url']) ? $cfg['evolution_api_url'] : ($cfg['evolution_url'] ?? 'https://evogo.acessaronline.com.br');
            $evoKey = !empty($cfg['evolution_api_key']) ? $cfg['evolution_api_key'] : ($cfg['evolution_apikey'] ?? get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef')));
            $evoInst = !empty($cfg['evolution_instance_name']) ? $cfg['evolution_instance_name'] : ($cfg['evolution_instance'] ?? $tenantTargetId);

            $ch = curl_init(rtrim($evoUrl, '/') . "/instance/logout/" . urlencode($evoInst));
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["apikey: " . $evoKey]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            apply_curl_ssl_opts($ch);
            curl_exec($ch);
            curl_close($ch);

            http_response_code(200);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode(["success" => true, "message" => "WhatsApp desconectado."]);
            exit();
        }

        // GET /tenants -> Listar todas as clínicas
        if ($method === 'GET' && empty($tenantTargetId)) {
            // Busca instâncias ativas na Evolution GO para mapear status em tempo real
            $globalApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
            $evoInstancesMap = [];
            try {
                $chAll = curl_init("https://evogo.acessaronline.com.br/instance/all");
                curl_setopt($chAll, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chAll, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey, "Content-Type: application/json"]);
                curl_setopt($chAll, CURLOPT_TIMEOUT, 6);
                apply_curl_ssl_opts($chAll);
                $resAll = curl_exec($chAll);
                curl_close($chAll);
                if ($resAll) {
                    $allDec = json_decode($resAll, true) ?: [];
                    foreach ($allDec['data'] ?? [] as $instItem) {
                        $name = $instItem['name'] ?? '';
                        if (!empty($name)) {
                            $evoInstancesMap[$name] = [
                                "id" => $instItem['id'] ?? '',
                                "connected" => !empty($instItem['connected']),
                                "jid" => $instItem['jid'] ?? '',
                                "phone" => preg_replace('/\D/', '', explode(':', $instItem['jid'] ?? '')[0])
                            ];
                        }
                    }
                }
            } catch (Throwable $eEvo) {}

            $stmtTenants = $db->query("
                SELECT t.*, 
                       s.evolution_instance_name, s.evolution_api_url, s.gemini_custom_prompt, s.dias_antecedencia_lembrete, s.horario_padrao_envio
                FROM tenants t
                LEFT JOIN tenant_settings s ON t.id = s.tenant_id
                ORDER BY t.created_at ASC
            ");
            $tenants = $stmtTenants->fetchAll(PDO::FETCH_ASSOC);

            $results = [];
            foreach ($tenants as $ten) {
                $tId = $ten['id'];
                
                // Contagem de Pacientes
                $stmtPat = $db->prepare("SELECT COUNT(*) FROM patients WHERE tenant_id = ?");
                $stmtPat->execute([$tId]);
                $totalPatients = (int)$stmtPat->fetchColumn();

                // Contagem de Consultas
                $stmtApt = $db->prepare("SELECT COUNT(*) FROM appointments WHERE tenant_id = ?");
                $stmtApt->execute([$tId]);
                $totalAppointments = (int)$stmtApt->fetchColumn();

                // Contagem de Mensagens
                $stmtMsg = $db->prepare("SELECT COUNT(*) FROM messages WHERE tenant_id = ?");
                $stmtMsg->execute([$tId]);
                $totalMessages = (int)$stmtMsg->fetchColumn();

                // Profissionais
                $stmtUsers = $db->prepare("SELECT id, name, email, role FROM users WHERE tenant_id = ? AND role != 'superadmin'");
                $stmtUsers->execute([$tId]);
                $usersList = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);

                // Mapeia WhatsApp Status
                $instName = !empty($ten['evolution_instance_name']) ? $ten['evolution_instance_name'] : $tId;
                $evoData = $evoInstancesMap[$instName] ?? null;

                $results[] = [
                    "id" => $tId,
                    "name" => $ten['name'],
                    "nome_empresa" => $ten['nome_empresa'] ?: $ten['name'],
                    "cnpj" => $ten['cnpj'] ?? '',
                    "email_contato" => $ten['email_contato'] ?? '',
                    "telefone_contato" => $ten['telefone_contato'] ?? '',
                    "plano" => $ten['plano'] ?? 'PRO',
                    "status" => $ten['status'] ?? 'ativo',
                    "limite_disparos_mensal" => (int)($ten['limite_disparos_mensal'] ?? 1000),
                    "created_at" => $ten['created_at'],
                    "evolution_instance_name" => $instName,
                    "whatsapp" => [
                        "connected" => $evoData ? $evoData['connected'] : false,
                        "jid" => $evoData ? $evoData['jid'] : '',
                        "phone" => $evoData ? $evoData['phone'] : ''
                    ],
                    "metrics" => [
                        "patients" => $totalPatients,
                        "appointments" => $totalAppointments,
                        "messages" => $totalMessages,
                        "users_count" => count($usersList)
                    ],
                    "users" => $usersList
                ];
            }

            http_response_code(200);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode($results);
            exit();
        }

        // POST /tenants -> Criar nova clínica
        if ($method === 'POST' && empty($tenantTargetId)) {
            $rawInput = file_get_contents('php://input');
            $input = json_decode($rawInput, true) ?: $_POST;

            $name = trim($input['name'] ?? '');
            $slug = strtolower(trim($input['slug'] ?? $input['id'] ?? ''));
            $email = strtolower(trim($input['email_contato'] ?? $input['email'] ?? ''));
            $phone = trim($input['telefone_contato'] ?? $input['phone'] ?? '');
            $plano = trim($input['plano'] ?? 'PRO');
            $limite = (int)($input['limite_disparos_mensal'] ?? 1000);
            $responsavelNome = trim($input['responsavel_nome'] ?? $name);
            $promptIa = trim($input['gemini_custom_prompt'] ?? '');

            // Normaliza slug (somente letras, números e hífens)
            $slug = preg_replace('/[^a-z0-9\-]/', '', str_replace([' ', '_'], '-', $slug));

            if (empty($name) || empty($slug)) {
                http_response_code(400);
                header('Content-Type: application/json; charset=UTF-8');
                echo json_encode(["error" => "Nome e identificador (subdomínio) são obrigatórios."]);
                exit();
            }

            // Verifica se o slug já existe
            $stmtCheck = $db->prepare("SELECT id FROM tenants WHERE id = ? LIMIT 1");
            $stmtCheck->execute([$slug]);
            if ($stmtCheck->fetch()) {
                http_response_code(400);
                header('Content-Type: application/json; charset=UTF-8');
                echo json_encode(["error" => "O identificador/subdomínio '{$slug}' já está em uso."]);
                exit();
            }

            // 1. Insere em tenants
            $stmtInsT = $db->prepare("
                INSERT INTO tenants (id, name, nome_empresa, email_contato, telefone_contato, plano, status, active, limite_disparos_mensal)
                VALUES (?, ?, ?, ?, ?, ?, 'ativo', 1, ?)
            ");
            $stmtInsT->execute([$slug, $name, $name, $email, $phone, $plano, $limite]);

            // 2. Insere em tenant_settings
            $globalApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
            $defaultPrompt = !empty($promptIa) ? $promptIa : "Você é a secretária e assistente virtual da {$name}. Seja atenciosa, humanizada e profissional. Confirme as consultas e passe orientações com gentileza.";
            
            $isPg = ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql');
            $sqlInsS = $isPg
                ? "INSERT INTO tenant_settings (tenant_id, evolution_api_url, evolution_api_key, evolution_instance_name, gemini_custom_prompt, dias_antecedencia_lembrete, horario_padrao_envio)
                   VALUES (?, 'https://evogo.acessaronline.com.br', ?, ?, ?, 1, '08:00')
                   ON CONFLICT (tenant_id) DO UPDATE 
                       SET evolution_instance_name = EXCLUDED.evolution_instance_name,
                           gemini_custom_prompt = EXCLUDED.gemini_custom_prompt"
                : "INSERT INTO tenant_settings (tenant_id, evolution_api_url, evolution_api_key, evolution_instance_name, gemini_custom_prompt, dias_antecedencia_lembrete, horario_padrao_envio)
                   VALUES (?, 'https://evogo.acessaronline.com.br', ?, ?, ?, 1, '08:00')
                   ON DUPLICATE KEY UPDATE 
                       evolution_instance_name = VALUES(evolution_instance_name),
                       gemini_custom_prompt = VALUES(gemini_custom_prompt)";
            $stmtInsS = $db->prepare($sqlInsS);
            $stmtInsS->execute([$slug, $globalApiKey, $slug, $defaultPrompt]);

            // 3. Cria usuário Administrador da Clínica em users (se e-mail informado)
            if (!empty($email)) {
                $newUserId = 'usr_' . bin2hex(random_bytes(8));
                $sqlInsU = $isPg
                    ? "INSERT INTO users (id, tenant_id, email, name, role, status, ativo)
                       VALUES (?, ?, ?, ?, 'admin_clinica', 'Ativo', 1)
                       ON CONFLICT (tenant_id, email) DO UPDATE SET name = EXCLUDED.name, status = 'Ativo', ativo = 1"
                    : "INSERT INTO users (id, tenant_id, email, name, role, status, ativo)
                       VALUES (?, ?, ?, ?, 'admin_clinica', 'Ativo', 1)
                       ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'Ativo', ativo = 1";
                $stmtInsU = $db->prepare($sqlInsU);
                $stmtInsU->execute([$newUserId, $slug, $email, $responsavelNome]);
            }

            // 4. Cria a instância no Evolution GO
            $evoCreated = false;
            try {
                $evoToken = bin2hex(random_bytes(16));
                $chCreate = curl_init("https://evogo.acessaronline.com.br/instance/create");
                curl_setopt($chCreate, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chCreate, CURLOPT_POST, true);
                curl_setopt($chCreate, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey, "Content-Type: application/json"]);
                curl_setopt($chCreate, CURLOPT_POSTFIELDS, json_encode([
                    "name" => $slug,
                    "token" => $evoToken,
                    "webhook" => "https://crmninja.acessaronline.com.br/api/webhook_whatsapp.php"
                ]));
                apply_curl_ssl_opts($chCreate);
                curl_setopt($chCreate, CURLOPT_TIMEOUT, 8);
                $resCreate = curl_exec($chCreate);
                $codeCreate = curl_getinfo($chCreate, CURLINFO_HTTP_CODE);
                curl_close($chCreate);
                if ($codeCreate >= 200 && $codeCreate < 300) {
                    $evoCreated = true;
                }
            } catch (Throwable $eEvoC) {}

            http_response_code(201);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                "success" => true,
                "message" => "Clínica '{$name}' cadastrada com sucesso!",
                "tenant_id" => $slug,
                "evolution_created" => $evoCreated
            ]);
            exit();
        }

        // PUT /tenants/:id -> Atualizar dados / status da clínica
        if ($method === 'PUT' && !empty($tenantTargetId)) {
            $rawInput = file_get_contents('php://input');
            $input = json_decode($rawInput, true) ?: $_POST;

            $status = $input['status'] ?? null;
            $name = $input['name'] ?? null;
            $plano = $input['plano'] ?? null;
            $limite = isset($input['limite_disparos_mensal']) ? (int)$input['limite_disparos_mensal'] : null;
            $email = $input['email_contato'] ?? null;
            $phone = $input['telefone_contato'] ?? null;
            $promptIa = $input['gemini_custom_prompt'] ?? null;

            $fields = [];
            $params = [];

            if ($status !== null) {
                $fields[] = "status = ?";
                $params[] = ($status === 'suspenso' ? 'suspenso' : 'ativo');
                $fields[] = "active = ?";
                $params[] = ($status === 'suspenso' ? 0 : 1);
            }
            if ($name !== null) {
                $fields[] = "name = ?";
                $params[] = trim($name);
                $fields[] = "nome_empresa = ?";
                $params[] = trim($name);
            }
            if ($plano !== null) {
                $fields[] = "plano = ?";
                $params[] = trim($plano);
            }
            if ($limite !== null) {
                $fields[] = "limite_disparos_mensal = ?";
                $params[] = $limite;
            }
            if ($email !== null) {
                $fields[] = "email_contato = ?";
                $params[] = trim($email);
            }
            if ($phone !== null) {
                $fields[] = "telefone_contato = ?";
                $params[] = trim($phone);
            }

            if (!empty($fields)) {
                $params[] = $tenantTargetId;
                $stmtUpT = $db->prepare("UPDATE tenants SET " . implode(', ', $fields) . " WHERE id = ?");
                $stmtUpT->execute($params);
            }

            if ($promptIa !== null) {
                $stmtUpS = $db->prepare("UPDATE tenant_settings SET gemini_custom_prompt = ? WHERE tenant_id = ?");
                $stmtUpS->execute([$promptIa, $tenantTargetId]);
            }

            http_response_code(200);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode(["success" => true, "message" => "Clínica atualizada com sucesso."]);
            exit();
        }

        // DELETE /tenants/:id -> Excluir clínica (com proteção de inquilinos base)
        if ($method === 'DELETE' && !empty($tenantTargetId) && empty($subAction)) {
            if (in_array($tenantTargetId, ['acessaronline', 'clinica-elo', 'crmninja'], true)) {
                http_response_code(400);
                header('Content-Type: application/json; charset=UTF-8');
                echo json_encode(["error" => "Não é permitido excluir o inquilino principal do sistema."]);
                exit();
            }

            // Exclui do Evolution GO se houver
            try {
                $globalApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
                $chAll = curl_init("https://evogo.acessaronline.com.br/instance/all");
                curl_setopt($chAll, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chAll, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey]);
                apply_curl_ssl_opts($chAll);
                $resAll = curl_exec($chAll);
                curl_close($chAll);
                $allDec = json_decode($resAll, true) ?: [];
                foreach ($allDec['data'] ?? [] as $instItem) {
                    if (($instItem['name'] ?? '') === $tenantTargetId && !empty($instItem['id'])) {
                        $chDel = curl_init("https://evogo.acessaronline.com.br/instance/delete/" . $instItem['id']);
                        curl_setopt($chDel, CURLOPT_CUSTOMREQUEST, "DELETE");
                        curl_setopt($chDel, CURLOPT_RETURNTRANSFER, true);
                        curl_setopt($chDel, CURLOPT_HTTPHEADER, ["apikey: " . $globalApiKey]);
                        apply_curl_ssl_opts($chDel);
                        curl_exec($chDel);
                        curl_close($chDel);
                        break;
                    }
                }
            } catch (Throwable $eDelEvo) {}

            // Exclui registros do banco
            $db->prepare("DELETE FROM appointments WHERE tenant_id = ?")->execute([$tenantTargetId]);
            $db->prepare("DELETE FROM messages WHERE tenant_id = ?")->execute([$tenantTargetId]);
            $db->prepare("DELETE FROM patients WHERE tenant_id = ?")->execute([$tenantTargetId]);
            $db->prepare("DELETE FROM users WHERE tenant_id = ? AND role != 'superadmin'")->execute([$tenantTargetId]);
            $db->prepare("DELETE FROM tenant_settings WHERE tenant_id = ?")->execute([$tenantTargetId]);
            $db->prepare("DELETE FROM tenants WHERE id = ?")->execute([$tenantTargetId]);

            http_response_code(200);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode(["success" => true, "message" => "Clínica excluída com sucesso."]);
            exit();
        }
    } catch (Throwable $eTenants) {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(["error" => "Erro ao processar gestão de clínicas: " . $eTenants->getMessage()]);
        exit();
    }
}

// Route: settings
if ($resource === 'settings') {
    try {
        if ($method === 'GET') {
            $stmt = $db->prepare("SELECT evolution_url, evolution_api_url, evolution_apikey, evolution_api_key, evolution_instance, evolution_instance_name, gemini_apikey, gemini_custom_prompt, antiban_delay_min, antiban_delay_max, antiban_batch_size, antiban_batch_interval, antiban_simulate_typing, antiban_simulate_audio FROM tenant_settings WHERE tenant_id = ?");
            $stmt->execute([$tid]);
            $config = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $evoUrlVal = !empty($config['evolution_api_url']) ? $config['evolution_api_url'] : (!empty($config['evolution_url']) ? $config['evolution_url'] : get_env_var('EVOLUTION_API_URL', 'https://evogo.acessaronline.com.br'));
            $evoKeyVal = !empty($config['evolution_api_key']) ? $config['evolution_api_key'] : (!empty($config['evolution_apikey']) ? $config['evolution_apikey'] : get_env_var('EVOLUTION_API_KEY', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
            $evoInstVal = !empty($config['evolution_instance_name']) ? $config['evolution_instance_name'] : (!empty($config['evolution_instance']) ? $config['evolution_instance'] : get_env_var('EVOLUTION_INSTANCE_NAME', 'atlanticanatural'));

            // Translate back to schema for frontend
            if (!$config) {
                $config = [
                    "provider" => "Evolution API",
                    "instance_id" => $evoInstVal,
                    "api_key" => $evoKeyVal,
                    "evolution_url" => $evoUrlVal,
                    "system_prompt" => "",
                    "temperatura" => 0.70,
                    "antiban_delay_min" => 15,
                    "antiban_delay_max" => 45,
                    "antiban_batch_size" => 20,
                    "antiban_batch_interval" => 5,
                    "antiban_simulate_typing" => true,
                    "antiban_simulate_audio" => false
                ];
            } else {
                $config = [
                    "provider" => "Evolution API",
                    "instance_id" => $evoInstVal,
                    "api_key" => $evoKeyVal,
                    "evolution_url" => $evoUrlVal,
                    "gemini_apikey" => $config['gemini_apikey'] ?? '',
                    "system_prompt" => $config['gemini_custom_prompt'] ?? '',
                    "temperatura" => 0.70,
                    "antiban_delay_min" => isset($config['antiban_delay_min']) ? (int)$config['antiban_delay_min'] : 15,
                    "antiban_delay_max" => isset($config['antiban_delay_max']) ? (int)$config['antiban_delay_max'] : 45,
                    "antiban_batch_size" => isset($config['antiban_batch_size']) ? (int)$config['antiban_batch_size'] : 20,
                    "antiban_batch_interval" => isset($config['antiban_batch_interval']) ? (int)$config['antiban_batch_interval'] : 5,
                    "antiban_simulate_typing" => isset($config['antiban_simulate_typing']) ? (bool)$config['antiban_simulate_typing'] : true,
                    "antiban_simulate_audio" => isset($config['antiban_simulate_audio']) ? (bool)$config['antiban_simulate_audio'] : false
                ];
            }
            echo json_encode($config);
        } elseif ($method === 'PUT') {
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Buscar configurações atuais para não sobrescrever dados não enviados
            $stmtCurrent = $db->prepare("SELECT evolution_url, evolution_api_url, evolution_apikey, evolution_api_key, evolution_instance, evolution_instance_name, gemini_apikey, gemini_custom_prompt, antiban_delay_min, antiban_delay_max, antiban_batch_size, antiban_batch_interval, antiban_simulate_typing, antiban_simulate_audio FROM tenant_settings WHERE tenant_id = ?");
            $stmtCurrent->execute([$tid]);
            $current = $stmtCurrent->fetch(PDO::FETCH_ASSOC) ?: [];

            $inst = array_key_exists('instance_id', $input) ? $input['instance_id'] : (array_key_exists('evolution_instance', $input) ? $input['evolution_instance'] : (!empty($current['evolution_instance_name']) ? $current['evolution_instance_name'] : ($current['evolution_instance'] ?? '')));
            
            $apiInput = array_key_exists('api_key', $input) ? $input['api_key'] : (array_key_exists('evolution_apikey', $input) ? $input['evolution_apikey'] : '');
            $currKey = !empty($current['evolution_api_key']) ? $current['evolution_api_key'] : ($current['evolution_apikey'] ?? 'd7b87fcfca7d42cfb7692298bc6d42ef');
            $api = (!empty($apiInput) && $apiInput !== 'SUA_GLOBAL_API_KEY') ? $apiInput : $currKey;

            $urlInput = array_key_exists('evolution_url', $input) ? $input['evolution_url'] : '';
            $currUrl = !empty($current['evolution_api_url']) ? $current['evolution_api_url'] : ($current['evolution_url'] ?? 'https://evogo.acessaronline.com.br');
            $url = (!empty($urlInput) && $urlInput !== 'https://api.evolution.com') ? $urlInput : $currUrl;

            $gemini = array_key_exists('gemini_apikey', $input) ? $input['gemini_apikey'] : ($current['gemini_apikey'] ?? '');
            $sysPrompt = array_key_exists('system_prompt', $input) ? $input['system_prompt'] : (array_key_exists('gemini_custom_prompt', $input) ? $input['gemini_custom_prompt'] : ($current['gemini_custom_prompt'] ?? ''));

            $delayMin = array_key_exists('antiban_delay_min', $input) ? (int)$input['antiban_delay_min'] : (int)($current['antiban_delay_min'] ?? 15);
            $delayMax = array_key_exists('antiban_delay_max', $input) ? (int)$input['antiban_delay_max'] : (int)($current['antiban_delay_max'] ?? 45);
            $batchSize = array_key_exists('antiban_batch_size', $input) ? (int)$input['antiban_batch_size'] : (int)($current['antiban_batch_size'] ?? 20);
            $batchInterval = array_key_exists('antiban_batch_interval', $input) ? (int)$input['antiban_batch_interval'] : (int)($current['antiban_batch_interval'] ?? 5);
            $simTyping = array_key_exists('antiban_simulate_typing', $input) ? ($input['antiban_simulate_typing'] ? 1 : 0) : (isset($current['antiban_simulate_typing']) ? ($current['antiban_simulate_typing'] ? 1 : 0) : 1);
            $simAudio = array_key_exists('antiban_simulate_audio', $input) ? ($input['antiban_simulate_audio'] ? 1 : 0) : (isset($current['antiban_simulate_audio']) ? ($current['antiban_simulate_audio'] ? 1 : 0) : 0);
            
            $isPg = ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql');
            $sqlSettings = $isPg
                ? "INSERT INTO tenant_settings (tenant_id, evolution_url, evolution_api_url, evolution_apikey, evolution_api_key, evolution_instance, evolution_instance_name, gemini_apikey, gemini_custom_prompt, antiban_delay_min, antiban_delay_max, antiban_batch_size, antiban_batch_interval, antiban_simulate_typing, antiban_simulate_audio)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (tenant_id) DO UPDATE SET
                       evolution_url = EXCLUDED.evolution_url,
                       evolution_api_url = EXCLUDED.evolution_api_url,
                       evolution_apikey = EXCLUDED.evolution_apikey,
                       evolution_api_key = EXCLUDED.evolution_api_key,
                       evolution_instance = EXCLUDED.evolution_instance,
                       evolution_instance_name = EXCLUDED.evolution_instance_name,
                       gemini_apikey = EXCLUDED.gemini_apikey,
                       gemini_custom_prompt = EXCLUDED.gemini_custom_prompt,
                       antiban_delay_min = EXCLUDED.antiban_delay_min,
                       antiban_delay_max = EXCLUDED.antiban_delay_max,
                       antiban_batch_size = EXCLUDED.antiban_batch_size,
                       antiban_batch_interval = EXCLUDED.antiban_batch_interval,
                       antiban_simulate_typing = EXCLUDED.antiban_simulate_typing,
                       antiban_simulate_audio = EXCLUDED.antiban_simulate_audio"
                : "INSERT INTO tenant_settings (tenant_id, evolution_url, evolution_api_url, evolution_apikey, evolution_api_key, evolution_instance, evolution_instance_name, gemini_apikey, gemini_custom_prompt, antiban_delay_min, antiban_delay_max, antiban_batch_size, antiban_batch_interval, antiban_simulate_typing, antiban_simulate_audio)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE
                       evolution_url = VALUES(evolution_url),
                       evolution_api_url = VALUES(evolution_api_url),
                       evolution_apikey = VALUES(evolution_apikey),
                       evolution_api_key = VALUES(evolution_api_key),
                       evolution_instance = VALUES(evolution_instance),
                       evolution_instance_name = VALUES(evolution_instance_name),
                       gemini_apikey = VALUES(gemini_apikey),
                       gemini_custom_prompt = VALUES(gemini_custom_prompt),
                       antiban_delay_min = VALUES(antiban_delay_min),
                       antiban_delay_max = VALUES(antiban_delay_max),
                       antiban_batch_size = VALUES(antiban_batch_size),
                       antiban_batch_interval = VALUES(antiban_batch_interval),
                       antiban_simulate_typing = VALUES(antiban_simulate_typing),
                       antiban_simulate_audio = VALUES(antiban_simulate_audio)";
            $stmt = $db->prepare($sqlSettings);
            $stmt->execute([$tid, $url, $url, $api, $api, $inst, $inst, $gemini, $sysPrompt, $delayMin, $delayMax, $batchSize, $batchInterval, $simTyping, $simAudio]);
            echo json_encode(["success" => true]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}

// Route: google-auth
if ($resource === 'google-auth' && $method === 'GET') {
    $userId = $_GET['user_id'] ?? '';
    $tenantId = $_GET['tenant_id'] ?? '';
    
    if (empty($userId) || empty($tenantId)) {
        http_response_code(400);
        echo "<h1>Parâmetros inválidos</h1><p>user_id e tenant_id são obrigatórios.</p>";
        exit;
    }
    
    $clientId = get_env_var('GOOGLE_CLIENT_ID');
    $clientSecret = get_env_var('GOOGLE_CLIENT_SECRET');
    

    
    $envAppUrl = get_env_var('APP_URL');
    if (!empty($envAppUrl) && strpos($envAppUrl, 'localhost') === false) {
        $appUrl = rtrim($envAppUrl, '/');
    } else {
        $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:3000';
        $appUrl = $scheme . '://' . $host;
    }

    $apiUrl = get_env_var('VITE_API_URL', '/api');
    
    $oauthMasterUri = get_env_var('GOOGLE_REDIRECT_URI');
    if (!empty($oauthMasterUri)) {
        $redirectUri = $oauthMasterUri;
    } elseif (strpos($appUrl, 'crmatlanticanatural') !== false || strpos($appUrl, 'atlantica') !== false || $tenantId === 'atlanticanatural') {
        $redirectUri = 'https://crmatlanticanatural.acessaronline.com.br/api/google-callback';
    } elseif (strpos($appUrl, 'crmclinica') !== false) {
        $redirectUri = 'https://crmclinica.acessaronline.com.br/api/google-callback';
    } elseif (strpos($appUrl, 'crmninja') !== false) {
        $redirectUri = 'https://crmninja.acessaronline.com.br/api/google-callback';
    } else {
        $redirectUri = $appUrl . $apiUrl . '/google-callback';
    }
    
    $state = base64_encode(json_encode([
        'user_id' => $userId,
        'tenant_id' => $tenantId,
        'return_url' => $appUrl,
        'redirect_uri' => $redirectUri
    ]));
    
    $authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" . http_build_query([
        'client_id' => $clientId,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'scope' => 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
        'access_type' => 'offline',
        'prompt' => 'consent',
        'state' => $state
    ]);
    
    header("Location: " . $authUrl);
    exit;
}

// Route: google-callback
if ($resource === 'google-callback' && $method === 'GET') {
    $code = $_GET['code'] ?? '';
    $stateStr = $_GET['state'] ?? '';
    
    if (empty($code) || empty($stateStr)) {
        http_response_code(400);
        echo "<h1>Erro de Autorização</h1><p>Código ou estado ausentes na resposta do Google.</p>";
        exit;
    }
    
    $state = json_decode(base64_decode($stateStr), true);
    $userId = $state['user_id'] ?? '';
    $tenantId = $state['tenant_id'] ?? '';
    $returnUrl = $state['return_url'] ?? '';
    $usedRedirectUri = $state['redirect_uri'] ?? '';
    
    if (empty($userId) || empty($tenantId)) {
        http_response_code(400);
        echo "<h1>Erro de Autorização</h1><p>Estado inválido ou corrompido.</p>";
        exit;
    }
    
    $clientId = get_env_var('GOOGLE_CLIENT_ID');
    $clientSecret = get_env_var('GOOGLE_CLIENT_SECRET');

    
    $envAppUrl = get_env_var('APP_URL');
    if (!empty($envAppUrl) && strpos($envAppUrl, 'localhost') === false) {
        $appUrl = rtrim($envAppUrl, '/');
    } else {
        $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:3000';
        $appUrl = $scheme . '://' . $host;
    }
    
    $oauthMasterUri = get_env_var('GOOGLE_REDIRECT_URI');
    if (!empty($usedRedirectUri)) {
        $redirectUri = $usedRedirectUri;
    } elseif (!empty($oauthMasterUri)) {
        $redirectUri = $oauthMasterUri;
    } elseif (strpos($appUrl, 'crmatlanticanatural') !== false || strpos($appUrl, 'atlantica') !== false || $tenantId === 'atlanticanatural') {
        $redirectUri = 'https://crmatlanticanatural.acessaronline.com.br/api/google-callback';
    } elseif (strpos($appUrl, 'crmclinica') !== false) {
        $redirectUri = 'https://crmclinica.acessaronline.com.br/api/google-callback';
    } elseif (strpos($appUrl, 'crmninja') !== false) {
        $redirectUri = 'https://crmninja.acessaronline.com.br/api/google-callback';
    } else {
        $redirectUri = $appUrl . '/api/google-callback';
    }
    
    $ch = curl_init("https://oauth2.googleapis.com/token");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    apply_curl_ssl_opts($ch);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'code' => $code,
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri' => $redirectUri,
        'grant_type' => 'authorization_code'
    ]));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        http_response_code(500);
        echo "<h1>Erro ao obter tokens</h1><p>Resposta do Google (HTTP {$httpCode}): " . htmlspecialchars($response) . "</p>";
        exit;
    }
    
    $tokens = json_decode($response, true);
    $accessToken = $tokens['access_token'] ?? '';
    $refreshToken = $tokens['refresh_token'] ?? '';
    $expiresIn = $tokens['expires_in'] ?? 3600;
    
    $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn);
    
    // Obter dados da conta Google autenticada para mapeamento resiliente
    $googleEmail = '';
    try {
        $chUser = curl_init("https://www.googleapis.com/oauth2/v2/userinfo");
        curl_setopt($chUser, CURLOPT_RETURNTRANSFER, true);
        apply_curl_ssl_opts($chUser);
        curl_setopt($chUser, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
        curl_setopt($chUser, CURLOPT_TIMEOUT, 5);
        $resUser = curl_exec($chUser);
        curl_close($chUser);
        if ($resUser) {
            $uDec = json_decode($resUser, true);
            $googleEmail = strtolower($uDec['email'] ?? '');
        }
    } catch (Throwable $eU) {}

    if (!empty($refreshToken)) {
        $stmtUpdate = $db->prepare("
            UPDATE users 
            SET google_access_token = ?, google_refresh_token = ?, google_token_expires = ?
            WHERE id = ? 
               OR (LOWER(email) = ? AND ? <> '')
               OR (LOWER(email) IN ('suporteninja1@gmail.com', 'salesioninja@gmail.com'))
               OR (tenant_id = ? AND role IN ('superadmin', 'admin_clinica', 'lider_diamante', 'consultor'))
        ");
        $stmtUpdate->execute([$accessToken, $refreshToken, $expiresAt, $userId, $googleEmail, $googleEmail, $tenantId]);
    } else {
        $stmtUpdate = $db->prepare("
            UPDATE users 
            SET google_access_token = ?, google_token_expires = ?
            WHERE id = ? 
               OR (LOWER(email) = ? AND ? <> '')
               OR (LOWER(email) IN ('suporteninja1@gmail.com', 'salesioninja@gmail.com'))
               OR (tenant_id = ? AND role IN ('superadmin', 'admin_clinica', 'lider_diamante', 'consultor'))
        ");
        $stmtUpdate->execute([$accessToken, $expiresAt, $userId, $googleEmail, $googleEmail, $tenantId]);
    }
    
    $destination = !empty($returnUrl) ? rtrim($returnUrl, '/') : $appUrl;
    header("Location: " . $destination . "/?google_calendar_success=true");
    exit;
}

// Route: calendar (Watch & Stop-Watch para Google Push Notifications)
if ($resource === 'calendar') {
    $subAction = $parts[1] ?? null;

    // Auto-criar a tabela google_calendar_sync caso não exista
    $isPg = ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql');
    try {
        if ($isPg) {
            $db->exec("
                CREATE TABLE IF NOT EXISTS google_calendar_sync (
                    id VARCHAR(50) PRIMARY KEY,
                    tenant_id VARCHAR(50) NOT NULL,
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
            ");
        } else {
            $db->exec("
                CREATE TABLE IF NOT EXISTS google_calendar_sync (
                    id VARCHAR(50) PRIMARY KEY,
                    tenant_id VARCHAR(50) NOT NULL,
                    user_id VARCHAR(50) NOT NULL,
                    calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
                    channel_id VARCHAR(100) NOT NULL UNIQUE,
                    resource_id VARCHAR(255) NULL,
                    sync_token TEXT NULL,
                    expiration_timestamp BIGINT NOT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'ativo',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_channel_token (channel_id, tenant_id),
                    INDEX idx_user_tenant (user_id, tenant_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
        }
    } catch (Exception $e) {
        // Tabela já existe
    }

    if ($method === 'POST' && $subAction === 'watch') {
        try {
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            $userId = $input['user_id'] ?? '';
            $calendarId = $input['calendar_id'] ?? 'primary';

            if (empty($userId)) {
                http_response_code(400);
                echo json_encode(["error" => "user_id is required."]);
                exit;
            }

            // Busca os tokens do profissional
            $stmtUser = $db->prepare("SELECT google_access_token, google_refresh_token, google_token_expires FROM users WHERE id = ? AND tenant_id = ?");
            $stmtUser->execute([$userId, $tid]);
            $u = $stmtUser->fetch();

            if (!$u || (empty($u['google_access_token']) && empty($u['google_refresh_token']))) {
                http_response_code(400);
                echo json_encode(["error" => "Profissional não possui conta do Google Agenda conectada."]);
                exit;
            }

            $accessToken = $u['google_access_token'];
            $refreshToken = $u['google_refresh_token'];
            $expiresAt = $u['google_token_expires'];

            // Renovar token se expirado
            $expTimestamp = is_numeric($expiresAt) ? (int)$expiresAt : (strtotime($expiresAt ?: '') ?: 0);
            if (empty($accessToken) || (time() + 60) >= $expTimestamp) {
                if (!empty($refreshToken)) {
                    $chToken = curl_init("https://oauth2.googleapis.com/token");
                    curl_setopt($chToken, CURLOPT_POST, true);
                    curl_setopt($chToken, CURLOPT_POSTFIELDS, http_build_query([
                        'client_id' => get_env_var('VITE_GOOGLE_CLIENT_ID', get_env_var('GOOGLE_CLIENT_ID')),
                        'client_secret' => get_env_var('GOOGLE_CLIENT_SECRET'),
                        'refresh_token' => $refreshToken,
                        'grant_type' => 'refresh_token'
                    ]));
                    curl_setopt($chToken, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($chToken, CURLOPT_TIMEOUT, 10);
                    $resToken = curl_exec($chToken);
                    curl_close($chToken);
                    $arrToken = json_decode($resToken, true);
                    if (!empty($arrToken['access_token'])) {
                        $accessToken = $arrToken['access_token'];
                        $newExpires = date('Y-m-d H:i:s', time() + ($arrToken['expires_in'] ?? 3600));
                        $stmtUp = $db->prepare("UPDATE users SET google_access_token = ?, google_token_expires = ? WHERE id = ?");
                        $stmtUp->execute([$accessToken, $newExpires, $userId]);
                    }
                }
            }

            $channelId = 'gcal_' . bin2hex(random_bytes(16));
            $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $requestUri = $_SERVER['REQUEST_URI'] ?? '';
            $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';

            $basePath = '';
            if (preg_match('#^(/[^/]+)/api#', $requestUri, $m)) {
                $basePath = $m[1];
            } elseif (preg_match('#^(/[^/]+)/api#', $scriptName, $m)) {
                $basePath = $m[1];
            } elseif (strpos($host, 'acessaronline') !== false) {
                $basePath = '/crm-clinicas';
            }

            $defaultWebhook = "{$protocol}://{$host}{$basePath}/api/google_calendar_webhook.php";
            $webhookUrl = get_env_var('GOOGLE_WEBHOOK_URL', $defaultWebhook);

            $watchPayload = json_encode([
                "id" => $channelId,
                "type" => "web_hook",
                "address" => $webhookUrl,
                "token" => "tenant_{$tid}"
            ]);

            $urlWatch = "https://www.googleapis.com/calendar/v3/calendars/" . urlencode($calendarId) . "/events/watch";
            $chWatch = curl_init($urlWatch);
            curl_setopt($chWatch, CURLOPT_POST, true);
            curl_setopt($chWatch, CURLOPT_POSTFIELDS, $watchPayload);
            curl_setopt($chWatch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chWatch, CURLOPT_HTTPHEADER, [
                "Authorization: Bearer {$accessToken}",
                "Content-Type: application/json"
            ]);
            curl_setopt($chWatch, CURLOPT_TIMEOUT, 10);
            $resWatch = curl_exec($chWatch);
            $httpCode = curl_getinfo($chWatch, CURLINFO_HTTP_CODE);
            curl_close($chWatch);

            $arrWatch = json_decode($resWatch, true) ?: [];

            if ($httpCode >= 200 && $httpCode < 300) {
                $resourceId = $arrWatch['resourceId'] ?? null;
                $expirationMs = isset($arrWatch['expiration']) ? (int)$arrWatch['expiration'] : (time() + (7 * 86400)) * 1000;
                $expirationTimestamp = (int)($expirationMs / 1000);

                // Desativa canais antigos deste profissional
                $db->prepare("UPDATE google_calendar_sync SET status = 'inativo' WHERE user_id = ? AND tenant_id = ?")->execute([$userId, $tid]);

                // Salva o novo canal ativo
                $syncId = 'sync_' . bin2hex(random_bytes(12));
                $stmtInsSync = $db->prepare("
                    INSERT INTO google_calendar_sync 
                    (id, tenant_id, user_id, calendar_id, channel_id, resource_id, expiration_timestamp, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo')
                ");
                $stmtInsSync->execute([
                    $syncId,
                    $tid,
                    $userId,
                    $calendarId,
                    $channelId,
                    $resourceId,
                    $expirationTimestamp
                ]);

                echo json_encode([
                    "success" => true,
                    "channelId" => $channelId,
                    "resourceId" => $resourceId,
                    "expiration" => $expirationTimestamp
                ]);
            } else {
                http_response_code($httpCode ?: 400);
                echo json_encode([
                    "error" => "Falha ao registrar Watch com o Google Calendar API.",
                    "details" => $arrWatch
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;
    } elseif ($method === 'POST' && $subAction === 'stop-watch') {
        try {
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            $userId = $input['user_id'] ?? '';

            if (empty($userId)) {
                http_response_code(400);
                echo json_encode(["error" => "user_id is required."]);
                exit;
            }

            // Busca canal ativo do profissional
            $stmtSync = $db->prepare("SELECT channel_id, resource_id FROM google_calendar_sync WHERE user_id = ? AND tenant_id = ? AND status = 'ativo' LIMIT 1");
            $stmtSync->execute([$userId, $tid]);
            $activeSync = $stmtSync->fetch();

            if ($activeSync) {
                // Busca token de acesso
                $stmtUser = $db->prepare("SELECT google_access_token FROM users WHERE id = ? AND tenant_id = ?");
                $stmtUser->execute([$userId, $tid]);
                $u = $stmtUser->fetch();
                $accessToken = $u['google_access_token'] ?? null;

                if ($accessToken && !empty($activeSync['resource_id'])) {
                    $chStop = curl_init("https://www.googleapis.com/calendar/v3/channels/stop");
                    curl_setopt($chStop, CURLOPT_POST, true);
                    curl_setopt($chStop, CURLOPT_POSTFIELDS, json_encode([
                        "id" => $activeSync['channel_id'],
                        "resourceId" => $activeSync['resource_id']
                    ]));
                    curl_setopt($chStop, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($chStop, CURLOPT_HTTPHEADER, [
                        "Authorization: Bearer {$accessToken}",
                        "Content-Type: application/json"
                    ]);
                    curl_setopt($chStop, CURLOPT_TIMEOUT, 10);
                    curl_exec($chStop);
                    curl_close($chStop);
                }

                $db->prepare("UPDATE google_calendar_sync SET status = 'inativo' WHERE user_id = ? AND tenant_id = ?")->execute([$userId, $tid]);
            }

            echo json_encode(["success" => true, "message" => "Canal de notificação do Google desativado."]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;
    }
}

// Route: google-disconnect
if ($resource === 'google-disconnect' && $method === 'POST') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $userId = $input['user_id'] ?? '';
        
        if (empty($userId)) {
            http_response_code(400);
            echo json_encode(["error" => "user_id is required."]);
            exit;
        }
        
        $stmt = $db->prepare("
            UPDATE users 
            SET google_access_token = NULL, google_refresh_token = NULL, google_token_expires = NULL
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$userId, $tid]);
        echo json_encode(["success" => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit;
}

// Route: users (Professionals)
if ($resource === 'users') {
    try {
        if ($method === 'GET') {
            if ($id) {
                $stmt = $db->prepare("SELECT id, tenant_id, email, name, role, status, avatar_url, google_refresh_token FROM users WHERE id = ? AND tenant_id = ?");
                $stmt->execute([$id, $tid]);
                $res = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($res) {
                    $res['google_connected'] = !empty($res['google_refresh_token']);
                    unset($res['google_refresh_token']);
                    echo json_encode($res);
                } else {
                    http_response_code(404);
                    echo json_encode(["error" => "User not found"]);
                }
            } else {
                $stmt = $db->prepare("SELECT id, tenant_id, email, name, role, status, avatar_url, google_refresh_token FROM users WHERE tenant_id = ? ORDER BY name ASC");
                $stmt->execute([$tid]);
                $users = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($users as &$u) {
                    $u['google_connected'] = !empty($u['google_refresh_token']);
                    unset($u['google_refresh_token']);
                }
                echo json_encode($users);
            }
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            if (empty($input['name']) || empty($input['email'])) {
                http_response_code(400);
                echo json_encode(["error" => "Name and email are required"]);
                exit();
            }
            $uid = $input['id'] ?? 'user_' . uniqid();
            $status = $input['status'] ?? 'Ativo';
            $avatarUrl = $input['avatar_url'] ?? null;
            $stmt = $db->prepare("
                INSERT INTO users (id, tenant_id, email, name, role, status, avatar_url)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $uid,
                $tid,
                $input['email'],
                $input['name'],
                $input['role'] ?? 'user',
                $status,
                $avatarUrl
            ]);
            http_response_code(201);
            echo json_encode(["success" => true, "id" => $uid]);
        } elseif ($method === 'PUT' && $id) {
            $input = json_decode(file_get_contents('php://input'), true);
            $allowed = ['name', 'role', 'email', 'avatar_url', 'status'];
            $sets = [];
            $vals = [];
            foreach ($input as $k => $v) {
                if (in_array($k, $allowed)) {
                    $sets[] = "$k = ?";
                    $vals[] = $v;
                }
            }
            if (empty($sets)) {
                http_response_code(400);
                echo json_encode(["error" => "No valid fields to update"]);
                exit();
            }
            $vals[] = $id;
            $vals[] = $tid;
            $stmt = $db->prepare("UPDATE users SET " . implode(", ", $sets) . " WHERE id = ? AND tenant_id = ?");
            $stmt->execute($vals);
            echo json_encode(["success" => true]);
        } elseif ($method === 'DELETE' && $id) {
            $stmt = $db->prepare("DELETE FROM users WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$id, $tid]);
            echo json_encode(["success" => true]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}

// Route: interactions (CRM Timeline)
if ($resource === 'interactions') {
    try {
        if ($method === 'GET') {
            $patientId = $_GET['patient_id'] ?? null;
            if (!$patientId) {
                http_response_code(400);
                echo json_encode(["error" => "patient_id query param is required"]);
                exit();
            }
            $stmt = $db->prepare("SELECT * FROM patient_interactions WHERE patient_id = ? AND tenant_id = ? ORDER BY created_at DESC");
            $stmt->execute([$patientId, $tid]);
            echo json_encode($stmt->fetchAll());
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}

// Default 404 Route
http_response_code(404);
echo json_encode(["error" => "Recurso não encontrado."]);
