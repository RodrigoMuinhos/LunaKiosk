package com.luna.pay.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
        info = @Info(
                title = "LunaPay API",
                version = "v1",
                description = "LunaPay API - Payment Gateway Integration"
        )
)
public class OpenApiConfig {
}
