import { AuthResponse, AuthRequest, ValidationStatusResponse } from '../types';
import { store } from '../state/store';

/**
 * Handles authentication with WhookTown backend
 * Uses HttpOnly cookies for session (set by server) and CSRF cookie for protection
 * WebSocket uses the session cookie automatically during handshake
 */
export class AuthManager {
  private authChangeListeners: Set<(authenticated: boolean) => void> = new Set();

  constructor() {
    // Nettoyage des anciens tokens localStorage (migration)
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('yic_ws_token');
      localStorage.removeItem('app_token');
      localStorage.removeItem('yic_session_token');
    }
  }

  /**
   * Subscribe to auth state changes
   * Returns an unsubscribe function
   */
  onAuthChange(callback: (authenticated: boolean) => void): () => void {
    this.authChangeListeners.add(callback);
    return () => this.authChangeListeners.delete(callback);
  }

  /**
   * @deprecated Use onAuthChange instead
   */
  setOnAuthChange(callback: (authenticated: boolean) => void): void {
    this.authChangeListeners.add(callback);
  }

  /**
   * Get CSRF token from cookie (Double Submit Cookie pattern)
   */
  getCSRFToken(): string | null {
    // Look for app-specific CSRF cookie for threejs-scene
    const match = document.cookie.match(/csrf_token_threejs=([^;]+)/);
    return match ? match[1] : null;
  }

  /**
   * Check if user is authenticated by looking for CSRF cookie
   * (Session cookie is HttpOnly and not accessible via JS)
   */
  isAuthenticated(): boolean {
    return this.getCSRFToken() !== null;
  }

  /**
   * Get headers to include in authenticated requests
   */
  getAuthHeaders(): Record<string, string> {
    const csrf = this.getCSRFToken();
    return {
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      'X-App-ID': 'threejs',
    };
  }

  async login(email: string): Promise<AuthResponse> {
    const request: AuthRequest = {
      email,
      type: 'user',
      name: 'threejs-viewer',
      app_id: 'threejs',
    };

    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-ID': 'threejs' },
      credentials: 'same-origin',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Login failed');
    }

    const data: AuthResponse = await response.json();
    // Cookie session_token est defini par le serveur
    // Only trigger auth change if validation is not pending
    // (i.e., SKIP_EMAIL_VALIDATION=true on server)
    if (!data.validation_pending) {
      this.notifyAuthChange(true);
    }
    return data;
  }

  /**
   * Check if a token has been validated via email link (for polling)
   */
  async checkValidationStatus(token: string): Promise<ValidationStatusResponse> {
    const response = await fetch(`/auth/check/validation/${token}`, {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error('Failed to check validation status');
    }

    return response.json();
  }

  async loginWithToken(token: string): Promise<AuthResponse> {
    const response = await fetch('/auth/login/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-ID': 'threejs' },
      credentials: 'same-origin',
      body: JSON.stringify({ token, app_id: 'threejs' }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Token login failed');
    }

    const data: AuthResponse = await response.json();
    // Cookie session_token est defini par le serveur
    this.notifyAuthChange(true);
    return data;
  }

  async redeemExchangeCode(code: string): Promise<void> {
    const response = await fetch('/auth/exchange/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ code, app_id: 'threejs' }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Exchange code redemption failed');
    }

    this.notifyAuthChange(true);
  }

  async logout(): Promise<void> {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: this.getAuthHeaders(),
      });
    } finally {
      // Reset store to clear all user data (layouts, building states, etc.)
      store.reset();
      // Notify even if request fails (cookies cleared server-side)
      this.notifyAuthChange(false);
    }
  }

  /**
   * Notify that auth state has changed (for use by WebSocket when account is locked)
   */
  notifyAuthChange(authenticated: boolean): void {
    this.authChangeListeners.forEach(callback => callback(authenticated));
  }
}

export const authManager = new AuthManager();
