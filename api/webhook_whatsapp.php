<?php
// api/webhook_whatsapp.php
// Receptor Inteligente de Mensagens WhatsApp (Evolution API / Evolution Go / n8n / Meta)
// com Agente Especialista e Mentor de Negócios MMN da Atlântica Natural (Grupo ATL)

date_default_timezone_set('America/Sao_Paulo');

require_once __DIR__ . '/config/bootstrap.php'; 

// Função de registro seguro de interações (compatível com prospect_interactions e patient_interactions)
if (!function_exists('record_interaction_safely')) {
    function record_interaction_safely($db, $tenantId, $patientId, $type, $content) {
        if (!$db) return false;
        try {
            $stmtInt1 = $db->prepare("INSERT INTO prospect_interactions (tenant_id, prospect_id, type, content) VALUES (?, ?, ?, ?)");
            $stmtInt1->execute([$tenantId, $patientId, $type, $content]);
            return true;
        } catch (Throwable $e1) {
            try {
                $stmtInt2 = $db->prepare("INSERT INTO patient_interactions (tenant_id, patient_id, type, content) VALUES (?, ?, ?, ?)");
                $stmtInt2->execute([$tenantId, $patientId, $type, $content]);
                return true;
            } catch (Throwable $e2) {
                return false;
            }
        }
    }
}

// Resposta CORS para pre-flight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(["status" => "processed"]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(["error" => "Método não permitido."]);
    exit;
}

// 1. Validação Opcional de Assinatura do Webhook
$expectedWebhookSecret = get_env_var('WEBHOOK_SECRET', null);

$allHeaders = function_exists('getallheaders') ? getallheaders() : [];
$receivedSecret = $_SERVER['HTTP_APIKEY'] 
               ?? $_SERVER['HTTP_X_WEBHOOK_SECRET'] 
               ?? $allHeaders['apikey'] 
               ?? $allHeaders['Apikey'] 
               ?? $allHeaders['X-Webhook-Secret'] 
               ?? ($_GET['secret'] ?? $_GET['apikey'] ?? '');

if (!empty($expectedWebhookSecret) && !empty($receivedSecret)) {
    $isValidSecret = hash_equals($expectedWebhookSecret, $receivedSecret);
    if (!$isValidSecret) {
        try {
            $stmtSec = $db->prepare("SELECT tenant_id FROM tenant_settings WHERE evolution_apikey = ? OR evolution_api_key = ? LIMIT 1");
            $stmtSec->execute([$receivedSecret, $receivedSecret]);
            if ($stmtSec->fetch()) {
                $isValidSecret = true;
            }
        } catch (Throwable $eSec) {}
    }
    if (!$isValidSecret) {
        http_response_code(403);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(["error" => "Forbidden: Webhook signature or apikey invalid."]);
        exit();
    }
}

function extract_jid_string($val): string {
    if (is_string($val)) {
        return trim($val);
    }
    if (is_array($val)) {
        if (!empty($val['user'])) {
            $u = preg_replace('/\D/', '', (string)$val['user']);
            $s = !empty($val['server']) ? (string)$val['server'] : 's.whatsapp.net';
            return $u ? "{$u}@{$s}" : '';
        }
        if (!empty($val['User'])) {
            $u = preg_replace('/\D/', '', (string)$val['User']);
            $s = !empty($val['Server']) ? (string)$val['Server'] : 's.whatsapp.net';
            return $u ? "{$u}@{$s}" : '';
        }
        if (!empty($val['jid'])) return trim((string)$val['jid']);
        if (!empty($val['JID'])) return trim((string)$val['JID']);
    }
    return '';
}

function clean_whatsapp_phone(string $jidOrPhone): string {
    $base = explode('@', $jidOrPhone)[0] ?? $jidOrPhone;
    $base = explode(':', $base)[0] ?? $base;
    return preg_replace('/\D/', '', $base);
}

function extract_message_text(array $input): string {
    $cands = [
        $input['data']['message']['conversation'] ?? null,
        $input['data']['message']['extendedTextMessage']['text'] ?? null,
        $input['data']['message']['extendedTextMessage']['Text'] ?? null,
        $input['data']['Message']['conversation'] ?? null,
        $input['data']['Message']['Conversation'] ?? null,
        $input['data']['Message']['extendedTextMessage']['text'] ?? null,
        $input['data']['Message']['ExtendedTextMessage']['text'] ?? null,
        $input['data']['Message']['ExtendedTextMessage']['Text'] ?? null,
        $input['data']['messageText'] ?? null,
        $input['data']['MessageText'] ?? null,
        $input['data']['Info']['Text'] ?? null,
        $input['data']['info']['text'] ?? null,
        $input['data']['text'] ?? null,
        $input['data']['Text'] ?? null,
        $input['data']['conversation'] ?? null,
        $input['data']['Conversation'] ?? null,
        $input['messageText'] ?? null,
        $input['text'] ?? null,
        $input['message'] ?? null,
        $input['data']['message']['buttonsResponseMessage']['selectedDisplayText'] ?? null,
        $input['data']['message']['templateButtonReplyMessage']['selectedDisplayText'] ?? null,
        $input['data']['message']['listResponseMessage']['title'] ?? null,
    ];
    foreach ($cands as $c) {
        if (is_string($c) && trim($c) !== '') return trim($c);
    }
    return '';
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: [];

// Identifica se é evento de mensagem enviada do próprio chip/WhatsApp (fromMe)
$isSendMsgEvent = (isset($input['event']) && in_array(strtoupper(trim((string)$input['event'])), ['SEND_MESSAGE', 'MESSAGES_UPSERT_OUTBOUND', 'MESSAGE_SENT', 'SENT_MESSAGE'], true));

$fromMeRaw = $input['data']['key']['fromMe'] 
          ?? $input['data']['Info']['isFromMe'] 
          ?? $input['data']['Info']['IsFromMe'] 
          ?? $input['data']['info']['isFromMe'] 
          ?? $input['data']['info']['IsFromMe'] 
          ?? $input['data']['isFromMe'] 
          ?? $input['fromMe'] 
          ?? false;

$fromMe = $isSendMsgEvent || ($fromMeRaw === true || $fromMeRaw === 'true' || $fromMeRaw === 1 || $fromMeRaw === '1');

$isGroup = $input['data']['Info']['IsGroup'] 
        ?? $input['data']['Info']['isGroup'] 
        ?? $input['data']['info']['isGroup'] 
        ?? $input['data']['isGroup'] 
        ?? false;

if ($isGroup === true || $isGroup === 'true' || $isGroup === 1 || $isGroup === '1') {
    http_response_code(200);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(["status" => "ignored", "reason" => "Mensagem enviada em grupo ignorada."]);
    exit;
}

// Extração resiliente dos metadados da mensagem (compatível com WhatsMeow / Evolution GO / Baileys)
$rawChat = $input['data']['key']['remoteJid'] 
        ?? $input['data']['Info']['chat'] 
        ?? $input['data']['Info']['Chat'] 
        ?? $input['data']['info']['chat'] 
        ?? $input['data']['info']['Chat'] 
        ?? $input['data']['chat'] 
        ?? $input['data']['Chat'] 
        ?? '';

$rawSender = $input['data']['Info']['sender']
          ?? $input['data']['Info']['Sender']
          ?? $input['data']['info']['sender']
          ?? $input['data']['info']['Sender']
          ?? $input['data']['sender']
          ?? $input['data']['Sender']
          ?? '';

$remoteJid = extract_jid_string($rawChat);
if (empty($remoteJid) && !$fromMe) {
    $remoteJid = extract_jid_string($rawSender);
}
if (empty($remoteJid)) {
    $remoteJid = extract_jid_string($input['phone'] ?? $input['number'] ?? $input['from'] ?? '');
}

$textReceived = extract_message_text($input);

$instanceId = $_GET['instance']
           ?? $input['instanceId'] 
           ?? $input['instance'] 
           ?? $input['data']['instance'] 
           ?? $input['data']['instanceName'] 
           ?? $input['data']['name'] 
           ?? '';

// Isolamento Estrito de Host / Subdomínio para evitar processamento duplicado
$currentHost = $_SERVER['HTTP_HOST'] ?? '';
if (!empty($instanceId)) {
    $instLower = strtolower($instanceId);
    if (strpos($currentHost, 'crmninja') !== false && !in_array($instLower, ['crmninja', 'professor', 'acessaronline'])) {
        http_response_code(200);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(["status" => "ignored", "reason" => "Instância {$instanceId} não pertence a crmninja."]);
        exit;
    }
    if (strpos($currentHost, 'crmclinica') !== false && $instLower !== 'crmclinica') {
        http_response_code(200);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(["status" => "ignored", "reason" => "Instância {$instanceId} não pertence a crmclinica."]);
        exit;
    }
    if (strpos($currentHost, 'crmatlanticanatural') !== false && !in_array($instLower, ['atlanticanatural', 'atlantica'])) {
        // Aceita instâncias da atlanticanatural neste subdomínio
    }
}

$pushName = $input['data']['Info']['PushName'] 
         ?? $input['data']['Info']['pushName'] 
         ?? $input['data']['info']['pushName'] 
         ?? $input['data']['pushName'] 
         ?? $input['pushName'] 
         ?? '';

// Retorna 200 imediatamente se a mensagem estiver vazia ou for evento de sistema sem texto
if (empty($remoteJid) || empty(trim($textReceived))) {
    http_response_code(200);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(["status" => "processed", "reason" => "Payload sem texto ou remetente."]);
    exit;
}

// Sincronização de mensagens enviadas pelo próprio número (fromMe = true)
// Ex: Líder ou atendente respondendo diretamente pelo WhatsApp no celular
if ($fromMe) {
    try {
        $phoneDigitsFromMe = clean_whatsapp_phone($remoteJid);
        $suffix8FromMe = strlen($phoneDigitsFromMe) >= 8 ? substr($phoneDigitsFromMe, -8) : $phoneDigitsFromMe;
        
        $tenantIdFromMe = get_env_var('TENANT_ID', 'atlanticanatural');
        if (!empty($instanceId)) {
            $stmtTenant = $db->prepare("SELECT tenant_id FROM tenant_settings WHERE evolution_instance = ? OR evolution_instance_name = ? OR evolution_instance LIKE ? OR evolution_instance_name LIKE ? LIMIT 1");
            $stmtTenant->execute([$instanceId, $instanceId, "%{$instanceId}%", "%{$instanceId}%"]);
            $cfg = $stmtTenant->fetch();
            if ($cfg && !empty($cfg['tenant_id'])) {
                $tenantIdFromMe = $cfg['tenant_id'];
            }
        }

        $tFamFromMe = ($tenantIdFromMe === 'crmclinica') ? ['crmclinica'] : get_tenant_family($tenantIdFromMe);
        $tInFromMe = implode(',', array_fill(0, count($tFamFromMe), '?'));

        $patientIdFromMe = null;
        $patientNameFromMe = 'Contato WhatsApp';

        // 1. Busca em patients
        $stmtPat = $db->prepare("
            SELECT id, name FROM patients 
            WHERE tenant_id IN ({$tInFromMe})
              AND (
                  REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                  OR REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
              )
            ORDER BY id DESC LIMIT 1
        ");
        $stmtPatParams = array_merge($tFamFromMe, ['%' . $phoneDigitsFromMe, '%' . $suffix8FromMe]);
        $stmtPat->execute($stmtPatParams);
        $patFromMe = $stmtPat->fetch(PDO::FETCH_ASSOC);

        if ($patFromMe && !empty($patFromMe['id'])) {
            $patientIdFromMe = $patFromMe['id'];
            if (!empty($patFromMe['name'])) $patientNameFromMe = $patFromMe['name'];
        } else {
            // 2. Busca em prospects
            try {
                $stmtPrsp = $db->prepare("
                    SELECT id, nome FROM prospects 
                    WHERE tenant_id IN ({$tInFromMe})
                      AND (
                          REPLACE(REPLACE(REPLACE(REPLACE(whatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                          OR REPLACE(REPLACE(REPLACE(REPLACE(whatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                      )
                    ORDER BY id DESC LIMIT 1
                ");
                $stmtPrsp->execute(array_merge($tFamFromMe, ['%' . $phoneDigitsFromMe, '%' . $suffix8FromMe]));
                $prspFromMe = $stmtPrsp->fetch(PDO::FETCH_ASSOC);
                if ($prspFromMe && !empty($prspFromMe['id'])) {
                    $patientIdFromMe = $prspFromMe['id'];
                    if (!empty($prspFromMe['nome'])) $patientNameFromMe = $prspFromMe['nome'];
                }
            } catch (Throwable $ePr) {}
        }

        // 3. Se ainda não existir em nenhuma tabela, auto-cadastra!
        if (!$patientIdFromMe && !empty($phoneDigitsFromMe)) {
            $patientIdFromMe = 'prsp_' . uniqid();
            try {
                $stmtNewPrsp = $db->prepare("
                    INSERT INTO prospects (id, tenant_id, nome, whatsapp, email, fase_funil, perfil_interesse, bot_status)
                    VALUES (?, ?, ?, ?, 'N/A', 'Novo Lead', 'Revendedor', 'active')
                ");
                $stmtNewPrsp->execute([$patientIdFromMe, $tenantIdFromMe, $patientNameFromMe, $phoneDigitsFromMe]);
            } catch (Throwable $eInsPr) {
                try {
                    $stmtNewPat = $db->prepare("
                        INSERT INTO patients (id, tenant_id, name, phone, email, bot_status)
                        VALUES (?, ?, ?, ?, 'N/A', 'active')
                    ");
                    $stmtNewPat->execute([$patientIdFromMe, $tenantIdFromMe, $patientNameFromMe, $phoneDigitsFromMe]);
                } catch (Throwable $eInsPt) {}
            }
        }

        $cleanContent = trim($textReceived);

        if ($patientIdFromMe && !empty($cleanContent)) {
            // Determina o nome do remetente com base na instância disparadora
            $senderLabel = 'Atendente (WhatsApp)';
            if (!empty($instanceId)) {
                if (stripos($instanceId, 'maximo') !== false) {
                    $senderLabel = 'Máximo (WhatsApp)';
                } elseif (stripos($instanceId, 'atlantica') !== false) {
                    $senderLabel = 'Atlântica (WhatsApp)';
                }
            }

            // Verifica se a mensagem já foi gravada nos últimos 15s (evita duplicar envios feitos pelo CRM ou IA)
            $time15sAgo = date('Y-m-d H:i:s', time() - 15);
            $stmtCheck = $db->prepare("
                SELECT COUNT(*) FROM messages 
                WHERE (patient_id = ? OR prospect_id = ?) 
                  AND direction = 'outbound' 
                  AND TRIM(content) = ? 
                  AND created_at >= ?
            ");
            $stmtCheck->execute([$patientIdFromMe, $patientIdFromMe, $cleanContent, $time15sAgo]);
            $alreadyExists = ((int)$stmtCheck->fetchColumn() > 0);

            if (!$alreadyExists) {
                $msgId = 'msg_' . uniqid();
                $stmtInsertOut = $db->prepare("
                    INSERT INTO messages (id, tenant_id, patient_id, prospect_id, direction, content, sender_name, created_at)
                    VALUES (?, ?, ?, ?, 'outbound', ?, ?, NOW())
                ");
                $stmtInsertOut->execute([$msgId, $tenantIdFromMe, $patientIdFromMe, $patientIdFromMe, $cleanContent, $senderLabel]);

                record_interaction_safely(
                    $db, 
                    $tenantIdFromMe, 
                    $patientIdFromMe, 
                    'whatsapp_sent', 
                    "Mensagem enviada via celular por {$senderLabel}: " . mb_substr($cleanContent, 0, 100)
                );
            }
        }
    } catch (Throwable $eFromMe) {
        // Silencioso para não interromper webhook
    }

    http_response_code(200);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(["status" => "processed", "reason" => "Mensagem enviada pelo celular sincronizada no CRM."]);
    exit;
}

// Extrai identificador único da mensagem para evitar disparos e gravações concorrentes duplicadas
$msgUniqueId = $input['data']['key']['id'] 
            ?? $input['data']['Info']['ID'] 
            ?? $input['data']['id'] 
            ?? $input['id'] 
            ?? ('msg_' . md5($remoteJid . '_' . trim($textReceived)));

// Deduplicação Atômica por Mutex / Arquivo de Lock (Impede requisições paralelas do mesmo evento no mesmo segundo)
$dedupHash = md5($remoteJid . '_' . $msgUniqueId);
$dedupLockFile = sys_get_temp_dir() . '/evo_lock_' . $dedupHash;

if (file_exists($dedupLockFile) && (time() - filemtime($dedupLockFile)) < 15) {
    http_response_code(200);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(["status" => "ignored", "reason" => "Mensagem duplicada já recebida/processada."]);
    exit;
}

$fpLock = @fopen($dedupLockFile, 'c+');
if ($fpLock) {
    if (!flock($fpLock, LOCK_EX | LOCK_NB)) {
        fclose($fpLock);
        http_response_code(200);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(["status" => "ignored", "reason" => "Mensagem concorrente idêntica já em processamento."]);
        exit;
    }
    @fwrite($fpLock, (string)time());
}

// Higieniza número de telefone (remove sufixo WhatsApp e dispositivo multi-device)
$phoneDigits = clean_whatsapp_phone($remoteJid);
$timestampActual = date('d/m/Y H:i:s');

// Gera variações com e sem o nono dígito para busca resiliente
$phoneSearch1 = $phoneDigits;
$phoneSearch2 = $phoneDigits;

if (strpos($phoneDigits, '55') === 0) {
    $ddd = substr($phoneDigits, 2, 2);
    $num = substr($phoneDigits, 4);
    if (strlen($phoneDigits) === 12) { // 8 dígitos locais
        $phoneSearch2 = '55' . $ddd . '9' . $num;
    } elseif (strlen($phoneDigits) === 13) { // 9 dígitos locais
        $phoneSearch2 = '55' . $ddd . substr($phoneDigits, 5);
    }
}

$suffix = strlen($phoneDigits) >= 8 ? substr($phoneDigits, -8) : $phoneDigits;

try {
    // 2. Identifica o Inquilino (Tenant) dono desta instância e carrega configurações
    $tenantId = $_GET['tenant_id'] ?? '';
    if (empty($tenantId) && strpos($_SERVER['HTTP_HOST'] ?? '', 'crmclinica') !== false) {
        $tenantId = 'crmclinica';
    }
    if (empty($instanceId) && !empty($receivedSecret)) {
        try {
            $stmtKeyTenant = $db->prepare("SELECT tenant_id, evolution_instance FROM tenant_settings WHERE evolution_apikey = ? OR evolution_api_key = ? LIMIT 1");
            $stmtKeyTenant->execute([$receivedSecret, $receivedSecret]);
            $rowKey = $stmtKeyTenant->fetch(PDO::FETCH_ASSOC);
            if ($rowKey) {
                if (empty($tenantId)) $tenantId = $rowKey['tenant_id'];
                $instanceId = $rowKey['evolution_instance'];
            }
        } catch (Throwable $eKt) {}
    }
    if (empty($tenantId)) {
        $tenantId = get_env_var('TENANT_ID', 'atlanticanatural');
    }

    $config = null;
    if (!empty($instanceId)) {
        if (!empty($tenantId)) {
            $stmtTenant = $db->prepare("SELECT * FROM tenant_settings WHERE tenant_id = ? AND (evolution_instance = ? OR evolution_instance_name = ? OR evolution_instance LIKE ? OR evolution_instance_name LIKE ?) LIMIT 1");
            $stmtTenant->execute([$tenantId, $instanceId, $instanceId, "%{$instanceId}%", "%{$instanceId}%"]);
            $config = $stmtTenant->fetch(PDO::FETCH_ASSOC);
        }
        if (!$config) {
            $stmtTenant = $db->prepare("SELECT * FROM tenant_settings WHERE evolution_instance = ? OR evolution_instance_name = ? OR evolution_instance LIKE ? OR evolution_instance_name LIKE ? ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END LIMIT 1");
            $stmtTenant->execute([$instanceId, $instanceId, "%{$instanceId}%", "%{$instanceId}%", $tenantId]);
            $config = $stmtTenant->fetch(PDO::FETCH_ASSOC);
            if ($config && !empty($config['tenant_id'])) {
                $tenantId = $config['tenant_id'];
            }
        }
    }
    if (!$config) {
        $stmtTenant = $db->prepare("SELECT * FROM tenant_settings WHERE tenant_id = ? LIMIT 1");
        $stmtTenant->execute([$tenantId]);
        $config = $stmtTenant->fetch(PDO::FETCH_ASSOC) ?: [];
    }

    // 3. Localiza prospect ou AUTO-CADASTRA caso seja um lead novo
    $tPatFam = get_tenant_family($tenantId);
    $tPatPlaceholders = implode(',', array_fill(0, count($tPatFam), '?'));

    $patient = null;
    try {
        $stmtProspect = $db->prepare("
            SELECT id as patient_id, nome as name, bot_status, fase_funil, perfil_interesse
            FROM prospects
            WHERE (
                REPLACE(REPLACE(REPLACE(REPLACE(whatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                OR REPLACE(REPLACE(REPLACE(REPLACE(whatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                OR REPLACE(REPLACE(REPLACE(REPLACE(whatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
            ) AND tenant_id IN ({$tPatPlaceholders})
            ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END ASC, id DESC LIMIT 1
        ");
        $patientQueryParams = array_merge(['%' . $phoneSearch1, '%' . $phoneSearch2, '%' . $suffix], $tPatFam, [$tenantId]);
        $stmtProspect->execute($patientQueryParams);
        $patient = $stmtProspect->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $thPrsp) {
        try {
            $stmtPatient = $db->prepare("
                SELECT id as patient_id, name, bot_status
                FROM patients
                WHERE (
                    REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                    OR REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                    OR REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                ) AND tenant_id IN ({$tPatPlaceholders})
                ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END ASC, id DESC LIMIT 1
            ");
            $patientQueryParams = array_merge(['%' . $phoneSearch1, '%' . $phoneSearch2, '%' . $suffix], $tPatFam, [$tenantId]);
            $stmtPatient->execute($patientQueryParams);
            $patient = $stmtPatient->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable $thPat) {}
    }

    if (!$patient) {
        $patientId = 'prsp_' . uniqid();
        $senderName = !empty($pushName) ? trim($pushName) : 'Novo Contato';
        try {
            $stmtNewProspect = $db->prepare("
                INSERT INTO prospects (id, tenant_id, nome, whatsapp, email, fase_funil, perfil_interesse, bot_status)
                VALUES (?, ?, ?, ?, 'N/A', 'Novo Lead', 'Revendedor', 'active')
            ");
            $stmtNewProspect->execute([$patientId, $tenantId, $senderName, $phoneDigits]);
        } catch (Throwable $thInsPrsp) {
            try {
                $stmtNewPatient = $db->prepare("
                    INSERT INTO patients (id, tenant_id, name, phone, email, bot_status)
                    VALUES (?, ?, ?, ?, 'N/A', 'active')
                ");
                $stmtNewPatient->execute([$patientId, $tenantId, $senderName, $phoneDigits]);
            } catch (Throwable $thInsPat) {}
        }

        $patient = [
            'patient_id' => $patientId,
            'name' => $senderName,
            'bot_status' => 'active'
        ];
    }

    $patientId = $patient['patient_id'];
    $patientName = $patient['name'] ?? 'Contato';
    $botStatus = $patient['bot_status'] ?? 'active';

    // Localiza APN / reunião ativa do contato
    $activeAppt = null;
    $activeApptId = null;
    $timeLimit1h = date('Y-m-d H:i:s', time() - 3600);
    try {
        $tApptFam = get_tenant_family($tenantId);
        $tApptPlaceholders = implode(',', array_fill(0, count($tApptFam), '?'));
        $phoneSuffix8 = substr($phoneDigits, -8);

        $stmtActive = $db->prepare("
            SELECT id, professional, appointment_time, data_consulta, treatment_command, category, status_crm, crm_status, event_id, logs
            FROM appointments
            WHERE (
                patient_id = ? 
                OR patient_id IN (SELECT id FROM patients WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ? OR REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?)
                OR patient_id IN (SELECT id FROM prospects WHERE REPLACE(REPLACE(REPLACE(REPLACE(whatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ? OR REPLACE(REPLACE(REPLACE(REPLACE(whatsapp, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?)
            )
              AND tenant_id IN ({$tApptPlaceholders})
              AND LOWER(COALESCE(crm_status, status_crm, '')) NOT IN ('cancelado', 'cancelada', 'faltou')
              AND appointment_time >= ?
            ORDER BY 
              CASE WHEN appointment_time >= (NOW() - INTERVAL '30 minutes') THEN 0 ELSE 1 END ASC,
              appointment_time ASC,
              created_at DESC
            LIMIT 1
        ");
        $stmtActive->execute(array_merge(
            [$patientId, '%' . $phoneSuffix8, '%' . $phoneDigits, '%' . $phoneSuffix8, '%' . $phoneDigits],
            $tApptFam,
            [$timeLimit1h]
        ));
        $activeAppt = $stmtActive->fetch(PDO::FETCH_ASSOC) ?: null;
        if ($activeAppt) {
            $activeApptId = $activeAppt['id'];
        }
    } catch (Throwable $thAct) {}

    $appointmentId = $activeApptId;
    $existingLogs = $activeAppt['logs'] ?? '';

    // Previne duplicidade de mensagens idênticas do mesmo telefone/paciente em intervalo curto (< 15s)
    $timeLimit15s = date('Y-m-d H:i:s', time() - 15);
    $stmtDedup = $db->prepare("
        SELECT m.id FROM messages m
        WHERE (m.patient_id = ? OR m.prospect_id = ?)
          AND m.direction = 'inbound' 
          AND m.content = ? 
          AND m.created_at >= ?
        LIMIT 1
    ");
    $stmtDedup->execute([$patientId, $patientId, $textReceived, $timeLimit15s]);
    if ($stmtDedup->fetch()) {
        http_response_code(200);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(["status" => "ignored", "reason" => "Mensagem duplicada já processada recentemente."]);
        exit;
    }

    // 4. GRAVA RESPOSTA DO CLIENTE NO CHAT OMNICHANNEL (PRIORIDADE MÁXIMA PARA APARECER NO INBOX)
    $msgId = 'msg_' . uniqid();
    $stmtMsg = $db->prepare("
        INSERT INTO messages (id, tenant_id, patient_id, prospect_id, direction, content, sender_name, created_at)
        VALUES (?, ?, ?, ?, 'inbound', ?, ?, NOW())
    ");
    $stmtMsg->execute([
        $msgId,
        $tenantId,
        $patientId,
        $patientId,
        $textReceived,
        $patientName
    ]);

    // Grava na Linha do Tempo Comercial de forma segura
    record_interaction_safely($db, $tenantId, $patientId, 'client_reply', "Lead respondeu: " . $textReceived);

    // 5. Automação de Confirmação Rápida (quando prospect responde afirmativamente de forma sucinta)
    $lowerText = mb_strtolower(trim($textReceived), 'UTF-8');
    $unwanted = [
        'á'=>'a', 'à'=>'a', 'ã'=>'a', 'â'=>'a', 'ä'=>'a',
        'é'=>'e', 'è'=>'e', 'ê'=>'e', 'ë'=>'e',
        'í'=>'i', 'ì'=>'i', 'î'=>'i', 'ï'=>'i',
        'ó'=>'o', 'ò'=>'o', 'õ'=>'o', 'ô'=>'o', 'ö'=>'o',
        'ú'=>'u', 'ù'=>'u', 'û'=>'u', 'ü'=>'u',
        'ç'=>'c'
    ];
    $normalizedText = preg_replace('/\s+/', ' ', strtr($lowerText, $unwanted));

    $newCrmStatus = null;
    $logReason = '';

    // Apenas confirma diretamente se for resposta estritamente afirmativa e direta
    if (preg_match('/^(sim|confirmo|confirmado|ok|estarei|com certeza|pode confirmar|confirmar|positivo|vou sim|estarei presente|vou|claro|perfeito)$/i', $normalizedText)) {
        $newCrmStatus = 'Confirmado';
        $logReason = "Resposta afirmativa direta do lead (\"{$textReceived}\")";
    }

    if ($newCrmStatus && !empty($activeApptId) && $newCrmStatus !== ($activeAppt['status_crm'] ?? '')) {
        $logEventText = "\n[{$timestampActual}] {$logReason}";
        $updatedLogsStr = $existingLogs . $logEventText;

        $updateAppt = $db->prepare("UPDATE appointments SET status_crm = ?, crm_status = ?, logs = ? WHERE id = ? AND tenant_id = ?");
        $updateAppt->execute([$newCrmStatus, $newCrmStatus, $updatedLogsStr, $activeApptId, $tenantId]);

        try {
            $updatePrsp = $db->prepare("UPDATE prospects SET fase_funil = ? WHERE id = ?");
            $updatePrsp->execute([$newCrmStatus, $patientId]);
        } catch (Throwable $ePr) {}

        record_interaction_safely($db, $tenantId, $patientId, 'stage_change', "{$logReason} e moveu o agendamento para a etapa: {$newCrmStatus}");
    }

    // 6. MOTOR CONVERSACIONAL DE IA (Mentor & Especialista MMN da Atlântica Natural)
    // Se o bot estiver pausado para este lead, a mensagem já está salva no Inbox para atendimento humano
    if ($botStatus === 'paused') {
        http_response_code(200);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(["status" => "processed", "bot" => "paused"]);
        exit;
    }

    $apiKey = get_env_var('GEMINI_API_KEY', '');
    $dbApiKey = '';
    try {
        $stmtKey = $db->prepare("SELECT gemini_apikey FROM tenant_settings WHERE tenant_id = ? AND gemini_apikey IS NOT NULL AND gemini_apikey != '' LIMIT 1");
        $stmtKey->execute([$tenantId]);
        $rowKey = $stmtKey->fetch();
        if ($rowKey && !empty($rowKey['gemini_apikey'])) {
            $dbApiKey = $rowKey['gemini_apikey'];
        }
    } catch (Throwable $th) {}

    if (!empty($dbApiKey)) {
        $apiKey = $dbApiKey;
    }

    if (empty($apiKey)) {
        http_response_code(200);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode(["status" => "processed", "warning" => "GEMINI_API_KEY não configurada."]);
        exit;
    }

    // Define âncoras de calendário em fuso horário oficial (America/Sao_Paulo)
    $nowSp = new DateTime('now', new DateTimeZone('America/Sao_Paulo'));
    $diasNomesSemana = [
        1 => 'Segunda-feira',
        2 => 'Terça-feira',
        3 => 'Quarta-feira',
        4 => 'Quinta-feira',
        5 => 'Sexta-feira',
        6 => 'Sábado',
        7 => 'Domingo'
    ];
    $hojeDataFmt = $nowSp->format('d/m/Y');
    $hojeDataSql = $nowSp->format('Y-m-d');
    $hojeSemanaFmt = $diasNomesSemana[(int)$nowSp->format('N')] ?? '';
    $horaAtualFmt = $nowSp->format('H:i');

    $amanhaSp = (clone $nowSp)->modify('+1 day');
    $amanhaDataFmt = $amanhaSp->format('d/m/Y');
    $amanhaDataSql = $amanhaSp->format('Y-m-d');
    $amanhaSemanaFmt = $diasNomesSemana[(int)$amanhaSp->format('N')] ?? '';

    $depoisSp = (clone $nowSp)->modify('+2 days');
    $depoisDataFmt = $depoisSp->format('d/m/Y');
    $depoisDataSql = $depoisSp->format('Y-m-d');
    $depoisSemanaFmt = $diasNomesSemana[(int)$depoisSp->format('N')] ?? '';

    // Recupera histórico recente de mensagens para manter o contexto da conversa
    $tFamHist = get_tenant_family($tenantId);
    $tInHist = implode(',', array_fill(0, count($tFamHist), '?'));
    $stmtHistory = $db->prepare("
        SELECT direction, content, created_at 
        FROM messages 
        WHERE (patient_id = ? OR prospect_id = ?) AND tenant_id IN ({$tInHist}) 
        ORDER BY created_at DESC LIMIT 6
    ");
    $stmtHistory->execute(array_merge([$patientId, $patientId], $tFamHist));
    $historyRows = array_reverse($stmtHistory->fetchAll(PDO::FETCH_ASSOC));

    $historyText = "";
    foreach ($historyRows as $h) {
        $papel = ($h['direction'] === 'inbound') ? "Lead" : "Especialista";
        $historyText .= "{$papel}: " . trim($h['content']) . "\n";
    }

    // Detalhes da APN / Reunião do prospect
    if (!empty($activeAppt['appointment_time'])) {
        $appDt = new DateTime($activeAppt['appointment_time'], new DateTimeZone('America/Sao_Paulo'));
        $diaSemanaAppt = $diasNomesSemana[(int)$appDt->format('N')] ?? '';
        $horaFormatada = $appDt->format('H:i');
        $dataFormatada = $appDt->format('d/m/Y');
        $servicoAppt = !empty($activeAppt['category']) ? $activeAppt['category'] : 'Apresentação de Negócios (APN)';
        
        $apptDetailsText = <<<APPTINFO
[STATUS DA AGENDA DO LEAD NO SISTEMA]:
- REUNIÃO OFICIAL AGENDADA E ATIVA: {$diaSemanaAppt}, {$dataFormatada} às {$horaFormatada} (Horário de Brasília)
- Assunto/Evento: {$servicoAppt}
- Mentor / Apresentador: Professor Salésio (Líder Diamante & Mentor Nacional de Expansão)
- Status Atual: {$activeAppt['status_crm']}
- REGRA ABSOLUTA: Este é o ÚNICO horário oficial ativo. NUNCA mencione horários passados cancelados.
APPTINFO;
    } else {
        // Busca se houve cancelamento recente do lead no banco para informar a IA com máxima precisão
        $lastCancelled = null;
        try {
            $phoneSuffix8 = substr($phoneDigits, -8);
            $stmtLastCancelled = $db->prepare("
                SELECT appointment_time, category, treatment_command, logs 
                FROM appointments 
                WHERE (
                    patient_id = ?
                    OR patient_id IN (SELECT id FROM patients WHERE phone LIKE ? OR phone LIKE ?)
                    OR patient_id IN (SELECT id FROM prospects WHERE whatsapp LIKE ? OR whatsapp LIKE ?)
                )
                  AND (tenant_id = ? OR tenant_id = 'atlanticanatural')
                  AND LOWER(COALESCE(crm_status, status_crm, '')) IN ('cancelado', 'cancelada', 'faltou')
                ORDER BY updated_at DESC, created_at DESC 
                LIMIT 1
            ");
            $stmtLastCancelled->execute([
                $patientId,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                $tenantId
            ]);
            $lastCancelled = $stmtLastCancelled->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable $thC) {}

        if ($lastCancelled && !empty($lastCancelled['appointment_time'])) {
            $cDt = new DateTime($lastCancelled['appointment_time'], new DateTimeZone('America/Sao_Paulo'));
            $cDiaSemana = $diasNomesSemana[(int)$cDt->format('N')] ?? '';
            $cHoraFmt = $cDt->format('H:i');
            $cDataFmt = $cDt->format('d/m/Y');
            
            $apptDetailsText = <<<APPTINFO
[STATUS DA AGENDA DO LEAD NO SISTEMA]:
- STATUS ATUAL: NENHUMA REUNIÃO ATIVA NO MOMENTO.
- REGISTRO DA AGENDA: O agendamento anterior para {$cDiaSemana}, {$cDataFmt} às {$cHoraFmt} FOI CANCELADO e EXCLUÍDO DA AGENDA!
- INSTRUÇÃO OBRIGATÓRIA: O lead NÃO tem reunião marcada agora. Se o lead perguntar sobre horário, confirmação ou se a reunião ainda vai acontecer, informe com clareza e gentileza que o horário anterior foi cancelado/removido da agenda e pergunte qual o melhor dia e horário para marcar a nova apresentação oficial com o Professor Salésio! NUNCA diga que o horário antigo ainda está de pé!
APPTINFO;
        } else {
            $apptDetailsText = <<<APPTINFO
[STATUS DA AGENDA DO LEAD NO SISTEMA]:
- STATUS ATUAL: NENHUMA REUNIÃO ATIVA NO MOMENTO. O lead ainda não possui apresentação APN agendada.
- INSTRUÇÃO OBRIGATÓRIA: Convide o lead com simpatia a agendar a APN oficial com o Professor Salésio e pergunte qual dia e horário ele prefere!
APPTINFO;
        }
    }

    // Determina se este inquilino é estritamente a Clínica ELO
    $isClinicaElo = ($tenantId === 'crmclinica' && strpos($_SERVER['HTTP_HOST'] ?? '', 'crmclinica') !== false);

    if ($isClinicaElo) {
        // Fallback de compatibilidade para CRM de Clínicas
        $slotsInfo = calculate_clinic_free_slots($db, $tenantId, 'hoje', $activeApptId);
        $livresStr = !empty($slotsInfo['horarios_livres']) ? implode(', ', $slotsInfo['horarios_livres']) : 'Consulte a recepção';
        $systemPrompt = <<<CLINICPROMPT
Você é a Secretária Profissional da clínica ELO PILATES • OSTEOPATIA • FISIOTERAPIA da Dra. Eloíza Beal.
Nome do paciente: {$patientName}.
Data Atual: {$hojeSemanaFmt}, {$hojeDataFmt} às {$horaAtualFmt}.
{$apptDetailsText}
Horários Livres: [ {$livresStr} ]
Histórico:
{$historyText}
Mensagem: "{$textReceived}"
Responda formalmente e com respeito:
CLINICPROMPT;
    } else {
        // ========================================================
        // PROMPT DO AGENTE ESPECIALISTA MMN ATLÂNTICA NATURAL (GRUPO ATL)
        // Padronizado na metodologia GO PRO (Eric Worre) e Blindado contra Alucinação de Memória
        // ========================================================
        $systemPrompt = <<<MMNPROMPT
Você é a Consultora e Secretária Executiva de Expansão da ATLÂNTICA NATURAL (equipe oficial do Professor Salésio, Líder Diamante e Mentor Nacional).
Você atende contatos diretamente no WhatsApp, dominando a postura e as habilidades profissionais do livro "Go Pro" de Eric Worre para o Marketing Multinível (MMN).

NOME DO CONTATO: {$patientName}

CALENDÁRIO OFICIAL (BASE TEMPORAL EXATA DE HOJE):
- HOJE É: {$hojeSemanaFmt}, {$hojeDataFmt} às {$horaAtualFmt} (Horário Oficial de Brasília).
- AMANHÃ É: {$amanhaSemanaFmt}, {$amanhaDataFmt}.
- DEPOIS DE AMANHÃ É: {$depoisSemanaFmt}, {$depoisDataFmt}.

{$apptDetailsText}

============================================================
REGRA DE OURO DA MEMÓRIA TEMPORAL (LEIA COM ATENÇÃO MÁXIMA):
============================================================
1. O histórico recente de mensagens abaixo pode conter citações de horários antigos de testes anteriores (ex: 18:00, 19:00, 20:00, 21:00, 22:00, etc.).
2. DESCONSIDERE TOTALMENTE quaisquer horários passados, cancelados ou reagendados presentes nas mensagens antigas deste chat! NUNCA traga esses horários passados de volta para a conversa.
3. A ÚNICA verdade oficial do sistema sobre horários é o bloco [STATUS DA AGENDA DO LEAD NO SISTEMA] acima:
   - Se o bloco indicar "NENHUMA REUNIÃO ATIVA" ou "CANCELADO", o contato NÃO tem reunião agendada no momento. Se ele perguntar sobre o horário ou a reunião (ex: "que horas é?", "confirma meu horário"), informe com simpatia e brevidade que o agendamento anterior foi cancelado/removido e pergunte qual dia e horário fica melhor para agendar a nova apresentação com o Professor Salésio! NUNCA diga que horários passados cancelados ainda estão mantidos!
   - Se o bloco indicar uma data e horário específicos com "REUNIÃO OFICIAL AGENDADA E ATIVA", esse é o ÚNICO horário válido. NUNCA mencione horários anteriores cancelados.
   - Se o lead pedir para reagendar ou sugerir novo dia/horário, o horário anterior é cancelado e você confirma exclusivamente o NOVO horário.

============================================================
POSTURA E CONHECIMENTO PROFISSIONAL MMN (GO PRO - ERIC WORRE):
============================================================
1. POSTURA CONSULTIVA: Seja segura, elegante, profissional e entusiasmada, sem afobação e sem amadorismo. Profissionais educam, esclarecem e valorizam o tempo do prospect em vez de empurrar produtos ou dar discursos prontos de vendas.
2. OS DOIS PILARES REAIS DA ATLÂNTICA NATURAL:
   - Pilar 1 - Venda Direta com 100% de Lucro Real: Produtos exclusivos com homologação total na ANVISA, altíssima demanda e recompras constantes: Óleos Ozonizados de grau terapêutico com tecnologia patenteada, Curcumina Ouro 95% biodisponível, chás funcionais, suplementos para longevidade/saúde celular e cosméticos ozonizados.
   - Pilar 2 - Alavancagem e Renda Residual: Construção de equipe e expansão de rede. O empreendedor recebe comissões recorrentes sobre a movimentação de volume da equipe, bônus de liderança e plano de carreira estruturado.
   - Microfranquia Acessível: Ativação inicial a partir de R$ 79,90, já com escritório digital, loja online e mentoria semanal direta do Professor Salésio.
3. A TÉCNICA MESTRA DO CONVITE GO PRO ("Se eu..., você...?"):
   - Quando o lead perguntar "Como funciona?", "Sobre o que é?", "Qual o produto?" ou demonstrar interesse:
     Explique os 2 pilares com substância e autoridade (2 a 3 frases bem construídas) e finalize aplicando a técnica de convite profissional do Go Pro direcionando para a APN (reunião online rápida com o Professor Salésio para conhecer os produtos e o plano financeiro na prática):
     "Se eu te passar o link exclusivo da apresentação rápida oficial com o Professor Salésio hoje às [HORA] para você ver os produtos e o plano de ganhos na prática, você consegue assistir? 📲"
4. TRATAMENTO ÉTICO DE OBJEÇÕES (GO PRO):
   - "É pirâmide?": "De maneira alguma! Pirâmides não possuem produtos e são crimes financeiros ilegais. A Atlântica Natural é uma indústria 100% brasileira de venda direta, com produtos físicos registrados na ANVISA e modelo de microfranquia regulamentado por lei. Na APN você verá toda a seriedade e transparência da nossa estrutura 🤝"
   - "Não tenho tempo": "Mais de 80% dos nossos líderes começaram em tempo parcial, dedicando apenas 1 a 2 horas por dia nos seus horários livres. Você consegue construir sua renda extra sem alterar sua rotina atual 📲"
   - "Não sei vender": "O modelo conta com treinamento passo a passo e mentoria semanal do Professor Salésio para quem está começando do absoluto zero 🤝"
   - "Precisa pagar para entrar?": "A apresentação online é 100% gratuita. Para quem decide empreender, a ativação de microfranquia inicia a partir de R$ 79,90, a menor barreira de entrada do mercado com retorno imediato 📲"

============================================================
ESTILO DE COMUNICAÇÃO NO WHATSAPP:
============================================================
- RESPOSTAS HUMANIZADAS: Entre 2 e 4 frases fluidas, bem escritas, persuasivas e agradáveis de ler no celular (proibido textões bíblicos e proibido respostas robóticas ou frias).
- RESPOSTAS A MENSAGENS CURTAS DO LEAD ("ok", "sim", "beleza", "combinado", "show"): Responda com APENAS UMA frase simpática (ex: "Show de bola, combinadíssimo! 🤝" ou "Perfeito! Nos falamos logo mais 📲").
- EMOJIS: No máximo 1 emoji bem posicionado por mensagem (ex: 📲 ou 🤝).
- NUNCA use marcadores de listas com hífens ou tópicos extensos. Escreva naturalmente como uma pessoa no WhatsApp.

============================================================
COMANDOS OCULTOS DE AÇÃO (INSIRA NO FINAL DA RESPOSTA SE HOUVER AÇÃO):
============================================================
- Se o lead CONFIRMAR presença na APN (ex: "sim", "vou sim", "confirmo", "com certeza", "estarei lá", "pode confirmar"):
  Confirme a data e o horário e adicione no final: [CMD_CONFIRMAR]
- Se o lead pedir para REMARCAR ou sugerir outro horário/data (ex: "pode ser às 20h?", "remarca para as 21:00", "amanhã às 15h"):
  Confirme o novo dia e horário com clareza e adicione no final: [CMD_AGENDAR: DATA=YYYY-MM-DD; HORA=HH:MM; SERVICO=Apresentação APN]
  (Atenção às datas: hoje={$hojeDataSql}, amanhã={$amanhaDataSql}, depois de amanhã={$depoisDataSql}).
- Se o lead pedir para CANCELAR ou afirmar que não tem nenhum interesse:
  Agradeça cordialmente com postura profissional e adicione no final: [CMD_CANCELAR]

HISTÓRICO RECENTE DA CONVERSA (LEMBRE-SE: DESCONSIDERE HORÁRIOS PASSADOS CITADOS AQUI):
{$historyText}

MENSAGEM RECEBIDA DO CONTATO: "{$textReceived}"

Sua resposta no WhatsApp:
MMNPROMPT;
    }

    $aiResponse = call_gemini_generate_content($systemPrompt, $apiKey);
    if (empty($aiResponse) && !empty($dbApiKey) && $dbApiKey !== $apiKey) {
        $aiResponse = call_gemini_generate_content($systemPrompt, $dbApiKey);
    }

    if (!empty($aiResponse)) {
        $finalText = trim($aiResponse);
        $bookedTime = null;

        // Processa comando de confirmação explícito emitido pela IA
        if (preg_match('/\[CMD_CONFIRMAR\]/i', $finalText)) {
            if (!empty($activeApptId)) {
                $stmtConf = $db->prepare("
                    UPDATE appointments 
                    SET status_crm = 'Confirmado', crm_status = 'Confirmado',
                        logs = CONCAT(COALESCE(logs, ''), '\n[{$timestampActual}] Presença confirmada pelo lead no WhatsApp.')
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtConf->execute([$activeApptId, $tenantId]);

                try {
                    $stmtUpdPrsp = $db->prepare("UPDATE prospects SET fase_funil = 'Confirmado' WHERE id = ?");
                    $stmtUpdPrsp->execute([$patientId]);
                } catch (Throwable $ePr) {}

                record_interaction_safely($db, $tenantId, $patientId, 'stage_change', "Lead confirmou presença na APN via WhatsApp. Etapa movida para: Confirmado");

                // Sincroniza com Google Calendar
                if (function_exists('sync_google_calendar_event')) {
                    $stEv = $db->prepare("SELECT event_id FROM appointments WHERE id = ?");
                    $stEv->execute([$activeApptId]);
                    $rwEv = $stEv->fetch(PDO::FETCH_ASSOC);
                    $act = (!empty($rwEv['event_id'])) ? 'update' : 'create';
                    sync_google_calendar_event($db, $activeApptId, $tenantId, $act);
                }
            }
            $finalText = trim(preg_replace('/\[CMD_CONFIRMAR\]/i', '', $finalText));
        }

        // Processa comando de cancelamento explícito emitido pela IA
        if (preg_match('/\[CMD_CANCELAR\]/i', $finalText)) {
            $phoneSuffix8 = substr($phoneDigits, -8);
            $cleanNameBase = preg_replace('/[áàãâä]/u', 'a', mb_strtolower($patientName, 'UTF-8'));
            $cleanNameBase = preg_replace('/[éèêë]/u', 'e', $cleanNameBase);
            $cleanNameBase = preg_replace('/[íìîï]/u', 'i', $cleanNameBase);
            $cleanNameBase = preg_replace('/[óòõôö]/u', 'o', $cleanNameBase);
            $cleanNameBase = preg_replace('/[úùûü]/u', 'u', $cleanNameBase);

            // Localiza e cancela TODOS os agendamentos deste contato
            $stmtAllCancel = $db->prepare("
                SELECT a.id, a.event_id 
                FROM appointments a
                LEFT JOIN patients pat ON a.patient_id = pat.id
                LEFT JOIN prospects prs ON a.patient_id = prs.id
                WHERE (a.tenant_id = ? OR a.tenant_id = 'atlanticanatural' OR a.tenant_id = 'acessaronline')
                  AND LOWER(COALESCE(a.crm_status, a.status_crm, '')) NOT IN ('cancelado', 'cancelada', 'faltou')
                  AND (
                      a.patient_id = ?
                      OR a.patient_id IN (SELECT id FROM patients WHERE phone LIKE ? OR phone LIKE ?)
                      OR a.patient_id IN (SELECT id FROM prospects WHERE whatsapp LIKE ? OR whatsapp LIKE ?)
                      OR pat.phone LIKE ? OR pat.phone LIKE ?
                      OR prs.whatsapp LIKE ? OR prs.whatsapp LIKE ?
                      OR (LOWER(COALESCE(pat.name, '')) LIKE LOWER(?) AND COALESCE(pat.name, '') <> '')
                      OR (LOWER(COALESCE(prs.nome, '')) LIKE LOWER(?) AND COALESCE(prs.nome, '') <> '')
                      OR (LOWER(COALESCE(pat.name, '')) LIKE LOWER(?) AND COALESCE(pat.name, '') <> '')
                      OR (LOWER(COALESCE(prs.nome, '')) LIKE LOWER(?) AND COALESCE(prs.nome, '') <> '')
                      OR (LOWER(a.treatment_command) LIKE LOWER(?) AND a.treatment_command IS NOT NULL AND a.treatment_command <> '')
                      OR (LOWER(a.treatment_command) LIKE LOWER(?) AND a.treatment_command IS NOT NULL AND a.treatment_command <> '')
                      OR (a.event_id IS NOT NULL AND a.event_id <> '' AND a.appointment_time >= CURRENT_DATE - INTERVAL '1 day')
                  )
            ");
            $stmtAllCancel->execute([
                $tenantId,
                $patientId,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                '%' . $patientName . '%',
                '%' . $patientName . '%',
                '%' . $cleanNameBase . '%',
                '%' . $cleanNameBase . '%',
                '%' . $patientName . '%',
                '%' . $cleanNameBase . '%'
            ]);
            $apptsToCancel = $stmtAllCancel->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if (!empty($activeApptId) && !in_array($activeApptId, array_column($apptsToCancel, 'id'))) {
                $apptsToCancel[] = ['id' => $activeApptId, 'event_id' => $activeAppt['event_id'] ?? null];
            }

            foreach ($apptsToCancel as $cAppt) {
                $cId = $cAppt['id'];
                $cEvt = $cAppt['event_id'];

                if (!empty($cEvt) && function_exists('sync_google_calendar_event')) {
                    sync_google_calendar_event($db, $cId, $tenantId, 'delete');
                }

                $stmtCancel = $db->prepare("
                    UPDATE appointments 
                    SET status_crm = 'Cancelado', crm_status = 'Cancelado',
                        logs = CONCAT(COALESCE(logs, ''), '\n[{$timestampActual}] Cancelado pelo contato no WhatsApp.')
                    WHERE id = ?
                ");
                $stmtCancel->execute([$cId]);

                try {
                    $stmtCancelSd = $db->prepare("UPDATE scheduled_dispatches SET status = 'Cancelado', status_message = 'Cancelado' WHERE appointment_id = ?");
                    $stmtCancelSd->execute([$cId]);
                } catch (Throwable $thSd) {}
            }

            try {
                $stmtCancelSdPat = $db->prepare("UPDATE scheduled_dispatches SET status = 'Cancelado', status_message = 'Cancelado' WHERE patient_id = ? OR prospect_id = ?");
                $stmtCancelSdPat->execute([$patientId, $patientId]);
            } catch (Throwable $thSdPat) {}

            try {
                $stmtUpdPrsp = $db->prepare("UPDATE prospects SET fase_funil = 'Desistente' WHERE id = ?");
                $stmtUpdPrsp->execute([$patientId]);
            } catch (Throwable $ePr) {}

            record_interaction_safely($db, $tenantId, $patientId, 'stage_change', "Contato solicitou cancelamento via WhatsApp.");
            $finalText = trim(preg_replace('/\[CMD_CANCELAR\]/i', '', $finalText));
        }

        // Processa comando de reagendamento / nova APN emitido pela IA
        if (preg_match('/\[CMD_AGENDAR:\s*DATA=([\d\-]+);\s*HORA=([\d:]+)(?:;\s*SERVICO=([^\]]+))?\]/i', $finalText, $mCmd)) {
            $bookDate = trim($mCmd[1]);
            $bookTime = trim($mCmd[2]);
            $bookService = !empty($mCmd[3]) ? trim($mCmd[3]) : 'Apresentação APN';

            if (preg_match('/^(\d{1,2}):(\d{2})/', $bookTime, $mH)) {
                $bookTime = sprintf('%02d:%02d', (int)$mH[1], (int)$mH[2]);
            }

            $targetDateTimeStr = "{$bookDate} {$bookTime}:00";
            $targetApptId = null;

            if (!empty($activeApptId)) {
                $targetApptId = $activeApptId;
                $stmtUpdAppt = $db->prepare("
                    UPDATE appointments 
                    SET appointment_time = ?, data_consulta = ?, category = ?, status_crm = 'Confirmado', crm_status = 'Confirmado',
                        logs = CONCAT(COALESCE(logs, ''), '\n[{$timestampActual}] APN remarcada para {$targetDateTimeStr} via WhatsApp.')
                    WHERE id = ? AND tenant_id = ?
                ");
                $stmtUpdAppt->execute([$targetDateTimeStr, $bookDate, $bookService, $activeApptId, $tenantId]);
            } else {
                $newApptId = 'apt_' . uniqid();
                $targetApptId = $newApptId;

                // Identifica usuário líder do tenant para associar
                $stmtProfUser = $db->prepare("SELECT id FROM users WHERE (tenant_id = ? OR tenant_id = 'atlanticanatural' OR role = 'superadmin') AND google_refresh_token IS NOT NULL AND google_refresh_token <> '' ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END LIMIT 1");
                $stmtProfUser->execute([$tenantId, $tenantId]);
                $profUserRow = $stmtProfUser->fetch(PDO::FETCH_ASSOC);
                $profUserId = $profUserRow['id'] ?? 'usr_salesio';

                $stmtNewAppt = $db->prepare("
                    INSERT INTO appointments (
                        id, tenant_id, patient_id, professional, category, price, valor_consulta,
                        appointment_time, data_consulta, message_time, treatment_command,
                        status_crm, crm_status, status_message, logs, created_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, 0.00, 0.00,
                        ?, ?, NOW(), ?,
                        'Confirmado', 'Confirmado', 'Confirmado', ?, NOW()
                    )
                ");
                $logBooking = "[{$timestampActual}] APN agendada pela Secretária Virtual no WhatsApp.";
                $stmtNewAppt->execute([
                    $newApptId,
                    $tenantId,
                    $patientId,
                    $profUserId,
                    $bookService,
                    $targetDateTimeStr,
                    $bookDate,
                    $bookService,
                    $logBooking
                ]);
            }

            try {
                $stmtUpdPrsp = $db->prepare("UPDATE prospects SET fase_funil = 'Confirmado' WHERE id = ?");
                $stmtUpdPrsp->execute([$patientId]);
            } catch (Throwable $ePr) {}

            record_interaction_safely($db, $tenantId, $patientId, 'stage_change', "APN agendada/remarcada para {$targetDateTimeStr}. Etapa: Confirmado");

            // Sincroniza o agendamento atualizado com o Google Calendar imediatamente
            if (function_exists('sync_google_calendar_event') && !empty($targetApptId)) {
                $stmtChkEvt = $db->prepare("SELECT event_id FROM appointments WHERE id = ?");
                $stmtChkEvt->execute([$targetApptId]);
                $chkEvt = $stmtChkEvt->fetch(PDO::FETCH_ASSOC);
                $actionType = (!empty($chkEvt['event_id'])) ? 'update' : 'create';
                sync_google_calendar_event($db, $targetApptId, $tenantId, $actionType);
            }

            // Obtém o event_id que ficou no agendamento ativo após a sincronização para não removê-lo
            $stmtCurrentEvt = $db->prepare("SELECT event_id FROM appointments WHERE id = ?");
            $stmtCurrentEvt->execute([$targetApptId]);
            $currentEvtId = $stmtCurrentEvt->fetchColumn();

            // Localiza e CANCELA todos os outros agendamentos anteriores deste mesmo contato e conflitos de agenda
            $phoneSuffix8 = substr($phoneDigits, -8);
            $cleanNameBase = preg_replace('/[áàãâä]/u', 'a', mb_strtolower($patientName, 'UTF-8'));
            $cleanNameBase = preg_replace('/[éèêë]/u', 'e', $cleanNameBase);
            $cleanNameBase = preg_replace('/[íìîï]/u', 'i', $cleanNameBase);
            $cleanNameBase = preg_replace('/[óòõôö]/u', 'o', $cleanNameBase);
            $cleanNameBase = preg_replace('/[úùûü]/u', 'u', $cleanNameBase);

            $stmtOldAppts = $db->prepare("
                SELECT a.id, a.event_id 
                FROM appointments a
                LEFT JOIN patients pat ON a.patient_id = pat.id
                LEFT JOIN prospects prs ON a.patient_id = prs.id
                WHERE a.id <> ?
                  AND (a.tenant_id = ? OR a.tenant_id = 'atlanticanatural' OR a.tenant_id = 'acessaronline')
                  AND LOWER(COALESCE(a.crm_status, a.status_crm, '')) NOT IN ('cancelado', 'cancelada', 'faltou')
                  AND (
                      a.patient_id = ?
                      OR a.patient_id IN (SELECT id FROM patients WHERE phone LIKE ? OR phone LIKE ?)
                      OR a.patient_id IN (SELECT id FROM prospects WHERE whatsapp LIKE ? OR whatsapp LIKE ?)
                      OR pat.phone LIKE ? OR pat.phone LIKE ?
                      OR prs.whatsapp LIKE ? OR prs.whatsapp LIKE ?
                      OR (LOWER(COALESCE(pat.name, '')) LIKE LOWER(?) AND COALESCE(pat.name, '') <> '')
                      OR (LOWER(COALESCE(prs.nome, '')) LIKE LOWER(?) AND COALESCE(prs.nome, '') <> '')
                      OR (LOWER(COALESCE(pat.name, '')) LIKE LOWER(?) AND COALESCE(pat.name, '') <> '')
                      OR (LOWER(COALESCE(prs.nome, '')) LIKE LOWER(?) AND COALESCE(prs.nome, '') <> '')
                      OR (LOWER(a.treatment_command) LIKE LOWER(?) AND a.treatment_command IS NOT NULL AND a.treatment_command <> '')
                      OR (LOWER(a.treatment_command) LIKE LOWER(?) AND a.treatment_command IS NOT NULL AND a.treatment_command <> '')
                      OR (a.event_id IS NOT NULL AND a.event_id <> '' AND a.appointment_time >= CURRENT_DATE - INTERVAL '1 day')
                  )
            ");
            $stmtOldAppts->execute([
                $targetApptId,
                $tenantId,
                $patientId,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                '%' . $phoneSuffix8,
                '%' . $phoneDigits,
                '%' . $patientName . '%',
                '%' . $patientName . '%',
                '%' . $cleanNameBase . '%',
                '%' . $cleanNameBase . '%',
                '%' . $patientName . '%',
                '%' . $cleanNameBase . '%'
            ]);
            $oldApptsToCancel = $stmtOldAppts->fetchAll(PDO::FETCH_ASSOC) ?: [];

            foreach ($oldApptsToCancel as $oldA) {
                $oldAid = $oldA['id'];
                $oldEvt = $oldA['event_id'];

                // Se tinha evento no Google Calendar e não for o mesmo evento do agendamento atual, DELETA do Google Calendar
                if (!empty($oldEvt) && $oldEvt !== $currentEvtId) {
                    if (function_exists('sync_google_calendar_event')) {
                        sync_google_calendar_event($db, $oldAid, $tenantId, 'delete');
                    }
                }

                // Atualiza o agendamento antigo para Cancelado no banco de dados
                $stmtCancelOld = $db->prepare("
                    UPDATE appointments 
                    SET status_crm = 'Cancelado', crm_status = 'Cancelado',
                        logs = CONCAT(COALESCE(logs, ''), '\n[{$timestampActual}] Cancelado automaticamente devido a remarcação para {$targetDateTimeStr}.')
                    WHERE id = ?
                ");
                $stmtCancelOld->execute([$oldAid]);

                // Cancela disparos pendentes agendados deste agendamento antigo
                try {
                    $stmtCancelSd = $db->prepare("UPDATE scheduled_dispatches SET status = 'Cancelado', status_message = 'Cancelado' WHERE appointment_id = ?");
                    $stmtCancelSd->execute([$oldAid]);
                } catch (Throwable $thSdOld) {}
            }

            // Cancela também quaisquer outros disparos pendentes do lead que não pertençam ao agendamento ativo
            try {
                $stmtCancelSdOther = $db->prepare("
                    UPDATE scheduled_dispatches 
                    SET status = 'Cancelado', status_message = 'Cancelado',
                        logs = CONCAT(COALESCE(logs, ''), '\n[{$timestampActual}] Cancelado: lead remarcou para {$targetDateTimeStr}.')
                    WHERE (patient_id = ? OR prospect_id = ?)
                      AND (status IN ('Aguardando', 'Pendente') OR status_message IN ('Aguardando', 'Pendente'))
                      AND appointment_id <> ?
                ");
                $stmtCancelSdOther->execute([$patientId, $patientId, $targetApptId]);
            } catch (Throwable $thSdOther) {}

            $finalText = trim(preg_replace('/\[CMD_AGENDAR:[^\]]+\]/i', '', $finalText));
        }

        // Envia a resposta da IA para o WhatsApp do prospect via Evolution Go na mesma instância
        $sendResult = send_evolution_whatsapp_message($db, $tenantId, $phoneDigits, $finalText, !empty($instanceId) ? $instanceId : null);

        // Registra mensagem enviada no chat omnichannel e na linha do tempo
        $outMsgId = 'msg_' . uniqid();
        $stmtOutMsg = $db->prepare("
            INSERT INTO messages (id, tenant_id, patient_id, prospect_id, direction, content, sender_name, created_at)
            VALUES (?, ?, ?, ?, 'outbound', ?, 'Secretária Virtual', NOW())
        ");
        $stmtOutMsg->execute([$outMsgId, $tenantId, $patientId, $patientId, $finalText]);

        record_interaction_safely($db, $tenantId, $patientId, 'ai_reply', "Secretária Virtual respondeu: " . $finalText);

        http_response_code(200);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode([
            "status" => "processed",
            "bot_replied" => true,
            "send_result" => $sendResult
        ]);
        exit;
    }

    http_response_code(200);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(["status" => "processed", "crm_status_updated" => $newCrmStatus]);

} catch (Exception $e) {
    http_response_code(200);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(["status" => "processed", "error" => $e->getMessage()]);
}
