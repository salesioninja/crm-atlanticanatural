#!/bin/bash
set -e
echo "=== INICIANDO ATUALIZACAO DO CRM ATLANTICA NATURAL ==="
mkdir -p /root/crm_atlantica_deploy

# Descompacta usando Python3 nativo (100% compativel sem depender do comando unzip)
if [ -f "/root/deploy_crm_atlantica.zip" ]; then
    echo "Descompactando deploy_crm_atlantica.zip via python3 zipfile..."
    python3 -m zipfile -e /root/deploy_crm_atlantica.zip /root/crm_atlantica_deploy/
elif [ -f "/root/deploy.zip" ]; then
    echo "Descompactando deploy.zip via python3 zipfile..."
    python3 -m zipfile -e /root/deploy.zip /root/crm_atlantica_deploy/
fi

echo "Copiando arquivos atualizados para o container crm_atlantica_app..."
docker cp /root/crm_atlantica_deploy/. crm_atlantica_app:/var/www/html/

echo "Ajustando permissoes www-data..."
docker exec crm_atlantica_app chown -R www-data:www-data /var/www/html/

echo "Reiniciando crm_atlantica_app..."
docker restart crm_atlantica_app

echo "=== ATUALIZACAO CONCLUIDA COM SUCESSO! ==="
