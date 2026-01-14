package com.luna.shared.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import java.util.Collection;
import java.util.List;

/**
 * UNIFIED ROLE AND PERMISSION SERVICE
 * Shared across LunaCore, TotemAPI, and LunaPay
 * 
 * Usage:
 * @PreAuthorize("@unifiedRoleService.canPerformAction(#action, #resourceTenantId)")
 */
@Component("unifiedRoleService")
public class UnifiedRoleService {

    // ============================================================
    // ROLE CHECKS
    // ============================================================

    public boolean hasRole(String role) {
        return SecurityContextHolder.getContext()
                .getAuthentication()
                .getAuthorities()
                .stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_" + role));
    }

    public boolean hasAnyRole(String... roles) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        for (String role : roles) {
            if (auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_" + role))) {
                return true;
            }
        }
        return false;
    }

    public String getCurrentRole() {
        return SecurityContextHolder.getContext()
                .getAuthentication()
                .getAuthorities()
                .stream()
                .findFirst()
                .map(auth -> auth.getAuthority().replace("ROLE_", ""))
                .orElse(null);
    }

    // ============================================================
    // TENANT ISOLATION CHECKS
    // ============================================================

    public String getCurrentTenantId() {
        Object principal = SecurityContextHolder.getContext()
                .getAuthentication()
                .getPrincipal();
        
        if (principal instanceof com.luna.core.user.entity.User) {
            return ((com.luna.core.user.entity.User) principal)
                    .getTenant()
                    .getId();
        }
        return null;
    }

    public boolean isOwnTenant(String resourceTenantId) {
        String currentTenantId = getCurrentTenantId();
        return currentTenantId != null && currentTenantId.equals(resourceTenantId);
    }

    // ============================================================
    // MODULE CHECKS
    // ============================================================

    @SuppressWarnings("unchecked")
    public List<String> getCurrentModules() {
        // Extract from JWT token claims
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Object details = auth.getDetails();
        
        if (details instanceof java.util.Map) {
            return (List<String>) ((java.util.Map<?, ?>) details).get("modules");
        }
        return List.of();
    }

    public boolean hasModule(String module) {
        return getCurrentModules().contains(module);
    }

    public boolean hasAnyModule(String... modules) {
        Collection<String> userModules = getCurrentModules();
        for (String module : modules) {
            if (userModules.contains(module)) {
                return true;
            }
        }
        return false;
    }

    // ============================================================
    // PERMISSION CHECKS - LUNACORE
    // ============================================================

    public boolean canManageTenants() {
        String role = getCurrentRole();
        return role.equals("OWNER") || role.equals("ADMIN");
    }

    public boolean canManageUsers() {
        String role = getCurrentRole();
        return role.equals("OWNER") || role.equals("ADMIN");
    }

    public boolean canManageLicenses() {
        String role = getCurrentRole();
        return role.equals("OWNER") || role.equals("ADMIN");
    }

    public boolean canViewLicenses() {
        String role = getCurrentRole();
        return role.equals("OWNER") || role.equals("ADMIN") || role.equals("FINANCE");
    }

    public boolean canManageDevices() {
        String role = getCurrentRole();
        return role.equals("OWNER") || role.equals("ADMIN") || role.equals("DOCTOR");
    }

    // ============================================================
    // PERMISSION CHECKS - TOTEMAPI
    // ============================================================

    public boolean canManagePatients() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("DOCTOR") || role.equals("RECEPTION");
    }

    public boolean canViewAllPatients() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("RECEPTION");
    }

    public boolean canViewOwnPatients() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("DOCTOR") || 
               role.equals("RECEPTION") || role.equals("GUEST");
    }

    public boolean canManageDoctors() {
        String role = getCurrentRole();
        return role.equals("ADMIN");
    }

    public boolean canViewDoctors() {
        return hasAnyRole("ADMIN", "DOCTOR", "RECEPTION", "GUEST");
    }

    public boolean canManageConsultations() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("DOCTOR") || role.equals("RECEPTION");
    }

    public boolean canViewAllConsultations() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("RECEPTION");
    }

    public boolean canViewOwnConsultations() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("DOCTOR") || 
               role.equals("RECEPTION") || role.equals("GUEST");
    }

    public boolean canManageMedicalRecords() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("DOCTOR");
    }

    public boolean canViewMedicalRecords() {
        return hasAnyRole("ADMIN", "DOCTOR", "RECEPTION");
    }

    // ============================================================
    // PERMISSION CHECKS - LUNAPAY
    // ============================================================

    public boolean canManagePayments() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("FINANCE");
    }

    public boolean canViewAllPayments() {
        return hasAnyRole("ADMIN", "FINANCE");
    }

    public boolean canViewOwnPayments() {
        return hasAnyRole("ADMIN", "FINANCE");
    }

    public boolean canProcessPayments() {
        String role = getCurrentRole();
        return role.equals("FINANCE");
    }

    public boolean canManagePaymentMethods() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("FINANCE");
    }

    public boolean canManageInvoices() {
        String role = getCurrentRole();
        return role.equals("ADMIN") || role.equals("FINANCE");
    }

    // ============================================================
    // GENERIC PERMISSION CHECK
    // ============================================================

    /**
     * Generic check for action authorization
     * @param action The action to check (VIEW, CREATE, UPDATE, DELETE)
     * @param resourceType The type of resource
     * @return true if user can perform the action
     */
    public boolean canPerformAction(String action, String resourceType) {
        String role = getCurrentRole();
        
        return switch (action.toUpperCase()) {
            case "VIEW" -> canView(role, resourceType);
            case "CREATE" -> canCreate(role, resourceType);
            case "UPDATE" -> canUpdate(role, resourceType);
            case "DELETE" -> canDelete(role, resourceType);
            default -> false;
        };
    }

    /**
     * Check if user can view a resource
     */
    public boolean canView(String role, String resourceType) {
        return switch (resourceType.toUpperCase()) {
            case "TENANT" -> role.equals("OWNER") || role.equals("ADMIN");
            case "USER" -> role.equals("OWNER") || role.equals("ADMIN");
            case "LICENSE" -> role.equals("OWNER") || role.equals("ADMIN") || role.equals("FINANCE");
            case "PATIENT" -> role.equals("ADMIN") || role.equals("DOCTOR") || role.equals("RECEPTION") || role.equals("GUEST");
            case "DOCTOR" -> role.equals("ADMIN") || role.equals("DOCTOR") || role.equals("RECEPTION") || role.equals("GUEST");
            case "CONSULTATION" -> role.equals("ADMIN") || role.equals("DOCTOR") || role.equals("RECEPTION") || role.equals("GUEST");
            case "PAYMENT" -> role.equals("ADMIN") || role.equals("FINANCE");
            case "INVOICE" -> role.equals("ADMIN") || role.equals("FINANCE");
            default -> false;
        };
    }

    /**
     * Check if user can create a resource
     */
    public boolean canCreate(String role, String resourceType) {
        return switch (resourceType.toUpperCase()) {
            case "TENANT" -> role.equals("OWNER");
            case "USER" -> role.equals("OWNER") || role.equals("ADMIN");
            case "LICENSE" -> role.equals("OWNER") || role.equals("ADMIN");
            case "PATIENT" -> role.equals("ADMIN") || role.equals("RECEPTION");
            case "DOCTOR" -> role.equals("ADMIN");
            case "CONSULTATION" -> role.equals("ADMIN") || role.equals("DOCTOR") || role.equals("RECEPTION");
            case "PAYMENT" -> role.equals("FINANCE");
            case "INVOICE" -> role.equals("ADMIN") || role.equals("FINANCE");
            default -> false;
        };
    }

    /**
     * Check if user can update a resource
     */
    public boolean canUpdate(String role, String resourceType) {
        return switch (resourceType.toUpperCase()) {
            case "TENANT" -> role.equals("OWNER") || role.equals("ADMIN");
            case "USER" -> role.equals("OWNER") || role.equals("ADMIN");
            case "LICENSE" -> role.equals("OWNER") || role.equals("ADMIN");
            case "PATIENT" -> role.equals("ADMIN") || role.equals("DOCTOR") || role.equals("RECEPTION");
            case "DOCTOR" -> role.equals("ADMIN") || role.equals("DOCTOR");
            case "CONSULTATION" -> role.equals("ADMIN") || role.equals("DOCTOR") || role.equals("RECEPTION");
            case "PAYMENT" -> role.equals("ADMIN") || role.equals("FINANCE");
            case "INVOICE" -> role.equals("ADMIN") || role.equals("FINANCE");
            default -> false;
        };
    }

    /**
     * Check if user can delete a resource
     */
    public boolean canDelete(String role, String resourceType) {
        return switch (resourceType.toUpperCase()) {
            case "TENANT" -> role.equals("OWNER");
            case "USER" -> role.equals("OWNER");
            case "LICENSE" -> role.equals("OWNER");
            case "PATIENT" -> role.equals("ADMIN");
            case "DOCTOR" -> role.equals("ADMIN");
            case "CONSULTATION" -> role.equals("ADMIN");
            case "PAYMENT" -> role.equals("ADMIN");
            case "INVOICE" -> role.equals("ADMIN");
            default -> false;
        };
    }

    // ============================================================
    // OWNER CHECK
    // ============================================================

    public boolean isOwner() {
        return hasRole("OWNER");
    }

    public boolean isAdmin() {
        return hasRole("ADMIN");
    }

    // ============================================================
    // DEBUG
    // ============================================================

    public String debugInfo() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        StringBuilder sb = new StringBuilder();
        sb.append("User: ").append(auth.getPrincipal()).append("\n");
        sb.append("Authorities: ").append(auth.getAuthorities()).append("\n");
        sb.append("Tenant ID: ").append(getCurrentTenantId()).append("\n");
        sb.append("Modules: ").append(getCurrentModules()).append("\n");
        return sb.toString();
    }
}
