FROM nginx:alpine

# Copy all static assets into the default Nginx public directory
COPY . /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
