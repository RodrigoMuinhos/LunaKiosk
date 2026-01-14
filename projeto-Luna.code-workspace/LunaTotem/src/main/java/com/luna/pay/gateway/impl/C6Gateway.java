package com.luna.pay.gateway.impl;

import com.luna.pay.common.exception.GatewayException;
import com.luna.pay.gateway.*;
import com.luna.pay.gateway.dto.c6.*;
import com.luna.pay.payment.PaymentStatus;
import com.luna.pay.payment.dto.CreatePaymentRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.binary.Hex;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * Implementação real do gateway C6 Bank com integração via API.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class C6Gateway implements PaymentGateway {

    private final GatewayConfig gatewayConfig;
    private final WebClient c6WebClient;

    @Override
    public String getGatewayName() {
        return "C6";
    }

    @Override
    public boolean isEnabled() {
        return gatewayConfig.getC6().isEnabled();
    }

    @Override
    public GatewayPaymentResult createPayment(CreatePaymentRequest request, String tenantId) {
        log.info("[C6] Criando pagamento real para tenant {}", tenantId);

        if (!isEnabled()) {
            throw new GatewayException("C6", "Gateway C6 não está habilitado");
        }

        try {
            // Mapeia request para DTO da API C6
            C6CreatePaymentRequest.C6CreatePaymentRequestBuilder c6RequestBuilder = C6CreatePaymentRequest.builder()
                    .amount(request.getAmount())
                    .paymentMethod(request.getPaymentMethod())
                    .pixExpirationMinutes(request.getPixExpirationMinutes());

            // Adiciona dados do cliente se disponível
            if (request.getCustomer() != null) {
                c6RequestBuilder.customer(C6CreatePaymentRequest.C6Customer.builder()
                        .name(request.getCustomer().getName())
                        .email(request.getCustomer().getEmail())
                        .document(request.getCustomer().getCpfCnpj())
                        .phone(request.getCustomer().getPhone())
                        .build());
            }

            C6CreatePaymentRequest c6Request = c6RequestBuilder.build();

            // Adiciona dados de cartão se aplicável
            if (request.getCardData() != null) {
                c6Request.setCardData(C6CreatePaymentRequest.C6CardData.builder()
                        .cardNumber(request.getCardData().getNumber())
                        .holderName(request.getCardData().getHolderName())
                        .expiryMonth(request.getCardData().getExpiryMonth())
                        .expiryYear(request.getCardData().getExpiryYear())
                        .cvv(request.getCardData().getCvv())
                        .installments(1) // Default 1 parcela
                        .build());
            }

            // Faz POST para API C6
            C6CreatePaymentResponse response = c6WebClient.post()
                    .uri("/payments")
                    .header("Authorization", "Bearer " + gatewayConfig.getC6().getApiKey())
                    .header("X-Tenant-ID", tenantId)
                    .bodyValue(c6Request)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new GatewayException("C6", 
                                            "Erro na API C6: " + errorBody))))
                    .bodyToMono(C6CreatePaymentResponse.class)
                    .block();

            if (response == null || response.getPaymentId() == null) {
                throw new GatewayException("C6", "Resposta inválida da API C6");
            }

            // Mapeia response para resultado
            GatewayPaymentResult.GatewayPaymentResultBuilder builder = GatewayPaymentResult.builder()
                    .success(response.getStatus().equals("SUCCESS") || response.getStatus().equals("PENDING"))
                    .gatewayPaymentId(response.getPaymentId())
                    .paymentMethod(request.getPaymentMethod())
                    .amount(request.getAmount());

            // Adiciona dados específicos do método
            if (response.getPixQrCode() != null) {
                builder.pixQrCode(response.getPixQrCode())
                       .pixCopyPaste(response.getPixCopyPaste())
                       .pixQrCodeBase64(response.getPixQrCodeBase64())
                       .pixExpiresAt(response.getPixExpiresAt());
            }
            if (response.getBoletoBarCode() != null) {
                builder.boletoBarCode(response.getBoletoBarCode())
                       .boletoUrl(response.getBoletoUrl())
                       .boletoExpiresAt(response.getBoletoExpiresAt());
            }
            if (response.getAuthorizationCode() != null) {
                builder.authorizationCode(response.getAuthorizationCode())
                       .nsu(response.getNsu());
            }

            log.info("[C6] Pagamento criado com sucesso: {}", response.getPaymentId());
            return builder.build();

        } catch (Exception e) {
            log.error("[C6] Erro ao criar pagamento", e);
            throw new GatewayException("C6", "Falha ao criar pagamento: " + e.getMessage());
        }
    }

    @Override
    public GatewayPaymentStatus getPaymentStatus(String gatewayPaymentId) {
        log.info("[C6] Consultando status do pagamento: {}", gatewayPaymentId);

        try {
            C6PaymentStatusResponse response = c6WebClient.get()
                    .uri("/payments/{paymentId}", gatewayPaymentId)
                    .header("Authorization", "Bearer " + gatewayConfig.getC6().getApiKey())
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new GatewayException("C6", 
                                            "Erro ao consultar pagamento: " + errorBody))))
                    .bodyToMono(C6PaymentStatusResponse.class)
                    .block();

            if (response == null) {
                throw new GatewayException("C6", "Resposta vazia da API C6");
            }

            // Mapeia status do C6 para PaymentStatus interno
            PaymentStatus internalStatus = mapC6Status(response.getStatus());

            return GatewayPaymentStatus.builder()
                    .gatewayPaymentId(gatewayPaymentId)
                    .status(internalStatus)
                    .gatewayStatus(response.getStatus())
                    .message(response.getMessage())
                    .build();

        } catch (Exception e) {
            log.error("[C6] Erro ao consultar status", e);
            throw new GatewayException("C6", "Falha ao consultar status: " + e.getMessage());
        }
    }

    private PaymentStatus mapC6Status(String c6Status) {
        if (c6Status == null) return PaymentStatus.PENDING;
        
        return switch (c6Status.toUpperCase()) {
            case "SUCCESS", "PAID", "CONFIRMED" -> PaymentStatus.PAID;
            case "PENDING", "WAITING_PAYMENT" -> PaymentStatus.PENDING;
            case "CANCELLED", "REFUNDED" -> PaymentStatus.CANCELED;
            case "FAILED", "ERROR" -> PaymentStatus.FAILED;
            default -> PaymentStatus.PENDING;
        };
    }

    @Override
    public boolean cancelPayment(String gatewayPaymentId) {
        log.info("[C6 STUB] Cancelando pagamento: {}", gatewayPaymentId);

        // TODO: Implementar cancelamento real na API C6

        return true;
    }

    @Override
    public boolean validateWebhook(String signature, String payload) {
        log.info("[C6] Validando assinatura do webhook");

        try {
            String secret = gatewayConfig.getC6().getWebhookSecret();
            if (secret == null || secret.isBlank()) {
                log.warn("[C6] Secret não configurado, pulando validação");
                return true;
            }

            // Calcula HMAC-SHA256 do payload
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKey);
            byte[] hash = hmac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            
            // Converte para hex
            String calculatedSignature = Hex.encodeHexString(hash);

            boolean valid = calculatedSignature.equalsIgnoreCase(signature);
            log.info("[C6] Assinatura válida: {}", valid);
            return valid;

        } catch (Exception e) {
            log.error("[C6] Erro ao validar webhook", e);
            return false;
        }
    }

    @Override
    public WebhookProcessingResult processWebhook(String payload) {
        log.info("[C6] Processando webhook");

        try {
            // Parse JSON do webhook (ajustar conforme estrutura real da API C6)
            // Exemplo simplificado - implementar com Jackson ObjectMapper
            if (payload.contains("\"paymentId\"") && payload.contains("\"status\"")) {
                // Extrai paymentId (simplificado - usar ObjectMapper em produção)
                String paymentId = extractJsonValue(payload, "paymentId");
                String newStatus = extractJsonValue(payload, "status");

                return WebhookProcessingResult.builder()
                        .success(true)
                        .paymentId(paymentId)
                        .newStatus(mapC6Status(newStatus))
                        .message("Webhook processado: " + newStatus)
                        .build();
            }

            return WebhookProcessingResult.builder()
                    .success(false)
                    .message("Payload inválido")
                    .build();

        } catch (Exception e) {
            log.error("[C6] Erro ao processar webhook", e);
            return WebhookProcessingResult.builder()
                    .success(false)
                    .message("Erro: " + e.getMessage())
                    .build();
        }
    }

    private String extractJsonValue(String json, String key) {
        // Extração simplificada - usar ObjectMapper em produção
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start == -1) return null;
        start += search.length();
        int end = json.indexOf("\"", start);
        return end == -1 ? null : json.substring(start, end);
    }
}
