package com.luna.pay.gateway.impl;

import com.luna.pay.common.exception.GatewayException;
import com.luna.pay.gateway.*;
import com.luna.pay.gateway.dto.asaas.*;
import com.luna.pay.payment.PaymentStatus;
import com.luna.pay.payment.dto.CreatePaymentRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.binary.Hex;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

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
        log.info("[ASAAS] Criando pagamento real para tenant {}", tenantId);
        log.debug("[ASAAS] API Key configurada: {}", gatewayConfig.getAsaas().getApiKey() != null && !gatewayConfig.getAsaas().getApiKey().isBlank());

        if (!isEnabled()) {
            throw new GatewayException("ASAAS", "Gateway Asaas não está habilitado");
        }

        try {
            // 1. Cria ou obtém cliente no Asaas
            String customerId = createOrGetCustomer(request, tenantId);

            // 2. Mapeia tipo de pagamento
            String billingType = mapPaymentMethodToBillingType(request.getPaymentMethod());

            // 3. Cria cobranca
            AsaasCreatePaymentRequest.AsaasCreatePaymentRequestBuilder asaasRequestBuilder = AsaasCreatePaymentRequest.builder()
                    .customer(customerId)
                    .billingType(billingType)
                    .value(request.getAmount())
                    .dueDate(LocalDate.now().plusDays(3).format(DateTimeFormatter.ISO_DATE))
                    .description(request.getDescription())
                    .externalReference(tenantId);

            if ("CREDIT_CARD".equals(billingType) && request.getCardData() != null) {
                asaasRequestBuilder.creditCard(AsaasCreatePaymentRequest.AsaasCreditCard.builder()
                        .holderName(request.getCardData().getHolderName())
                        .number(request.getCardData().getNumber())
                        .expiryMonth(request.getCardData().getExpiryMonth())
                        .expiryYear(request.getCardData().getExpiryYear())
                        .ccv(request.getCardData().getCvv())
                        .build());

                if (request.getCustomer() != null) {
                    asaasRequestBuilder.creditCardHolderInfo(AsaasCreatePaymentRequest.AsaasCreditCardHolderInfo.builder()
                            .name(request.getCustomer().getName())
                            .email(request.getCustomer().getEmail())
                            .cpfCnpj(request.getCustomer().getCpfCnpj())
                            .phone(request.getCustomer().getPhone())
                            .build());
                }
            }

            AsaasCreatePaymentRequest asaasRequest = asaasRequestBuilder.build();

            AsaasCreatePaymentResponse response = asaasWebClient.post()
                    .uri("/payments")
                    .header("access_token", gatewayConfig.getAsaas().getApiKey())
                    .bodyValue(asaasRequest)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new GatewayException("ASAAS",
                                            "Erro ao criar pagamento: " + errorBody))))
                    .bodyToMono(AsaasCreatePaymentResponse.class)
                    .block();

            if (response == null || response.getId() == null) {
                throw new GatewayException("ASAAS", "Resposta invalida da API Asaas");
            }

            boolean success = "PENDING".equalsIgnoreCase(response.getStatus())
                    || "CONFIRMED".equalsIgnoreCase(response.getStatus())
                    || "RECEIVED".equalsIgnoreCase(response.getStatus());

            GatewayPaymentResult.GatewayPaymentResultBuilder builder = GatewayPaymentResult.builder()
                    .success(success)
                    .gatewayPaymentId(response.getId())
                    .paymentMethod(request.getPaymentMethod())
                    .amount(request.getAmount());

            // Adiciona dados especificos do metodo
            if ("PIX".equals(billingType)) {
                if (response.getPixTransaction() != null) {
                    builder.pixQrCode(response.getPixTransaction().getQrCode())
                           .pixCopyPaste(response.getPixTransaction().getPayload())
                           .pixExpiresAt(response.getPixTransaction().getExpirationDate());
                }
                // Asaas often returns PIX QR code in a separate endpoint.
                AsaasPixQrCodeResponse pixQr = fetchPixQrCode(response.getId());
                if (pixQr != null) {
                    if (pixQr.getEncodedImage() != null && !pixQr.getEncodedImage().isBlank()) {
                        builder.pixQrCodeBase64(pixQr.getEncodedImage());
                    }
                    if (pixQr.getPayload() != null && !pixQr.getPayload().isBlank()) {
                        builder.pixCopyPaste(pixQr.getPayload());
                        builder.pixQrCode(pixQr.getPayload());
                    }
                    Instant pixExpiration = parsePixExpiration(pixQr.getExpirationDate());
                    if (pixExpiration != null) {
                        builder.pixExpiresAt(pixExpiration);
                    }
                }
            } else if ("BOLETO".equals(billingType)) {
                builder.boletoBarCode(response.getIdentificationField())
                       .boletoUrl(response.getBankSlipUrl());
            }

            log.info("[ASAAS] Pagamento criado com sucesso: {}", response.getId());
            return builder.build();

        } catch (GatewayException e) {
            // Preserva a mensagem original (incluindo body do Asaas quando aplicável)
            throw e;
        } catch (Exception e) {
            log.error("[ASAAS] Erro ao criar pagamento", e);
            throw new GatewayException("ASAAS", "Falha ao criar pagamento: " + e.getMessage());
        }
    }

    private Instant parsePixExpiration(String expirationDate) {
        if (expirationDate == null || expirationDate.isBlank()) {
            return null;
        }
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
            LocalDateTime parsed = LocalDateTime.parse(expirationDate, formatter);
            return parsed.atZone(ZoneId.systemDefault()).toInstant();
        } catch (Exception ignore) {
            try {
                return Instant.parse(expirationDate);
            } catch (Exception ignored) {
                log.warn("[ASAAS] Formato de expirationDate inesperado: {}", expirationDate);
                return null;
            }
        }
    }
    private AsaasPixQrCodeResponse fetchPixQrCode(String paymentId) {
        try {
            return asaasWebClient.get()
                    .uri("/payments/{id}/pixQrCode", paymentId)
                    .header("access_token", gatewayConfig.getAsaas().getApiKey())
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new GatewayException("ASAAS",
                                            "Erro ao obter QR Code: " + errorBody))))
                    .bodyToMono(AsaasPixQrCodeResponse.class)
                    .block();
        } catch (GatewayException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[ASAAS] Falha ao obter QR Code: {}", e.getMessage());
            return null;
        }
    }

    private String createOrGetCustomer(CreatePaymentRequest request, String tenantId) {
        if (request.getCustomer() == null) {
            throw new GatewayException("ASAAS", "Dados do cliente são obrigatórios");
        }

        String cpfCnpj = request.getCustomer().getCpfCnpj();
        if (cpfCnpj == null || cpfCnpj.isBlank()) {
            throw new GatewayException("ASAAS", "cpfCnpj do cliente é obrigatório");
        }

        String externalReference = tenantId + "_" + cpfCnpj;

        // Tenta reusar um customer já existente para evitar erro em tentativas repetidas
        String existing = findCustomerIdByExternalReference(externalReference);
        if (existing != null) {
            log.info("[ASAAS] Cliente já existe para externalReference={}, reutilizando id={}", externalReference, existing);
            return existing;
        }

        existing = findCustomerIdByCpfCnpj(cpfCnpj);
        if (existing != null) {
            log.info("[ASAAS] Cliente já existe para cpfCnpj={}, reutilizando id={}", cpfCnpj, existing);
            return existing;
        }

        try {
            AsaasCustomerRequest customerRequest = AsaasCustomerRequest.builder()
                    .name(request.getCustomer().getName())
                    .cpfCnpj(cpfCnpj)
                    .email(request.getCustomer().getEmail())
                    .phone(request.getCustomer().getPhone())
                    .mobilePhone(request.getCustomer().getPhone())
                    .externalReference(externalReference)
                    .build();

            AsaasCustomerResponse response = asaasWebClient.post()
                    .uri("/customers")
                    .header("access_token", gatewayConfig.getAsaas().getApiKey())
                    .bodyValue(customerRequest)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> {
                                        log.error("[ASAAS] Erro ao criar cliente - Body: {}", errorBody);
                                        return Mono.error(new GatewayException("ASAAS", "Erro ao criar cliente: " + errorBody));
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

            log.info("[ASAAS] Cliente criado com sucesso: {}", response.getId());
            return response.getId();

        } catch (GatewayException e) {
            throw e;
        } catch (Exception e) {
            log.error("[ASAAS] Erro ao criar/obter cliente: {}", e.getMessage(), e);
            throw new GatewayException("ASAAS", "Falha ao criar cliente: " + e.getMessage());
        }
    }

    private String findCustomerIdByExternalReference(String externalReference) {
        try {
            var response = asaasWebClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/customers")
                            .queryParam("externalReference", externalReference)
                            .queryParam("limit", 1)
                            .build())
                    .header("access_token", gatewayConfig.getAsaas().getApiKey())
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new GatewayException("ASAAS",
                                            "Erro ao buscar cliente por externalReference: " + errorBody))))
                    .bodyToMono(new ParameterizedTypeReference<AsaasListResponse<AsaasCustomerResponse>>() {})
                    .block();

            if (response == null || response.getData() == null || response.getData().isEmpty()) {
                return null;
            }

            return response.getData().getFirst().getId();
        } catch (GatewayException e) {
            // Não falha o fluxo principal por erro de lookup; apenas loga e tenta criar.
            log.warn("[ASAAS] Falha ao buscar cliente por externalReference: {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("[ASAAS] Erro inesperado ao buscar cliente por externalReference: {}", e.getMessage());
            return null;
        }
    }

    private String findCustomerIdByCpfCnpj(String cpfCnpj) {
        try {
            var response = asaasWebClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/customers")
                            .queryParam("cpfCnpj", cpfCnpj)
                            .queryParam("limit", 1)
                            .build())
                    .header("access_token", gatewayConfig.getAsaas().getApiKey())
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            clientResponse -> clientResponse.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new GatewayException("ASAAS",
                                            "Erro ao buscar cliente por cpfCnpj: " + errorBody))))
                    .bodyToMono(new ParameterizedTypeReference<AsaasListResponse<AsaasCustomerResponse>>() {})
                    .block();

            if (response == null || response.getData() == null || response.getData().isEmpty()) {
                return null;
            }

            return response.getData().getFirst().getId();
        } catch (GatewayException e) {
            log.warn("[ASAAS] Falha ao buscar cliente por cpfCnpj: {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("[ASAAS] Erro inesperado ao buscar cliente por cpfCnpj: {}", e.getMessage());
            return null;
        }
    }

    private String mapPaymentMethodToBillingType(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            throw new GatewayException("ASAAS", "Método de pagamento é obrigatório");
        }

        return switch (paymentMethod.toUpperCase()) {
            case "PIX" -> "PIX";
            case "BOLETO" -> "BOLETO";
            case "CREDIT_CARD" -> "CREDIT_CARD";
            case "DEBIT_CARD" -> "DEBIT_CARD";
            default -> throw new GatewayException("ASAAS", "Método de pagamento não suportado: " + paymentMethod);
        };
    }

    private static class AsaasListResponse<T> {
        private List<T> data;

        public List<T> getData() {
            return data;
        }

        public void setData(List<T> data) {
            this.data = data;
        }
    }

    @Override
    public GatewayPaymentStatus getPaymentStatus(String gatewayPaymentId) {
        log.info("[ASAAS] Consultando status do pagamento: {}", gatewayPaymentId);

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
        if (asaasStatus == null) return PaymentStatus.PENDING;
        
        return switch (asaasStatus.toUpperCase()) {
            case "CONFIRMED", "RECEIVED" -> PaymentStatus.PAID;
            case "PENDING", "AWAITING_RISK_ANALYSIS" -> PaymentStatus.PENDING;
            case "REFUNDED", "REFUND_REQUESTED" -> PaymentStatus.CANCELED;
            case "OVERDUE", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE" -> PaymentStatus.FAILED;
            default -> PaymentStatus.PENDING;
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
        log.info("[ASAAS] Validando assinatura do webhook");

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
            log.info("[ASAAS] Assinatura válida: {}", valid);
            return valid;

        } catch (Exception e) {
            log.error("[ASAAS] Erro ao validar webhook", e);
            return false;
        }
    }

    @Override
    public WebhookProcessingResult processWebhook(String payload) {
        log.info("[ASAAS] Processando webhook");

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
        if (event == null) return PaymentStatus.PENDING;
        
        return switch (event.toUpperCase()) {
            case "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED" -> PaymentStatus.PAID;
            case "PAYMENT_OVERDUE", "PAYMENT_DELETED" -> PaymentStatus.FAILED;
            case "PAYMENT_REFUNDED" -> PaymentStatus.CANCELED;
            default -> PaymentStatus.PENDING;
        };
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

