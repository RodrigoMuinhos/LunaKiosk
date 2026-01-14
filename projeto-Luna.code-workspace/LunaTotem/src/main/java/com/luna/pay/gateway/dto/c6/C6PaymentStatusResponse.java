package com.luna.pay.gateway.dto.c6;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para resposta de consulta de status de pagamento no C6 Bank.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class C6PaymentStatusResponse {

    @JsonProperty("payment_id")
    private String paymentId;

    @JsonProperty("status")
    private String status;

    @JsonProperty("message")
    private String message;

    @JsonProperty("paid_at")
    private String paidAt;

    @JsonProperty("cancelled_at")
    private String cancelledAt;
}
