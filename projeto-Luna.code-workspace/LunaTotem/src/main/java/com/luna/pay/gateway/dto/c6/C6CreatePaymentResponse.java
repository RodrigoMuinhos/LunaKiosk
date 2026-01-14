package com.luna.pay.gateway.dto.c6;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO para resposta de criação de pagamento no C6 Bank.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class C6CreatePaymentResponse {

    @JsonProperty("payment_id")
    private String paymentId;

    @JsonProperty("status")
    private String status;

    @JsonProperty("amount")
    private BigDecimal amount;

    @JsonProperty("payment_method")
    private String paymentMethod;

    // PIX specific
    @JsonProperty("pix_qr_code")
    private String pixQrCode;

    @JsonProperty("pix_copy_paste")
    private String pixCopyPaste;

    @JsonProperty("pix_qr_code_base64")
    private String pixQrCodeBase64;

    @JsonProperty("pix_expires_at")
    private Instant pixExpiresAt;

    // Boleto specific
    @JsonProperty("boleto_bar_code")
    private String boletoBarCode;

    @JsonProperty("boleto_url")
    private String boletoUrl;

    @JsonProperty("boleto_expires_at")
    private Instant boletoExpiresAt;

    // Card specific
    @JsonProperty("authorization_code")
    private String authorizationCode;

    @JsonProperty("nsu")
    private String nsu;

    // Error handling
    @JsonProperty("error_message")
    private String errorMessage;

    @JsonProperty("error_code")
    private String errorCode;
}
