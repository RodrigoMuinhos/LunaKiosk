package com.luna.pay.gateway;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GatewayPaymentResult {

    private boolean success;
    private String gatewayPaymentId;
    private String paymentMethod;
    private BigDecimal amount;
    
    // PIX
    private String pixQrCode;
    private String pixQrCodeBase64;
    private String pixCopyPaste;
    private Instant pixExpiresAt;
    
    // Boleto
    private String boletoBarCode;
    private String boletoUrl;
    private Instant boletoExpiresAt;
    
    // Cartão
    private String authorizationCode;
    private String nsu;
    
    // Erro
    private String errorMessage;
    private String errorCode;
}
