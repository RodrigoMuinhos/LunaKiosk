package com.luna.pay.config;

import com.luna.pay.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
          .csrf(AbstractHttpConfigurer::disable)
          .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
          .authorizeHttpRequests(auth -> auth
                  .requestMatchers("/actuator/health").permitAll()
          .requestMatchers(
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html"
          ).permitAll()
                  .requestMatchers("/webhooks/**").permitAll()
                  .anyRequest().authenticated()
          )
          .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

      // CORS global: libera acesso do frontend (localhost:3000)
      http.cors(cors -> cors.configurationSource(request -> {
        var config = new org.springframework.web.cors.CorsConfiguration();
        // TotemUI pode rodar via localhost, 127.0.0.1 e também no kiosk (Electron)
        config.setAllowedOriginPatterns(java.util.List.of(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:19007",
                "http://127.0.0.1:19007"
        ));
        config.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(java.util.List.of("*"));
        config.setAllowCredentials(true);
        return config;
      }));

        return http.build();
    }
}
