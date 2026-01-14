package com.luna.pay.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);

            if (jwtUtil.isValid(token)) {
                String userId = jwtUtil.getUserId(token);
                String tenantId = jwtUtil.getTenantId(token);
                String role = jwtUtil.getRole(token);
                List<String> modules = jwtUtil.getModules(token);

                if (!modules.contains("LUNAPAY")) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "Módulo LUNAPAY não habilitado");
                    return;
                }

                UserContext userContext = new UserContext(userId, tenantId, role, modules);

                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));

                var auth = new UsernamePasswordAuthenticationToken(userContext, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        filterChain.doFilter(request, response);
    }
}
