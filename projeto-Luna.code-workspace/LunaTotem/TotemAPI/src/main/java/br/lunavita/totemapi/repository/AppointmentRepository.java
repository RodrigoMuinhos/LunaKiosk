package br.lunavita.totemapi.repository;

import br.lunavita.totemapi.model.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, String> {

    // ===== MÉTODOS MULTI-TENANT (SEMPRE FILTRAR POR TENANT_ID) =====

    /**
     * Busca agendamento por ID dentro do tenant
     */
    Optional<Appointment> findByTenantIdAndId(String tenantId, String id);

    /**
     * Lista todos os agendamentos do tenant
     */
    List<Appointment> findAllByTenantId(String tenantId);

    /**
     * Busca agendamentos futuros do tenant, ordenados por data/hora
     */
    List<Appointment> findByTenantIdAndDateGreaterThanEqualOrderByDateAscTimeAscPatientAsc(
            String tenantId, LocalDate from);

    /**
     * Busca agendamentos futuros filtrando por nome de paciente
     */
    List<Appointment> findByTenantIdAndDateGreaterThanEqualAndPatientIgnoreCaseContainingOrderByDateAscTimeAscPatientAsc(
            String tenantId, LocalDate from, String patientPart);

    /**
     * Busca agendamentos por status dentro do tenant
     */
    List<Appointment> findByTenantIdAndStatusOrderByDateAscTimeAsc(String tenantId, String status);

    /**
     * Busca agendamentos de uma data específica do tenant
     */
    List<Appointment> findByTenantIdAndDateOrderByTimeAsc(String tenantId, LocalDate date);

    /**
     * Busca agendamentos de um paciente específico
     */
    List<Appointment> findByTenantIdAndPatientIdOrderByDateDescTimeDesc(String tenantId, String patientId);

    /**
     * Conta agendamentos não pagos do tenant
     */
    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.tenantId = :tenantId AND a.paid = false")
    long countUnpaidByTenantId(@Param("tenantId") String tenantId);

    // ===== MÉTODOS DEPRECADOS (NÃO USAR - SEM FILTRO DE TENANT) =====

    /**
     * @deprecated Use
     *             findByTenantIdAndDateGreaterThanEqualOrderByDateAscTimeAscPatientAsc()
     */
    @Deprecated
    List<Appointment> findByDateGreaterThanEqualOrderByDateAscTimeAscPatientAsc(LocalDate from);

    /**
     * @deprecated Use
     *             findByTenantIdAndDateGreaterThanEqualAndPatientIgnoreCaseContainingOrderByDateAscTimeAscPatientAsc()
     */
    @Deprecated
    List<Appointment> findByDateGreaterThanEqualAndPatientIgnoreCaseContainingOrderByDateAscTimeAscPatientAsc(
            LocalDate from, String patientPart);
}
