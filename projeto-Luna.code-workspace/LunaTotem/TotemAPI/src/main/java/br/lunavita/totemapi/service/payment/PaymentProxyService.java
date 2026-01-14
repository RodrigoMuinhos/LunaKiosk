package br.lunavita.totemapi.service.payment;

import br.lunavita.totemapi.integration.lunapay.LunaPayClient;
import br.lunavita.totemapi.integration.lunapay.dto.LunaPayCreatePaymentRequest;
import br.lunavita.totemapi.integration.lunapay.dto.LunaPayPaymentResponse;
import br.lunavita.totemapi.integration.lunapay.dto.LunaPayPaymentStatusResponse;
import br.lunavita.totemapi.model.Appointment;
import br.lunavita.totemapi.model.Patient;
import br.lunavita.totemapi.repository.PatientRepository;
import br.lunavita.totemapi.security.UserContext;
import br.lunavita.totemapi.service.DataStoreService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Objects;

@Service
public class PaymentProxyService {

    private final DataStoreService store;
    private final PatientRepository patientRepository;
    private final LunaPayClient lunaPayClient;

    public PaymentProxyService(DataStoreService store, PatientRepository patientRepository, LunaPayClient lunaPayClient) {
        this.store = store;
        this.patientRepository = patientRepository;
        this.lunaPayClient = lunaPayClient;
    }

    public PixInitResponse createPixForAppointment(String appointmentId, UserContext userContext, String authorizationHeader) {
        requireLunaPayModule(userContext);
        Objects.requireNonNull(authorizationHeader, "authorizationHeader");

        Appointment appointment = store.findAppointment(userContext.getTenantId(), appointmentId)
                .orElseThrow(() -> new IllegalArgumentException("Consulta nao encontrada para este tenant"));

        BigDecimal amount = appointment.getAmount();
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Valor inválido para pagamento");
        }

        Patient patient = patientRepository
                .findByTenantIdAndId(userContext.getTenantId(), appointment.getPatientId())
                .orElse(null);

        LunaPayCreatePaymentRequest req = new LunaPayCreatePaymentRequest();
        req.setAmount(amount);
        req.setDescription("Pagamento consulta " + appointment.getId());
        req.setGateway("ASAAS");
        req.setPaymentMethod("PIX");
        req.setPixExpirationMinutes(30);

        LunaPayCreatePaymentRequest.Customer cust = new LunaPayCreatePaymentRequest.Customer();
        cust.setName(patient != null ? patient.getName() : appointment.getPatient());
        cust.setEmail(firstNonBlank(patient != null ? patient.getEmail() : null, appointment.getPatientEmail(), ""));
        cust.setCpfCnpj(firstNonBlank(patient != null ? patient.getCpf() : null, appointment.getCpf(), ""));
        cust.setPhone(firstNonBlank(patient != null ? patient.getPhone() : null, ""));
        req.setCustomer(cust);

        LunaPayPaymentResponse created = lunaPayClient.createPayment(req, authorizationHeader);
        if (created == null || created.getId() == null || created.getId().isBlank()) {
            throw new IllegalArgumentException("Falha ao criar pagamento no LunaPay");
        }

        return new PixInitResponse(
                created.getId(),
                created.getPixQrCodeBase64(),
                created.getPixCopyPaste(),
                created.getStatus()
        );
    }

    public LunaPayPaymentStatusResponse getPaymentStatus(String paymentId, UserContext userContext, String authorizationHeader) {
        requireLunaPayModule(userContext);
        Objects.requireNonNull(authorizationHeader, "authorizationHeader");
        return lunaPayClient.getPaymentStatus(paymentId, authorizationHeader, true);
    }

    private void requireLunaPayModule(UserContext userContext) {
        if (userContext == null) {
            throw new SecurityException("Usuário não autenticado");
        }
        if (!userContext.hasModule("LUNAPAY")) {
            throw new SecurityException("Módulo LUNAPAY não habilitado no token");
        }
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return "";
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return "";
    }

    public record PixInitResponse(
            String paymentId,
            String qrCodeImageBase64,
            String qrCodeText,
            String status
    ) {
    }
}

