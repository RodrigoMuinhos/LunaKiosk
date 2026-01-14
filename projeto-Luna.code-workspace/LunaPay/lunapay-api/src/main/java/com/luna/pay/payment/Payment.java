package com.luna.pay.payment;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payments")
@Data
@EntityListeners(AuditingEntityListener.class)
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    private BigDecimal amount;

    private String description;

    @Enumerated(EnumType.STRING)
    private PaymentStatus status;

    private String gateway;
    private String gatewayPaymentId;
    private String paymentMethod;

    // PIX
    @Column(length = 1000)
    private String pixQrCode;
    @Column(length = 2000)
    private String pixQrCodeBase64;
    @Column(length = 1000)
    private String pixCopyPaste;
    private Instant pixExpiresAt;

    // Boleto
    private String boletoBarCode;
    private String boletoUrl;
    private Instant boletoExpiresAt;

    // Cartão
    private String authorizationCode;
    private String nsu;

    @CreatedDate
    private Instant createdAt;
    
    @LastModifiedDate
    private Instant updatedAt;
    
    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;
    
    @LastModifiedBy
    @Column(name = "modified_by")
    private String modifiedBy;

    @PrePersist
    void prePersist() {
        if (status == null) status = PaymentStatus.PENDING;
    }
}
