# LunaCore - Authentication Service
# Multi-stage build for optimal image size

# Stage 1: Build
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# Install Maven (project does not ship a complete Maven Wrapper .mvn directory)
RUN apk add --no-cache maven

# Copy pom first for better layer caching
COPY pom.xml ./

# Download dependencies (cached layer)
RUN mvn -B -q dependency:go-offline

# Copy source code
COPY src ./src

# Build application (skip tests for faster builds)
RUN mvn -B -q clean package -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Create non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy jar from build stage
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]