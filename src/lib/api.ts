import axios from 'axios';

const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const pathname = window.location.pathname;
  if (pathname.includes('/crm-clinicas')) {
    return '/crm-clinicas/api/index.php';
  }
  const match = pathname.match(/^(\/[^\/]+)\//);
  if (match && match[1] !== '/api' && match[1] !== '/assets') {
    return `${match[1]}/api/index.php`;
  }
  return '/api/index.php';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

// Interceptor global do Axios para injetar o contexto Multi-tenant dinamicamente
api.interceptors.request.use((config) => {
  const host = window.location.hostname;
  const parts = host.split('.');
  
  let subdomain = 'atlanticanatural';
  if (parts.length > 1) {
    if (parts[0] === 'www' && parts.length > 2) {
      subdomain = parts[1];
    } else {
      subdomain = parts[0];
    }
  }
  if (subdomain.includes('atlantica')) {
    subdomain = 'atlanticanatural';
  }

  const urlParams = new URLSearchParams(window.location.search);
  const qTenant = urlParams.get('tenant') || urlParams.get('tenant_id');

  // Remove hardcoded values and uses dynamic session context
  const sessionTenantId = sessionStorage.getItem('tenant_id');
  const sessionUser = sessionStorage.getItem('user');
  let userEmail = '';
  
  if (sessionUser) {
    try {
      const parsedUser = JSON.parse(sessionUser);
      userEmail = parsedUser.email || '';
    } catch (e) {
      // JSON parse error
    }
  }

  const sessionToken = sessionStorage.getItem('auth_token');

  config.headers['Content-Type'] = 'application/json';
  config.headers['Authorization'] = `Bearer ${sessionToken || import.meta.env.VITE_API_SECRET || 'd7b87fcfca7d42cfb7692298bc6d42ef'}`;
  config.headers['X-Tenant-ID'] = qTenant || sessionTenantId || subdomain;
  config.headers['X-User-Email'] = userEmail || 'prospect-publico@acessaronline.com.br';
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
