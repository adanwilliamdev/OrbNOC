# syntax=docker/dockerfile:1

# ---- build ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -q -B dependency:go-offline
COPY src ./src
# Spotless e JaCoCo ficam de fora: já rodam no CI e não mudam o artefato.
RUN --mount=type=cache,target=/root/.m2 \
    mvn -q -B -DskipTests -Dspotless.check.skip=true -Djacoco.skip=true package \
    # Separa o jar em camadas (dependências, loader, snapshots, aplicação): só a última muda a cada
    # commit, então os rebuilds e os pulls reaproveitam as demais.
    && java -Djarmode=tools -jar target/orbnoc.jar extract --layers --destination /build/extracted

# ---- runtime ----
FROM eclipse-temurin:21-jre-noble
# ping/traceroute: checagens ICMP e diagnóstico; curl: healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends iputils-ping traceroute curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --create-home orbnoc
WORKDIR /app
# Da camada que menos muda para a que mais muda.
COPY --from=build /build/extracted/dependencies/ ./
COPY --from=build /build/extracted/spring-boot-loader/ ./
COPY --from=build /build/extracted/snapshot-dependencies/ ./
COPY --from=build /build/extracted/application/ ./
USER orbnoc
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/health/live || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar orbnoc.jar"]
