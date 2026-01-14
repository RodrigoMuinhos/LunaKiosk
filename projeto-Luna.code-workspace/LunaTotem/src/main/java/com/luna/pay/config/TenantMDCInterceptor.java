package com.luna.pay.config;

import com.luna.pay.security.UserContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Interceptor para adicionar tenantId no MDC (Mapped Diagnostic Context).
 * Permite que todos os logs incluam automaticamente o tenant da requisição.
 * 
 * Exemplo de log:
 * INFO [tenant=clinic_123] Criando pagamento via gateway C6
 */
@Component
public class TenantMDCInterceptor implements HandlerInterceptor {

    private static final String MDC_TENANT_KEY = "tenantId";
    private static final String MDC_USER_KEY = "userId";

    @Override
    public boolean preHandle(HttpServletRequest request, 
                             HttpServletResponse response, 
                             Object handler) {
        
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        
        if (auth != null && auth.getPrincipal() instanceof UserContext userContext) {
            // Adiciona tenantId e userId no MDC para logs
            MDC.put(MDC_TENANT_KEY, userContext.getTenantId());
            MDC.put(MDC_USER_KEY, userContext.getUserId());
        }
        
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, 
                                 HttpServletResponse response, 
                                 Object handler, 
                                 Exception ex) {
        // Limpa MDC após requisição para evitar memory leak
        MDC.remove(MDC_TENANT_KEY);
        MDC.remove(MDC_USER_KEY);
    }
}
