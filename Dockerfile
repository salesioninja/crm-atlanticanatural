# Ambiente de Produção com Apache e PHP 8.2 (Suporte a PostgreSQL e MySQL)
FROM php:8.2-apache
WORKDIR /var/www/html

# Instalar extensões necessárias do PHP para PostgreSQL e MySQL
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pdo_mysql \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Habilitar mod_rewrite do Apache para rotas amigáveis da API (.htaccess)
RUN a2enmod rewrite

# Permitir sobrescrita do .htaccess
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Copiar arquivos construídos do frontend React para a raiz do Apache
COPY dist/ /var/www/html/

# Copiar o código-fonte da API PHP para o subdiretório api
COPY api/ /var/www/html/api

# Copiar arquivos de configuração
COPY .htaccess /var/www/html/.htaccess

# Configurar permissões para o servidor Apache
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
CMD ["apache2-foreground"]
