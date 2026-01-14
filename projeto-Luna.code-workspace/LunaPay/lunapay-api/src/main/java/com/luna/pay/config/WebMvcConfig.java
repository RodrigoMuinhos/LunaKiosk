package com.luna.pay.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuração do WebMVC para registrar interceptors.
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final TenantMDCInterceptor tenantMDCInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Adiciona interceptor para todas as rotas
        registry.addInterceptor(tenantMDCInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/actuator/**", "/error");
    }
}
