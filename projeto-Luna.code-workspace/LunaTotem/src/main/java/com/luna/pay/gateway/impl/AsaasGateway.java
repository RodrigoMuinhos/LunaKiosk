package com.luna.pay.gateway.impl;

import com.luna.pay.common.exception.GatewayException;
import com.luna.pay.gateway.*;
import com.luna.pay.gateway.dto.asaas.*;
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
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Implementação real do gateway Asaas com integração via API.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AsaasGateway implements PaymentGateway {

    private final GatewayConfig gatewayConfig;
    private final WebClient asaasWebClient;

    @Override
    public String getGatewayName() {
        return "ASAAS";
    }

    @Override
    public boolean isEnabled() {
        return gatewayConfig.getAsaas().isEnabled();
    }

    @Override
    public GatewayPaymentResult createPayment(CreatePaymentRequest request, String tenantId) {
        log.debug("[ASAAS] Criando pagamento real para tenant {}", tenantId);

        if (!isEnabled()) {
            throw new GatewayException("ASAAS", "Gateway Asaas não está habilitado");
        }

        try {
            // 1. Cria ou obtém cliente no Asaas
            String customerId = createOrGetCustomer(request, tenantId);

            // 2. Mapeia tipo de pagamento
            String billingType = mapPaymentMethodToBillingType(request.getPaymentMethod());

            // 3. Cria cobrança
            AsaasCreatePaymentRequest asaasRequest = AsaasCreatePaymentRequest.builder()
                    .customer(customerId)
                    .billingType(billingType)
                    .value(request.getAmount())
                    .dueDate(LocalDate.now().plusDays(3).format(DateTimeFormatter.ISO_DATE))
                    .description(request.getDescription())
                    .externalReference(tenantId)
                    .build();

            // Adiciona dados de cartão se aplicável
            if (request.getCardData() != null && "CREDIT_CARD".equals(billingType)) {
                asaasRequest.setCreditCard(AsaasCreatePaymentRequest.AsaasCreditCard.builder()
                        .holderName(request.getCardData().getHolderName())
                        .number(request.getCardData().getNumber())
                        .expiryMonth(request.getCardData().getExpiryMonth())
                        .expiryYear(request.getCardData().getExpiryYear())
                        .ccv(request.getCardData().getCvv())
                        .build());

                if (request.getCustomer() != null) {
                    asaasRequest.setCreditCardHolderInfo(AsaasCreatePaymentRequest.AsaasCreditCardHolderInfo.builder()
                            .name(request.getCustomer().getName())
                            .email(request.getCustomer().getEmail())
                            .cpfCnpj(request.getCustomer().getCpfCnpj())
                            .phone(request.getCustomer().getPhone())
                            .postalCode("00000-000")
                            .addressNumber("S/N")
                            .build());
                }
            }

            // POST para API Asaas
            AsaasCreatePaymentResponse response = asaasWebClient.post()
                    .uri("/payments")
                    .header("access_token", gatewayConfig.getAsaas().getApiKey())
                    .bodyValue(asaasRequest)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new GatewayException("ASAAS",
                                    "Erro na API Asaas: " + errorBody))))
                    .bodyToMono(AsaasCreatePaymentResponse.class)
                    .doOnNext(r -> log.debug("[ASAAS] Resposta pagamento: id={}, pixTxn={}, boletoUrl={}, identificationField={}",
                    r.getId(),
                    r.getPixTransaction() != null ? "present" : "null",
                    r.getBankSlipUrl(),
                    r.getIdentificationField()))
                    .block();

            if (response == null || response.getId() == null) {
                throw new GatewayException("ASAAS", "Resposta inválida da API Asaas");
            }

            // Mapeia response para resultado
            GatewayPaymentResult.GatewayPaymentResultBuilder builder = GatewayPaymentResult.builder()
                    .success(true)
                    .gatewayPaymentId(response.getId())
                    .paymentMethod(request.getPaymentMethod())
                    .amount(request.getAmount());

            // Adiciona dados específicos do método
            if ("PIX".equals(billingType) && response.getPixTransaction() != null) {
                builder.pixQrCode(response.getPixTransaction().getQrCode())
                        .pixCopyPaste(response.getPixTransaction().getPayload())
                        .pixExpiresAt(response.getPixTransaction().getExpirationDate());
            } else if ("BOLETO".equals(billingType)) {
                builder.boletoBarCode(response.getIdentificationField())
                        .boletoUrl(response.getBankSlipUrl());
            }

            log.info("[ASAAS] Pagamento criado com sucesso: {}", response.getId());
            return builder.build();

        } catch (Exception e) {
            log.error("[ASAAS] Erro ao criar pagamento", e);
            throw new GatewayException("ASAAS", "Falha ao criar pagamento: " + e.getMessage());
        }
    }

    private String createOrGetCustomer(CreatePaymentRequest request, String tenantId) {
        if (request.getCustomer() == null) {
            throw new GatewayException("ASAAS", "Dados do cliente são obrigatórios");
        }

        try {
            AsaasCustomerRequest customerRequest = AsaasCustomerRequest.builder()
                    .name(request.getCustomer().getName())
                    .cpfCnpj(request.getCustomer().getCpfCnpj())
                    .email(request.getCustomer().getEmail())
                    .phone(request.getCustomer().getPhone())
                    .mobilePhone(request.getCustomer().getPhone())
                    .externalReference(tenantId + "_" + request.getCustomer().getCpfCnpj())
                    .build();

            AsaasCustomerResponse response = asaasWebClient.post()
                    .uri("/customers")
                    .header("access_token", gatewayConfig.getAsaas().getApiKey())
                    .bodyValue(customerRequest)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> {
                                        String sanitized = errorBody == null ? "" : errorBody.replaceAll("\\s+", " ").trim();
                                        if (sanitized.length() > 500) {
                                            sanitized = sanitized.substring(0, 500) + "...";
                                        }
                                        log.warn("[ASAAS] Falha ao criar cliente (status {}). Body (trunc): {}",
                                                clientResponse.statusCode().value(),
                                                sanitized);
                                        return Mono.error(new GatewayException("ASAAS", "Erro ao criar cliente: " + sanitized));
                                    }))
                    .bodyToMono(AsaasCustomerResponse.class)
                    .doOnNext(r -> log.debug("[ASAAS] Resposta cliente: id={}, cpfCnpj={} email={}",
                    r.getId(),
                    customerRequest.getCpfCnpj(),
                    customerRequest.getEmail()))
                    .block();

            if (response == null || response.getId() == null) {
                throw new GatewayException("ASAAS", "Resposta inválida ao criar cliente");
            }

            log.debug("[ASAAS] Cliente criado com sucesso: {}", response.getId());
            return response.getId();

        } catch (Exception e) {
            log.error("[ASAAS] Erro ao criar/obter cliente: {}", e.getMessage(), e);
            throw new GatewayException("ASAAS", "Falha ao criar cliente: " + e.getMessage());
        }
    }

    private String mapPaymentMethodToBillingType(String paymentMethod) {
        return switch (paymentMethod.toUpperCase()) {
            case "PIX" ->
                "PIX";
            case "BOLETO" ->
                "BOLETO";
            case "CREDIT_CARD" ->
                "CREDIT_CARD";
            case "DEBIT_CARD" ->
                "DEBIT_CARD";
            default ->
                "UNDEFINED";
        };
    }

    @Override
    public GatewayPaymentStatus getPaymentStatus(String gatewayPaymentId) {
        log.debug("[ASAAS] Consultando status do pagamento: {}", gatewayPaymentId);

        try {
            AsaasPaymentStatusResponse response = asaasWebClient.get()
                    .uri("/payments/{id}", gatewayPaymentId)
                    .header("access_token", gatewayConfig.getAsaas().getApiKey())
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new GatewayException("ASAAS",
                                    "Erro ao consultar pagamento: " + errorBody))))
                    .bodyToMono(AsaasPaymentStatusResponse.class)
                    .block();

            if (response == null) {
                throw new GatewayException("ASAAS", "Resposta vazia da API Asaas");
            }

            // Mapeia status do Asaas para PaymentStatus interno
            PaymentStatus internalStatus = mapAsaasStatus(response.getStatus());

            return GatewayPaymentStatus.builder()
                    .gatewayPaymentId(gatewayPaymentId)
                    .status(internalStatus)
                    .gatewayStatus(response.getStatus())
                    .message("Status: " + response.getStatus())
                    .build();

        } catch (Exception e) {
            log.error("[ASAAS] Erro ao consultar status", e);
            throw new GatewayException("ASAAS", "Falha ao consultar status: " + e.getMessage());
        }
    }

    private PaymentStatus mapAsaasStatus(String asaasStatus) {
        if (asaasStatus == null) {
            return PaymentStatus.PENDING;
        }

        return switch (asaasStatus.toUpperCase()) {
            case "CONFIRMED", "RECEIVED" ->
                PaymentStatus.PAID;
            case "PENDING", "AWAITING_RISK_ANALYSIS" ->
                PaymentStatus.PENDING;
            case "REFUNDED", "REFUND_REQUESTED" ->
                PaymentStatus.CANCELED;
            case "OVERDUE", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE" ->
                PaymentStatus.FAILED;
            default ->
                PaymentStatus.PENDING;
        };
    }

    @Override
    public boolean cancelPayment(String gatewayPaymentId) {
        log.info("[ASAAS STUB] Cancelando pagamento: {}", gatewayPaymentId);

        // TODO: Implementar cancelamento real na API Asaas
        return true;
    }

    @Override
    public boolean validateWebhook(String signature, String payload) {
        log.debug("[ASAAS] Validando assinatura do webhook");

        try {
            String secret = gatewayConfig.getAsaas().getWebhookSecret();
            if (secret == null || secret.isBlank()) {
                log.warn("[ASAAS] Webhook secret não configurado, pulando validação");
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
            log.debug("[ASAAS] Assinatura válida: {}", valid);
            return valid;

        } catch (Exception e) {
            log.error("[ASAAS] Erro ao validar webhook", e);
            return false;
        }
    }

    @Override
    public WebhookProcessingResult processWebhook(String payload) {
        log.debug("[ASAAS] Processando webhook");

        try {
            // Parse JSON do webhook (estrutura simplificada - ajustar conforme docs Asaas)
            if (payload.contains("\"payment\"") && payload.contains("\"event\"")) {
                // Extrai ID do pagamento e evento
                String paymentId = extractJsonValue(payload, "id");
                String event = extractJsonValue(payload, "event");

                // Mapeia evento para status
                PaymentStatus newStatus = mapEventToStatus(event);

                return WebhookProcessingResult.builder()
                        .success(true)
                        .paymentId(paymentId)
                        .newStatus(newStatus)
                        .message("Webhook processado: " + event)
                        .build();
            }

            return WebhookProcessingResult.builder()
                    .success(false)
                    .message("Payload inválido")
                    .build();

        } catch (Exception e) {
            log.error("[ASAAS] Erro ao processar webhook", e);
            return WebhookProcessingResult.builder()
                    .success(false)
                    .message("Erro: " + e.getMessage())
                    .build();
        }
    }

    private PaymentStatus mapEventToStatus(String event) {
        if (event == null) {
            return PaymentStatus.PENDING;
        }

        return switch (event.toUpperCase()) {
            case "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED" ->
                PaymentStatus.PAID;
            case "PAYMENT_OVERDUE", "PAYMENT_DELETED" ->
                PaymentStatus.FAILED;
            case "PAYMENT_REFUNDED" ->
                PaymentStatus.CANCELED;
            default ->
                PaymentStatus.PENDING;
        };
    }

    private String extractJsonValue(String json, String key) {
        // Extração simplificada - usar ObjectMapper em produção
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start == -1) {
            return null;
        }
        start += search.length();
        int end = json.indexOf("\"", start);
        return end == -1 ? null : json.substring(start, end);
    }
}
