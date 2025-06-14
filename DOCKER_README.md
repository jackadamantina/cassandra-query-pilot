# Cassandra Query Pilot - Docker Setup

Este projeto foi configurado para rodar completamente em Docker com MySQL interno, substituindo o Supabase original.

## 🚀 Início Rápido

### Pré-requisitos
- Docker
- Docker Compose
- Git

### Executar a Aplicação

1. **Clone o repositório** (se ainda não foi feito):
```bash
git clone <seu-repositorio>
cd cassandra-query-pilot
```

2. **Execute o script de inicialização**:
```bash
chmod +x start.sh
./start.sh
```

3. **Acesse a aplicação**:
- Frontend: http://localhost:8088
- Backend API: http://localhost:3000
- MySQL: localhost:3306

### Credenciais Padrão
- **Usuário**: admin
- **Senha**: admin123

Ou:
- **Usuário**: demo
- **Senha**: admin123

## 🏗️ Arquitetura

### Serviços Docker

1. **MySQL (mysql)**
   - Porta: 3306
   - Database: cassandra_pilot
   - Usuário: pilot_user
   - Senha: pilot_pass

2. **Backend (Node.js + Express)**
   - Porta: 3000
   - API endpoints em `/api/*`
   - Conecta ao MySQL para autenticação e logs

3. **Frontend (React + Vite)**
   - Porta: 8088
   - Interface web da aplicação
   - Proxy para backend em `/api/*`

### Estrutura do Banco de Dados

- **users**: Gestão de usuários
- **cassandra_clusters**: Configuração de clusters Cassandra
- **query_logs**: Logs de execução de queries
- **user_sessions**: Sessões ativas
- **audit_logs**: Logs de auditoria

## 🛠️ Comandos Úteis

### Gerenciar Containers
```bash
# Iniciar containers
docker-compose up -d

# Parar containers
docker-compose down

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f mysql
```

### Acessar Containers
```bash
# Acessar MySQL
docker-compose exec mysql mysql -u pilot_user -p cassandra_pilot

# Acessar backend
docker-compose exec backend sh

# Ver logs do backend em tempo real
docker-compose logs -f backend
```

### Rebuild após Mudanças
```bash
# Rebuild apenas o frontend
docker-compose build frontend
docker-compose up -d frontend

# Rebuild apenas o backend
docker-compose build backend
docker-compose up -d backend

# Rebuild tudo
docker-compose up --build -d
```

## 📊 Funcionalidades

### ✅ Implementadas
- [x] Autenticação JWT com MySQL
- [x] Gestão de usuários
- [x] Gestão de clusters Cassandra
- [x] Execução de queries (simuladas)
- [x] Logs de queries
- [x] Logs de auditoria
- [x] Interface web responsiva
- [x] Sistema de permissões (admin/user/viewer)

### 🔄 Em Desenvolvimento
- [ ] Conexão real com Cassandra
- [ ] Gestão visual de usuários
- [ ] Dashboard de estatísticas
- [ ] Exportação de resultados

## 🐛 Troubleshooting

### Problema: Containers não iniciam
```bash
# Verificar se as portas estão livres
netstat -tulpn | grep :8088
netstat -tulpn | grep :3000
netstat -tulpn | grep :3306

# Limpar containers existentes
docker-compose down -v
docker system prune -f
```

### Problema: Erro de conexão com MySQL
```bash
# Verificar logs do MySQL
docker-compose logs mysql

# Reiniciar apenas o MySQL
docker-compose restart mysql
```

### Problema: Frontend não carrega
```bash
# Verificar se o build foi bem-sucedido
docker-compose logs frontend

# Rebuild do frontend
docker-compose build frontend --no-cache
docker-compose up -d frontend
```

## 🔒 Segurança

- Senhas padrão devem ser alteradas em produção
- JWT secret deve ser alterado em produção
- Configurar HTTPS em produção
- Implementar rate limiting adicional se necessário

## 📝 Logs

Todos os logs são armazenados no MySQL:
- Logs de queries em `query_logs`
- Logs de auditoria em `audit_logs`
- Informações de sessão em `user_sessions`

## 🚦 Monitoramento

### Health Checks
- Backend: http://localhost:3000/api/health
- Frontend: http://localhost:8088 (deve carregar a página)
- MySQL: Verificar com `docker-compose logs mysql` 