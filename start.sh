#!/bin/bash

echo "🚀 Iniciando Cassandra Query Pilot..."

# Verificar se o Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker primeiro."
    exit 1
fi

# Parar containers existentes se houver
echo "📦 Parando containers existentes..."
docker-compose down

# Construir e iniciar os containers
echo "🔨 Construindo e iniciando containers..."
docker-compose up --build -d

# Aguardar os serviços iniciarem
echo "⏳ Aguardando serviços iniciarem..."
sleep 10

# Verificar se os serviços estão rodando
echo "🔍 Verificando status dos serviços..."

# Verificar MySQL
if docker-compose exec -T mysql mysqladmin ping -h localhost --silent; then
    echo "✅ MySQL: OK"
else
    echo "❌ MySQL: ERRO"
fi

# Verificar Backend
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: ERRO"
fi

# Verificar Frontend
if curl -s http://localhost:8088 > /dev/null; then
    echo "✅ Frontend: OK"
else
    echo "❌ Frontend: ERRO"
fi

echo ""
echo "🎉 Aplicação está rodando!"
echo "📱 Acesse: http://localhost:8088"
echo ""
echo "👤 Credenciais padrão:"
echo "   Usuário: admin"
echo "   Senha: admin123"
echo ""
echo "🛠️  Para parar a aplicação: docker-compose down"
echo "📋 Para ver logs: docker-compose logs -f" 