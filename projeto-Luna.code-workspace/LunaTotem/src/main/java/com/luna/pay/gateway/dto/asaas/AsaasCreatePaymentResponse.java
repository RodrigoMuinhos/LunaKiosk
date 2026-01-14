package com.luna.pay.gateway.dto.asaas;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO para resposta de criação de pagamento no Asaas.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AsaasCreatePaymentResponse {

    @JsonProperty("id")
    private String id;

    @JsonProperty("customer")
    private String customer;

    @JsonProperty("billingType")
    private String billingType;

    @JsonProperty("value")
    private BigDecimal value;

    @JsonProperty("dueDate")
    private String dueDate;

    @JsonProperty("status")
    private String status; // PENDING, CONFIRMED, RECEIVED, OVERDUE, REFUNDED, etc.

    @JsonProperty("description")
    private String description;

    @JsonProperty("externalReference")
    private String externalReference;

    @JsonProperty("invoiceUrl")
    private String invoiceUrl;

    @JsonProperty("bankSlipUrl")
    private String bankSlipUrl;

    @JsonProperty("identificationField")
    private String identificationField; // Linha digitável do boleto

    @JsonProperty("nossoNumero")
    private String nossoNumero;

    // Dados PIX
    @JsonProperty("pixTransaction")
    private AsaasPixTransaction pixTransaction;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AsaasPixTransaction {
        @JsonProperty("qrCode")
        private String qrCode;

        @JsonProperty("payload")
        private String payload; // PIX Copia e Cola

        @JsonProperty("expirationDate")
        private Instant expirationDate;
    }
}
