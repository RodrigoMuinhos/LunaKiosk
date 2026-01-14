package com.luna.pay.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, String> {

    List<Payment> findByTenantId(String tenantId);
    
    Optional<Payment> findByGatewayPaymentId(String gatewayPaymentId);

    Optional<Payment> findByGatewayPaymentIdAndTenantId(String gatewayPaymentId, String tenantId);
}
