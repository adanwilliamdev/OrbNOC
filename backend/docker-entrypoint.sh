#!/bin/sh

# Aguardar PostgreSQL ficar disponível
echo "Aguardando PostgreSQL..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done
echo "PostgreSQL disponível!"

# Aguardar Redis ficar disponível
echo "Aguardando Redis..."
while ! nc -z $REDIS_HOST $REDIS_PORT; do
  sleep 1
done
echo "Redis disponível!"

# Executar a aplicação
exec java -jar app.jar