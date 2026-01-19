package br.lunavita.printagent.service;

import br.lunavita.printagent.config.AgentConfig;
import br.lunavita.printagent.model.PrintJob;
import com.google.gson.Gson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Serviço que faz polling no backend para buscar jobs de impressão pendentes
 */
public class QueuePollingService {

    private static final Logger log = LoggerFactory.getLogger(QueuePollingService.class);

    private final AgentConfig config;
    private final ThermalPrintService printService;
    private final HttpClient httpClient;
    private final Gson gson;
    private final AtomicBoolean running;

    public QueuePollingService(AgentConfig config, ThermalPrintService printService) {
        this.config = config;
        this.printService = printService;
        this.gson = new Gson();
        this.running = new AtomicBoolean(false);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * Inicia o loop de polling
     */
    public void start() {
        running.set(true);
        log.info("Iniciando polling de jobs pendentes...");

        while (running.get()) {
            try {
                // Busca o próximo job pendente
                PrintJob job = claimNextJob();

                if (job != null) {
                    log.info("Job recebido: {} (tipo: {}, tentativa: {}/{})",
                             job.getId(), job.getReceiptType(), job.getAttempts(), job.getMaxAttempts());

                    // Tenta imprimir
                    processJob(job);
                } else {
                    // Nenhum job pendente, aguarda antes de buscar novamente
                    Thread.sleep(config.getPollingIntervalMs());
                }

            } catch (InterruptedException e) {
                log.info("Polling interrompido");
                break;
            } catch (Exception e) {
                log.error("Erro no loop de polling", e);
                try {
                    Thread.sleep(5000); // Aguarda 5s antes de tentar novamente em caso de erro
                } catch (InterruptedException ie) {
                    break;
                }
            }
        }

        log.info("Polling finalizado");
    }

    /**
     * Para o loop de polling
     */
    public void stop() {
        log.info("Parando polling...");
        running.set(false);
    }

    /**
     * Busca (e reserva) o próximo job pendente no backend
     */
    private PrintJob claimNextJob() throws IOException, InterruptedException {
        String url = config.getBackendUrl() + "/api/print-queue/claim-next?terminalId=" + config.getTerminalId();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 204) {
            // No Content - nenhum job pendente
            return null;
        }

        if (response.statusCode() != 200) {
            log.warn("Erro ao buscar job: HTTP {}", response.statusCode());
            return null;
        }

        // Parse JSON response
        return gson.fromJson(response.body(), PrintJob.class);
    }

    /**
     * Processa um job de impressão
     */
    private void processJob(PrintJob job) {
        try {
            // Verifica se a impressora está disponível
            if (!printService.isPrinterAvailable()) {
                log.warn("Impressora não disponível, reportando falha");
                reportResult(job.getId(), false, "Impressora não disponível");
                return;
            }

            // Tenta imprimir
            log.info("Imprimindo job {}...", job.getId());
            printService.print(job.getPayload());

            // Sucesso!
            log.info("✅ Job {} impresso com sucesso", job.getId());
            reportResult(job.getId(), true, null);

        } catch (Exception e) {
            log.error("❌ Erro ao imprimir job {}: {}", job.getId(), e.getMessage(), e);
            reportResult(job.getId(), false, e.getMessage());
        }
    }

    /**
     * Reporta o resultado da impressão ao backend
     */
    private void reportResult(String jobId, boolean success, String errorMessage) {
        try {
            String url = config.getBackendUrl() + "/api/print-queue/report";

            String jsonBody = gson.toJson(new PrintResult(jobId, success, errorMessage));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                log.info("Resultado reportado com sucesso para job {}", jobId);
            } else {
                log.warn("Erro ao reportar resultado para job {}: HTTP {}", jobId, response.statusCode());
            }

        } catch (Exception e) {
            log.error("Falha ao reportar resultado do job {}", jobId, e);
            // Não propaga erro - o job eventualmente será liberado pelo backend
        }
    }

    /**
     * DTO para reportar resultado
     */
    private static class PrintResult {
        private String jobId;
        private boolean success;
        private String errorMessage;

        public PrintResult(String jobId, boolean success, String errorMessage) {
            this.jobId = jobId;
            this.success = success;
            this.errorMessage = errorMessage;
        }
    }
}
