FROM openjdk:17-jdk-slim
WORKDIR /app

# Copiar o JAR diretamente
COPY target/orbnoc-backend-1.0.0.jar app.jar

EXPOSE 8080

CMD ["java", "-jar", "app.jar"]