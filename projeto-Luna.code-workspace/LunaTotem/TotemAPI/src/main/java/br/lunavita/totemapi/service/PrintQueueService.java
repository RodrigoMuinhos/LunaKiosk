package br.lunavita.totemapi.service;

import br.lunavita.totemapi.dto.CreatePrintJobRequest;
import br.lunavita.totemapi.dto.PrintJobResponse;
import br.lunavita.totemapi.model.PrintJob;
import br.lunavita.totemapi.model.PrintJob.PrintJobStatus;
import br.lunavita.totemapi.repository.PrintJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * Serviço de gerenciamento da fila de impressão.
 * Responsável por enfileirar, processar e gerenciar o ciclo de vida dos jobs de impressão.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PrintQueueService {

    private final PrintJobRepository printJobRepository;

    /**
     * Adiciona um novo job à fila de impressão
     */
    @Transactional
    public PrintJobResponse enqueue(CreatePrintJobRequest request) {
        log.info("Enfileirando job de impressão - terminal: {}, tipo: {}", 
                 request.getTerminalId(), request.getReceiptType());

        PrintJob job = PrintJob.builder()
                .terminalId(request.getTerminalId())
                .tenantId(request.getTenantId())
                .receiptType(request.getReceiptType())
                .status(PrintJobStatus.PENDING)
                .payload(request.getPayload())
                .attempts(0)
                .maxAttempts(request.getMaxAttempts() != null ? request.getMaxAttempts() : 5)
                .priority(request.getPriority() != null ? request.getPriority() : 0)
                .appointmentId(request.getAppointmentId())
                .paymentId(request.getPaymentId())
                .metadata(request.getMetadata())
                .build();

        PrintJob saved = printJobRepository.save(job);
        
        log.info("Job de impressão criado: {} (status: PENDING)", saved.getId());
        
        return mapToResponse(saved);
    }

    /**
     * Busca o próximo job pendente para um terminal (claim/lock)
     */
    @Transactional
    public Optional<PrintJobResponse> claimNext(String terminalId) {
        Optional<PrintJob> jobOpt = printJobRepository.findNextPendingByTerminal(terminalId);

        if (jobOpt.isEmpty()) {
            return Optional.empty();
        }

        PrintJob job = jobOpt.get();
        
        // Lock: muda status para PRINTING
        job.setStatus(PrintJobStatus.PRINTING);
        job.incrementAttempts();
        
        PrintJob updated = printJobRepository.save(job);
        
        log.info("Job {} reservado para impressão no terminal {} (tentativa {}/{})",
                 job.getId(), terminalId, job.getAttempts(), job.getMaxAttempts());

        return Optional.of(mapToResponse(updated));
    }

    /**
     * Marca um job como impresso com sucesso
     */
    @Transactional
    public boolean markPrinted(String jobId) {
        Optional<PrintJob> jobOpt = printJobRepository.findById(jobId);

        if (jobOpt.isEmpty()) {
            log.warn("Job {} não encontrado para marcar como impresso", jobId);
            return false;
        }

        PrintJob job = jobOpt.get();
        job.markPrinted();
        printJobRepository.save(job);

        log.info("Job {} marcado como PRINTED", jobId);
        return true;
    }

    /**
     * Marca um job como falhado
     */
    @Transactional
    public boolean markFailed(String jobId, String errorMessage) {
        Optional<PrintJob> jobOpt = printJobRepository.findById(jobId);

        if (jobOpt.isEmpty()) {
            log.warn("Job {} não encontrado para marcar como falhado", jobId);
            return false;
        }

        PrintJob job = jobOpt.get();
        job.markFailed(errorMessage);
        printJobRepository.save(job);

        if (job.getStatus() == PrintJobStatus.FAILED) {
            log.error("Job {} FALHOU permanentemente após {} tentativas: {}", 
                      jobId, job.getAttempts(), errorMessage);
        } else {
            log.warn("Job {} falhou (tentativa {}/{}), será reprocessado: {}", 
                     jobId, job.getAttempts(), job.getMaxAttempts(), errorMessage);
        }

        return true;
    }

    /**
     * Lista jobs pendentes de um terminal
     */
    @Transactional(readOnly = true)
    public List<PrintJobResponse> listPending(String terminalId) {
        return printJobRepository.findPendingByTerminal(terminalId)
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    /**
     * Lista todos os jobs de um tenant
     */
    @Transactional(readOnly = true)
    public List<PrintJobResponse> listByTenant(String tenantId) {
        return printJobRepository.findByTenantIdOrderByCreatedAtDesc(tenantId)
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    /**
     * Busca um job específico
     */
    @Transactional(readOnly = true)
    public Optional<PrintJobResponse> findById(String jobId) {
        return printJobRepository.findById(jobId)
                .map(this::mapToResponse);
    }

    /**
     * Cancela um job
     */
    @Transactional
    public boolean cancel(String jobId) {
        Optional<PrintJob> jobOpt = printJobRepository.findById(jobId);

        if (jobOpt.isEmpty()) {
            return false;
        }

        PrintJob job = jobOpt.get();
        job.setStatus(PrintJobStatus.CANCELED);
        printJobRepository.save(job);

        log.info("Job {} cancelado", jobId);
        return true;
    }

    /**
     * Libera jobs travados (que estão em PRINTING há muito tempo)
     * Útil para casos onde o Print Agent morreu durante impressão
     */
    @Transactional
    public int releaseStaleJobs(int minutesThreshold) {
        Instant threshold = Instant.now().minus(minutesThreshold, ChronoUnit.MINUTES);
        List<PrintJob> stalledJobs = printJobRepository.findStalledJobs(threshold);

        for (PrintJob job : stalledJobs) {
            log.warn("Liberando job travado: {} (última tentativa: {})", 
                     job.getId(), job.getLastAttemptAt());
            job.setStatus(PrintJobStatus.PENDING);
            printJobRepository.save(job);
        }

        return stalledJobs.size();
    }

    /**
     * Mapeia entidade para DTO de resposta
     */
    private PrintJobResponse mapToResponse(PrintJob job) {
        return PrintJobResponse.builder()
                .id(job.getId())
                .terminalId(job.getTerminalId())
                .tenantId(job.getTenantId())
                .receiptType(job.getReceiptType())
                .status(job.getStatus().name())
                .payload(job.getPayload())
                .attempts(job.getAttempts())
                .maxAttempts(job.getMaxAttempts())
                .error(job.getError())
                .appointmentId(job.getAppointmentId())
                .paymentId(job.getPaymentId())
                .priority(job.getPriority())
                .metadata(job.getMetadata())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .printedAt(job.getPrintedAt())
                .lastAttemptAt(job.getLastAttemptAt())
                .build();
    }

    /**
     * Conta jobs pendentes de um terminal
     */
    @Transactional(readOnly = true)
    public long countPending(String terminalId) {
        return printJobRepository.countByTerminalIdAndStatus(terminalId, PrintJobStatus.PENDING);
    }

    /**
     * Lista jobs falhados de um terminal
     */
    @Transactional(readOnly = true)
    public List<PrintJobResponse> listFailed(String terminalId) {
        return printJobRepository.findByTerminalIdAndStatusOrderByUpdatedAtDesc(terminalId, PrintJobStatus.FAILED)
                .stream()
                .map(this::mapToResponse)
                .toList();
    }
}
