package com.luna.pay.gateway;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Map;

@Configuration
@ConfigurationProperties(prefix = "payment")
@Data
public class GatewayConfig {

    private Map<String, GatewayProperties> gateways = new HashMap<>();

    @Data
    public static class GatewayProperties {
        private boolean enabled = false;
        private String apiKey;
        private String apiSecret;
        private String baseUrl;
        private String webhookSecret;
        private String walletId;
        private String environment = "sandbox";
        private Integer timeoutSeconds = 30;
    }

    public GatewayProperties getAsaas() {
        return gateways.getOrDefault("asaas", new GatewayProperties());
    }

    public GatewayProperties getC6() {
        return gateways.getOrDefault("c6", new GatewayProperties());
    }

    public boolean isGatewayEnabled(String gateway) {
        GatewayProperties props = gateways.get(gateway.toLowerCase());
        return props != null && props.isEnabled();
    }
}
