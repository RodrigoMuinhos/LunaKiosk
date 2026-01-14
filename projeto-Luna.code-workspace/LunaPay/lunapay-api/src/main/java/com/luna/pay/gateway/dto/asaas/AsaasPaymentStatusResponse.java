package com.luna.pay.gateway.dto.asaas;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * DTO para resposta de consulta de status de pagamento no Asaas.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AsaasPaymentStatusResponse {

    @JsonProperty("id")
    private String id;

    @JsonProperty("status")
    private String status; // PENDING, CONFIRMED, RECEIVED, OVERDUE, REFUNDED, REFUND_REQUESTED, CHARGEBACK_REQUESTED, CHARGEBACK_DISPUTE, AWAITING_CHARGEBACK_REVERSAL

    @JsonProperty("value")
    private BigDecimal value;

    @JsonProperty("netValue")
    private BigDecimal netValue;

    @JsonProperty("billingType")
    private String billingType;

    @JsonProperty("confirmedDate")
    private String confirmedDate;

    @JsonProperty("paymentDate")
    private String paymentDate;
}
