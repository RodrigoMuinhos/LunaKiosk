package com.luna.pay.gateway.dto.asaas;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para resposta de criação de cliente no Asaas.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AsaasCustomerResponse {

    @JsonProperty("id")
    private String id;

    @JsonProperty("name")
    private String name;

    @JsonProperty("cpfCnpj")
    private String cpfCnpj;

    @JsonProperty("email")
    private String email;
}
