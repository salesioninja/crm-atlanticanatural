# Documentação Oficial: Google Cloud & Firebase Console
## CRM Atlântica Natural • MMN & Go Pro

Este documento contém todos os novos identificadores, credenciais, URLs de autorização e configurações criadas para o funcionamento do sistema com o Google e Firebase.

---

### 1. Google Cloud Console

* **Nome do Projeto:** `crm-atlantica`
* **ID do Projeto:** `crm-atlantica`
* **Painel de Acesso:** [https://console.cloud.google.com/](https://console.cloud.google.com/)

#### Credenciais OAuth 2.0 (Aplicativo Web)
* **ID do Cliente (Client ID):**
  ```text
  SEU_CLIENT_ID.apps.googleusercontent.com (consulte seu arquivo .env)
  ```
* **Chave Secreta do Cliente (Client Secret):**
  ```text
  SEU_CLIENT_SECRET (consulte seu arquivo .env)
  ```

#### Origens JavaScript Autorizadas
* `https://crmatlanticanatural.acessaronline.com.br`
* `http://localhost:5173`

#### URIs de Redirecionamento Autorizados
* `https://crmatlanticanatural.acessaronline.com.br/api/google-callback`
* `https://crmatlanticanatural.acessaronline.com.br/api/index.php/google-callback`
* `https://crm-atlantica-86811.firebaseapp.com/__/auth/handler`

#### Usuários de Teste Autorizados (Tela de Permissão OAuth)
* `suporteninja1@gmail.com`
* `salesioninja@gmail.com`

---

### 2. Firebase Console

* **Nome do Projeto:** `crm atlantica`
* **ID do Projeto:** `crm-atlantica-86811`
* **Número do Projeto:** `890139188685`
* **Painel de Acesso:** [https://console.firebase.google.com/](https://console.firebase.google.com/)
* **Plano:** Spark (Gratuito)

#### Configuração SDK Web (`firebaseConfig`)
```javascript
const firebaseConfig = {
  apiKey: "SUA_FIREBASE_API_KEY",
  authDomain: "crm-atlantica-86811.firebaseapp.com",
  projectId: "crm-atlantica-86811",
  storageBucket: "crm-atlantica-86811.firebasestorage.app",
  messagingSenderId: "890139188685",
  appId: "1:890139188685:web:974cb549daff4ba75d3884",
  measurementId: "G-42911RM34K"
};
```

#### Provedores de Autenticação Ativados
* **Google:** Ativado (com tela pública: `CRM Atlantica`)

#### Domínios Autorizados no Firebase
* `localhost`
* `crm-atlantica-86811.firebaseapp.com`
* `crm-atlantica-86811.web.app`
* `crmatlanticanatural.acessaronline.com.br`
* `acessaronline.com.br`

---

### 3. Integração no Sistema e Arquivos Configurados

| Arquivo | Finalidade |
| :--- | :--- |
| `src/lib/firebase.ts` | Inicializa o Firebase Auth com as credenciais do projeto `crm-atlantica-86811`. |
| `.env` | Contém `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` para sincronização Google Agenda. |
| `src/context/AuthContext.tsx` | Gerencia o fluxo de login (Popup Google + E-mail) com fallback de contingência Master. |
| `src/components/TopBar.tsx` | Inclui `suporteninja1@gmail.com` como Master SuperAdmin no header da aplicação. |
| `api/config/bootstrap.php` | Valida as permissões RBAC e reconhece `suporteninja1@gmail.com` como SuperAdmin Master. |
| `api/index.php` | Endpoint `/auth/resolve` compatibilizado com PostgreSQL para registrar e retornar perfil `superadmin`. |
| `database_pg.sql` | Schema do PostgreSQL 16 com a VIEW `appointments` corrigida e seed de administradores. |

---

### 4. Administradores Master com Acesso Imediato
Os seguintes e-mails possuem acesso mestre universal (SuperAdmin) em todo o sistema:
* `suporteninja1@gmail.com`
* `salesioninja@gmail.com`
* `agencianinjamkd@gmail.com`
* `salesiosouzaoficial@gmail.com`
