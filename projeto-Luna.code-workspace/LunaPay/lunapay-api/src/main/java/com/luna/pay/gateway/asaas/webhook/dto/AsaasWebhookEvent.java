package com.luna.pay.gateway.asaas.webhook.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AsaasWebhookEvent(
        String id,
        String event,
        Payment payment
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Payment(
            String id,
            String status
    ) {}
}
