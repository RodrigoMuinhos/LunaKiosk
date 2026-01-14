package com.luna.pay.gateway.asaas.webhook;

import com.luna.pay.gateway.asaas.webhook.dto.AsaasWebhookEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/webhooks/asaas")
public class AsaasWebhookController {

    private final AsaasWebhookService service;

    /**
     * Endpoint público para receber webhooks do Asaas.
     * 
     * Configuração no painel Asaas:
     * - URL: https://seu-dominio.com/webhooks/asaas
     * - Authentication Token: mesmo valor de ASAAS_WEBHOOK_SECRET
     * - Header: asaas-access-token
     * 
     * Eventos recomendados para habilitar:
     * - PAYMENT_CONFIRMED (pagamento confirmado)
     * - PAYMENT_RECEIVED (pagamento recebido)
     * - PAYMENT_OVERDUE (vencido)
     * - PAYMENT_DELETED (cancelado)
     * - PAYMENT_REFUNDED (estornado)
     */
    @PostMapping
    public ResponseEntity<Void> receive(
            @RequestHeader(value = "asaas-access-token", required = false) String asaasAccessToken,
            @RequestBody AsaasWebhookEvent body
    ) {
        log.debug("Webhook Asaas recebido: event={}, paymentId={}", 
                body != null ? body.event() : null,
                body != null && body.payment() != null ? body.payment().id() : null);

        if (!service.isValidToken(asaasAccessToken)) {
            log.warn("Webhook Asaas REJEITADO (token inválido). event={}, paymentId={}",
                    body != null ? body.event() : null,
                    body != null && body.payment() != null ? body.payment().id() : null
            );
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        service.process(body);
        return ResponseEntity.ok().build();
    }
}
