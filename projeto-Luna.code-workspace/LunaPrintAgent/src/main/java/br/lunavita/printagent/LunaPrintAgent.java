package br.lunavita.printagent;

import br.lunavita.printagent.config.AgentConfig;
import br.lunavita.printagent.service.ThermalPrintService;
import br.lunavita.printagent.service.QueuePollingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * Luna Print Agent
 * 
 * Agente local que roda no totem e é responsável por:
 * - Buscar jobs de impressão pendentes no backend
 * - Imprimir na impressora USB conectada
 * - Reportar o resultado ao backend
 * 
 * Este é um serviço que deve rodar em background no totem.
 */
public class LunaPrintAgent {

    private static final Logger log = LoggerFactory.getLogger(LunaPrintAgent.class);

    public static void main(String[] args) {
        log.info("=================================================");
        log.info("    Luna Print Agent v1.0.0                     ");
        log.info("    Iniciando...                                ");
        log.info("=================================================");

        try {
            // Carrega configuração
            AgentConfig config = loadConfig();
            log.info("Configuração carregada:");
            log.info("  - Terminal ID: {}", config.getTerminalId());
            log.info("  - Backend URL: {}", config.getBackendUrl());
            log.info("  - Impressora: {}", config.getPrinterName());
            log.info("  - Intervalo de polling: {}ms", config.getPollingIntervalMs());

            // Inicializa serviços
            ThermalPrintService printService = new ThermalPrintService(config.getPrinterName());
            QueuePollingService pollingService = new QueuePollingService(
                    config, 
                    printService
            );

            // Registra shutdown hook para parar graciosamente
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                log.info("Parando Luna Print Agent...");
                pollingService.stop();
                log.info("Agent finalizado.");
            }));

            // Inicia o loop de polling
            log.info("=================================================");
            log.info("    Agent iniciado com sucesso!                 ");
            log.info("    Aguardando jobs de impressão...             ");
            log.info("=================================================");
            pollingService.start();

        } catch (Exception e) {
            log.error("Erro fatal ao iniciar Print Agent", e);
            System.exit(1);
        }
    }

    /**
     * Carrega configuração do agent
     */
    private static AgentConfig loadConfig() throws IOException {
        AgentConfig config = new AgentConfig();

        // Tenta carregar de variáveis de ambiente primeiro
        config.setTerminalId(getEnvOrDefault("TERMINAL_ID", "TOTEM-DEFAULT"));
        config.setBackendUrl(getEnvOrDefault("BACKEND_URL", "http://localhost:8081"));
        config.setPrinterName(getEnvOrDefault("PRINTER_NAME", null)); // null = impressora padrão
        config.setPollingIntervalMs(Integer.parseInt(getEnvOrDefault("POLLING_INTERVAL_MS", "3000")));
        config.setMaxRetries(Integer.parseInt(getEnvOrDefault("MAX_RETRIES", "3")));

        // Valida configuração
        if (config.getTerminalId() == null || config.getTerminalId().isBlank()) {
            throw new IllegalArgumentException("TERMINAL_ID não configurado");
        }

        if (config.getBackendUrl() == null || config.getBackendUrl().isBlank()) {
            throw new IllegalArgumentException("BACKEND_URL não configurado");
        }

        return config;
    }

    private static String getEnvOrDefault(String key, String defaultValue) {
        String value = System.getenv(key);
        return value != null ? value : defaultValue;
    }
}
