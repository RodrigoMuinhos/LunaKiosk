FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/totem-api-0.0.1-SNAPSHOT.jar app.jar
# Railway routes traffic to the port your app listens on (usually from $PORT).
# We publish 8081 to match the expected TotemAPI service port in this repo.
EXPOSE 8081
# Otimizado para plano FREE (512MB): heap 200m, metaspace 128m (Spring Security precisa)
ENTRYPOINT ["java", "-Xmx200m", "-Xms64m", "-XX:MaxMetaspaceSize=128m", "-XX:ReservedCodeCacheSize=32m", "-Xss256k", "-XX:+UseSerialGC", "-XX:+TieredCompilation", "-XX:TieredStopAtLevel=1", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
