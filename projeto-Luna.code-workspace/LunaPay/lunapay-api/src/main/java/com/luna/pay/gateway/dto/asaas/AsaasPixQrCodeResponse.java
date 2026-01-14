package com.luna.pay.gateway.dto.asaas;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AsaasPixQrCodeResponse {

    @JsonProperty("encodedImage")
    private String encodedImage;

    @JsonProperty("payload")
    private String payload;

    @JsonProperty("expirationDate")
    private String expirationDate;
}
