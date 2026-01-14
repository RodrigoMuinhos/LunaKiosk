package com.luna.pay.gateway.client;

import com.luna.pay.gateway.GatewayConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

/**
 * Configuração do WebClient para chamadas HTTP aos gateways de pagamento.
 * Usa WebClient reativo para melhor performance e timeout configurável.
 */
@Configuration
@RequiredArgsConstructor
public class GatewayWebClientConfig {

    private final GatewayConfig gatewayConfig;

    @Bean
    public WebClient.Builder webClientBuilder() {
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofSeconds(30))
                .doOnConnected(conn -> 
                    conn.addHandlerLast(new io.netty.handler.timeout.ReadTimeoutHandler(30))
                        .addHandlerLast(new io.netty.handler.timeout.WriteTimeoutHandler(30))
                );

        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
    }

    @Bean
    public WebClient c6WebClient(WebClient.Builder builder) {
        return builder
                .baseUrl("https://api.c6bank.com.br/v1")
                .build();
    }

    @Bean
    public WebClient asaasWebClient(WebClient.Builder builder) {
        String baseUrl = gatewayConfig.getAsaas().getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://sandbox.asaas.com/api/v3"; // fallback
        }
        return builder
                .baseUrl(baseUrl)
                .build();
    }
}
