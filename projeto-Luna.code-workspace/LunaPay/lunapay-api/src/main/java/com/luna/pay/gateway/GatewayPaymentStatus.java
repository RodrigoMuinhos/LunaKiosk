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
public class GatewayPaymentStatus {

    private String gatewayPaymentId;
    private PaymentStatus status;
    private String gatewayStatus;
    private String message;
}
