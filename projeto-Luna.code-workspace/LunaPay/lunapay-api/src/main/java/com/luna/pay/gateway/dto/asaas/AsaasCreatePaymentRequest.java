package com.luna.pay.gateway.dto.asaas;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * DTO para criação de pagamento no Asaas.
 * Baseado na documentação oficial da API Asaas.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AsaasCreatePaymentRequest {

    @JsonProperty("customer")
    private String customer; // ID do cliente no Asaas

    @JsonProperty("billingType")
    private String billingType; // BOLETO, CREDIT_CARD, PIX, UNDEFINED

    @JsonProperty("value")
    private BigDecimal value;

    @JsonProperty("dueDate")
    private String dueDate; // yyyy-MM-dd

    @JsonProperty("description")
    private String description;

    @JsonProperty("externalReference")
    private String externalReference;

    // Dados do cartão de crédito
    @JsonProperty("creditCard")
    private AsaasCreditCard creditCard;

    @JsonProperty("creditCardHolderInfo")
    private AsaasCreditCardHolderInfo creditCardHolderInfo;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AsaasCreditCard {
        @JsonProperty("holderName")
        private String holderName;

        @JsonProperty("number")
        private String number;

        @JsonProperty("expiryMonth")
        private String expiryMonth;

        @JsonProperty("expiryYear")
        private String expiryYear;

        @JsonProperty("ccv")
        private String ccv;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AsaasCreditCardHolderInfo {
        @JsonProperty("name")
        private String name;

        @JsonProperty("email")
        private String email;

        @JsonProperty("cpfCnpj")
        private String cpfCnpj;

        @JsonProperty("postalCode")
        private String postalCode;

        @JsonProperty("addressNumber")
        private String addressNumber;

        @JsonProperty("phone")
        private String phone;
    }
}
