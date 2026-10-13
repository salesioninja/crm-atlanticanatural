<?php
// api/cron_dispatch.php
// Motor de Disparo em Lote em Segundo Plano (via Cron Job)

date_default_timezone_set('America/Sao_Paulo');
set_time_limit(120);

require_once __DIR__ . '/config/bootstrap.php';

// 1. Autenticação e Execução Segura (CLI ou Token Bearer / Header)
if (php_sapi_name() !== 'cli') {
    // Busca exclusivamente variável de servidor (com fallback seguro padrão)
    $apiSecret = get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef');

    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $tokenQuery = $_GET['token'] ?? $_GET['cron_token'] ?? '';
    $receivedToken = '';

    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        $receivedToken = $matches[1];
    } elseif (!empty($tokenQuery)) {
        $receivedToken = $tokenQuery;
    }

    // hash_equals previne timing attacks na comparação da string
    if (empty($receivedToken) || !hash_equals($apiSecret, $receivedToken)) {
        http_response_code(401);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(["error" => "Unauthorized access. Invalid cron token."]);
        exit();
    }
}

// 1.1 Identificação e Isolamento Estrito do Inquilino Alvo (Tenant)
$targetTenant = $_GET['tenant_id'] ?? $_GET['tenant'] ?? null;
if (empty($targetTenant) && php_sapi_name() === 'cli' && !empty($argv)) {
    foreach ($argv as $arg) {
        if (preg_match('/^--?tenant[=_](.+)$/i', $arg, $m)) {
            $targetTenant = trim($m[1]);
            break;
        } elseif (preg_match('/^tenant[=_](.+)$/i', $arg, $m)) {
            $targetTenant = trim($m[1]);
            break;
        }
    }
}

// Auto-detecção inteligente pelo diretório de execução na VPS ou Hostinger
if (empty($targetTenant)) {
    $scriptDir = str_replace('\\', '/', __DIR__);
    if (strpos($scriptDir, 'atlantica') !== false) {
        $targetTenant = 'atlanticanatural';
    } elseif (strpos($scriptDir, 'crmclinica') !== false) {
        $targetTenant = 'crmclinica';
    } elseif (strpos($scriptDir, 'crmninja') !== false) {
        $targetTenant = 'crmninja';
    } else {
        $targetTenant = get_env_var('CRON_TARGET_TENANT', 'atlanticanatural');
    }
}

// 1.2 Adquire Lock distribuído (compatível com PostgreSQL e MySQL)
$lockKey = 'crm_cron_dispatch_' . md5($targetTenant ?: 'global');
$driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
$isPg = ($driver === 'pgsql');

if ($isPg) {
    // Em PostgreSQL usamos pg_try_advisory_lock
    $lockStmt = $db->prepare("SELECT pg_try_advisory_lock(abs(hashtext(?)::bigint)) as locked");
    $lockStmt->execute([$lockKey]);
    $val = $lockStmt->fetchColumn();
    $lockAcquired = ($val === true || $val === 't' || (int)$val === 1);
} else {
    $lockStmt = $db->prepare("SELECT GET_LOCK(?, 0) as locked");
    $lockStmt->execute([$lockKey]);
    $val = $lockStmt->fetchColumn();
    $lockAcquired = ((int)$val === 1);
}

if (!$lockAcquired) {
    if (php_sapi_name() !== 'cli') {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(["status" => "locked", "message" => "Outra instância do cron (" . ($targetTenant ?: 'global') . ") já está em execução no momento."]);
    } else {
        echo "Cron (" . ($targetTenant ?: 'global') . ") já em execução em outra instância (lock ativo).\n";
    }
    exit();
}

// Garante liberação do Lock ao encerrar o script
register_shutdown_function(function() use ($db, $lockKey, $isPg) {
    try {
        if ($isPg) {
            $stmtRel = $db->prepare("SELECT pg_advisory_unlock(abs(hashtext(?)::bigint))");
        } else {
            $stmtRel = $db->prepare("SELECT RELEASE_LOCK(?)");
        }
        $stmtRel->execute([$lockKey]);
    } catch (Throwable $e) {}
});

// 2. Query de Fila & Disparo
$nowStr = date('Y-m-d H:i:s');
$thirtyMinAgo = date('Y-m-d H:i:s', time() - 1800);

try {
    // Filtro condicional de Tenant para proteger isolamento
    $tenantSdFilter = "";
    $tenantApptFilter = "";
    $tenantUnlockSd = "";
    $tenantUnlockAppt = "";

    if ($targetTenant === 'atlanticanatural' || $targetTenant === 'atlantica') {
        $tenantSdFilter = " AND sd.tenant_id IN ('atlanticanatural', 'atlantica') ";
        $tenantApptFilter = " AND a.tenant_id IN ('atlanticanatural', 'atlantica') ";
        $tenantUnlockSd = " AND tenant_id IN ('atlanticanatural', 'atlantica') ";
        $tenantUnlockAppt = " AND tenant_id IN ('atlanticanatural', 'atlantica') ";
    } elseif ($targetTenant === 'crmclinica') {
        $tenantSdFilter = " AND sd.tenant_id = 'crmclinica' ";
        $tenantApptFilter = " AND a.tenant_id = 'crmclinica' ";
        $tenantUnlockSd = " AND tenant_id = 'crmclinica' ";
        $tenantUnlockAppt = " AND tenant_id = 'crmclinica' ";
    } elseif (in_array($targetTenant, ['crmninja', 'acessaronline', 'clinica-elo'])) {
        $tenantSdFilter = " AND sd.tenant_id IN ('acessaronline', 'crmninja', 'clinica-elo') ";
        $tenantApptFilter = " AND a.tenant_id IN ('acessaronline', 'crmninja', 'clinica-elo') ";
        $tenantUnlockSd = " AND tenant_id IN ('acessaronline', 'crmninja', 'clinica-elo') ";
        $tenantUnlockAppt = " AND tenant_id IN ('acessaronline', 'crmninja', 'clinica-elo') ";
    }

    // Destravar registros que porventura ficaram em 'Processando' há mais de 30 minutos desde o horário previsto (ANSI SQL portátil)
    try {
        $db->exec("UPDATE appointments SET status_message = 'Aguardando', status_envio = 'Aguardando' WHERE status_message = 'Processando' AND message_time < '{$thirtyMinAgo}' {$tenantUnlockAppt}");
        $db->exec("UPDATE scheduled_dispatches SET status = 'Aguardando' WHERE status = 'Processando' AND scheduled_time < '{$thirtyMinAgo}' {$tenantUnlockSd}");
    } catch (Exception $eUnlock) {
        // Ignora caso haja incompatibilidade pontual
    }

    // 1. Tenta buscar da fila de Triplo Disparo (scheduled_dispatches)
    $disparos = [];
    try {
        $stmtDisp = $db->prepare("
            SELECT 
                sd.id as dispatch_id,
                sd.appointment_id,
                sd.tenant_id,
                COALESCE(sd.patient_id, sd.prospect_id) as patient_id,
                sd.dispatch_type,
                sd.scheduled_time as message_time,
                sd.treatment_command,
                COALESCE(sd.ai_message_preview, sd.message_content) as ai_message_preview,
                COALESCE(sd.status_message, sd.status) as status_message,
                sd.logs,
                a.appointment_time,
                COALESCE(p.name, 'Prospect') as patient_name,
                COALESCE(p.phone, '') as patient_phone,
                'scheduled_dispatches' as source_table
            FROM scheduled_dispatches sd
            LEFT JOIN patients p ON (sd.patient_id = p.id OR sd.prospect_id = p.id)
            LEFT JOIN appointments a ON sd.appointment_id = a.id
            WHERE (sd.status IN ('Aguardando', 'Pendente') OR sd.status_message IN ('Aguardando', 'Pendente'))
              AND sd.scheduled_time <= :now
              AND (a.id IS NULL OR LOWER(COALESCE(a.crm_status, a.status_crm, '')) NOT IN ('cancelado', 'cancelada', 'faltou'))
              {$tenantSdFilter}
            ORDER BY sd.scheduled_time ASC
            LIMIT 10
        ");
        $stmtDisp->execute([':now' => $nowStr]);
        $disparos = $stmtDisp->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $eDispQuery) {
        $disparos = [];
    }

    // 2. Se scheduled_dispatches nao tiver pendentes, busca da tabela appointments
    if (empty($disparos)) {
        try {
            $stmtAppt = $db->prepare("
                SELECT 
                    a.id as dispatch_id,
                    a.id as appointment_id,
                    a.tenant_id,
                    a.patient_id,
                    'legacy' as dispatch_type,
                    a.message_time,
                    a.treatment_command,
                    a.ai_message_preview,
                    COALESCE(a.status_message, a.status_envio) as status_message,
                    a.logs,
                    a.appointment_time,
                    COALESCE(p.name, 'Prospect') as patient_name,
                    COALESCE(p.phone, '') as patient_phone,
                    'appointments' as source_table
                FROM appointments a
                LEFT JOIN patients p ON a.patient_id = p.id
                WHERE (a.status_message IN ('Aguardando', 'Pendente') OR a.status_envio IN ('Aguardando', 'Pendente'))
                  AND a.message_time <= :now
                  AND LOWER(COALESCE(a.crm_status, a.status_crm, '')) NOT IN ('cancelado', 'cancelada', 'faltou')
                  {$tenantApptFilter}
                  AND NOT EXISTS (
                      SELECT 1 FROM scheduled_dispatches sd 
                      WHERE sd.appointment_id = a.id 
                        AND (sd.status IN ('Aguardando', 'Processando', 'Enviado') OR sd.status_message IN ('Aguardando', 'Processando', 'Enviado'))
                  )
                ORDER BY a.message_time ASC
                LIMIT 10
            ");
            $stmtAppt->execute([':now' => $nowStr]);
            $disparos = $stmtAppt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $eApptQuery) {
            $disparos = [];
        }
    }

    if (empty($disparos)) {
        if (php_sapi_name() !== 'cli') {
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode(["status" => "success", "message" => "Nenhum disparo pendente no momento.", "count" => 0]);
        } else {
            echo "Nenhum disparo pendente no momento.\n";
        }
        exit();
    }

    // Travar lote de forma atômica alterando status para 'Processando'
    $updateProcessingDisp = $db->prepare("UPDATE scheduled_dispatches SET status = 'Processando', status_message = 'Processando' WHERE id = ? AND (status IN ('Aguardando', 'Pendente') OR status_message IN ('Aguardando', 'Pendente'))");
    $updateProcessingAppt = $db->prepare("UPDATE appointments SET status_message = 'Processando', status_envio = 'Processando' WHERE id = ? AND (status_message IN ('Aguardando', 'Pendente') OR status_envio IN ('Aguardando', 'Pendente'))");

    $claimedDisparos = [];
    foreach ($disparos as $reg) {
        if (($reg['source_table'] ?? '') === 'scheduled_dispatches') {
            $updateProcessingDisp->execute([$reg['dispatch_id']]);
            if ($updateProcessingDisp->rowCount() > 0) {
                $claimedDisparos[] = $reg;
            }
        } else {
            $updateProcessingAppt->execute([$reg['appointment_id']]);
            if ($updateProcessingAppt->rowCount() > 0) {
                $claimedDisparos[] = $reg;
            }
        }
    }
    $disparos = $claimedDisparos;

    if (empty($disparos)) {
        if (php_sapi_name() !== 'cli') {
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode(["status" => "success", "message" => "Nenhum disparo reservado com sucesso no momento.", "count" => 0]);
        } else {
            echo "Nenhum disparo reservado com sucesso no momento.\n";
        }
        exit();
    }

    $processedCount = 0;
    $errorCount = 0;

    $updateSuccessDisp = $db->prepare("UPDATE scheduled_dispatches SET status = 'Enviado', status_message = 'Enviado', ai_message_preview = ?, logs = ? WHERE id = ?");
    $updateErrorDisp   = $db->prepare("UPDATE scheduled_dispatches SET status = 'Erro', status_message = 'Erro', logs = ? WHERE id = ?");
    
    $updateSuccessAppt = $db->prepare("UPDATE appointments SET status_message = 'Enviado', status_envio = 'Enviado', status_crm = 'Agendado', crm_status = 'Agendado', ai_message_preview = ?, logs = ? WHERE id = ?");
    $updateErrorAppt   = $db->prepare("UPDATE appointments SET status_message = 'Erro', status_envio = 'Erro', logs = ? WHERE id = ?");

    $insertInt = $db->prepare("INSERT INTO patient_interactions (tenant_id, patient_id, type, content) VALUES (?, ?, ?, ?)");

    foreach ($disparos as $index => $registro) {
        $tenantId = $registro['tenant_id'];

        // Carregar configurações do tenant e parâmetros Anti-Ban
        $stmtConf = $db->prepare("SELECT * FROM tenant_settings WHERE tenant_id = ? LIMIT 1");
        $stmtConf->execute([$tenantId]);
        $tenantConf = $stmtConf->fetch(PDO::FETCH_ASSOC) ?: [];

        $minDelay = (int)($tenantConf['antiban_delay_min'] ?? 15);
        $maxDelay = (int)($tenantConf['antiban_delay_max'] ?? 45);
        if ($minDelay <= 0) $minDelay = 5;
        if ($maxDelay < $minDelay) $maxDelay = $minDelay + 5;
        $batchSize = (int)($tenantConf['antiban_batch_size'] ?? 20);
        $batchInterval = (int)($tenantConf['antiban_batch_interval'] ?? 5);
        $simTyping = isset($tenantConf['antiban_simulate_typing']) ? (bool)$tenantConf['antiban_simulate_typing'] : true;
        $simAudio = isset($tenantConf['antiban_simulate_audio']) ? (bool)$tenantConf['antiban_simulate_audio'] : false;

        // Intervalo pseudo-aleatório humanizado (Anti-Ban) a partir do segundo item
        if ($index > 0) {
            // Verifica se atingiu limite de lote para pausa prolongada
            if ($batchSize > 0 && ($index % $batchSize === 0)) {
                $batchSleepSec = $batchInterval * 60;
                if (php_sapi_name() === 'cli') {
                    echo "[Anti-Ban] Lote de {$batchSize} mensagens concluído. Pausa de {$batchInterval} min ({$batchSleepSec}s)...\n";
                }
                sleep($batchSleepSec);
            } else {
                $randDelay = rand($minDelay, $maxDelay);
                if (php_sapi_name() === 'cli') {
                    echo "[Anti-Ban] Aguardando {$randDelay}s antes do próximo envio humanizado...\n";
                }
                sleep($randDelay);
            }
        }
        $telefoneLimpo = preg_replace('/[^0-9]/', '', $registro['patient_phone']);
        if (strlen($telefoneLimpo) === 10 || strlen($telefoneLimpo) === 11) {
            if (substr($telefoneLimpo, 0, 2) !== '55') {
                $telefoneLimpo = '55' . $telefoneLimpo;
            }
        }
        $timestampActual = date('d/m/Y H:i:s');
        $aiText = $registro['ai_message_preview'];
        $isScheduledTable = (($registro['source_table'] ?? '') === 'scheduled_dispatches');

        // 1. Verificação de integridade: Cancela disparo se o agendamento foi cancelado ou se o lead já reagendou
        if (!empty($registro['appointment_id'])) {
            $stmtChkCancel = $db->prepare("
                SELECT crm_status, status_crm, appointment_time, patient_id 
                FROM appointments 
                WHERE id = ?
            ");
            $stmtChkCancel->execute([$registro['appointment_id']]);
            $chkRow = $stmtChkCancel->fetch(PDO::FETCH_ASSOC);
            if ($chkRow) {
                $apptStatusLower = strtolower($chkRow['crm_status'] ?? $chkRow['status_crm'] ?? '');
                if (in_array($apptStatusLower, ['cancelado', 'cancelada', 'faltou'])) {
                    if ($isScheduledTable) {
                        $db->prepare("UPDATE scheduled_dispatches SET status = 'Cancelado', status_message = 'Cancelado', logs = CONCAT(COALESCE(logs, ''), '\n[{$timestampActual}] Cancelado: agendamento foi cancelado.') WHERE id = ?")->execute([$registro['dispatch_id']]);
                    } else {
                        $db->prepare("UPDATE appointments SET status_message = 'Cancelado', status_envio = 'Cancelado', logs = CONCAT(COALESCE(logs, ''), '\n[{$timestampActual}] Cancelado: agendamento foi cancelado.') WHERE id = ?")->execute([$registro['appointment_id']]);
                    }
                    continue;
                }

                // Verifica se há um agendamento mais novo (lead remarcou)
                $stmtNewer = $db->prepare("
                    SELECT id FROM appointments 
                    WHERE patient_id = ? 
                      AND id <> ? 
                      AND LOWER(COALESCE(crm_status, status_crm, '')) NOT IN ('cancelado', 'cancelada', 'faltou')
                      AND appointment_time > ?
                    LIMIT 1
                ");
                $stmtNewer->execute([$chkRow['patient_id'], $registro['appointment_id'], $chkRow['appointment_time']]);
                if ($stmtNewer->fetch()) {
                    if ($isScheduledTable) {
                        $db->prepare("UPDATE scheduled_dispatches SET status = 'Cancelado', status_message = 'Cancelado', logs = CONCAT(COALESCE(logs, ''), '\n[{$timestampActual}] Cancelado: lead remarcou para horário mais novo.') WHERE id = ?")->execute([$registro['dispatch_id']]);
                    } else {
                        $db->prepare("UPDATE appointments SET status_message = 'Cancelado', status_envio = 'Cancelado', logs = CONCAT(COALESCE(logs, ''), '\n[{$timestampActual}] Cancelado: lead remarcou para horário mais novo.') WHERE id = ?")->execute([$registro['appointment_id']]);
                    }
                    continue;
                }
            }
        }

        // Detecta se a mensagem é um texto robótico legado antigo
        $isRoboticLegacy = (!empty($aiText) && (
            strpos($aiText, 'Agendado via Google Calendar') !== false ||
            preg_match('/Olá [^,]+, tudo bem\? [^!]+! Se precisar de algo/u', $aiText)
        ));

        // Se a prévia da mensagem de IA estiver vazia ou for texto robótico antigo, gera mensagem acolhedora
        if (empty($aiText) || $isRoboticLegacy) {
            $geminiKey = get_env_var('GEMINI_API_KEY');
            $tCmd = $registro['treatment_command'] ?? '';
            $tCmdLower = mb_strtolower($tCmd, 'UTF-8');
            $dispType = $registro['dispatch_type'] ?? '';
            
            // Detecta o tipo exato da mensagem
            if (strpos($tCmdLower, 'retorno') !== false || strpos($tCmdLower, 'convite') !== false) {
                $cronTipo = 'retorno';
            } elseif (strpos($tCmdLower, 'conscienti') !== false || strpos($tCmdLower, 'regularidade') !== false || strpos($tCmdLower, 'preven') !== false) {
                $cronTipo = 'conscientizacao';
            } elseif (strpos($tCmdLower, 'aniversar') !== false) {
                $cronTipo = 'aniversario';
            } elseif (strpos($tCmdLower, 'agradec') !== false) {
                $cronTipo = 'agradecimento';
            } elseif (!empty($registro['appointment_time']) && $dispType !== 'custom') {
                $cronTipo = 'consulta';
            } else {
                $cronTipo = 'avulso';
            }

            if (!empty($geminiKey)) {
                try {
                    $profLiderName = $registro['user_name'] ?? 'Professor Salésio - Líder Atlântica';
                    if (function_exists('build_atlantica_mmn_prompt')) {
                        $aiPrompt = build_atlantica_mmn_prompt($cronTipo, $registro['patient_name'], $dtFormatada, $tCmd, $tCmd, $profLiderName);
                    } else {
                        $aiPrompt = build_clinic_ai_prompt($cronTipo, $registro['patient_name'], $dtFormatada, $tCmd, $tCmd);
                    }
                    $aiText = call_gemini_generate_content($aiPrompt, $geminiKey);
                } catch (Exception $eEx) {
                    // ignorar exceção na chamada do Gemini
                }
            }

            if (empty($aiText)) {
                $apptTime = ($cronTipo === 'consulta') ? ($registro['appointment_time'] ?? '') : '';
                $aiText = generate_smart_fallback_message($registro['patient_name'], $apptTime, $tCmd);
            }
        }

        // Garante personalização do nome do contato e data/horário antes do envio final
        if (!empty($aiText)) {
            $leadFullName = trim($registro['patient_name'] ?? 'Prospect');
            $leadFirstName = explode(' ', $leadFullName)[0];
            $apptFmtHora = !empty($registro['appointment_time']) ? date('H:i', strtotime($registro['appointment_time'])) : '19:00';
            $apptFmtData = !empty($registro['appointment_time']) ? date('d/m/Y', strtotime($registro['appointment_time'])) : date('d/m/Y');
            $aiText = str_replace(
                ['{nome}', '{Nome}', '{NOME}', '{primeiro_nome}', '{Primeiro_Nome}', '{horario}', '{hora}', '{data}'],
                [$leadFullName, $leadFullName, $leadFullName, $leadFirstName, $leadFirstName, $apptFmtHora, $apptFmtHora, $apptFmtData],
                $aiText
            );
        }

        // Carregar credenciais do tenant de forma altamente resiliente com fallback seguro
        $stmtConf = $db->prepare("SELECT * FROM tenant_settings WHERE tenant_id = ? LIMIT 1");
        $stmtConf->execute([$tenantId]);
        $tenantConf = $stmtConf->fetch(PDO::FETCH_ASSOC) ?: [];

        $evoUrl = !empty($tenantConf['evolution_api_url']) ? $tenantConf['evolution_api_url'] : ($tenantConf['evolution_url'] ?? get_env_var('EVOLUTION_API_URL', 'https://evogo.acessaronline.com.br'));
        $rawEvoInstance = !empty($tenantConf['evolution_instance_name']) ? $tenantConf['evolution_instance_name'] : ($tenantConf['evolution_instance'] ?? get_env_var('EVOLUTION_INSTANCE_NAME', 'atlanticanatural, Teste-disparo-maximo'));

        // Parser de Rotação Multi-Chip em estilo Round-Robin com persistência entre chamadas
        $instancesList = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', (string)$rawEvoInstance))));
        if (empty($instancesList) || (count($instancesList) === 1 && $instancesList[0] === 'atlanticanatural')) {
            $instancesList = ['atlanticanatural', 'Teste-disparo-maximo'];
        }

        // Contador de rotação persistente entre execuções do cron
        $counterFile = sys_get_temp_dir() . "/evo_rotation_" . md5($tenantId) . ".txt";
        $lastIdx = file_exists($counterFile) ? (int)@file_get_contents($counterFile) : 0;
        $currentIdx = ($lastIdx + $index) % count($instancesList);
        $currentInstance = $instancesList[$currentIdx];
        @file_put_contents($counterFile, (string)(($currentIdx + 1) % count($instancesList)));

        if (empty($evoApiKey)) {
            $evoApiKey = get_env_var('GLOBAL_API_KEY', get_env_var('CRON_API_SECRET', 'd7b87fcfca7d42cfb7692298bc6d42ef'));
        }
        $n8nUrl = $tenantConf['n8n_webhook_url'] ?? 'https://webhook.acessaronline.com.br/webhook/crm-lembretes-clinica';

        if (!empty($evoUrl) && !empty($currentInstance)) {
            if (php_sapi_name() === 'cli' && count($instancesList) > 1) {
                echo "[Multi-Chip] Rotação: Enviando via instância '{$currentInstance}' (" . (($index % count($instancesList)) + 1) . "/" . count($instancesList) . ")...\n";
            }

            // Simulação de presença humana (Digitando... ou Gravando áudio...) antes do envio
            if ($simTyping || $simAudio) {
                $presenceType = $simAudio ? 'recording' : 'composing';
                send_evolution_presence($db, $tenantId, $telefoneLimpo, $presenceType, 2500, $currentInstance);
                // Pausa natural para o destinatário visualizar a digitação (1.8s a 2.6s)
                usleep(rand(1800000, 2600000));
            }

            $evoRes = send_evolution_whatsapp_message($db, $tenantId, $telefoneLimpo, $aiText, $currentInstance);
            $httpCode = $evoRes['http_code'] ?? ($evoRes['success'] ? 200 : 500);
            $curlErr = $evoRes['error'] ?? '';
            $response = is_array($evoRes['response']) ? json_encode($evoRes['response']) : ($evoRes['response'] ?? '');
        } else {
            $targetUrl = $n8nUrl;
            $payload = [
                "action" => "send_reminder",
                "tenant_id" => $tenantId,
                "nome" => $registro['patient_name'],
                "telefone" => $telefoneLimpo,
                "number" => $telefoneLimpo,
                "text" => $aiText,
                "horarioMensagem" => $registro['message_time'],
                "horarioConsulta" => $registro['appointment_time'],
                "ai_message_preview" => $aiText,
                "id" => $registro['appointment_id']
            ];
            $headers = ['Content-Type: application/json'];

            $ch = curl_init($targetUrl);
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
        }

        $existingLogs = $registro['logs'] ?? '';

        if ($httpCode === 200 || $httpCode === 201) {
            $multiTag = (count($instancesList) > 1) ? " via chip/instância [{$currentInstance}]" : "";
            $newLog = "\n[{$timestampActual}] Disparado via Cron Job ({$registro['dispatch_type']}) com sucesso{$multiTag}.";
            $updatedLogStr = $existingLogs . $newLog;

            if ($isScheduledTable) {
                $updateSuccessDisp->execute([$aiText, $updatedLogStr, $registro['dispatch_id']]);
                if (!empty($registro['appointment_id'])) {
                    $updateSuccessAppt->execute([$aiText, $updatedLogStr, $registro['appointment_id']]);
                }
            } else {
                $updateSuccessAppt->execute([$aiText, $updatedLogStr, $registro['appointment_id']]);
            }

            $insertInt->execute([
                $tenantId,
                $registro['patient_id'],
                'whatsapp_sent',
                "Disparado ({$registro['dispatch_type']}) via Cron Job com sucesso para " . $registro['patient_name']
            ]);

            // Grava histórico no Chat Omnichannel / Inbox de Mensagens
            try {
                $msgId = 'msg_' . uniqid();
                $stmtMsg = $db->prepare("
                    INSERT INTO messages (id, tenant_id, patient_id, prospect_id, direction, content, sender_name, created_at)
                    VALUES (?, ?, ?, ?, 'outbound', ?, 'Secretária Virtual', NOW())
                ");
                $stmtMsg->execute([$msgId, $tenantId, $registro['patient_id'], $registro['patient_id'], trim($aiText)]);
            } catch (Throwable $eMsg) {
                try {
                    $stmtMsg2 = $db->prepare("
                        INSERT INTO messages (id, tenant_id, patient_id, direction, content, sender_name, created_at)
                        VALUES (?, ?, ?, 'outbound', ?, 'Secretária Virtual', NOW())
                    ");
                    $stmtMsg2->execute([$msgId, $tenantId, $registro['patient_id'], trim($aiText)]);
                } catch (Throwable $eMsg2) {}
            }

            $processedCount++;
        } else {
            $rawErr = !empty($curlErr) ? $curlErr : "HTTP {$httpCode} - " . substr($response, 0, 150);
            if (strpos($response, 'not registered on WhatsApp') !== false || strpos($response, 'not registered') !== false) {
                $errMsg = "Número não cadastrado no WhatsApp (verifique se digitou dígitos a mais ou a menos: {$telefoneLimpo}).";
            } elseif ($httpCode === 401 || $httpCode === 403) {
                $errMsg = "Erro de autenticação na Evolution API (verifique a chave de API da instância).";
            } else {
                $errMsg = $rawErr;
            }
            $errorLog = "\n[{$timestampActual}] Falha no disparo Cron ({$registro['dispatch_type']}): {$errMsg}";
            $updatedLogStr = $existingLogs . $errorLog;

            if ($isScheduledTable) {
                $updateErrorDisp->execute([$updatedLogStr, $registro['dispatch_id']]);
            } else {
                $updateErrorAppt->execute([$updatedLogStr, $registro['appointment_id']]);
            }

            $insertInt->execute([
                $tenantId,
                $registro['patient_id'],
                'system_log',
                "Falha no disparo Cron ({$registro['dispatch_type']}): {$errMsg}"
            ]);

            $errorCount++;
        }
    }

    if (php_sapi_name() !== 'cli') {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            "status" => "success",
            "message" => "Lote de disparos Cron processado com sucesso.",
            "enviados" => $processedCount,
            "erros" => $errorCount
        ]);
    } else {
        echo "Processamento Cron finalizado. Enviados: {$processedCount}, Erros: {$errorCount}\n";
    }

} catch (Exception $e) {
    if (php_sapi_name() !== 'cli') {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(["error" => "Erro grave na execução do Cron: " . $e->getMessage()]);
    } else {
        echo "ERRO GRAVE Cron: " . $e->getMessage() . "\n";
    }
}
