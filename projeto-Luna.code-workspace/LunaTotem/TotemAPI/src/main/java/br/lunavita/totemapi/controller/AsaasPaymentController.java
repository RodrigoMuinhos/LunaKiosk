package br.lunavita.totemapi.controller;

import br.lunavita.totemapi.security.UserContext;
import br.lunavita.totemapi.service.payment.PaymentProxyService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import jakarta.servlet.http.HttpServletRequest;

/**
 * BFF de pagamentos: o cliente (TotemUI/LunaKiosk) chama o TotemAPI,
 * e o TotemAPI chama o LunaPay por trás, reutilizando o JWT do LunaCore.
 */
@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*")
public class AsaasPaymentController {

    private final PaymentProxyService paymentProxyService;

    public AsaasPaymentController(PaymentProxyService paymentProxyService) {
        this.paymentProxyService = paymentProxyService;
    }

    @PostMapping("/pix")
    public ResponseEntity<?> createPixPayment(
            @RequestBody PixRequest request,
            @AuthenticationPrincipal UserContext userContext,
            HttpServletRequest httpRequest) {

        String auth = httpRequest.getHeader("Authorization");
        if (auth == null || auth.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(java.util.Map.of("error", "Missing Authorization header"));
        }

        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(paymentProxyService.createPixForAppointment(request.appointmentId, userContext, auth));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", e.getMessage()));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(java.util.Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(java.util.Map.of("error", "LunaPay error: " + e.getMessage()));
        }
    }

    @GetMapping("/status/{paymentId}")
    public ResponseEntity<?> checkPaymentStatus(
            @PathVariable String paymentId,
            @AuthenticationPrincipal UserContext userContext,
            HttpServletRequest httpRequest) {

        String auth = httpRequest.getHeader("Authorization");
        if (auth == null || auth.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(java.util.Map.of("error", "Missing Authorization header"));
        }

        try {
            return ResponseEntity.ok(paymentProxyService.getPaymentStatus(paymentId, userContext, auth));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(java.util.Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/asaas/webhook")
    public ResponseEntity<String> handleAsaasWebhook() {
        return ResponseEntity.status(HttpStatus.GONE)
                .body("Webhook Asaas desativado no TotemAPI; pagamentos são processados pelo LunaPay.");
    }

    public static class PixRequest {
        public String appointmentId;
    }
}
