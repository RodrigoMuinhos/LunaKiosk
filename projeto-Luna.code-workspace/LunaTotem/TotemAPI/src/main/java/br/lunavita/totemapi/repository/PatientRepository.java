package br.lunavita.totemapi.repository;

import br.lunavita.totemapi.model.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, String> {

    // ===== MÉTODOS MULTI-TENANT (SEMPRE FILTRAR POR TENANT_ID) =====

    /**
     * Busca paciente por CPF dentro do tenant
     */
    Optional<Patient> findByTenantIdAndCpf(String tenantId, String cpf);

    /**
     * Busca paciente por ID dentro do tenant
     */
    Optional<Patient> findByTenantIdAndId(String tenantId, String id);

    /**
     * Lista todos os pacientes do tenant
     */
    List<Patient> findAllByTenantId(String tenantId);

    /**
     * Busca pacientes por nome (case-insensitive) dentro do tenant
     */
    List<Patient> findByTenantIdAndNameContainingIgnoreCase(String tenantId, String namePart);

    // ===== MÉTODOS DEPRECADOS (NÃO USAR - SEM FILTRO DE TENANT) =====

    /**
     * @deprecated Use findByTenantIdAndCpf() para garantir isolamento multi-tenant
     */
    @Deprecated
    Optional<Patient> findByCpf(String cpf);
}
