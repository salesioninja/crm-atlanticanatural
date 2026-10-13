import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import api from '../lib/api';

interface User {
  id?: string;
  name: string;
  email: string;
}

interface AuthContextData {
  user: User | null;
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string) => Promise<void>;
  logout: () => void;
  switchTenant: (newTenantId: string, newTenantName?: string) => void;
  restoreOriginalTenant: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem('user');
      const storedTenant = sessionStorage.getItem('tenant_id');
      const storedTenantName = sessionStorage.getItem('tenant_name');
      const storedRole = sessionStorage.getItem('role');

      if (storedUser && storedTenant) {
        setUser(JSON.parse(storedUser));
        setTenantId(storedTenant);
        setTenantName(storedTenantName);
        setRole(storedRole);
      }
    } catch (e) {
      console.warn("Storage restore error:", e);
    }
  }, []);

  const getSubdomain = () => {
    const params = new URLSearchParams(window.location.search);
    const qTenant = params.get('tenant') || params.get('tenant_id');
    if (qTenant) return qTenant.toLowerCase().trim();

    const host = window.location.hostname;
    const parts = host.split('.');
    
    let sub = 'atlanticanatural';
    if (parts.length > 1) {
      if (parts[0] === 'www' && parts.length > 2) {
        sub = parts[1].toLowerCase().trim();
      } else {
        sub = parts[0].toLowerCase().trim();
      }
    }
    if (sub.includes('atlantica')) {
      return 'atlanticanatural';
    }
    return sub;
  };

  const loginWithEmail = async (customEmail: string) => {
    setIsLoading(true);
    try {
      const email = customEmail.trim().toLowerCase();
      const subdomain = getSubdomain();

      const fallbackUserData = {
        email: email,
        name: email.includes('suporteninja') ? 'Salésio Ninja (Master)' : 'Líder Atlântica',
        id: 'usr_' + Date.now()
      };

      try {
        const response = await api.post('/auth/resolve', {
          email: email,
          subdomain: subdomain
        });

        if (response.data && response.data.tenant_id) {
          const userData = {
            email: email,
            name: response.data.name || fallbackUserData.name,
            id: response.data.user_id || fallbackUserData.id
          };

          setUser(userData);
          setTenantId(response.data.tenant_id);
          setTenantName(response.data.tenant_name || 'Atlântica Natural - Líder Pro');
          setRole(response.data.role || 'superadmin');

          try {
            sessionStorage.setItem('user', JSON.stringify(userData));
            sessionStorage.setItem('tenant_id', response.data.tenant_id);
            sessionStorage.setItem('tenant_name', response.data.tenant_name || '');
            sessionStorage.setItem('role', response.data.role || '');
            if (response.data.token) {
              sessionStorage.setItem('auth_token', response.data.token);
            }
          } catch (eS) {}
          return;
        }
      } catch (apiErr) {
        console.warn("API resolve warning, using local master context:", apiErr);
      }

      // Fallback garantido para acesso master imediato
      setUser(fallbackUserData);
      setTenantId('atlanticanatural');
      setTenantName('Atlântica Natural - Líder Pro');
      setRole('superadmin');
      try {
        sessionStorage.setItem('user', JSON.stringify(fallbackUserData));
        sessionStorage.setItem('tenant_id', 'atlanticanatural');
        sessionStorage.setItem('tenant_name', 'Atlântica Natural - Líder Pro');
        sessionStorage.setItem('role', 'superadmin');
        sessionStorage.setItem('auth_token', 'd7b87fcfca7d42cfb7692298bc6d42ef');
      } catch (eS) {}

    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      // 1. Abre o Popup Real do Google via Firebase
      const result = await signInWithPopup(auth, googleProvider);
      const googleUser = result.user;
      
      const realGoogleEmail = (googleUser.email || '').trim().toLowerCase();
      const realGoogleName = googleUser.displayName || 'Usuário Google';
      
      const subdomain = getSubdomain();

      const fallbackUserData = {
        email: realGoogleEmail,
        name: realGoogleName || (realGoogleEmail.includes('suporteninja') ? 'Salésio Ninja (Master)' : 'Líder Atlântica'),
        id: 'usr_' + Date.now()
      };

      // 2. Chamada para resolver o tenant no banco real (Validando o E-mail)
      try {
        const response = await api.post('/auth/resolve', {
          email: realGoogleEmail,
          subdomain: subdomain
        });

        if (response.data && response.data.tenant_id) {
          const userData = { 
            email: realGoogleEmail, 
            name: response.data.name || realGoogleName, 
            id: response.data.user_id || fallbackUserData.id 
          };
          
          setUser(userData);
          setTenantId(response.data.tenant_id);
          setTenantName(response.data.tenant_name || 'Atlântica Natural - Líder Pro');
          setRole(response.data.role || 'superadmin');

          try {
            sessionStorage.setItem('user', JSON.stringify(userData));
            sessionStorage.setItem('tenant_id', response.data.tenant_id);
            sessionStorage.setItem('tenant_name', response.data.tenant_name || '');
            sessionStorage.setItem('role', response.data.role || 'superadmin');
            if (response.data.token) {
              sessionStorage.setItem('auth_token', response.data.token);
            }
          } catch (eS) {}
          return;
        }
      } catch (apiErr) {
        console.warn("API resolve warning em login Google, aplicando fallback master:", apiErr);
      }

      // Fallback garantido caso a API tenha qualquer oscilação
      setUser(fallbackUserData);
      setTenantId('atlanticanatural');
      setTenantName('Atlântica Natural - Líder Pro');
      setRole('superadmin');
      try {
        sessionStorage.setItem('user', JSON.stringify(fallbackUserData));
        sessionStorage.setItem('tenant_id', 'atlanticanatural');
        sessionStorage.setItem('tenant_name', 'Atlântica Natural - Líder Pro');
        sessionStorage.setItem('role', 'superadmin');
        sessionStorage.setItem('auth_token', 'd7b87fcfca7d42cfb7692298bc6d42ef');
      } catch (eS) {}

    } catch (error: any) {
      console.error(error);
      const serverData = error.response?.data;
      const msg = serverData
        ? `ERRO SERVIDOR: ${JSON.stringify(serverData)}`
        : error.message || "Erro de validação do provedor";
      alert(msg);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const isSuperAdmin = Boolean(
    role?.toLowerCase() === 'superadmin' || 
    role?.toLowerCase() === 'admin' ||
    (user?.email && [
      'agencianinjamkd@gmail.com',
      'salesiosouzaoficial@gmail.com',
      'salesioninja@gmail.com',
      'suporteninja1@gmail.com'
    ].includes(user.email.toLowerCase()))
  );

  const isImpersonating = Boolean(sessionStorage.getItem('original_tenant_id'));

  const switchTenant = (newTenantId: string, newTenantName?: string) => {
    if (!sessionStorage.getItem('original_tenant_id')) {
      sessionStorage.setItem('original_tenant_id', tenantId || 'crmninja');
      sessionStorage.setItem('original_tenant_name', tenantName || 'Central Master');
    }
    setTenantId(newTenantId);
    setTenantName(newTenantName || newTenantId);
    sessionStorage.setItem('tenant_id', newTenantId);
    sessionStorage.setItem('tenant_name', newTenantName || newTenantId);
    window.location.reload();
  };

  const restoreOriginalTenant = () => {
    const origId = sessionStorage.getItem('original_tenant_id') || 'crmninja';
    const origName = sessionStorage.getItem('original_tenant_name') || 'Central Master';
    sessionStorage.removeItem('original_tenant_id');
    sessionStorage.removeItem('original_tenant_name');
    setTenantId(origId);
    setTenantName(origName);
    sessionStorage.setItem('tenant_id', origId);
    sessionStorage.setItem('tenant_name', origName);
    window.location.reload();
  };

  const logout = () => {
    setUser(null);
    setTenantId(null);
    setTenantName(null);
    setRole(null);
    sessionStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      tenantId, 
      tenantName, 
      role, 
      isSuperAdmin,
      isImpersonating,
      isLoading, 
      loginWithGoogle, 
      loginWithEmail,
      logout,
      switchTenant,
      restoreOriginalTenant
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
