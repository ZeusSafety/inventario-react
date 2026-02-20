export const API_BASE_URL = 'https://api-inventario-logistica-2946605267.us-central1.run.app';

export async function apiCall(action: string, method: string = 'GET', data: unknown = null, timeout: number = 60000) {
  try {
    const url = `${API_BASE_URL}/?action=${action}`;

    // Crear AbortController para timeout compatible con todos los navegadores
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const options: RequestInit = {
      method: method,
      headers: {},
      signal: controller.signal
    };

    if (method !== 'GET' && data) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json'
      };
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          message: result.message || result.error || `Error del servidor: ${response.status}`
        };
      }

      return result;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      // Si fue abortado, es un timeout
      if (fetchError.name === 'AbortError' || controller.signal.aborted) {
        throw new Error('La operación está tardando demasiado. Por favor, espere un momento y vuelva a intentar.');
      }
      throw fetchError;
    }
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
