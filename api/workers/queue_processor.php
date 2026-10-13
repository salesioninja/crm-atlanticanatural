<?php
// api/workers/queue_processor.php

require_once __DIR__ . '/../config/bootstrap.php'; // Carrega banco de dados, get_env_var e GEMINI_MODEL

// Define o fuso horário atual do PHP
$now = date('Y-m-d H:i:s');

// 1. Abrir bloco transacional com bloqueio FOR UPDATE para garantir exclusividade e evitar race conditions
$db->beginTransaction();
try {
    $stmt = $db->prepare("
        SELECT a.id, a.tenant_id, a.patient_id, a.professional, a.appointment_time, a.message_time, a.treatment_command, a.ai_message_preview,
               p.name AS patient_name, p.phone AS patient_phone, u.name AS user_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        LEFT JOIN users u ON a.professional = u.id AND a.tenant_id = u.tenant_id
        WHERE a.status_message = 'Aguardando' AND a.message_time <= :now
        LIMIT 10
        FOR UPDATE
    ");
    $stmt->execute([':now' => $now]);
    $queue = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($queue)) {
        $db->commit();
        echo "Nenhum lembrete pendente na fila.\n";
        exit(0);
    }

    // Atualiza imediatamente o status para 'Processando' dentro da transação para proteger a fila de forma atômica
    $updateStmt = $db->prepare("UPDATE appointments SET status_message = 'Processando' WHERE id = ? AND status_message = 'Aguardando'");
    $claimedQueue = [];
    foreach ($queue as $item) {
        $updateStmt->execute([$item['id']]);
        if ($updateStmt->rowCount() > 0) {
            $claimedQueue[] = $item;
        }
    }
    
    // Commit inicial para liberar o bloqueio de linha no banco rapidamente
    $db->commit();
    $queue = $claimedQueue;

    if (empty($queue)) {
        echo "Nenhum lembrete pendente reservado na fila.\n";
        exit(0);
    }

    echo "Registros bloqueados e definidos como 'Processando'. Iniciando processamento assíncrono...\n";

} catch (Exception $e) {
    $db->rollBack();
    fwrite(STDERR, "Erro na transação da fila: " . $e->getMessage() . "\n");
    exit(1);
}

// 2. Processar chamadas de API externas fora do bloco de transação MySQL
$geminiKey = get_env_var('GEMINI_API_KEY');
if (empty($geminiKey)) {
    fwrite(STDERR, "Erro grave: GEMINI_API_KEY está vazia ou não configurada.\n");
}

$webhookUrl = 'https://webhook.acessaronline.com.br/webhook/crm-lembretes-clinica';
$updateAppt = $db->prepare("UPDATE appointments SET status_message = ?, ai_message_preview = ? WHERE id = ?");
$updateCrm = $db->prepare("UPDATE appointments SET status_crm = ? WHERE id = ? AND tenant_id = ?");
$insertInt = $db->prepare("INSERT INTO patient_interactions (tenant_id, patient_id, type, content) VALUES (?, ?, ?, ?)");

foreach ($queue as $item) {
    echo "Processando agendamento {$item['id']} para paciente {$item['patient_name']}...\n";
    try {
        if (empty($geminiKey)) {
            throw new Exception("Chave GEMINI_API_KEY ausente nas configurações do servidor.");
        }

        // A. Compor o prompt humanizado para o Gemini
        $dtFormatada = !empty($item['appointment_time']) ? format_ptbr_datetime($item['appointment_time']) : '';
        $loc = get_clinic_location_for_appointment($item['appointment_time'], $item['treatment_command'] ?? '');
        $aiPrompt = "Você é a secretária profissional e institucional da clínica ELO PILATES • OSTEOPATIA • FISIOTERAPIA (Dra. Eloíza Beal - CREFITO nº 241442-F) atuando no WhatsApp.\n"
                  . "Redija uma mensagem formal, polida, ética, respeitosa e estritamente profissional. PROIBIDO corações de qualquer cor ou termos carinhosos/íntimos.\n"
                  . "Paciente: {$item['patient_name']}\n"
                  . "Comando Base/Objetivo: {$item['treatment_command']}\n"
                  . ($dtFormatada ? "Horário da Consulta: {$dtFormatada}\n" : "")
                  . "Unidade de Atendimento: {$loc['unidade']} ({$loc['cidade']})\n"
                  . "Localização da clínica: {$loc['endereco']} (Maps: {$loc['maps']})\n"
                  . "Profissional: " . ($item['user_name'] ?? 'Dra. Eloíza Beal') . "\n"
                  . "Siga rigorosamente a orientação do Comando Base (confirmação imediata, lembrete de 24h ou alerta de 2h antes) com formalidade e cortesia profissional.";

        // B. Chamar a API do Gemini via chamada resiliente
        $aiText = call_gemini_generate_content($aiPrompt, $geminiKey);
        
        if (empty($aiText)) {
            $aiText = generate_smart_fallback_message($item['patient_name'], $item['appointment_time'], $item['treatment_command']);
        }

        // C. Despachar payload para Evolution API ou Webhook n8n cadastrado no inquilino
        $telefoneLimpo = preg_replace('/[^0-9]/', '', $item['patient_phone']);
        if (strlen($telefoneLimpo) === 10 || strlen($telefoneLimpo) === 11) {
            if (substr($telefoneLimpo, 0, 2) !== '55') {
                $telefoneLimpo = '55' . $telefoneLimpo;
            }
        }
        
        $stmtConf = $db->prepare("SELECT * FROM tenant_settings WHERE tenant_id = ?");
        $stmtConf->execute([$item['tenant_id']]);
        $tenantConf = $stmtConf->fetch(PDO::FETCH_ASSOC) ?: [];

        $dispatchUrl = !empty($tenantConf['evolution_api_url']) ? $tenantConf['evolution_api_url'] : ($tenantConf['evolution_url'] ?? '');
        $evoInstance = !empty($tenantConf['evolution_instance_name']) ? $tenantConf['evolution_instance_name'] : ($tenantConf['evolution_instance'] ?? '');

        if (!empty($dispatchUrl) && !empty($evoInstance) && strpos($dispatchUrl, '/webhook') === false) {
            $evoRes = send_evolution_whatsapp_message($db, $item['tenant_id'], $telefoneLimpo, trim($aiText));
            $n8nHttpCode = $evoRes['http_code'] ?? ($evoRes['success'] ? 200 : 500);
            $n8nRes = is_array($evoRes['response']) ? json_encode($evoRes['response']) : ($evoRes['response'] ?? ($evoRes['error'] ?? ''));
        } else {
            $targetUrl = !empty($tenantConf['n8n_webhook_url']) ? $tenantConf['n8n_webhook_url'] : 'https://webhook.acessaronline.com.br/webhook/crm-lembretes-clinica';
            $payload = [
                "action" => "send_reminder",
                "tenant_id" => $item['tenant_id'],
                "nome" => $item['patient_name'],
                "telefone" => $telefoneLimpo,
                "horarioMensagem" => $item['message_time'],
                "horarioConsulta" => $item['appointment_time'],
                "aiMessagePreview" => trim($aiText),
                "comando" => $item['treatment_command'],
                "status" => "Aguardando",
                "id" => $item['id']
            ];
            $headers = ['Content-Type: application/json'];

            $ch = curl_init($targetUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            apply_curl_ssl_opts($ch);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            
            $n8nRes = curl_exec($ch);
            $n8nHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
        }

        if ($n8nHttpCode !== 200 && $n8nHttpCode !== 201) {
            throw new Exception("Falha ao enviar disparo HTTP {$n8nHttpCode}: " . substr($n8nRes, 0, 150));
        }

        // D. Finalizar com sucesso no banco de dados
        $updateAppt->execute(['Enviado', trim($aiText), $item['id']]);
        $updateCrm->execute(['Agendado', $item['id'], $item['tenant_id']]);

        // Grava histórico na linha do tempo
        $insertInt->execute([
            $item['tenant_id'],
            $item['patient_id'],
            'whatsapp_sent',
            "Lembrete gerado e despachado com sucesso via n8n"
        ]);

        // Grava histórico no Chat Omnichannel / Inbox de Mensagens
        try {
            $msgId = 'msg_' . uniqid();
            $stmtMsg = $db->prepare("
                INSERT INTO messages (id, tenant_id, patient_id, direction, content, sender_name, created_at)
                VALUES (?, ?, ?, 'outbound', ?, 'Secretária Virtual', NOW())
            ");
            $stmtMsg->execute([$msgId, $item['tenant_id'], $item['patient_id'], trim($aiText)]);
        } catch (Throwable $eMsg) {
            // Silencioso se houver falha pontual na gravação do chat
        }

        echo "Agendamento {$item['id']} enviado com sucesso!\n";

    } catch (Exception $e) {
        // Capturar falhas e atualizar status para 'Erro' individualmente
        $updateAppt->execute(['Erro', $item['ai_message_preview'], $item['id']]);
        
        // Grava histórico de erro na linha do tempo
        $insertInt->execute([
            $item['tenant_id'],
            $item['patient_id'],
            'system_log',
            "Erro no processamento do lembrete: " . $e->getMessage()
        ]);
        
        fwrite(STDERR, "Erro no agendamento {$item['id']}: " . $e->getMessage() . "\n");
    }
}
