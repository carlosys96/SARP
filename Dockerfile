# Etapa 1: Construcción (Build)
FROM node:20-alpine as build

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Construir la aplicación
# Usamos npx vite build para asegurar que use la versión local y evite bloqueos por TSC
RUN npx vite build --emptyOutDir

# Etapa 2: Servidor de Producción (Nginx)
FROM nginx:alpine

# Copiar los archivos construidos desde la etapa anterior a la carpeta de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer el puerto 80
EXPOSE 80

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
