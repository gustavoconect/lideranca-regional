# SP15 App - Leadership Intelligence System

## ✅ Status Atual

| Item | Status |
|------|--------|
| **Vite 7.3.1** | ✅ Instalado |
| **React 19** | ✅ Configurado |
| **TypeScript** | ✅ Funcionando |
| **Supabase Client** | ✅ Configurado via `.env` |
| **Servidor Dev** | ✅ http://localhost:5173 |

---

## 🔧 Configuração do Banco de Dados (Ação Necessária)

O arquivo `supabase/schema.sql` contém o schema completo do banco. Execute-o manualmente:

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard/project/kfttidnduaynkrtuukrt)
2. Vá para **SQL Editor** > **New Query**
3. Copie e cole o conteúdo de `supabase/schema.sql`
4. Clique em **Run**

---

## 👤 Criar Usuário de Teste

Após executar o schema, crie um usuário:

1. Dashboard Supabase > **Authentication** > **Users**
2. Clique **Add User** > **Create New User**
3. Preencha:
   - Email: `admin@teste.com`
   - Password: `123456`
4. Após criar, execute este SQL para torná-lo **regional_leader**:

```sql
UPDATE profiles 
SET role = 'regional_leader', full_name = 'Administrador Regional'
WHERE email = 'admin@teste.com';
```

---

## 🚀 Executando o Projeto

```bash
# Instalar dependências (se necessário)
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: **http://localhost:5173**

---

## 📁 Estrutura do Projeto

```
├── src/
│   ├── App.tsx           # Router principal
│   ├── pages/
│   │   ├── Login.tsx     # Página de login
│   │   └── Dashboard.tsx # Dashboard principal
│   ├── components/
│   │   ├── forms/
│   │   │   ├── login-form.tsx      # Formulário de login
│   │   │   ├── csv-upload-form.tsx # Upload CSV NPS
│   │   │   └── pdf-upload-form.tsx # Análise PDF com Gemini
│   │   └── charts/
│   │       └── nps-ranking-table.tsx # Tabela de ranking
│   └── lib/
│       └── supabase.ts   # Cliente Supabase
├── supabase/
│   └── schema.sql        # Schema do banco
└── .env                  # Variáveis de ambiente
```

---

## � Deploy no Vercel & GitHub

### 1. Preparar Repositório
O projeto já está inicializado com Git localmente. Para subir para o GitHub:
1. Crie um novo repositório vazio no GitHub.
2. Rode os comandos fornecidos pelo GitHub:
```bash
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
git branch -M main
git push -u origin main
```

### 2. Configurar no Vercel
1. Conecte sua conta do GitHub ao [Vercel](https://vercel.com).
2. Importe o repositório criado.
3. **Importante:** Adicione as seguintes Variáveis de Ambiente no Vercel (copie do seu `.env` local):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_GENERATIVE_AI_API_KEY`
4. Clique em **Deploy**.

O arquivo `vercel.json` já está configurado para lidar com as rotas do React Router.
