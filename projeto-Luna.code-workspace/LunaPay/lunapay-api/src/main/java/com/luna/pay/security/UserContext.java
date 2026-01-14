package com.luna.pay.security;

import java.util.List;

public class UserContext {

    private final String userId;
    private final String tenantId;
    private final String role;
    private final List<String> modules;

    public UserContext(String userId, String tenantId, String role, List<String> modules) {
        this.userId = userId;
        this.tenantId = tenantId;
        this.role = role;
        this.modules = modules;
    }

    public String getUserId() { 
        return userId; 
    }
    
    public String getTenantId() { 
        return tenantId; 
    }
    
    public String getRole() { 
        return role; 
    }
    
    public List<String> getModules() { 
        return modules; 
    }

    public boolean hasModule(String module) {
        return modules.contains(module);
    }
}
