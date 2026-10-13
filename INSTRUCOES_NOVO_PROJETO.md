# GUIA DEFINITIVO: NOVO PROJETO SEPARADO - CRM AGÊNCIA NINJA MKD

Esta pasta contém 100% de todos os arquivos necessários para rodar o CRM de forma totalmente isolada e independente do CRM Clínica Integrada.

---

## 1. Mover esta pasta para onde desejar
Você pode simplesmente recortar (`Ctrl+X`) a pasta **agencianinja** e colar (`Ctrl+V`) onde quiser fora deste diretório, por exemplo:
`C:\000-MEUS SITES EM HTML\+02-CRM-AgenciaNinja`

---

## 2. Criar o Novo Banco de Dados (Hostinger / MySQL)
1. Crie uma nova base MySQL separada no painel da Hostinger (ex: `u949594359_agencianinja`).
2. Crie um novo usuário MySQL e anote a senha.
3. No phpMyAdmin do novo banco, importe o arquivo `database.sql` que está nesta pasta.

---

## 3. Configurar o arquivo .env
Abra o arquivo `.env` desta pasta e atualize com os dados do seu novo banco:
```env
DB_HOST="srv1722.hstgr.io"
DB_NAME="u949594359_agencianinja"
DB_USER="u949594359_agencianinja"
DB_PASSWORD="SuaSenhaDoNovoBancoAqui"

APP_URL="https://agencianinja.acessaronline.com.br"
TENANT_ID="agencianinja"
```

---

## 4. Como Desenvolver e Compilar
Dentro da nova pasta no seu editor ou terminal:
- `npm install` (instala as dependências)
- `npm run dev` (roda o servidor local de desenvolvimento)
- `npm run build` (compila o frontend React para a pasta dist/)
- A pasta `dist/` já está previamente compilada e 100% pronta para produção!

---

## 5. Como Fazer o Deploy Independente
- **No WordPress (Hostinger):** Copie o conteúdo da pasta `dist/` e a pasta `api/` para a pasta do subdomínio ou diretório desejado via WP File Manager.
- **Na VPS:** Crie um container ou VirtualHost exclusivo apontando para a pasta independente.