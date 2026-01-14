package com.luna.pay.payment;

import com.luna.pay.payment.dto.CreatePaymentRequest;
import com.luna.pay.payment.dto.PaymentResponse;
import com.luna.pay.security.UserContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @GetMapping("/ping")
    public String ping(@AuthenticationPrincipal UserContext user) {
        return "LunaPay OK para tenant " + user.getTenantId() +
                " (user: " + user.getUserId() + ")";
    }

    @PostMapping
    public ResponseEntity<PaymentResponse> createPayment(
            @Valid @RequestBody CreatePaymentRequest request,
            @AuthenticationPrincipal UserContext user) {

        PaymentResponse response = paymentService.createPayment(request, user.getTenantId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<PaymentResponse>> listPayments(
            @AuthenticationPrincipal UserContext user) {

        List<PaymentResponse> payments = paymentService.findByTenant(user.getTenantId());
        return ResponseEntity.ok(payments);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PaymentResponse> getPayment(
            @PathVariable String id,
            @AuthenticationPrincipal UserContext user) {

        return paymentService.findById(id, user.getTenantId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<PaymentStatusResponse> getPaymentStatus(
            @PathVariable String id,
            @AuthenticationPrincipal UserContext user,
            @RequestParam(name = "refresh", defaultValue = "false") boolean refresh) {

        if (refresh) {
            // Hoje só temos sync real implementado para ASAAS via gatewayPaymentId.
            // Para evitar criar cobranças novas, o refresh consulta o Asaas e atualiza o registro local.
            return paymentService.findById(id, user.getTenantId())
                .map(existing -> {
                PaymentResponse synced = paymentService.syncAsaasPaymentByGatewayPaymentId(
                    existing.getGatewayPaymentId(),
                    user.getTenantId()
                );
                return ResponseEntity.ok(new PaymentStatusResponse(
                    synced.getId(),
                    synced.getStatus(),
                    synced.getGatewayPaymentId()
                ));
                })
                .orElse(ResponseEntity.notFound().build());
        }

        return paymentService.findById(id, user.getTenantId())
            .map(payment -> ResponseEntity.ok(new PaymentStatusResponse(
                payment.getId(),
                payment.getStatus(),
                payment.getGatewayPaymentId()
            )))
            .orElse(ResponseEntity.notFound().build());
    }

        @PostMapping("/sync/asaas/{gatewayPaymentId}")
        public ResponseEntity<PaymentResponse> syncAsaasPayment(
            @PathVariable String gatewayPaymentId,
            @AuthenticationPrincipal UserContext user) {

        PaymentResponse response = paymentService.syncAsaasPaymentByGatewayPaymentId(gatewayPaymentId, user.getTenantId());
        return ResponseEntity.ok(response);
        }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelPayment(
            @PathVariable String id,
            @AuthenticationPrincipal UserContext user) {

        paymentService.cancelPayment(id, user.getTenantId());
        return ResponseEntity.noContent().build();
    }

    // DTO inline para status
    public record PaymentStatusResponse(String id, PaymentStatus status, String gatewayPaymentId) {}
}
