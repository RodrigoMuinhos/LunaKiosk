package com.luna.pay.payment.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreatePaymentRequest {

    @NotNull(message = "Valor é obrigatório")
    @DecimalMin(value = "0.01", message = "Valor deve ser maior que zero")
    private BigDecimal amount;

    @NotBlank(message = "Descrição é obrigatória")
    private String description;

    @NotBlank(message = "Gateway é obrigatório")
    private String gateway; // ASAAS, C6

    @NotBlank(message = "Método de pagamento é obrigatório")
    private String paymentMethod; // PIX, BOLETO, CREDIT_CARD, DEBIT_CARD

    // Dados específicos do PIX
    private Integer pixExpirationMinutes; // padrão 30 min

    // Dados do cartão (quando aplicável)
    private CardData cardData;

    // Dados do cliente
    private CustomerData customer;

    @Data
    public static class CardData {
        private String holderName;
        private String number;
        private String expiryMonth;
        private String expiryYear;
        private String cvv;
    }

    @Data
    public static class CustomerData {
        private String name;
        private String email;
        private String cpfCnpj;
        private String phone;
    }
}
