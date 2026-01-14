package com.luna.pay.payment.dto;

import com.luna.pay.payment.PaymentStatus;
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
public class PaymentResponse {

    private String id;
    private String tenantId;
    private BigDecimal amount;
    private String description;
    private PaymentStatus status;
    private String gateway;
    private String gatewayPaymentId;
    private String paymentMethod;
    
    // Dados específicos para PIX
    private String pixQrCode;
    private String pixQrCodeBase64;
    private String pixCopyPaste;
    private Instant pixExpiresAt;
    
    // Dados específicos para Boleto
    private String boletoBarCode;
    private String boletoUrl;
    private Instant boletoExpiresAt;
    
    private Instant createdAt;
    private Instant updatedAt;
}
