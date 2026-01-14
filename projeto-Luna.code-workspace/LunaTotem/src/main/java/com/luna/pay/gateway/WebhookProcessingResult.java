package com.luna.pay.gateway;

import com.luna.pay.payment.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebhookProcessingResult {

    private boolean success;
    private String paymentId;
    private PaymentStatus newStatus;
    private String message;
    private String errorMessage;
}
