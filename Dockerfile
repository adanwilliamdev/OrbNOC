# ---- build ----
FROM maven:3.9-eclipse-temurin-26 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- runtime ----
FROM eclipse-temurin:24-jre-noble
# ping/traceroute: checagens ICMP e diagnóstico; curl: healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends iputils-ping traceroute curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home orbnoc
WORKDIR /app
COPY --from=build /build/target/orbnoc.jar app.jar
USER orbnoc
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/health/live || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
