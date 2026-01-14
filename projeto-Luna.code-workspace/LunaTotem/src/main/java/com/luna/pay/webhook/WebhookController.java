package com.luna.pay.webhook;

import com.luna.pay.gateway.PaymentGateway;
import com.luna.pay.gateway.WebhookProcessingResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/webhooks")
@RequiredArgsConstructor
@Slf4j
public class WebhookController {

    private final List<PaymentGateway> paymentGateways;

    private Map<String, PaymentGateway> getGatewayMap() {
        return paymentGateways.stream()
                .collect(Collectors.toMap(
                        gateway -> gateway.getGatewayName().toLowerCase(),
                        Function.identity()
                ));
    }

    @PostMapping("/c6")
    public ResponseEntity<String> c6Webhook(
            @RequestHeader(value = "X-C6-Signature", required = false) String signature,
            @RequestBody String payload) {

        log.debug("Recebido webhook do C6");

        PaymentGateway gateway = getGatewayMap().get("c6");
        if (gateway == null || !gateway.isEnabled()) {
            log.warn("Gateway C6 não está habilitado");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body("Gateway not enabled");
        }

        // Valida assinatura
        if (signature != null && !gateway.validateWebhook(signature, payload)) {
            log.warn("Assinatura inválida no webhook C6");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
        }

        // Processa webhook
        WebhookProcessingResult result = gateway.processWebhook(payload);

        if (result.isSuccess()) {
            log.debug("Webhook C6 processado com sucesso: {}", result.getMessage());
            return ResponseEntity.ok("Webhook processed");
        } else {
            log.error("Erro ao processar webhook C6: {}", result.getErrorMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error processing webhook");
        }
    }
}
