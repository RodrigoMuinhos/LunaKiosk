-- Script SQL para criar usuário de serviço do TOTEM
-- Email: totem@lunavita.com.br
-- Password: totem123 (hash bcrypt)
-- Role: RECEPCAO

-- Deletar usuário existente (se houver)
DELETE FROM luna.users WHERE email = 'totem@lunavita.com.br';

-- Criar usuário novo
-- Senha: totem123
-- Hash bcrypt (10 rounds): $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO luna.users (
  id,
  email,
  name,
  cpf,
  password,
  role,
  tenant_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'totem@lunavita.com.br',
  'Usuário Totem',
  '00000000000',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'RECEPCAO',
  'default',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  updated_at = NOW();

-- Verificar criação
SELECT 
  id,
  email,
  name,
  role,
  tenant_id,
  created_at,
  'Password hash: ' || LEFT(password, 20) || '...' as password_check
FROM luna.users 
WHERE email = 'totem@lunavita.com.br';

-- Instruções finais
SELECT '
╔═══════════════════════════════════════════════════════╗
║           CREDENCIAIS DO TOTEM CONFIGURADAS           ║
╚═══════════════════════════════════════════════════════╝

📧 Email:    totem@lunavita.com.br
🔑 Password: totem123
👤 Role:     RECEPCAO

✅ O TotemUI agora deve fazer auto-login com sucesso!

Para testar:
1. Abrir TotemUI: http://localhost:3000
2. O auto-login deve acontecer automaticamente
3. Se houver erro, verificar console do browser (F12)

' as "INSTRUÇÕES";
