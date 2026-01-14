package br.lunavita.totemapi.controller;

import br.lunavita.totemapi.service.SeedService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final SeedService seedService;

    public AdminController(SeedService seedService) {
        this.seedService = seedService;
    }

    @PostMapping("/seed-test-data")
    public ResponseEntity<?> seed(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "40") int perDay) {
        LocalDate d = from;
        while (!d.isAfter(to)) {
            seedService.seedPaymentsForDate(d, perDay);
            d = d.plusDays(1);
        }
        return ResponseEntity.ok().build();
    }
}
