# ===== Etapa 1: build =====
FROM maven:3.9.9-eclipse-temurin-17 AS builder
WORKDIR /workspace
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
# Compila y asegura el boot-jar:
RUN mvn -q -DskipTests clean package spring-boot:repackage
# Copia el jar "bueno" (excluye original-*.jar) a una ruta fija
RUN sh -lc 'JAR=$(ls target/*.jar | grep -v original | head -n1) && cp "$JAR" /workspace/app.jar && echo "USING: $JAR"'

# ===== Etapa 2: runtime =====
FROM eclipse-temurin:17-jre
WORKDIR /app
ENV TZ=America/La_Paz
ENV JAVA_OPTS=""
COPY --from=builder /workspace/app.jar /app/app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=docker
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
