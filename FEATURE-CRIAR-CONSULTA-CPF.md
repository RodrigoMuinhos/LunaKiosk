# Feature: Criar Consulta por CPF

## 📋 Resumo da Implementação

Feature completa para criar consultas vinculadas a pacientes através do CPF, com suporte opcional para médicos cadastrados.

**Data:** 2026-01-17  
**Status:** ✅ Implementado e compilado com sucesso

---

## 🗂️ Arquivos Criados/Modificados

### 1. Migration SQL
**Arquivo:** `TotemAPI/src/main/resources/db/migration/V001__appointments_nullable_doctor_and_add_doctor_id.sql`

- Tornou `doctor` e `specialty` nullable (permite consultas sem médico)
- Adicionou coluna `doctor_id` (VARCHAR(255), nullable)
- Criou índice `idx_appointments_tenant_doctor_date`

### 2. Entity Appointment
**Arquivo:** `TotemAPI/src/main/java/br/lunavita/totemapi/model/Appointment.java`

**Alterações:**
- Adicionada coluna `doctorId` (String, nullable)
- Removido `nullable = false` de `doctor` e `specialty`
- Adicionados getters/setters para `doctorId`

### 3. DTOs Criados

#### CreateAppointmentByCpfRequest
**Arquivo:** `TotemAPI/src/main/java/br/lunavita/totemapi/dto/CreateAppointmentByCpfRequest.java`

Campos obrigatórios:
- `cpf` (String, 11 dígitos)
- `date` (LocalDate, formato yyyy-MM-dd)
- `time` (String, formato HH:mm)
- `type` (String, ex: "Retorno", "Primeira Consulta")
- `amount` (BigDecimal)

Campos opcionais:
- `paid` (Boolean, default: false)
- `status` (String, default: "aguardando")
- `doctorId` (String, ID do médico na tabela doctors)

#### AppointmentResponse
**Arquivo:** `TotemAPI/src/main/java/br/lunavita/totemapi/dto/AppointmentResponse.java`

Retorna todos os dados da consulta criada, incluindo:
- Dados do paciente (id, name, email, cpf)
- Dados da consulta (date, time, type, status, paid, amount)
- Dados do médico (doctorId, doctor, specialty) - se aplicável

#### PatientByCpfResponse
**Arquivo:** `TotemAPI/src/main/java/br/lunavita/totemapi/dto/PatientByCpfResponse.java`

DTO simplificado para busca de paciente:
- `id`, `name`, `email`, `cpf`, `phone`

#### ErrorResponse
**Arquivo:** `TotemAPI/src/main/java/br/lunavita/totemapi/dto/ErrorResponse.java`

DTO para mensagens de erro padronizadas

### 4. Services

#### DataStoreService
**Arquivo:** `TotemAPI/src/main/java/br/lunavita/totemapi/service/DataStoreService.java`

**Novo método:** `createAppointmentByCpf()`

Lógica:
1. Valida tenant_id (obrigatório)
2. Busca paciente por CPF + tenant_id
3. Se `doctorId` fornecido:
   - Busca médico na tabela `doctors`
   - Preenche `doctor` e `specialty` automaticamente
4. Se `doctorId` vazio/null:
   - Cria consulta sem médico (doctor, specialty, doctorId = null)
5. Salva consulta com todos os dados preenchidos

Segurança:
- Mascara CPF nos logs (mostra apenas últimos 3 dígitos)
- Validação de tenant (evita cross-tenant access)
- Mensagens de erro claras

### 5. Controllers

#### PatientController
**Arquivo:** `TotemAPI/src/main/java/br/lunavita/totemapi/controller/PatientController.java`

**Novo endpoint:** `GET /api/patients/by-cpf?cpf=XXXXXXXXXXX`

- Busca paciente por CPF (filtrado por tenant)
- Retorna dados simplificados (id, name, email, cpf, phone)
- Retorna 404 se não encontrado
- Registra auditoria LGPD

#### AppointmentController
**Arquivo:** `TotemAPI/src/main/java/br/lunavita/totemapi/controller/AppointmentController.java`

**Novo endpoint:** `POST /api/appointments/by-cpf`

- Cria consulta por CPF
- Validações:
  - CPF obrigatório (11 dígitos)
  - Date no formato ISO (yyyy-MM-dd)
  - Time no formato HH:mm
  - Paciente deve existir no banco
  - Se doctorId fornecido, médico deve existir
- Retorna 201 (Created) com AppointmentResponse
- Retorna 400 (Bad Request) se validação falhar
- Retorna 404 se paciente ou médico não encontrado

---

## 🔌 Endpoints Implementados

### 1. Buscar Paciente por CPF

**GET** `/api/patients/by-cpf?cpf=04411750317`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response 200:**
```json
{
  "id": "27fffa6e-379d-430a-a8c2-5de6b0de699f",
  "name": "João Silva",
  "email": "joao@example.com",
  "cpf": "04411750317",
  "phone": "+5511987654321"
}
```

**Response 404:**
```json
{
  "error": "Paciente não encontrado para o CPF informado"
}
```

### 2. Criar Consulta por CPF

**POST** `/api/appointments/by-cpf`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body (com médico):**
```json
{
  "cpf": "04411750317",
  "date": "2026-01-20",
  "time": "14:30",
  "type": "Consulta",
  "amount": 150.00,
  "paid": false,
  "status": "aguardando",
  "doctorId": "abc-123-doctor-id"
}
```

**Body (sem médico):**
```json
{
  "cpf": "04411750317",
  "date": "2026-01-20",
  "time": "14:30",
  "type": "Consulta",
  "amount": 150.00,
  "paid": false,
  "status": "aguardando"
}
```

**Response 201:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "default",
  "patientId": "27fffa6e-379d-430a-a8c2-5de6b0de699f",
  "patient": "João Silva",
  "patientEmail": "joao@example.com",
  "date": "2026-01-20",
  "time": "14:30",
  "type": "Consulta",
  "status": "aguardando",
  "paid": false,
  "amount": 150.00,
  "cpf": "04411750317",
  "doctorId": "abc-123-doctor-id",
  "doctor": "Dr. Roberto",
  "specialty": "Cardiologia"
}
```

**Response 400:**
```json
{
  "error": "Paciente não encontrado para o CPF informado no tenant default"
}
```

ou

```json
{
  "error": "Médico não encontrado para o ID informado no tenant default"
}
```

### 3. Listar Médicos (já existia)

**GET** `/api/doctors`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response 200:**
```json
[
  {
    "id": "abc-123-doctor-id",
    "tenantId": "default",
    "name": "Dr. Roberto",
    "specialty": "Cardiologia",
    "email": "roberto@clinic.com",
    "phone": "+5511999887766",
    "crm": "123456",
    "availability": "Segunda a Sexta, 9h-17h"
  }
]
```

---

## 📊 Banco de Dados

### Schema Atualizado

```sql
-- Tabela appointments (atualizada)
CREATE TABLE luna.appointments (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    patient_id VARCHAR(255) NOT NULL,
    cpf VARCHAR(255) NOT NULL,
    patient VARCHAR(255) NOT NULL,
    patient_email VARCHAR(255),
    date DATE NOT NULL,
    time VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    amount NUMERIC NOT NULL,
    paid BOOLEAN NOT NULL,
    doctor_id VARCHAR(255),        -- NOVA COLUNA (nullable)
    doctor VARCHAR(255),            -- AGORA NULLABLE
    specialty VARCHAR(255),         -- AGORA NULLABLE
    photo_url VARCHAR(255)
);

-- Índice para performance
CREATE INDEX idx_appointments_tenant_doctor_date 
ON luna.appointments(tenant_id, doctor_id, date);
```

---

## 🧪 Testes Manuais

### Teste 1: Criar consulta COM médico

```bash
# 1. Login
curl -X POST https://totemapi.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "adm@luna.com",
    "password": "12345678"
  }'

# Copiar o token do response

# 2. Buscar paciente por CPF
curl -X GET "https://totemapi.up.railway.app/api/patients/by-cpf?cpf=04411750317" \
  -H "Authorization: Bearer <TOKEN>"

# 3. Listar médicos disponíveis
curl -X GET https://totemapi.up.railway.app/api/doctors \
  -H "Authorization: Bearer <TOKEN>"

# 4. Criar consulta com médico
curl -X POST https://totemapi.up.railway.app/api/appointments/by-cpf \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "04411750317",
    "date": "2026-01-20",
    "time": "14:30",
    "type": "Consulta",
    "amount": 150.00,
    "doctorId": "ID_DO_MEDICO_AQUI"
  }'
```

### Teste 2: Criar consulta SEM médico

```bash
curl -X POST https://totemapi.up.railway.app/api/appointments/by-cpf \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "04411750317",
    "date": "2026-01-20",
    "time": "14:30",
    "type": "Consulta",
    "amount": 150.00
  }'
```

### Teste 3: CPF inexistente (deve retornar 400)

```bash
curl -X POST https://totemapi.up.railway.app/api/appointments/by-cpf \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "99999999999",
    "date": "2026-01-20",
    "time": "14:30",
    "type": "Consulta",
    "amount": 150.00
  }'
```

---

## 🎨 Frontend (TotemUI) - Sugestões

### 1. Modal "Nova Consulta"

```typescript
// components/AppointmentCreateModal.tsx

const [cpf, setCpf] = useState('');
const [patientData, setPatientData] = useState(null);
const [doctors, setDoctors] = useState([]);
const [selectedDoctor, setSelectedDoctor] = useState('');

// Ao sair do campo CPF (onBlur)
const handleCpfBlur = async () => {
  if (cpf.length === 11) {
    const response = await fetch(`/api/patients/by-cpf?cpf=${cpf}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      const patient = await response.json();
      setPatientData(patient);
      // Auto-preencher nome e email (read-only)
    }
  }
};

// Carregar lista de médicos ao montar o componente
useEffect(() => {
  fetch('/api/doctors', {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(setDoctors);
}, []);

// Ao submeter
const handleSubmit = async () => {
  const payload = {
    cpf,
    date: '2026-01-20',
    time: '14:30',
    type: 'Consulta',
    amount: 150.00,
    paid: false,
    status: 'aguardando',
    doctorId: selectedDoctor || undefined // opcional
  };
  
  const response = await fetch('/api/appointments/by-cpf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  
  if (response.ok) {
    const appointment = await response.json();
    console.log('Consulta criada:', appointment);
    onSuccess();
  }
};
```

### 2. Componente CPF Input

```tsx
<input
  type="text"
  placeholder="CPF (11 dígitos)"
  value={cpf}
  onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))}
  onBlur={handleCpfBlur}
  maxLength={11}
/>

{patientData && (
  <div>
    <input 
      readOnly 
      value={patientData.name} 
      placeholder="Nome do paciente" 
    />
    <input 
      readOnly 
      value={patientData.email} 
      placeholder="Email" 
    />
  </div>
)}
```

### 3. Dropdown de Médicos

```tsx
<select 
  value={selectedDoctor} 
  onChange={(e) => setSelectedDoctor(e.target.value)}
>
  <option value="">Sem médico</option>
  {doctors.map(doc => (
    <option key={doc.id} value={doc.id}>
      {doc.name} - {doc.specialty}
    </option>
  ))}
</select>

{selectedDoctor && (
  <div>
    <span>Especialidade: {doctors.find(d => d.id === selectedDoctor)?.specialty}</span>
  </div>
)}
```

---

## 🔒 Segurança

### Multi-Tenant
- Todos os endpoints respeitam `tenant_id` do JWT token
- Impossível acessar dados de outro tenant
- Validação obrigatória de tenant em todas as operações

### Auditoria LGPD
- Endpoint `/api/patients/by-cpf` registra acesso ao paciente
- Logs incluem: usuário, IP, user-agent, timestamp
- CPF mascarado nos logs do backend (mostra apenas últimos 3 dígitos)

### Validações
- CPF: 11 dígitos numéricos
- Date: formato ISO (yyyy-MM-dd)
- Time: formato HH:mm (24h)
- Amount: BigDecimal (precisão monetária)

---

## 📝 Próximos Passos

### Backend
1. ✅ Migration aplicada automaticamente (Hibernate DDL auto-update)
2. ✅ Compilação bem-sucedida
3. 🔄 Deploy para Railway (auto-deploy via Git push)
4. ⏳ Testes em produção

### Frontend (TotemUI)
1. ⏳ Implementar modal "Nova Consulta"
2. ⏳ Integrar endpoint `/api/patients/by-cpf`
3. ⏳ Integrar endpoint `/api/appointments/by-cpf`
4. ⏳ Dropdown de médicos (GET `/api/doctors`)

### Testes
- ⏳ Teste E2E: criar consulta com médico
- ⏳ Teste E2E: criar consulta sem médico
- ⏳ Teste E2E: CPF inexistente (erro 400)
- ⏳ Teste E2E: doctorId inválido (erro 400)

---

## 📚 Referências

**Controllers:**
- `PatientController.java` - GET `/api/patients/by-cpf`
- `AppointmentController.java` - POST `/api/appointments/by-cpf`
- `DoctorController.java` - GET `/api/doctors`

**Services:**
- `DataStoreService.java` - `createAppointmentByCpf()`

**DTOs:**
- `CreateAppointmentByCpfRequest.java`
- `AppointmentResponse.java`
- `PatientByCpfResponse.java`

**Migration:**
- `V001__appointments_nullable_doctor_and_add_doctor_id.sql`

---

## ✅ Checklist de Deploy

- [x] Migration SQL criada
- [x] Entity Appointment atualizada
- [x] DTOs criados
- [x] Service method implementado
- [x] Endpoints criados
- [x] Compilação bem-sucedida
- [ ] Git commit e push
- [ ] Railway auto-deploy
- [ ] Testes em produção
- [ ] Frontend integrado

---

**Data de criação:** 2026-01-17  
**Autor:** GitHub Copilot  
**Status:** ✅ Implementação concluída
