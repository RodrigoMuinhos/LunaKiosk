package com.luna.pay.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.List;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    private Claims getClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(Keys.hmacShaKeyFor(secret.getBytes()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException e) {
            return null;
        }
    }

    public boolean isValid(String token) {
        Claims claims = getClaims(token);
        if (claims == null) return false;
        Date exp = claims.getExpiration();
        return exp != null && exp.after(new Date());
    }

    public String getUserId(String token) {
        Claims claims = getClaims(token);
        return claims != null ? claims.getSubject() : null;
    }

    public String getTenantId(String token) {
        Claims claims = getClaims(token);
        return claims != null ? (String) claims.get("tenantId") : null;
    }

    @SuppressWarnings("unchecked")
    public List<String> getModules(String token) {
        Claims claims = getClaims(token);
        if (claims == null) return List.of();
        Object modulesObj = claims.get("modules");
        if (modulesObj instanceof List<?> list) {
            return list.stream().map(Object::toString).toList();
        }
        return List.of();
    }

    public String getRole(String token) {
        Claims claims = getClaims(token);
        return claims != null ? (String) claims.get("role") : null;
    }
}
