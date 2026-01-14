package com.luna.pay.gateway.dto.asaas;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para criação de cliente no Asaas.
 * Asaas requer que o cliente seja criado antes do pagamento.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AsaasCustomerRequest {

    @JsonProperty("name")
    private String name;

    @JsonProperty("cpfCnpj")
    private String cpfCnpj;

    @JsonProperty("email")
    private String email;

    @JsonProperty("phone")
    private String phone;

    @JsonProperty("mobilePhone")
    private String mobilePhone;

    @JsonProperty("externalReference")
    private String externalReference; // Referência do nosso sistema
}
