package br.lunavita.totemapi.controller;

import br.lunavita.totemapi.model.Appointment;
import br.lunavita.totemapi.security.UserContext;
import br.lunavita.totemapi.service.DataStoreService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

/**
 * Endpoint legado de pagamento do Totem.
 * 
 * - Para PIX real: use POST /api/payments/pix (proxy do LunaPay)
 * - Este endpoint é usado pelo fluxo atual do TotemUI (simulado) para marcar a consulta como paga.
 */
@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*")
public class PaymentController {

    private final DataStoreService store;

    public PaymentController(DataStoreService store) {
        this.store = store;
    }

    @PostMapping
    public ResponseEntity<?> capture(
            @RequestBody PaymentProcessRequest request,
            @AuthenticationPrincipal UserContext userContext) {

        if (request == null || request.appointmentId == null || request.appointmentId.isBlank()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "appointmentId é obrigatório"));
        }

        if (userContext != null && userContext.getTenantId() != null) {
            // valida tenant (se a consulta não for do tenant, responde 404)
            return store.findAppointment(request.appointmentId)
                    .filter(apt -> userContext.getTenantId().equals(apt.getTenantId()))
                    .flatMap(apt -> store.updateStatus(request.appointmentId, "confirmado"))
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(java.util.Map.of("error", "Consulta não encontrada")));
        }

        // fallback (não deveria ocorrer se Security estiver ativo)
        return store.updateStatus(request.appointmentId, "confirmado")
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(java.util.Map.of("error", "Consulta não encontrada")));
    }

    @GetMapping
    public ResponseEntity<List<Appointment>> list(@AuthenticationPrincipal UserContext userContext) {
        // Mantido por compatibilidade com UI (não expõe dados de pagamento do LunaPay).
        // Retorna consultas do tenant (se existir tenantId no token), senão lista geral (dev).
        List<Appointment> all = store.listAppointments();
        if (userContext == null || userContext.getTenantId() == null) {
            return ResponseEntity.ok(all);
        }
        return ResponseEntity.ok(all.stream()
                .filter(a -> userContext.getTenantId().equals(a.getTenantId()))
                .toList());
    }

    public static class PaymentProcessRequest {
        public String appointmentId;
        public java.math.BigDecimal amount;
        public String method;
    }
}
