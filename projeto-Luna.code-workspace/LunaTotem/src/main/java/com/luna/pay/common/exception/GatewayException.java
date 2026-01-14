package com.luna.pay.common.exception;

public class GatewayException extends RuntimeException {

    private final String gateway;
    private final String errorCode;

    public GatewayException(String gateway, String message) {
        super(message);
        this.gateway = gateway;
        this.errorCode = null;
    }

    public GatewayException(String gateway, String message, String errorCode) {
        super(message);
        this.gateway = gateway;
        this.errorCode = errorCode;
    }

    public GatewayException(String gateway, String message, Throwable cause) {
        super(message, cause);
        this.gateway = gateway;
        this.errorCode = null;
    }

    public String getGateway() {
        return gateway;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
