package br.lunavita.printagent.config;

/**
 * Configuração do Print Agent
 */
public class AgentConfig {

    private String terminalId;
    private String backendUrl;
    private String printerName;
    private int pollingIntervalMs = 3000;
    private int maxRetries = 3;

    public String getTerminalId() {
        return terminalId;
    }

    public void setTerminalId(String terminalId) {
        this.terminalId = terminalId;
    }

    public String getBackendUrl() {
        return backendUrl;
    }

    public void setBackendUrl(String backendUrl) {
        this.backendUrl = backendUrl;
    }

    public String getPrinterName() {
        return printerName;
    }

    public void setPrinterName(String printerName) {
        this.printerName = printerName;
    }

    public int getPollingIntervalMs() {
        return pollingIntervalMs;
    }

    public void setPollingIntervalMs(int pollingIntervalMs) {
        this.pollingIntervalMs = pollingIntervalMs;
    }

    public int getMaxRetries() {
        return maxRetries;
    }

    public void setMaxRetries(int maxRetries) {
        this.maxRetries = maxRetries;
    }
}
