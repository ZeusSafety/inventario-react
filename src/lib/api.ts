export const API_BASE_URL = 'https://api-inventario-logistica-2946605267.us-central1.run.app';

export async function apiCall(action: string, method: string = 'GET', data: unknown = null) {
  try {
    const url = `${API_BASE_URL}/?action=${action}`;

    const options: RequestInit = {
      method: method,
      headers: {}
    };

    if (method !== 'GET' && data) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json'
      };
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        message: result.message || result.error || `Error del servidor: ${response.status}`
      };
    }

    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error en API ${action}:`, error);
    
    return { success: false, message: `Error de conexión: ${message}` };
  }
}

export async function apiCallFormData(action: string, formData: FormData) {
  try {
    const url = `${API_BASE_URL}/?action=${action}`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error en API ${action}:`, error);
    return { success: false, message: `Error de conexión: ${message}` };
  }
}
