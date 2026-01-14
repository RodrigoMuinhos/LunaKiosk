package com.luna.pay.config;

import com.luna.pay.security.UserContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/**
 * Configuração de JPA Auditing para rastrear quem criou/modificou entidades.
 * 
 * Habilita anotações:
 * - @CreatedBy
 * - @LastModifiedBy
 * - @CreatedDate
 * - @LastModifiedDate
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaAuditingConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        return new SpringSecurityAuditorAware();
    }

    /**
     * Implementação que obtém o userId do SecurityContext.
     */
    public static class SpringSecurityAuditorAware implements AuditorAware<String> {

        @Override
        public Optional<String> getCurrentAuditor() {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            
            if (auth == null || !auth.isAuthenticated()) {
                return Optional.of("system");
            }
            
            if (auth.getPrincipal() instanceof UserContext userContext) {
                return Optional.of(userContext.getUserId());
            }
            
            return Optional.of("system");
        }
    }
}
