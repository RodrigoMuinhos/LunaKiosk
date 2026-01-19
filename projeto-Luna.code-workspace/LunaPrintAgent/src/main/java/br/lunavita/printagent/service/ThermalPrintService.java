package br.lunavita.printagent.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.print.*;
import javax.print.attribute.HashPrintRequestAttributeSet;
import javax.print.attribute.PrintRequestAttributeSet;
import java.util.Base64;

/**
 * Serviço de impressão usando javax.print
 * Imprime bytes ESC/POS diretamente na impressora USB
 */
public class ThermalPrintService {

    private static final Logger log = LoggerFactory.getLogger(ThermalPrintService.class);

    private final String printerName;

    public ThermalPrintService(String printerName) {
        this.printerName = printerName;
    }

    /**
     * Imprime o conteúdo ESC/POS (Base64) na impressora
     */
    public void print(String base64Payload) throws Exception {
        // Decodifica Base64 para bytes ESC/POS
        byte[] escPosBytes = Base64.getDecoder().decode(base64Payload);

        // Busca a impressora
        PrintService printer = findPrintService();
        if (printer == null) {
            throw new Exception("Impressora não encontrada: " + 
                              (printerName != null ? printerName : "padrão"));
        }

        log.info("Imprimindo em: {}", printer.getName());

        // Cria o job de impressão
        DocPrintJob printJob = printer.createPrintJob();

        // Define o documento (bytes ESC/POS)
        Doc doc = new SimpleDoc(escPosBytes, DocFlavor.BYTE_ARRAY.AUTOSENSE, null);

        // Atributos de impressão
        PrintRequestAttributeSet attributes = new HashPrintRequestAttributeSet();

        // Executa a impressão
        printJob.print(doc, attributes);

        log.info("Impressão enviada com sucesso");
    }

    /**
     * Busca a impressora configurada (ou padrão)
     */
    private PrintService findPrintService() {
        PrintService[] printers = PrintServiceLookup.lookupPrintServices(null, null);

        if (printers == null || printers.length == 0) {
            log.warn("Nenhuma impressora encontrada no sistema");
            return null;
        }

        // Se não configurou nome específico, usa a padrão
        if (printerName == null || printerName.isBlank()) {
            PrintService defaultPrinter = PrintServiceLookup.lookupDefaultPrintService();
            if (defaultPrinter != null) {
                log.info("Usando impressora padrão: {}", defaultPrinter.getName());
                return defaultPrinter;
            }
            log.warn("Nenhuma impressora padrão configurada");
            return null;
        }

        // Busca impressora pelo nome
        for (PrintService printer : printers) {
            if (printer.getName().equalsIgnoreCase(printerName) ||
                printer.getName().contains(printerName)) {
                log.info("Impressora encontrada: {}", printer.getName());
                return printer;
            }
        }

        log.warn("Impressora '{}' não encontrada. Impressoras disponíveis:", printerName);
        for (PrintService printer : printers) {
            log.warn("  - {}", printer.getName());
        }

        return null;
    }

    /**
     * Verifica se a impressora está disponível
     */
    public boolean isPrinterAvailable() {
        try {
            return findPrintService() != null;
        } catch (Exception e) {
            log.error("Erro ao verificar impressora", e);
            return false;
        }
    }

    /**
     * Lista todas as impressoras disponíveis
     */
    public void listAvailablePrinters() {
        PrintService[] printers = PrintServiceLookup.lookupPrintServices(null, null);
        
        if (printers == null || printers.length == 0) {
            log.info("Nenhuma impressora encontrada");
            return;
        }

        log.info("Impressoras disponíveis:");
        for (PrintService printer : printers) {
            log.info("  - {}", printer.getName());
        }
    }
}
