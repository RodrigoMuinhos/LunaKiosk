package com.luna.pay.gateway.dto.c6;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * DTO para criação de pagamento no C6 Bank.
 * Baseado na documentação da API do C6.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class C6CreatePaymentRequest {

    @JsonProperty("amount")
    private BigDecimal amount;

    @JsonProperty("description")
    private String description;

    @JsonProperty("payment_method")
    private String paymentMethod; // PIX, BOLETO, CREDIT_CARD

    @JsonProperty("customer")
    private C6Customer customer;

    @JsonProperty("pix_expiration_minutes")
    private Integer pixExpirationMinutes;

    @JsonProperty("card_data")
    private C6CardData cardData;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class C6Customer {
        @JsonProperty("name")
        private String name;

        @JsonProperty("email")
        private String email;

        @JsonProperty("document")
        private String document;

        @JsonProperty("phone")
        private String phone;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class C6CardData {
        @JsonProperty("holder_name")
        private String holderName;

        @JsonProperty("card_number")
        private String cardNumber;

        @JsonProperty("expiry_month")
        private String expiryMonth;

        @JsonProperty("expiry_year")
        private String expiryYear;

        @JsonProperty("cvv")
        private String cvv;

        @JsonProperty("installments")
        private Integer installments;
    }
}
