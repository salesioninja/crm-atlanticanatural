<?php
// api/google_calendar_webhook.php
header("Content-Type: application/json; charset=UTF-8");
date_default_timezone_set('America/Sao_Paulo');

require_once __DIR__ . '/config/bootstrap.php'; // Carrega $db (PDO) e helpers de tenant

// 0. Auto-criar a tabela google_calendar_sync caso não exista
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
    // Tabela já existente
}

// 1. Captura Headers da Google Push Notification
$headers = getallheaders();
$channelId = null;
$resourceState = null;
$channelToken = null;

foreach ($headers as $key => $val) {
    $lowerKey = strtolower($key);
    if ($lowerKey === 'x-goog-channel-id') {
        $channelId = $val;
    } elseif ($lowerKey === 'x-goog-resource-state') {
        $resourceState = $val;
    } elseif ($lowerKey === 'x-goog-channel-token') {
        $channelToken = $val;
    }
}

// O Google envia um ping de teste ('sync') ao registrar o canal
if ($resourceState === 'sync') {
    http_response_code(200);
    echo json_encode(["status" => "channel_synced"]);
    exit;
}

if (!$channelId) {
    http_response_code(400);
    echo json_encode(["error" => "Canal do Google ausente."]);
    exit;
}

// 2. Localiza o Canal e o Tenant associado
$stmt = $db->prepare("
    SELECT g.*, u.google_access_token, u.google_refresh_token, u.google_token_expires, u.email as user_email 
    FROM google_calendar_sync g 
    INNER JOIN users u ON u.id = g.user_id AND u.tenant_id = g.tenant_id 
    WHERE g.channel_id = ? AND g.status = 'ativo' 
    LIMIT 1
");
$stmt->execute([$channelId]);
$syncContext = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$syncContext) {
    // Canal expirado ou inexistente - Responder 200 OK para liberar o Google
    http_response_code(200);
    echo json_encode(["status" => "channel_not_found_or_inactive"]);
    exit;
}

$tenantId = $syncContext['tenant_id'];

// Validação de Segurança do Channel Token contra requisições forjadas (MÉDIO #9)
$expectedToken = "tenant_" . $tenantId;
if (empty($channelToken) || !hash_equals($expectedToken, (string)$channelToken)) {
    http_response_code(403);
    echo json_encode(["error" => "Canal do Google não autorizado: token inválido."]);
    exit;
}

$userId = $syncContext['user_id'];
$accessToken = $syncContext['google_access_token'];
$refreshToken = $syncContext['google_refresh_token'];
$expiresAt = $syncContext['google_token_expires'];
$calendarId = urlencode($syncContext['calendar_id'] ?: 'primary');
$syncToken = $syncContext['sync_token'];

// Renovar Token se expirado
if (empty($accessToken) || empty($expiresAt) || (time() + 60) >= strtotime($expiresAt)) {
    if (!empty($refreshToken)) {
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
        curl_setopt($chToken, CURLOPT_TIMEOUT, 10);
        $resToken = curl_exec($chToken);
        curl_close($chToken);
        $arrToken = json_decode($resToken, true);
        if (!empty($arrToken['access_token'])) {
            $accessToken = $arrToken['access_token'];
            $newExpires = date('Y-m-d H:i:s', time() + ($arrToken['expires_in'] ?? 3600));
            $stmtUpUser = $db->prepare("UPDATE users SET google_access_token = ?, google_token_expires = ? WHERE id = ?");
            $stmtUpUser->execute([$accessToken, $newExpires, $userId]);
        }
    }
}

if (empty($accessToken)) {
    http_response_code(200);
    echo json_encode(["error" => "Google Access Token indisponível."]);
    exit;
}

// 3. Chamada ao Google Calendar API (Incremental Sync via syncToken)
$apiUrl = "https://www.googleapis.com/calendar/v3/calendars/{$calendarId}/events";
if ($syncToken) {
    $apiUrl .= "?syncToken=" . urlencode($syncToken);
} else {
    // Primeira sincronização: eventos a partir do dia anterior
    $apiUrl .= "?timeMin=" . urlencode(date('Y-m-d\TH:i:s\Z', strtotime('-1 day')));
}

$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
apply_curl_ssl_opts($ch);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer {$accessToken}",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 410) {
    // SyncToken expirado ou inválido: Limpa o token para sincronizar novamente do zero na próxima chamada
    $db->prepare("UPDATE google_calendar_sync SET sync_token = NULL WHERE channel_id = ?")->execute([$channelId]);
    http_response_code(200);
    echo json_encode(["status" => "sync_token_reset"]);
    exit;
}

if ($httpCode !== 200) {
    // Responder 200 para a Google não desativar o webhook em falhas temporárias
    http_response_code(200);
    echo json_encode(["status" => "google_api_non_200", "code" => $httpCode]);
    exit;
}

$data = json_decode($response, true) ?: [];
$events = $data['items'] ?? [];
$nextSyncToken = $data['nextSyncToken'] ?? null;

// 4. Processamento Transacional Atômico no CRM
if (!empty($events)) {
    $db->beginTransaction();
    try {
        // Tenta encontrar o agendamento por event_id ou id
        $stmtFind = $db->prepare("
            SELECT id, status_crm, crm_status, appointment_time, logs 
            FROM appointments 
            WHERE (event_id = ? OR id = ?) AND tenant_id = ? 
            LIMIT 1
        ");
        
        $stmtUpdate = $db->prepare("
            UPDATE appointments 
            SET crm_status = ?, status_crm = ?, appointment_time = ?, data_consulta = ?, logs = ? 
            WHERE id = ? AND tenant_id = ?
        ");

        $stmtInsert = $db->prepare("
            INSERT INTO appointments (
                id, tenant_id, patient_id, professional, category, price, valor_consulta,
                appointment_time, data_consulta, message_time, treatment_command, 
                ai_message_preview, status_message, status_crm, crm_status, event_id, logs
            ) VALUES (?, ?, ?, ?, ?, 0.00, 0.00, ?, ?, ?, ?, ?, ?, 'Agendado', 'Agendado', ?, ?)
        ");

        $stmtPatientFallback = $db->prepare("
            INSERT INTO patients (id, tenant_id, name, phone, email) 
            VALUES (?, ?, ?, ?, 'gcal@clinica.internal')
            ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone)
        ");

        // Garante existência da tabela scheduled_dispatches
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
        } catch (Throwable $t) {}

        foreach ($events as $event) {
            $eventId = $event['id'] ?? null;
            if (!$eventId) continue;
            
            $eventStatus = $event['status'] ?? 'confirmed'; // 'confirmed' ou 'cancelled'
            $summary = $event['summary'] ?? 'Consulta';
            $description = $event['description'] ?? '';
            
            // 4.1 Extrair telefone e nome reais da descrição ou sumário
            $rawText = ($event['description'] ?? '') . ' ' . ($event['summary'] ?? '');
            $telefone = extract_phone_from_text($rawText);
            $cleanPatName = clean_patient_name_from_summary($summary);
            $patientId = null;

            // 4.0 Tenta identificar se a descricao contem o ID do agendamento CRM
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

            // Se não encontrou telefone no texto, busca na tabela de prospects e patients por nome similar
            if (empty($telefone)) {
                try {
                    $stmtFindPrsp = $db->prepare("
                        SELECT id, nome as name, whatsapp as phone FROM prospects 
                        WHERE (LOWER(nome) = LOWER(?) OR LOWER(nome) LIKE LOWER(?) OR LOWER(?) LIKE CONCAT('%', LOWER(nome), '%'))
                          AND (tenant_id = ? OR tenant_id = 'atlanticanatural')
                          AND whatsapp IS NOT NULL AND whatsapp != '' AND whatsapp != '00000000000'
                        ORDER BY id DESC LIMIT 1
                    ");
                    $stmtFindPrsp->execute([$cleanPatName, '%' . $cleanPatName . '%', $cleanPatName, $tenantId]);
                    $matchedPrsp = $stmtFindPrsp->fetch(PDO::FETCH_ASSOC);
                    if ($matchedPrsp) {
                        $patientId = $matchedPrsp['id'];
                        $cleanPatName = $matchedPrsp['name'];
                        $telefone = preg_replace('/\D/', '', $matchedPrsp['phone']);
                    }
                } catch (Throwable $thP) {}

                if (empty($patientId)) {
                    try {
                        $stmtFindPat = $db->prepare("
                            SELECT id, name, phone FROM patients 
                            WHERE (LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?) OR LOWER(?) LIKE CONCAT('%', LOWER(name), '%'))
                              AND (tenant_id = ? OR tenant_id = 'atlanticanatural' OR tenant_id = 'clinica-elo')
                              AND phone != '00000000000' AND phone IS NOT NULL AND phone != ''
                            ORDER BY id DESC LIMIT 1
                        ");
                        $stmtFindPat->execute([$cleanPatName, '%' . $cleanPatName . '%', $cleanPatName, $tenantId]);
                        $matchedPat = $stmtFindPat->fetch(PDO::FETCH_ASSOC);
                        if ($matchedPat) {
                            $patientId = $matchedPat['id'];
                            $cleanPatName = $matchedPat['name'];
                            $telefone = preg_replace('/\D/', '', $matchedPat['phone']);
                        }
                    } catch (Throwable $thPat) {}
                }
            }

            // Se ainda não tem patient_id resolvido
            if (empty($patientId)) {
                if (!empty($telefone)) {
                    $patientId = 'pat_gcal_' . substr(md5($telefone . $tenantId), 0, 12);
                } else {
                    $patientId = 'pat_gcal_' . substr(md5(mb_strtolower($cleanPatName, 'UTF-8') . $tenantId), 0, 12);
                    $telefone = '00000000000';
                }
                $stmtPatientFallback->execute([$patientId, $tenantId, $cleanPatName, $telefone]);
            }

            $stmtFind->execute([$eventId, $eventId, $tenantId]);
            $schedule = $stmtFind->fetch(PDO::FETCH_ASSOC);

            if (!$schedule) {
                // Evento criado DIRETO na Google Agenda (celular/web)
                if ($eventStatus === 'confirmed') {
                    $newStart = $event['start']['dateTime'] ?? $event['start']['date'] ?? null;
                    if ($newStart) {
                        $tsNew = strtotime($newStart);
                        $formattedNewTime = date('Y-m-d H:i:s', $tsNew);
                        $formattedNewDate = date('Y-m-d', $tsNew);
                        $newApptId = 'apt_gcal_' . substr(md5($eventId . $tenantId . $userId), 0, 16);
                        $timeNow = date('d/m/Y H:i:s');
                        $hasValidPhone = (!empty($telefone) && $telefone !== '00000000000' && strlen($telefone) >= 10);

                        $aiMessagePreview = generate_smart_fallback_message($cleanPatName, $formattedNewTime, $summary, 'Google Calendar');
                        $statusMessage = $hasValidPhone ? 'Aguardando' : 'Processado';
                        $messageTime = date('Y-m-d H:i:s');
                        $log = "[{$timeNow}] Importado automaticamente do Google Calendar: {$summary}" . ($hasValidPhone ? " (WhatsApp agendado para {$cleanPatName})" : " (Sem telefone para WhatsApp)");

                        $stmtInsert->execute([
                            $newApptId,
                            $tenantId,
                            $patientId,
                            $userId,
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

                        // Se tem telefone válido, agenda o Triplo Disparo
                        if ($hasValidPhone) {
                            try {
                                $stmtDispGcal = $db->prepare("
                                    INSERT INTO scheduled_dispatches (id, tenant_id, appointment_id, patient_id, dispatch_type, scheduled_time, status, treatment_command, ai_message_preview)
                                    VALUES (?, ?, ?, ?, ?, ?, 'Aguardando', ?, ?)
                                ");

                                $appTs = $tsNew;
                                $time24h = date('Y-m-d H:i:s', $appTs - 86400);
                                $time2h  = date('Y-m-d H:i:s', $appTs - 7200);

                                // 1. Confirmação Imediata
                                $stmtDispGcal->execute([
                                    'disp_imm_' . uniqid(),
                                    $tenantId,
                                    $newApptId,
                                    $patientId,
                                    'immediate',
                                    $messageTime,
                                    'Confirmação imediata Google Agenda: ' . $summary,
                                    $aiMessagePreview
                                ]);

                                // 2. Lembrete 24h antes
                                if (strtotime($time24h) > time()) {
                                    $preview24h = generate_smart_fallback_message($cleanPatName, $formattedNewTime, '24h ' . $summary, 'Google Calendar');
                                    $stmtDispGcal->execute([
                                        'disp_24h_' . uniqid(),
                                        $tenantId,
                                        $newApptId,
                                        $patientId,
                                        'reminder_24h',
                                        $time24h,
                                        'Lembrete de véspera (24h antes): ' . $summary,
                                        $preview24h
                                    ]);
                                }

                                // 3. Alerta 2h antes
                                if (strtotime($time2h) > time()) {
                                    $preview2h = generate_smart_fallback_message($cleanPatName, $formattedNewTime, '2h ' . $summary, 'Google Calendar');
                                    $stmtDispGcal->execute([
                                        'disp_2h_' . uniqid(),
                                        $tenantId,
                                        $newApptId,
                                        $patientId,
                                        'reminder_2h',
                                        $time2h,
                                        'Alerta de proximidade (2h antes): ' . $summary,
                                        $preview2h
                                    ]);
                                }
                            } catch (Throwable $eDisp) {
                                // Ignora falha secundária no agendamento do triplo disparo
                            }
                        }
                    }
                }
                continue;
            }

            $currentLogs = $schedule['logs'] ?? '';
            $timeNow = date('d/m/Y H:i:s');
            $currentApptTime = $schedule['appointment_time'] ?? date('Y-m-d H:i:s');
            $currentDateOnly = date('Y-m-d', strtotime($currentApptTime));

            if ($eventStatus === 'cancelled') {
                // Evento excluído diretamente na Google Agenda do médico
                $newLog = trim("{$currentLogs}\n[{$timeNow}] Evento cancelado diretamente na Google Agenda.");
                $stmtUpdate->execute(['Cancelado', 'Cancelado', $currentApptTime, $currentDateOnly, $newLog, $schedule['id'], $tenantId]);
                try {
                    $db->prepare("UPDATE scheduled_dispatches SET status = 'Cancelado', status_message = 'Cancelado', logs = CONCAT(COALESCE(logs, ''), '\n[{$timeNow}] Cancelado: evento deletado no Google Calendar.') WHERE appointment_id = ?")->execute([$schedule['id']]);
                } catch (Throwable $thSd) {}
            } elseif ($eventStatus === 'confirmed') {
                // Evento remanejado (nova data/hora de consulta)
                $newStart = $event['start']['dateTime'] ?? $event['start']['date'] ?? null;
                if ($newStart) {
                    $tsNew = strtotime($newStart);
                    $formattedNewTime = date('Y-m-d H:i:s', $tsNew);
                    $formattedNewDate = date('Y-m-d', $tsNew);
                    
                    // Se a data mudou, atualiza preservando o status CRM!
                    if (date('Y-m-d H:i', strtotime($currentApptTime)) !== date('Y-m-d H:i', $tsNew)) {
                        $currentCrmStatus = $schedule['crm_status'] ?: ($schedule['status_crm'] ?: 'Agendado');
                        $displayTime = date('d/m/Y H:i', $tsNew);
                        $newLog = trim("{$currentLogs}\n[{$timeNow}] Horário remanejado via Google Agenda para: {$displayTime}.");
                        $stmtUpdate->execute([$currentCrmStatus, $currentCrmStatus, $formattedNewTime, $formattedNewDate, $newLog, $schedule['id'], $tenantId]);
                    }
                }
            }
        }

        // 5. Atualiza o nextSyncToken para a próxima iteração delta
        if ($nextSyncToken) {
            $db->prepare("UPDATE google_calendar_sync SET sync_token = ? WHERE channel_id = ?")
               ->execute([$nextSyncToken, $channelId]);
        }

        $db->commit();
    } catch (\Exception $e) {
        if ($db->inTransaction()) $db->rollBack();
    }
} else if ($nextSyncToken) {
    $db->prepare("UPDATE google_calendar_sync SET sync_token = ? WHERE channel_id = ?")
       ->execute([$nextSyncToken, $channelId]);
}

http_response_code(200);
echo json_encode(["success" => true]);
