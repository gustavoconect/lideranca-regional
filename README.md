# Regional App - Guia de Configuração

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

## 🔑 Variáveis de Ambiente

Já configuradas no `.env`:

- `VITE_SUPABASE_URL` - URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave pública do Supabase
- `VITE_GOOGLE_GENERATIVE_AI_API_KEY` - API Key do Gemini
