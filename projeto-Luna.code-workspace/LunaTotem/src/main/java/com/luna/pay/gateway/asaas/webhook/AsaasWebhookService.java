package com.luna.pay.gateway.asaas.webhook;

import com.luna.pay.gateway.asaas.webhook.dto.AsaasWebhookEvent;
import com.luna.pay.payment.Payment;
import com.luna.pay.payment.PaymentRepository;
import com.luna.pay.payment.PaymentStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class AsaasWebhookService {

    private final PaymentRepository paymentRepository;

    @Value("${payment.gateways.asaas.webhookSecret:}")
    private String webhookSecret;

    public boolean isValidToken(String token) {
        if (!StringUtils.hasText(webhookSecret) || !StringUtils.hasText(token)) {
            return false;
        }

        String trimmedToken = token.trim();
        String trimmedSecret = webhookSecret.trim();

        return trimmedSecret.equals(trimmedToken);
    }

    public void process(AsaasWebhookEvent evt) {
        if (evt == null || evt.payment() == null || !StringUtils.hasText(evt.payment().id())) {
            log.warn("Evento webhook Asaas inválido ou sem payment.id");
            return;
        }

        String event = evt.event();
        String asaasPaymentId = evt.payment().id();

        PaymentStatus newStatus = mapEventToStatus(event);

        log.debug("Webhook Asaas recebido: event={}, asaasPaymentId={}, mappedStatus={}",
                event, asaasPaymentId, newStatus);

        if (newStatus == null) {
            log.debug("Evento '{}' não mapeado, ignorando", event);
            return;
        }

        paymentRepository.findByGatewayPaymentId(asaasPaymentId).ifPresentOrElse(p -> {
            PaymentStatus oldStatus = p.getStatus();
            p.setStatus(newStatus);
            paymentRepository.save(p);
            log.debug("Pagamento atualizado: id={}, tenantId={}, {} -> {}",
                    p.getId(), p.getTenantId(), oldStatus, newStatus);
        }, () -> log.warn("Pagamento local não encontrado para gatewayPaymentId={}", asaasPaymentId));
    }

    /**
     * Mapeia os eventos do Asaas para o PaymentStatus local.
     *
     * Eventos Asaas principais: - PAYMENT_CREATED: Cobrança criada -
     * PAYMENT_AWAITING_RISK_ANALYSIS: Aguardando análise de risco -
     * PAYMENT_APPROVED_BY_RISK_ANALYSIS: Aprovado pela análise -
     * PAYMENT_REPROVED_BY_RISK_ANALYSIS: Reprovado pela análise -
     * PAYMENT_CONFIRMED: Pagamento confirmado (PIX/boleto compensado) -
     * PAYMENT_RECEIVED: Pagamento recebido - PAYMENT_OVERDUE: Vencido -
     * PAYMENT_DELETED: Cobrança deletada - PAYMENT_REFUNDED: Estornado
     */
    private PaymentStatus mapEventToStatus(String event) {
        if (!StringUtils.hasText(event)) {
            return null;
        }

        return switch (event) {
            case "PAYMENT_CREATED" ->
                PaymentStatus.PENDING;
            case "PAYMENT_AWAITING_RISK_ANALYSIS" ->
                PaymentStatus.PENDING;
            case "PAYMENT_APPROVED_BY_RISK_ANALYSIS" ->
                PaymentStatus.PENDING;
            case "PAYMENT_REPROVED_BY_RISK_ANALYSIS" ->
                PaymentStatus.FAILED;
            case "PAYMENT_CONFIRMED" ->
                PaymentStatus.PAID;
            case "PAYMENT_RECEIVED" ->
                PaymentStatus.PAID;
            case "PAYMENT_OVERDUE" ->
                PaymentStatus.FAILED;
            case "PAYMENT_DELETED" ->
                PaymentStatus.CANCELED;
            case "PAYMENT_REFUNDED" ->
                PaymentStatus.CANCELED;
            default ->
                null;
        };
    }
}
