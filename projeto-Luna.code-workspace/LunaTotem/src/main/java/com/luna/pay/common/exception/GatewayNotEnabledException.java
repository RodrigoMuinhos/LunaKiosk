package com.luna.pay.common.exception;

public class GatewayNotEnabledException extends RuntimeException {

    private final String gateway;

    public GatewayNotEnabledException(String gateway) {
        super("Gateway não habilitado: " + gateway);
        this.gateway = gateway;
    }

    public String getGateway() {
        return gateway;
    }
}
