package com.luna.pay.payment;

import com.luna.pay.common.exception.GatewayNotEnabledException;
import com.luna.pay.common.exception.PaymentException;
import com.luna.pay.gateway.GatewayPaymentResult;
import com.luna.pay.gateway.PaymentGateway;
import com.luna.pay.gateway.asaas.AsaasPaymentSyncService;
import com.luna.pay.payment.dto.CreatePaymentRequest;
import com.luna.pay.payment.dto.PaymentResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final List<PaymentGateway> paymentGateways;
    private final AsaasPaymentSyncService asaasPaymentSyncService;

    private Map<String, PaymentGateway> getGatewayMap() {
        return paymentGateways.stream()
                .collect(Collectors.toMap(
                        gateway -> gateway.getGatewayName().toUpperCase(),
                        Function.identity()
                ));
    }

    @Transactional
    public PaymentResponse createPayment(CreatePaymentRequest request, String tenantId) {
        log.info("Criando pagamento para tenant {} via gateway {}", tenantId, request.getGateway());

        // Valida gateway
        String gatewayName = request.getGateway().toUpperCase();
        PaymentGateway gateway = getGatewayMap().get(gatewayName);

        if (gateway == null) {
            throw new PaymentException("Gateway não suportado: " + request.getGateway());
        }

        if (!gateway.isEnabled()) {
            throw new GatewayNotEnabledException(gatewayName);
        }

        // Cria pagamento no gateway
        GatewayPaymentResult gatewayResult = gateway.createPayment(request, tenantId);

        if (!gatewayResult.isSuccess()) {
            throw new PaymentException(
                    "Erro ao criar pagamento no gateway: " + gatewayResult.getErrorMessage()
            );
        }

        // Salva no banco
        Payment payment = new Payment();
        payment.setTenantId(tenantId);
        payment.setAmount(request.getAmount());
        payment.setDescription(request.getDescription());
        payment.setGateway(gatewayName);
        payment.setGatewayPaymentId(gatewayResult.getGatewayPaymentId());
        payment.setPaymentMethod(request.getPaymentMethod().toUpperCase());
        payment.setStatus(PaymentStatus.PENDING);

        // Dados específicos PIX
        payment.setPixQrCode(gatewayResult.getPixQrCode());
        payment.setPixQrCodeBase64(gatewayResult.getPixQrCodeBase64());
        payment.setPixCopyPaste(gatewayResult.getPixCopyPaste());
        payment.setPixExpiresAt(gatewayResult.getPixExpiresAt());

        // Dados específicos Boleto
        payment.setBoletoBarCode(gatewayResult.getBoletoBarCode());
        payment.setBoletoUrl(gatewayResult.getBoletoUrl());
        payment.setBoletoExpiresAt(gatewayResult.getBoletoExpiresAt());

        // Dados específicos Cartão
        payment.setAuthorizationCode(gatewayResult.getAuthorizationCode());
        payment.setNsu(gatewayResult.getNsu());

        Payment saved = paymentRepository.save(payment);

        log.info("Pagamento criado com sucesso: {} (gateway: {})", saved.getId(), saved.getGatewayPaymentId());

        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> findByTenant(String tenantId) {
        return paymentRepository.findByTenantId(tenantId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<PaymentResponse> findById(String id, String tenantId) {
        return paymentRepository.findById(id)
                .filter(payment -> payment.getTenantId().equals(tenantId))
                .map(this::mapToResponse);
    }

    @Transactional
    public boolean cancelPayment(String id, String tenantId) {
        Optional<Payment> paymentOpt = paymentRepository.findById(id);

        if (paymentOpt.isEmpty()) {
            throw new PaymentException("Pagamento não encontrado");
        }

        Payment payment = paymentOpt.get();

        if (!payment.getTenantId().equals(tenantId)) {
            throw new PaymentException("Pagamento não pertence a este tenant");
        }

        if (payment.getStatus() == PaymentStatus.PAID) {
            throw new PaymentException("Não é possível cancelar pagamento já pago");
        }

        if (payment.getStatus() == PaymentStatus.CANCELED) {
            throw new PaymentException("Pagamento já está cancelado");
        }

        // Cancela no gateway
        PaymentGateway gateway = getGatewayMap().get(payment.getGateway());
        if (gateway != null && gateway.isEnabled()) {
            gateway.cancelPayment(payment.getGatewayPaymentId());
        }

        payment.setStatus(PaymentStatus.CANCELED);
        paymentRepository.save(payment);

        log.info("Pagamento {} cancelado", id);
        return true;
    }

    @Transactional
    public PaymentResponse syncAsaasPaymentByGatewayPaymentId(String gatewayPaymentId, String tenantId) {
        AsaasPaymentSyncService.AsaasPaymentSnapshot snapshot = asaasPaymentSyncService.fetchPayment(gatewayPaymentId);

        // Segurança: o pagamento no Asaas precisa estar vinculado ao tenant (externalReference)
        if (snapshot.externalReference() != null && !snapshot.externalReference().isBlank()) {
            if (!tenantId.equals(snapshot.externalReference())) {
                throw new PaymentException("Pagamento Asaas não pertence a este tenant");
            }
        }

        Payment payment = paymentRepository
                .findByGatewayPaymentIdAndTenantId(snapshot.id(), tenantId)
                .orElseGet(Payment::new);

        payment.setTenantId(tenantId);
        payment.setGateway("ASAAS");
        payment.setGatewayPaymentId(snapshot.id());
        payment.setDescription(snapshot.description());
        payment.setAmount(snapshot.value());
        if (snapshot.billingType() != null) {
            payment.setPaymentMethod(snapshot.billingType().toUpperCase());
        }
        payment.setStatus(snapshot.mappedStatus());

        Payment saved = paymentRepository.save(payment);
        return mapToResponse(saved);
    }

    private PaymentResponse mapToResponse(Payment payment) {
        return PaymentResponse.builder()
                .id(payment.getId())
                .tenantId(payment.getTenantId())
                .amount(payment.getAmount())
                .description(payment.getDescription())
                .status(payment.getStatus())
                .gateway(payment.getGateway())
                .gatewayPaymentId(payment.getGatewayPaymentId())
                .paymentMethod(payment.getPaymentMethod())
                .pixQrCode(payment.getPixQrCode())
                .pixQrCodeBase64(payment.getPixQrCodeBase64())
                .pixCopyPaste(payment.getPixCopyPaste())
                .pixExpiresAt(payment.getPixExpiresAt())
                .boletoBarCode(payment.getBoletoBarCode())
                .boletoUrl(payment.getBoletoUrl())
                .boletoExpiresAt(payment.getBoletoExpiresAt())
                .createdAt(payment.getCreatedAt())
                .updatedAt(payment.getUpdatedAt())
                .build();
    }
}
