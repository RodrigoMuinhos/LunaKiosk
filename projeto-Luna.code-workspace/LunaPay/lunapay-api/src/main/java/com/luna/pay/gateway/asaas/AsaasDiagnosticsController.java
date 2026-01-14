package com.luna.pay.gateway.asaas;

import com.luna.pay.gateway.GatewayConfig;
import com.luna.pay.security.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/gateways/asaas")
@RequiredArgsConstructor
public class AsaasDiagnosticsController {

    private final GatewayConfig gatewayConfig;
    private final WebClient asaasWebClient;

    @GetMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(
            @AuthenticationPrincipal UserContext user,
            @RequestParam(name = "paymentId", required = false) String paymentId
    ) {
        Map<String, Object> out = new LinkedHashMap<>();

        String environment = gatewayConfig.getAsaas().getEnvironment();
        String baseUrl = gatewayConfig.getAsaas().getBaseUrl();
        boolean apiKeyPresent = gatewayConfig.getAsaas().getApiKey() != null && !gatewayConfig.getAsaas().getApiKey().isBlank();

        out.put("environment", environment);
        out.put("baseUrl", baseUrl);
        out.put("apiKeyPresent", apiKeyPresent);
        out.put("tenantId", user != null ? user.getTenantId() : null);
        out.put("userId", user != null ? user.getUserId() : null);

        if (!apiKeyPresent) {
            out.put("ok", false);
            out.put("error", "ASAAS apiKey não configurada (verifique ASAAS_PROD_API_KEY/ASAAS_SANDBOX_API_KEY e profile)");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(out);
        }

        // 1) Prova de autenticação: tenta um endpoint leve. Se falhar por endpoint inexistente,
        // cai em outra rota de leitura.
        ProbeResult probe = probe("/myAccount");
        if (!probe.ok) {
            probe = probe("/customers?limit=1");
        }

        out.put("probeEndpoint", probe.endpoint);
        out.put("probeStatus", probe.status);
        out.put("probeOk", probe.ok);
        out.put("probeBodyPreview", truncate(probe.body, 500));

        // 2) Se o usuário passar paymentId, valida que ele existe no ambiente atual.
        if (paymentId != null && !paymentId.isBlank()) {
            ProbeResult paymentProbe = probe("/payments/" + paymentId.trim());
            out.put("paymentId", paymentId.trim());
            out.put("paymentLookupStatus", paymentProbe.status);
            out.put("paymentLookupOk", paymentProbe.ok);
            out.put("paymentBodyPreview", truncate(paymentProbe.body, 800));
        }

        boolean ok = Boolean.TRUE.equals(out.get("probeOk"));
        out.put("ok", ok);

        return ResponseEntity.status(ok ? HttpStatus.OK : HttpStatus.BAD_GATEWAY).body(out);
    }

    /**
     * Lista cobranças no Asaas por externalReference = tenantId do usuário autenticado.
     * Útil para encontrar um pay_* válido para sincronização.
     */
    @GetMapping("/payments/by-tenant")
    public ResponseEntity<Map<String, Object>> listPaymentsByTenant(
            @AuthenticationPrincipal UserContext user,
            @RequestParam(name = "limit", defaultValue = "10") int limit
    ) {
        if (user == null || !StringUtils.hasText(user.getTenantId())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("ok", false, "error", "Sem tenant no contexto"));
        }

        String apiKey = gatewayConfig.getAsaas().getApiKey();
        if (!StringUtils.hasText(apiKey)) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("ok", false, "error", "ASAAS apiKey não configurada"));
        }

        String endpoint = "/payments?externalReference=" + user.getTenantId() + "&limit=" + Math.max(1, Math.min(limit, 50));
        ProbeResult probe = probe(endpoint);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", probe.ok);
        out.put("environment", gatewayConfig.getAsaas().getEnvironment());
        out.put("baseUrl", gatewayConfig.getAsaas().getBaseUrl());
        out.put("tenantId", user.getTenantId());
        out.put("endpoint", probe.endpoint);
        out.put("status", probe.status);
        out.put("bodyPreview", truncate(probe.body, 1500));

        return ResponseEntity.status(probe.ok ? HttpStatus.OK : HttpStatus.BAD_GATEWAY).body(out);
    }

    private ProbeResult probe(String endpoint) {
        try {
            String body = asaasWebClient.get()
                    .uri(endpoint)
                    .header("access_token", gatewayConfig.getAsaas().getApiKey())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return new ProbeResult(endpoint, 200, true, body);
        } catch (WebClientResponseException e) {
            return new ProbeResult(endpoint, e.getRawStatusCode(), false, e.getResponseBodyAsString());
        } catch (Exception e) {
            return new ProbeResult(endpoint, -1, false, e.getMessage());
        }
    }

    private static String truncate(String text, int max) {
        if (text == null) return null;
        if (text.length() <= max) return text;
        return text.substring(0, max) + "...";
    }

    private record ProbeResult(String endpoint, int status, boolean ok, String body) {}
}
