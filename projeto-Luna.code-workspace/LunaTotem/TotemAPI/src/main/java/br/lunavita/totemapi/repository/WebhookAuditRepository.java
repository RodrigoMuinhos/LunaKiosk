package br.lunavita.totemapi.repository;

import br.lunavita.totemapi.model.WebhookAudit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookAuditRepository extends JpaRepository<WebhookAudit, String> {
}
