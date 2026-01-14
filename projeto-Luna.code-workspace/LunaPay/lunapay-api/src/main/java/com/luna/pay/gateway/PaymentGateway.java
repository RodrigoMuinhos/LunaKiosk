package com.luna.pay.gateway;

import com.luna.pay.payment.dto.CreatePaymentRequest;
import com.luna.pay.payment.dto.PaymentResponse;

/**
 * Interface base para todos os gateways de pagamento
 */
public interface PaymentGateway {

    /**
     * Retorna o nome do gateway (ASAAS, C6, etc)
     */
    String getGatewayName();

    /**
     * Verifica se o gateway está habilitado
     */
    boolean isEnabled();

    /**
     * Cria um pagamento no gateway
     */
    GatewayPaymentResult createPayment(CreatePaymentRequest request, String tenantId);

    /**
     * Consulta status de um pagamento
     */
    GatewayPaymentStatus getPaymentStatus(String gatewayPaymentId);

    /**
     * Cancela um pagamento
     */
    boolean cancelPayment(String gatewayPaymentId);

    /**
     * Valida webhook do gateway
     */
    boolean validateWebhook(String signature, String payload);

    /**
     * Processa webhook recebido
     */
    WebhookProcessingResult processWebhook(String payload);
}
