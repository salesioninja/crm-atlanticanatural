#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CLI do CRM Clinica para Hermes Agent - Versão Blindada com Auto-Cadastro, Cancelamento e Parsing Natural
"""
import os
import sys
import re
import json
import argparse
import unicodedata
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timedelta, timezone

# Fuso horário oficial de Brasília / Clínica (UTC-3)
TZ_BR = timezone(timedelta(hours=-3))

def get_now():
    return datetime.now(TZ_BR)

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def strip_accents(s):
    if not s:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", str(s))
        if unicodedata.category(c) != "Mn"
    ).lower().strip()

def is_cancelled(a):
    if not a:
        return False
    if isinstance(a, dict):
        st1 = str(a.get("crm_status") or "").strip().lower()
        st2 = str(a.get("status_crm") or "").strip().lower()
        return st1 in ("cancelado", "cancelada", "faltou") or st2 in ("cancelado", "cancelada", "faltou")
    st = str(a).strip().lower()
    return st in ("cancelado", "cancelada", "faltou")


API_URL = os.getenv("CRM_API_URL", "https://acessaronline.com.br/crm-clinicas/api/index.php")
API_SECRET = os.getenv("CRM_API_SECRET", "d7b87fcfca7d42cfb7692298bc6d42ef")
TENANT_ID = os.getenv("CRM_TENANT_ID", "acessaronline")
DEFAULT_PROF_ID = "usr_357cbe1ddf129d8c"

def api_call(endpoint, method="GET", data=None):
    clean_endpoint = endpoint.lstrip("/")
    base = API_URL.rstrip("/")
    if base.endswith("index.php"):
        url = f"{base}/{clean_endpoint}"
    else:
        url = f"{base}/index.php/{clean_endpoint}"
    
    headers = {
        "Authorization": f"Bearer {API_SECRET}",
        "X-Tenant-ID": TENANT_ID,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Hermes-Agent-CLI/2.0"
    }
    
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            res_body = response.read().decode("utf-8")
            try:
                return json.loads(res_body)
            except Exception:
                return {"raw": res_body, "status": response.status}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return {"error": True, "code": e.code, "details": json.loads(err_body)}
        except Exception:
            return {"error": True, "code": e.code, "details": err_body}
    except Exception as e:
        return {"error": True, "message": str(e)}

def digits_only(val):
    if not val:
        return ""
    return "".join(c for c in str(val) if c.isdigit())

def parse_flexible_date(date_str):
    now = get_now()
    if not date_str:
        return now.strftime("%Y-%m-%d")
    
    d_raw = str(date_str).strip()
    d_clean = strip_accents(d_raw).lower()
    
    # Se passou DD/MM ou DD-MM adiciona o ano atual para evitar ambiguidades
    if re.match(r'^\d{1,2}[/\-]\d{1,2}$', d_clean):
        d_clean = f"{d_clean.replace('-', '/')}/{now.year}"

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            dt = datetime.strptime(d_clean, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    if "depois de amanha" in d_clean:
        return (now + timedelta(days=2)).strftime("%Y-%m-%d")
    elif "amanha" in d_clean:
        return (now + timedelta(days=1)).strftime("%Y-%m-%d")
    elif "hoje" in d_clean:
        return now.strftime("%Y-%m-%d")
    
    # Se passou apenas o dia do mês (ex: "dia 19" ou "19")
    m_day = re.search(r'\b(?:dia\s*)?(\d{1,2})\b', d_clean)
    if m_day and len(d_clean) <= 8:
        try:
            day_num = int(m_day.group(1))
            if 1 <= day_num <= 31:
                target_dt = now.replace(day=day_num)
                return target_dt.strftime("%Y-%m-%d")
        except Exception:
            pass
            
    return now.strftime("%Y-%m-%d")

def build_horario(horario_arg=None, data_arg=None, hora_arg=None):
    if horario_arg:
        h_clean = horario_arg.strip()
        if len(h_clean) == 19 and h_clean[10] in (" ", "T"):
            return h_clean.replace("T", " ")
        if len(h_clean) == 16:
            return f"{h_clean}:00"
            
    date_part = parse_flexible_date(data_arg)
    
    time_part = "10:00:00"
    if hora_arg:
        m = re.search(r'(\d{1,2})(?:\s*[:hH]\s*(\d{2})|\s*(?:horas?|hrs?|h)?)', str(hora_arg).lower().strip())
        if m:
            hh = int(m.group(1))
            mm = int(m.group(2)) if m.group(2) else 0
            time_part = f"{hh:02d}:{mm:02d}:00"
                
    return f"{date_part} {time_part}"

def cmd_dashboard(args):
    res = api_call("dashboard")
    if isinstance(res, dict) and not res.get("error"):
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return
        
    pts = api_call("patients")
    apts = api_call("appointments")
    
    total_pts = len(pts) if isinstance(pts, list) else 0
    today = datetime.now().strftime("%Y-%m-%d")
    apts_today = 0
    pending = 0
    ganho_hoje = 0.0
    
    if isinstance(apts, list):
        for a in apts:
            t = a.get("horario_consulta") or a.get("appointment_time") or ""
            if t.startswith(today):
                apts_today += 1
                try:
                    ganho_hoje += float(a.get("price") or 0.0)
                except Exception:
                    pass
            if a.get("status_message") == "Aguardando":
                pending += 1
                
    contingency = {
        "total_patients": total_pts,
        "appointments_today": apts_today,
        "pending_queue": pending,
        "financeiro": [{"name": "Geral", "ganha": ganho_hoje}],
        "status": "online"
    }
    print(json.dumps(contingency, indent=2, ensure_ascii=False))

def cmd_servicos(args=None):
    catalogo = {
        "clinica": {
            "nome": "Clínica ELO PILATES • OSTEOPATIA • FISIOTERAPIA",
            "responsavel_tecnica": "Dra. Eloíza Beal, Fisioterapeuta e Osteopata (CREFITO nº 241442-F)",
            "apresentacao": "Clínica especializada em saúde e reabilitação da coluna, alívio de dores articulares e musculares, osteopatia e pilates clínico.",
            "locais": {
                "principal": {
                    "cidade": "Salto do Lontra - PR",
                    "endereco": "Av. Bertino Warmling, 576 — Salto do Lontra - PR",
                    "ponto_referencia": "Anexo à pista de moto da Autoescola Fasolin",
                    "maps": "https://maps.app.goo.gl/6YuQMGYJZDCDShWB9",
                    "atendimento": "Segunda a Quinta (07:00 às 18:00), Sexta de manhã (07:00 às 12:00) e Sábado (07:00 às 12:00)"
                },
                "filial": {
                    "cidade": "Nova Prata do Iguaçu - PR",
                    "endereco": "R. Barão do Cerro Azul, 284-306 — Centro, Nova Prata do Iguaçu - PR",
                    "maps": "https://maps.app.goo.gl/hWizMHkqvzxqYzSVA",
                    "atendimento": "Sexta-feira à tarde (14:00 às 18:00)",
                    "observacao": "Atendimento exclusivo de Osteopatia e Fisioterapia"
                }
            },
            "servicos": [
                {
                    "nome": "Osteopatia",
                    "profissional": "Dra. Eloíza Beal",
                    "preco": "R$ 180,00",
                    "duracao": "50 minutos",
                    "indicacoes": "Dores na coluna (cervical, torácica, lombar), nervo ciático inflamado, hérnia de disco, enxaquecas tensionais, dores articulares e contraturas.",
                    "descricao": "Tratamento manual global que reequilibra as estruturas corporais e elimina a dor na raiz sem medicamentos."
                },
                {
                    "nome": "Pilates Clínico",
                    "profissional": "Equipe Especializada",
                    "preco": "Consulte planos e frequências semanais",
                    "duracao": "50 minutos",
                    "indicacoes": "Correção postural, flexibilidade, fortalecimento do core, estabilização da coluna e prevenção de recidivas de dor.",
                    "descricao": "Aulas com foco em biomecânica individualizada, fisiologia e reabilitação motora."
                },
                {
                    "nome": "Fisioterapia Especializada",
                    "profissional": "Dra. Eloíza Beal & Equipe",
                    "preco": "Avaliação personalizada",
                    "duracao": "50 minutos",
                    "indicacoes": "Reabilitação funcional, recuperação pós-cirúrgica ou pós-trauma, tendinites, bursites e lesões ligamentares.",
                    "descricao": "Protocolos modernos de cinesioterapia, eletroterapia e reabilitação motora individualizada."
                }
            ]
        },
        "agencia": {
            "nome": "Agência Ninja MKD (Prof. Salésio)",
            "apresentacao": "Estratégia e tecnologia para atrair e reter clientes através de canais digitais.",
            "servicos": [
                "Sites e Landing Pages de Alta Conversão",
                "Automações de WhatsApp com IA (Hermes Agent)",
                "Gestão de Tráfego Pago (Google Ads & Meta Ads)",
                "Outdoor Virtual Regional"
            ],
            "contato": "(46) 99976-5576"
        }
    }
    print(json.dumps(catalogo, indent=2, ensure_ascii=False))

def cmd_listar_pacientes(args):
    res = api_call("patients")
    if isinstance(res, list):
        limite = getattr(args, "limite", None)
        out = res[:limite] if limite else res
        for p in out:
            if "photos_json" in p and p["photos_json"]:
                p["photos_json"] = "[Fotos anexadas no prontuario]"
        print(json.dumps(out, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(res, indent=2, ensure_ascii=False))

def cmd_buscar_paciente(args):
    termo = getattr(args, "termo", "").strip()
    termo_clean = strip_accents(termo)
    todos = api_call("patients")
    if isinstance(todos, list):
        encontrados = []
        t_dig = digits_only(termo)
        for p in todos:
            p_name = strip_accents(p.get("name", ""))
            p_phone = digits_only(p.get("phone", ""))
            if (termo_clean and (termo_clean in p_name or p_name in termo_clean)) or (t_dig and t_dig in p_phone):
                if "photos_json" in p and p["photos_json"]:
                    p["photos_json"] = "[Fotos anexadas no prontuario]"
                encontrados.append(p)
        print(json.dumps(encontrados, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(todos, indent=2, ensure_ascii=False))

def cmd_cadastrar_paciente(args):
    payload = {
        "name": args.nome,
        "phone": args.telefone,
        "email": getattr(args, "email", None) or "N/A"
    }
    res = api_call("patients", method="POST", data=payload)
    print(json.dumps(res, indent=2, ensure_ascii=False))

def cmd_listar_agendamentos(args):
    data_arg = getattr(args, "data", None) or getattr(args, "dia", None)
    res = api_call("appointments")
    if isinstance(res, list):
        if data_arg:
            data_formatada = parse_flexible_date(data_arg)
            filtrados = []
            for a in res:
                if is_cancelled(a):
                    continue
                horario = a.get("horario_consulta") or a.get("appointment_time") or ""
                if horario.startswith(data_formatada):
                    hora_min = horario.split(" ")[1][:5] if " " in horario else horario
                    paciente_desc = a.get("patient_name") or ""
                    if (not paciente_desc or paciente_desc in ["Agendamento Google Calendar", "Paciente Agendado"]) and a.get("treatment"):
                        paciente_desc = a.get("treatment")
                    if not paciente_desc:
                        paciente_desc = "Paciente"
                    paciente_limpo = re.sub(r'^(?:Consulta:\s*)+', '', paciente_desc, flags=re.IGNORECASE).strip()
                    filtrados.append({
                        "id": a.get("id"),
                        "horario": hora_min,
                        "paciente": paciente_limpo,
                        "servico": a.get("treatment") or a.get("treatment_command") or "Osteopatia",
                        "status": a.get("crm_status") or a.get("status_crm") or "Agendado"
                    })
            filtrados.sort(key=lambda x: x["horario"])
            print(json.dumps({
                "data": data_formatada,
                "total_agendados": len(filtrados),
                "pacientes": filtrados
            }, indent=2, ensure_ascii=False))
            return

        # Lista geral limpa (sem cancelados)
        ativos = []
        for a in res:
            if is_cancelled(a):
                continue
            horario = a.get("horario_consulta") or a.get("appointment_time") or ""
            paciente_desc = a.get("patient_name") or ""
            if (not paciente_desc or paciente_desc in ["Agendamento Google Calendar", "Paciente Agendado"]) and a.get("treatment"):
                paciente_desc = a.get("treatment")
            if not paciente_desc:
                paciente_desc = "Paciente"
            paciente_limpo = re.sub(r'^(?:Consulta:\s*)+', '', paciente_desc, flags=re.IGNORECASE).strip()
            ativos.append({
                "id": a.get("id"),
                "horario": horario,
                "paciente": paciente_limpo,
                "servico": a.get("treatment") or a.get("treatment_command") or "Osteopatia",
                "status": a.get("crm_status") or a.get("status_crm") or "Agendado"
            })
        print(json.dumps(ativos[:20], indent=2, ensure_ascii=False))
    else:
        print(json.dumps(res, indent=2, ensure_ascii=False))

def cmd_verificar_horarios(args):
    data_formatada = parse_flexible_date(getattr(args, "data", None))
    now = get_now()
    try:
        dt_target = datetime.strptime(data_formatada, "%Y-%m-%d")
    except Exception:
        dt_target = now

    weekday = dt_target.weekday() # 0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex, 5=Sab, 6=Dom
    weekday_names = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]
    dia_nome = weekday_names[weekday]

    # Regras de Locais e Expediente da Dra. Eloíza Beal
    cidade = "Salto do Lontra - PR"
    local_desc = "Clínica Principal (Salto do Lontra - PR)"
    endereco = "Av. Bertino Warmling, 576 — Salto do Lontra - PR (anexo à Autoescola Fasolin)"
    maps_link = "https://maps.app.goo.gl/6YuQMGYJZDCDShWB9"
    obs_dia = ""

    # Grade base de horários (passos de 30 min para consultas de 50 min)
    if weekday in (0, 1, 2, 3):  # Segunda a Quinta (07:00 às 18:00)
        grade_base = [
            "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
            "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
            "15:00", "15:30", "16:00", "16:30", "17:00", "17:10"
        ]
        obs_dia = "Atendimento normal em Salto do Lontra das 07:00 às 18:00."
    elif weekday == 4:  # Sexta-feira (Manhã em Salto do Lontra / Tarde em Nova Prata)
        grade_base = [
            # Manhã em Salto do Lontra (07:00 às 12:00)
            "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:10",
            # Tarde em Nova Prata do Iguaçu (14:00 às 18:00)
            "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:10"
        ]
        local_desc = "Sexta: Manhã em Salto do Lontra / Tarde em Nova Prata do Iguaçu"
        endereco = "Manhã: Av. Bertino Warmling, 576 (Salto do Lontra) | Tarde: R. Barão do Cerro Azul, 284-306 — Centro (Nova Prata do Iguaçu)"
        maps_link = "Salto do Lontra: https://maps.app.goo.gl/6YuQMGYJZDCDShWB9 | Nova Prata: https://maps.app.goo.gl/hWizMHkqvzxqYzSVA"
        obs_dia = "Sexta: Manhã (07h às 12h) em Salto do Lontra; Tarde (14h às 18h) exclusivo em Nova Prata do Iguaçu (Osteopatia e Fisioterapia)."
    elif weekday == 5:  # Sábado (07:00 às 12:00 em Salto do Lontra)
        grade_base = [
            "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:10"
        ]
        obs_dia = "Atendimento de sábado em Salto do Lontra exclusivamente pela manhã (07:00 às 12:00)."
    else:  # Domingo fechado
        grade_base = []
        obs_dia = "Clínica fechada aos domingos."

    appts = api_call("appointments")
    ocupados_ranges = []
    detalhes_ocupados = []

    if isinstance(appts, list):
        for a in appts:
            if is_cancelled(a):
                continue
            horario = a.get("horario_consulta") or a.get("appointment_time") or ""
            if horario.startswith(data_formatada):
                try:
                    hora_str = horario.split(" ")[1][:5]
                    # Consulta dura 50 minutos
                    dt_inicio = datetime.strptime(f"{data_formatada} {hora_str}:00", "%Y-%m-%d %H:%M:%S")
                    dt_fim = dt_inicio + timedelta(minutes=50)
                    ocupados_ranges.append((dt_inicio, dt_fim))
                    paciente_desc = a.get("patient_name") or a.get("treatment") or a.get("treatment_command") or "Paciente"
                    detalhes_ocupados.append(f"{hora_str} ({paciente_desc})")
                except Exception:
                    pass

    now_naive = now.replace(tzinfo=None)
    is_today = (data_formatada == now.strftime("%Y-%m-%d"))
    livres = []

    for slot_str in grade_base:
        try:
            slot_inicio = datetime.strptime(f"{data_formatada} {slot_str}:00", "%Y-%m-%d %H:%M:%S")
            slot_fim = slot_inicio + timedelta(minutes=50)

            # Se for hoje, exige aviso prévio de pelo menos 30 minutos
            if is_today and slot_inicio <= (now_naive + timedelta(minutes=30)):
                continue

            # Checa colisão de intervalo com agendamentos já marcados
            colisao = False
            for oc_ini, oc_fim in ocupados_ranges:
                if not (slot_fim <= oc_ini or slot_inicio >= oc_fim):
                    colisao = True
                    break

            if not colisao:
                livres.append(slot_str)
        except Exception:
            pass

    out = {
        "data": data_formatada,
        "dia_semana": dia_nome,
        "cidade": cidade,
        "local": local_desc,
        "endereco": endereco,
        "maps": maps_link,
        "duracao_consulta": "50 minutos",
        "total_livres": len(livres),
        "horarios_livres": livres,
        "detalhes_ocupados": detalhes_ocupados,
        "observacao": obs_dia
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))

def cmd_agendar(args):
    paciente_id = getattr(args, "paciente_id", None)
    nome = getattr(args, "nome", None) or getattr(args, "paciente", None)
    telefone = getattr(args, "telefone", None) or getattr(args, "phone", None)
    
    # Se paciente_id for na verdade um telefone numérico (>= 8 dígitos)
    if paciente_id and (str(paciente_id).isdigit() or len(digits_only(str(paciente_id))) >= 8):
        if not telefone:
            telefone = str(paciente_id)
        paciente_id = None
    
    # Se faltar paciente_id, buscar na lista de pacientes
    if not paciente_id:
        todos = api_call("patients")
        if isinstance(todos, list):
            t_dig = digits_only(telefone) if telefone else ""
            n_clean = strip_accents(nome) if nome else ""
            
            # PRIORIDADE 1: Match por NOME fornecido (se tiver pelo menos 3 letras)
            if n_clean and len(n_clean) >= 3:
                for p in todos:
                    p_name_clean = strip_accents(p.get("name", ""))
                    if n_clean == p_name_clean or (len(n_clean) >= 4 and (n_clean in p_name_clean or p_name_clean in n_clean)):
                        paciente_id = p.get("id")
                        if not telefone:
                            telefone = p.get("phone")
                        break
            
            # PRIORIDADE 2: Se ainda não achou por nome, verificar por telefone
            if not paciente_id and t_dig and len(t_dig) >= 8:
                for p in todos:
                    p_dig = digits_only(p.get("phone", ""))
                    if t_dig[-8:] in p_dig or p_dig[-8:] in t_dig:
                        p_name_clean = strip_accents(p.get("name", ""))
                        # Só adota o ID se o nome for compatível ou não tiver sido passado nome específico
                        if not n_clean or n_clean in p_name_clean or p_name_clean in n_clean:
                            paciente_id = p.get("id")
                            if not nome:
                                nome = p.get("name")
                            break
                        # Se o nome fornecido for DIFERENTE do dono do telefone (ex: agendando para terceiro):
                        # Mantém paciente_id = None para criar nova ficha com o nome correto!
            
            # Se não encontrou paciente compatível e temos nome, cadastrar novo paciente
            if not paciente_id and nome:
                cad_payload = {
                    "name": nome,
                    "phone": telefone or "00000000000",
                    "email": getattr(args, "email", None) or "N/A"
                }
                cad_res = api_call("patients", method="POST", data=cad_payload)
                if isinstance(cad_res, dict):
                    paciente_id = cad_res.get("id") or cad_res.get("patient_id")
                    if not paciente_id and isinstance(cad_res.get("patient"), dict):
                        paciente_id = cad_res["patient"].get("id")

    if not paciente_id and not (nome or telefone):
        print(json.dumps({
            "error": True,
            "message": "Paciente nao encontrado. Forneca --paciente-id OU (--nome e --telefone) para auto-cadastro."
        }, indent=2, ensure_ascii=False))
        return

    procedimento = getattr(args, "procedimento", None) or getattr(args, "servico", None) or "Osteopatia"
    horario_final = build_horario(
        horario_arg=getattr(args, "horario", None),
        data_arg=getattr(args, "data", None) or getattr(args, "dia", None),
        hora_arg=getattr(args, "hora", None)
    )
    
    payload = {
        "patient_id": paciente_id,
        "patient_name": nome,
        "patient_phone": telefone,
        "user_id": getattr(args, "user_id", None) or DEFAULT_PROF_ID,
        "treatment": procedimento,
        "horario_consulta": horario_final,
        "horario_mensagem": horario_final,
        "price": float(getattr(args, "preco", None) or 180.0),
        "crm_status": getattr(args, "status_crm", None) or "Agendado",
        "status_envio": "Aguardando"
    }
    
    res = api_call("appointments", method="POST", data=payload)
    print(json.dumps(res, indent=2, ensure_ascii=False))

def cmd_cancelar(args):
    agendamento_id = getattr(args, "agendamento_id", None) or getattr(args, "id", None)
    ids_arg = getattr(args, "ids", None)
    cancelar_todas = getattr(args, "todas", False) or getattr(args, "all", False)
    
    # Suporte a múltiplos IDs separados por vírgula em --id ou --ids
    lista_ids = []
    if ids_arg:
        lista_ids = [i.strip() for i in str(ids_arg).split(",") if i.strip()]
    elif agendamento_id and "," in str(agendamento_id):
        lista_ids = [i.strip() for i in str(agendamento_id).split(",") if i.strip()]
    elif agendamento_id:
        lista_ids = [agendamento_id.strip()]

    motivo = getattr(args, "motivo", None) or "Cancelado a pedido do paciente"
    payload = {
        "crm_status": "Cancelado",
        "status_crm": "Cancelado",
        "logs": f"[Hermes Agent] {motivo}"
    }

    if lista_ids:
        cancelados = []
        for aid in lista_ids:
            api_call(f"appointments/{aid}", method="PUT", data=payload)
            cancelados.append(aid)
        print(json.dumps({
            "sucesso": True,
            "total_cancelados": len(cancelados),
            "agendamentos_cancelados": cancelados,
            "status": "Cancelado",
            "mensagem": f"{len(cancelados)} consulta(s) cancelada(s) com sucesso no CRM e removida(s) da Google Agenda."
        }, indent=2, ensure_ascii=False))
        return

    nome_input = getattr(args, "nome", None) or getattr(args, "paciente", None) or ""
    nome_clean = strip_accents(nome_input)
    
    # Detecta termos que indicam cancelamento geral/múltiplo
    termos_todas = ["duas", "todas", "ambas", "todos", "duas consultas", "todas as consultas", "as consultas", "consultas"]
    if any(t in nome_clean for t in termos_todas):
        cancelar_todas = True
        nome_clean = ""  # Limpa para não tentar casar 'duas consultas' com nome de paciente!

    tel_raw = getattr(args, "telefone", None) or getattr(args, "phone", None) or ""
    telefone = digits_only(tel_raw)
    data_arg = getattr(args, "data", None) or getattr(args, "dia", None)
    data_solicitada = parse_flexible_date(data_arg) if data_arg else None
    
    hora_arg = getattr(args, "hora", None) or getattr(args, "horario", None)
    hora_clean = ""
    if hora_arg:
        h_raw = str(hora_arg).strip().lower().replace("h", ":").replace("hrs", "").replace("hr", "")
        parts = [p for p in h_raw.split(":") if p]
        if parts:
            try:
                hora_clean = f"{int(parts[0]):02d}:"
            except Exception:
                hora_clean = parts[0]

    appts = api_call("appointments")
    if not isinstance(appts, list):
        print(json.dumps({"error": True, "message": "Falha ao obter lista de agendamentos."}, indent=2, ensure_ascii=False))
        return

    candidatos = []
    for a in appts:
        if is_cancelled(a):
            continue

        appt_time = a.get("horario_consulta") or a.get("appointment_time") or ""

        # Se data foi solicitada, filtra estritamente pela data
        if data_solicitada and not appt_time.startswith(data_solicitada):
            continue

        c_name = strip_accents(a.get("patient_name") or a.get("name") or "")
        c_treat = strip_accents(a.get("treatment") or a.get("treatment_command") or "")
        c_prev = strip_accents(a.get("ai_message_preview") or "")
        c_phone = digits_only(a.get("patient_phone") or "")

        match_nome = bool(nome_clean and (nome_clean in c_name or c_name in nome_clean or nome_clean in c_treat or c_treat in nome_clean or nome_clean in c_prev))
        match_tel = bool(telefone and (telefone in c_phone or c_phone in telefone))
        match_hora = bool(hora_clean and hora_clean in appt_time)

        score = 0
        if match_tel: score += 10
        if match_nome: score += 8
        if match_hora: score += 4
        if data_solicitada and (cancelar_todas or (not nome_clean and not telefone)): score += 2

        if match_tel or match_nome or match_hora or (data_solicitada and (cancelar_todas or (not nome_clean and not telefone))):
            candidatos.append((score, a))

    if not candidatos:
        print(json.dumps({
            "error": True,
            "message": "Nenhum agendamento ativo correspondente encontrado para cancelamento."
        }, indent=2, ensure_ascii=False))
        return

    # Se pediu para cancelar todas ou foi termo múltiplo:
    if cancelar_todas or (data_solicitada and not nome_clean and not hora_clean and len(candidatos) > 1 and not telefone):
        cancelados = []
        for _, c_appt in candidatos:
            c_id = c_appt.get("id")
            if c_id:
                api_call(f"appointments/{c_id}", method="PUT", data=payload)
                cancelados.append(c_id)
        print(json.dumps({
            "sucesso": True,
            "total_cancelados": len(cancelados),
            "agendamentos_cancelados": cancelados,
            "status": "Cancelado",
            "mensagem": f"{len(cancelados)} consulta(s) cancelada(s) com sucesso no CRM e removida(s) da Google Agenda."
        }, indent=2, ensure_ascii=False))
        return

    # Cancelamento individual
    candidatos.sort(key=lambda x: x[0], reverse=True)
    escolhido_id = candidatos[0][1].get("id")
    api_call(f"appointments/{escolhido_id}", method="PUT", data=payload)
    print(json.dumps({
        "sucesso": True,
        "agendamento_id": escolhido_id,
        "status": "Cancelado",
        "mensagem": "Consulta cancelada com sucesso no CRM e removida da Google Agenda."
    }, indent=2, ensure_ascii=False))


def cmd_alterar(args):
    agendamento_id = getattr(args, "agendamento_id", None) or getattr(args, "id", None)
    
    nova_data = getattr(args, "nova_data", None) or getattr(args, "data_nova", None) or getattr(args, "novo_dia", None)
    nova_hora = getattr(args, "nova_hora", None) or getattr(args, "hora_nova", None) or getattr(args, "novo_horario", None)
    
    data_arg = getattr(args, "data", None) or getattr(args, "dia", None)
    hora_arg = getattr(args, "hora", None) or getattr(args, "horario", None)

    if not nova_data and data_arg:
        nova_data = data_arg
    if not nova_hora and hora_arg:
        nova_hora = hora_arg

    if not agendamento_id:
        nome_input = getattr(args, "nome", None) or getattr(args, "paciente", None) or ""
        nome_clean = strip_accents(nome_input)
        tel_raw = getattr(args, "telefone", None) or getattr(args, "phone", None) or ""
        telefone = digits_only(tel_raw)
        
        data_atual_arg = getattr(args, "data_atual", None) or getattr(args, "dia_atual", None)
        data_atual = parse_flexible_date(data_atual_arg) if data_atual_arg else None
        
        hora_atual_arg = getattr(args, "hora_atual", None)
        hora_atual_clean = ""
        if hora_atual_arg:
            parts = [p for p in str(hora_atual_arg).replace("h", ":").split(":") if p]
            if parts:
                try:
                    hora_atual_clean = f"{int(parts[0]):02d}:"
                except Exception:
                    hora_atual_clean = parts[0]

        appts = api_call("appointments")
        if isinstance(appts, list):
            candidatos = []
            for a in appts:
                if is_cancelled(a):
                    continue

                appt_time = a.get("horario_consulta") or a.get("appointment_time") or ""

                if data_atual and not appt_time.startswith(data_atual):
                    continue

                c_name = strip_accents(a.get("patient_name") or a.get("name") or "")
                c_treat = strip_accents(a.get("treatment") or a.get("treatment_command") or "")
                c_prev = strip_accents(a.get("ai_message_preview") or "")
                c_phone = digits_only(a.get("patient_phone") or "")

                match_nome = bool(nome_clean and (nome_clean in c_name or c_name in nome_clean or nome_clean in c_treat or c_treat in nome_clean or nome_clean in c_prev))
                match_tel = bool(telefone and (telefone in c_phone or c_phone in telefone))
                match_hora = bool(hora_atual_clean and hora_atual_clean in appt_time)

                score = 0
                if match_tel: score += 10
                if match_nome: score += 8
                if match_hora: score += 4
                if data_atual and not nome_clean: score += 2

                if match_tel or match_nome or match_hora or (data_atual and not nome_clean):
                    candidatos.append((score, a))

            if candidatos:
                candidatos.sort(key=lambda x: x[0], reverse=True)
                agendamento_id = candidatos[0][1].get("id")

    if not agendamento_id:
        print(json.dumps({
            "error": True,
            "message": "Nao foi encontrado nenhum agendamento correspondente para alterar."
        }, indent=2, ensure_ascii=False))
        return

    horario_final = build_horario(
        horario_arg=getattr(args, "novo_horario", None),
        data_arg=nova_data,
        hora_arg=nova_hora
    )

    motivo = getattr(args, "motivo", None) or "Remanejado a pedido do paciente"
    payload = {
        "horario_consulta": horario_final,
        "appointment_time": horario_final,
        "logs": f"[Hermes Agent] {motivo} para: {horario_final}"
    }
    res = api_call(f"appointments/{agendamento_id}", method="PUT", data=payload)
    
    out = {
        "sucesso": True,
        "agendamento_id": agendamento_id,
        "novo_horario": horario_final,
        "mensagem": f"Consulta remanejada com sucesso para {horario_final} e sincronizada na Google Agenda."
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))

def cmd_atualizar_status(args):
    payload = {}
    if getattr(args, "status", None):
        payload["crm_status"] = args.status
        payload["status_crm"] = args.status
    if getattr(args, "horario", None):
        payload["horario_consulta"] = args.horario
        payload["appointment_time"] = args.horario
    if getattr(args, "motivo", None):
        payload["logs"] = f"[Hermes Agent] {args.motivo}"
        
    res = api_call(f"appointments/{args.agendamento_id}", method="PUT", data=payload)
    print(json.dumps(res, indent=2, ensure_ascii=False))

def cmd_pausar_bot(args):
    payload = {"bot_status": args.status}
    res = api_call(f"patients/{args.paciente_id}/bot-status", method="PUT", data=payload)
    print(json.dumps(res, indent=2, ensure_ascii=False))

def cmd_checar_bot(args):
    termo = getattr(args, "telefone", None) or getattr(args, "phone", None) or getattr(args, "paciente_id", None) or getattr(args, "termo", "")
    termo = str(termo).strip()
    t_dig = digits_only(termo)
    
    todos = api_call("patients")
    encontrado = None
    if isinstance(todos, list):
        for p in todos:
            p_phone = digits_only(p.get("phone", ""))
            p_id = p.get("id", "")
            if (t_dig and (t_dig in p_phone or p_phone in t_dig)) or (termo and termo == p_id):
                encontrado = p
                break
                
    if encontrado:
        status = encontrado.get("bot_status", "active") or "active"
        is_active = (status != "paused")
        out = {
            "encontrado": True,
            "paciente_id": encontrado.get("id"),
            "nome": encontrado.get("name"),
            "telefone": encontrado.get("phone"),
            "bot_status": status,
            "ativo": is_active,
            "mensagem": "IA autorizada a responder e interagir." if is_active else "IA PAUSADA no CRM. Atendimento humano em andamento. NAO envie mensagens."
        }
    else:
        out = {
            "encontrado": False,
            "paciente_id": None,
            "telefone": termo,
            "bot_status": "active",
            "ativo": True,
            "mensagem": "Paciente ainda nao cadastrado. IA autorizada para primeiro atendimento."
        }
    print(json.dumps(out, indent=2, ensure_ascii=False))

def cmd_registrar_mensagem(args):
    telefone = getattr(args, "telefone", None) or getattr(args, "phone", None)
    paciente_id = getattr(args, "paciente_id", None) or getattr(args, "id", None)
    texto = getattr(args, "texto", None) or getattr(args, "mensagem", None) or getattr(args, "content", None)
    remetente = getattr(args, "remetente", None) or getattr(args, "sender_name", None) or "IA"
    
    if not texto:
        print(json.dumps({"erro": "O parametro --texto ou --mensagem e obrigatorio."}, ensure_ascii=False))
        return
        
    payload = {
        "content": texto,
        "sender_name": remetente,
        "skip_dispatch": True
    }
    if paciente_id:
        payload["patient_id"] = paciente_id
    if telefone:
        payload["phone"] = telefone
        
    res = api_call("messages", method="POST", data=payload)
    if isinstance(res, dict) and res.get("success"):
        out = {
            "sucesso": True,
            "mensagem_id": res.get("id"),
            "paciente_id": res.get("patient_id"),
            "remetente": remetente,
            "inbox_atualizado": True,
            "mensagem": "Mensagem espelhada com sucesso no Inbox do CRM."
        }
    else:
        out = res
    print(json.dumps(out, indent=2, ensure_ascii=False))


def setup_agenda_parser(p):
    p.add_argument("--paciente-id", required=False, help="ID do paciente (opcional se informar nome e telefone)")
    p.add_argument("--nome", required=False, help="Nome do paciente para auto-cadastro")
    p.add_argument("--paciente", required=False, help="Sinonimo de nome")
    p.add_argument("--telefone", required=False, help="Telefone/WhatsApp do paciente")
    p.add_argument("--phone", required=False, help="Sinonimo de telefone")
    p.add_argument("--email", required=False, default="N/A")
    p.add_argument("--procedimento", required=False, help="Especialidade ou procedimento")
    p.add_argument("--servico", required=False, help="Sinonimo de procedimento")
    p.add_argument("--horario", required=False, help="Data e hora completa YYYY-MM-DD HH:MM:SS")
    p.add_argument("--data", required=False, help="Data da consulta (ex: amanha, hoje, ou YYYY-MM-DD)")
    p.add_argument("--dia", required=False, help="Sinonimo de data")
    p.add_argument("--hora", required=False, help="Hora da consulta (ex: 10:00)")
    p.add_argument("--preco", default="180.00")
    p.add_argument("--user-id", default=DEFAULT_PROF_ID)
    p.add_argument("--status-crm", default="Agendado")

def setup_cancel_parser(p):
    p.add_argument("--agendamento-id", required=False, help="ID do agendamento (opcional)")
    p.add_argument("--id", required=False, help="Sinonimo de agendamento-id")
    p.add_argument("--ids", required=False, help="IDs separados por virgula para cancelamento multiplo")
    p.add_argument("--todas", action="store_true", help="Cancelar todas as consultas encontradas da data")
    p.add_argument("--all", action="store_true", help="Sinonimo de --todas")
    p.add_argument("--nome", required=False, help="Nome do paciente")
    p.add_argument("--paciente", required=False, help="Sinonimo de nome")
    p.add_argument("--telefone", required=False, help="Telefone/WhatsApp do paciente")
    p.add_argument("--phone", required=False, help="Sinonimo de telefone")
    p.add_argument("--data", required=False, help="Data da consulta a cancelar")
    p.add_argument("--dia", required=False, help="Sinonimo de data")
    p.add_argument("--hora", required=False, help="Hora da consulta (ex: 15:00 ou 15)")
    p.add_argument("--horario", required=False, help="Sinonimo de hora")
    p.add_argument("--servico", required=False, help="Sinonimo de procedimento")
    p.add_argument("--procedimento", required=False, help="Procedimento")
    p.add_argument("--motivo", required=False, default="Cancelado via WhatsApp")

def setup_alterar_parser(p):
    p.add_argument("--agendamento-id", required=False, help="ID do agendamento (opcional)")
    p.add_argument("--id", required=False, help="Sinonimo de agendamento-id")
    p.add_argument("--nome", required=False, help="Nome do paciente")
    p.add_argument("--paciente", required=False, help="Sinonimo de nome")
    p.add_argument("--telefone", required=False, help="Telefone/WhatsApp do paciente")
    p.add_argument("--phone", required=False, help="Sinonimo de telefone")
    p.add_argument("--data-atual", required=False, help="Data atual da consulta")
    p.add_argument("--dia-atual", required=False, help="Sinonimo de data-atual")
    p.add_argument("--hora-atual", required=False, help="Hora atual da consulta")
    p.add_argument("--nova-data", required=False, help="Nova data da consulta")
    p.add_argument("--data-nova", required=False, help="Sinonimo de nova-data")
    p.add_argument("--novo-dia", required=False, help="Sinonimo de nova-data")
    p.add_argument("--nova-hora", required=False, help="Nova hora da consulta")
    p.add_argument("--hora-nova", required=False, help="Sinonimo de nova-hora")
    p.add_argument("--novo-horario", required=False, help="Data e hora completa YYYY-MM-DD HH:MM:SS")
    p.add_argument("--data", required=False, help="Data da consulta")
    p.add_argument("--dia", required=False, help="Sinonimo de data")
    p.add_argument("--hora", required=False, help="Hora da consulta")
    p.add_argument("--horario", required=False, help="Sinonimo de hora")
    p.add_argument("--motivo", required=False, default="Remanejado via assistente")

def main():
    parser = argparse.ArgumentParser(description="CLI do CRM Clinica para Hermes Agent")
    subparsers = parser.add_subparsers(dest="action", required=True)
    
    subparsers.add_parser("dashboard")
    
    p_lsp = subparsers.add_parser("listar-pacientes")
    p_lsp.add_argument("--limite", type=int, default=None, required=False, help="Limite de pacientes")
    
    p_bus = subparsers.add_parser("buscar-paciente")
    p_bus.add_argument("--termo", required=True, help="Nome ou Telefone")
    
    p_cad = subparsers.add_parser("cadastrar-paciente")
    p_cad.add_argument("--nome", required=True)
    p_cad.add_argument("--telefone", required=True)
    p_cad.add_argument("--email", required=False, default="N/A")
    
    def setup_listar_parser(p):
        p.add_argument("--data", required=False, default=None, help="Filtrar por data (YYYY-MM-DD, hoje, amanha)")
        p.add_argument("--dia", required=False, default=None, help="Sinonimo de data")

    p_lsa1 = subparsers.add_parser("listar-agendamentos")
    setup_listar_parser(p_lsa1)

    p_lsa2 = subparsers.add_parser("listar")
    setup_listar_parser(p_lsa2)

    p_lsa3 = subparsers.add_parser("listar-consultas")
    setup_listar_parser(p_lsa3)
    
    p_hor = subparsers.add_parser("verificar-horarios")
    p_hor.add_argument("--data", required=False, default="hoje", help="Formato YYYY-MM-DD, hoje ou amanha")
    p_hor.add_argument("--dia", required=False, default=None, help="Sinonimo de data")
    
    p_age1 = subparsers.add_parser("agendar")
    setup_agenda_parser(p_age1)
    
    p_age2 = subparsers.add_parser("agendar-consulta")
    setup_agenda_parser(p_age2)
    
    p_can1 = subparsers.add_parser("cancelar")
    setup_cancel_parser(p_can1)
    
    p_can2 = subparsers.add_parser("cancelar-consulta")
    setup_cancel_parser(p_can2)

    p_alt1 = subparsers.add_parser("alterar")
    setup_alterar_parser(p_alt1)

    p_alt2 = subparsers.add_parser("alterar-consulta")
    setup_alterar_parser(p_alt2)

    p_alt3 = subparsers.add_parser("reagendar")
    setup_alterar_parser(p_alt3)

    p_alt4 = subparsers.add_parser("remarcar")
    setup_alterar_parser(p_alt4)
    
    p_upd = subparsers.add_parser("atualizar-status")
    p_upd.add_argument("--agendamento-id", required=True)
    p_upd.add_argument("--status", default=None)
    p_upd.add_argument("--horario", default=None)
    p_upd.add_argument("--motivo", default=None)
    
    p_bot = subparsers.add_parser("pausar-bot")
    p_bot.add_argument("--paciente-id", required=True)
    p_bot.add_argument("--status", choices=["paused", "active"], default="paused")

    p_chk1 = subparsers.add_parser("checar-bot")
    p_chk1.add_argument("--telefone", required=False, help="Telefone do paciente")
    p_chk1.add_argument("--phone", required=False, help="Sinonimo de telefone")
    p_chk1.add_argument("--paciente-id", required=False, help="ID do paciente")
    p_chk1.add_argument("--termo", required=False, help="Sinonimo de telefone/ID")

    p_chk2 = subparsers.add_parser("status-bot")
    p_chk2.add_argument("--telefone", required=False)
    p_chk2.add_argument("--phone", required=False)
    p_chk2.add_argument("--paciente-id", required=False)
    p_chk2.add_argument("--termo", required=False)

    p_reg1 = subparsers.add_parser("registrar-mensagem")
    p_reg1.add_argument("--texto", required=False, help="Texto da mensagem enviada")
    p_reg1.add_argument("--mensagem", required=False, help="Sinonimo de texto")
    p_reg1.add_argument("--content", required=False, help="Sinonimo de texto")
    p_reg1.add_argument("--telefone", required=False, help="Telefone do paciente")
    p_reg1.add_argument("--phone", required=False, help="Sinonimo de telefone")
    p_reg1.add_argument("--paciente-id", required=False, help="ID do paciente")
    p_reg1.add_argument("--id", required=False, help="Sinonimo de paciente-id")
    p_reg1.add_argument("--remetente", required=False, default="IA", help="Nome do remetente (padrao: IA)")

    p_reg2 = subparsers.add_parser("espelhar-mensagem")
    p_reg2.add_argument("--texto", required=False)
    p_reg2.add_argument("--mensagem", required=False)
    p_reg2.add_argument("--content", required=False)
    p_reg2.add_argument("--telefone", required=False)
    p_reg2.add_argument("--phone", required=False)
    p_reg2.add_argument("--paciente-id", required=False)
    p_reg2.add_argument("--id", required=False)
    p_reg2.add_argument("--remetente", required=False, default="IA")
    
    subparsers.add_parser("servicos")
    subparsers.add_parser("servicos-clinica")
    subparsers.add_parser("especialidades")
    subparsers.add_parser("tabela-precos")

    args, unknown = parser.parse_known_args()
    
    actions = {
        "dashboard": cmd_dashboard,
        "servicos": cmd_servicos,
        "servicos-clinica": cmd_servicos,
        "especialidades": cmd_servicos,
        "tabela-precos": cmd_servicos,
        "listar-pacientes": cmd_listar_pacientes,
        "buscar-paciente": cmd_buscar_paciente,
        "cadastrar-paciente": cmd_cadastrar_paciente,
        "listar-agendamentos": cmd_listar_agendamentos,
        "listar": cmd_listar_agendamentos,
        "listar-consultas": cmd_listar_agendamentos,
        "verificar-horarios": cmd_verificar_horarios,
        "agendar": cmd_agendar,
        "agendar-consulta": cmd_agendar,
        "cancelar": cmd_cancelar,
        "cancelar-consulta": cmd_cancelar,
        "alterar": cmd_alterar,
        "alterar-consulta": cmd_alterar,
        "reagendar": cmd_alterar,
        "remarcar": cmd_alterar,
        "atualizar-status": cmd_atualizar_status,
        "pausar-bot": cmd_pausar_bot,
        "checar-bot": cmd_checar_bot,
        "status-bot": cmd_checar_bot,
        "registrar-mensagem": cmd_registrar_mensagem,
        "espelhar-mensagem": cmd_registrar_mensagem
    }
    
    actions[args.action](args)

if __name__ == "__main__":
    main()