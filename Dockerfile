# Etapa 1: Construcción
FROM node:18-alpine as build
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Aumentar límite de memoria para evitar fallos en el build y construir
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Etapa 2: Servidor Nginx
FROM nginx:alpine

# Copiar el build de React generado en la etapa anterior a la carpeta de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# COMANDO DE INICIO:
# 1. Crea el archivo env-config.js vacío con la apertura del objeto
# 2. Busca todas las variables de entorno que empiecen por VITE_
# 3. Las formatea como pares clave-valor JSON y las añade al archivo
# 4. Cierra el objeto JSON
# 5. Inicia Nginx
CMD ["/bin/sh", "-c", "echo 'window.__ENV__ = {' > /usr/share/nginx/html/env-config.js && env | grep VITE_ | awk -F= '{print \"  \\\"\" $1 \"\\\": \\\"\" $2 \"\\\",\"}' >> /usr/share/nginx/html/env-config.js && echo '};' >> /usr/share/nginx/html/env-config.js && nginx -g 'daemon off;'"]
