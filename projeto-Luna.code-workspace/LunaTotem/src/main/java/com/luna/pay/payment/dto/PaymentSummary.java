package com.luna.pay.payment.dto;

import com.luna.pay.payment.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentSummary {

    private String id;
    private BigDecimal amount;
    private String description;
    private PaymentStatus status;
    private String gateway;
    private String paymentMethod;
    private String createdAt;
}
