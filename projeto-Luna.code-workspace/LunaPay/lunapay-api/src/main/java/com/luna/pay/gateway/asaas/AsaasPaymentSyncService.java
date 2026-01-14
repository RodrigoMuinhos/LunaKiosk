package com.luna.pay.gateway.asaas;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luna.pay.common.exception.GatewayException;
import com.luna.pay.gateway.GatewayConfig;
import com.luna.pay.payment.PaymentStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class AsaasPaymentSyncService {

    private final GatewayConfig gatewayConfig;
    private final WebClient asaasWebClient;
    private final ObjectMapper objectMapper;

    public AsaasPaymentSnapshot fetchPayment(String gatewayPaymentId) {
        if (!gatewayConfig.getAsaas().isEnabled()) {
            throw new GatewayException("ASAAS", "Gateway Asaas não está habilitado");
        }
        String apiKey = gatewayConfig.getAsaas().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new GatewayException("ASAAS", "ASAAS apiKey não configurada");
        }

        try {
            String body = asaasWebClient.get()
                    .uri("/payments/{id}", gatewayPaymentId)
                    .header("access_token", apiKey)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            if (body == null || body.isBlank()) {
                throw new GatewayException("ASAAS", "Resposta vazia ao consultar pagamento");
            }

            JsonNode json = objectMapper.readTree(body);
            String id = text(json, "id");
            String status = text(json, "status");
            String billingType = text(json, "billingType");
            String description = text(json, "description");
            String externalReference = text(json, "externalReference");

            BigDecimal value = null;
            if (json.hasNonNull("value")) {
                value = json.get("value").decimalValue();
            }

            return new AsaasPaymentSnapshot(
                    id,
                    value,
                    description,
                    billingType,
                    status,
                    externalReference,
                    mapAsaasStatus(status)
            );
        } catch (WebClientResponseException e) {
            throw new GatewayException("ASAAS", "Erro ao consultar pagamento no Asaas: " + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new GatewayException("ASAAS", "Falha ao consultar pagamento no Asaas: " + e.getMessage());
        }
    }

    private static String text(JsonNode json, String field) {
        return json.hasNonNull(field) ? json.get(field).asText() : null;
    }

    private static PaymentStatus mapAsaasStatus(String asaasStatus) {
        if (asaasStatus == null) return PaymentStatus.PENDING;

        return switch (asaasStatus.toUpperCase()) {
            case "CONFIRMED", "RECEIVED" -> PaymentStatus.PAID;
            case "PENDING", "AWAITING_RISK_ANALYSIS" -> PaymentStatus.PENDING;
            case "REFUNDED", "REFUND_REQUESTED" -> PaymentStatus.CANCELED;
            case "OVERDUE", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE" -> PaymentStatus.FAILED;
            default -> PaymentStatus.PENDING;
        };
    }

    public record AsaasPaymentSnapshot(
            String id,
            BigDecimal value,
            String description,
            String billingType,
            String status,
            String externalReference,
            PaymentStatus mappedStatus
    ) {}
}
