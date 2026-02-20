import { authManager } from '../auth/AuthManager';
import { store } from '../state/store';

/**
 * UI Manager - handles login page and overlay
 */
// Import SceneManager type for setSceneManager
import type { SceneManager } from '../scene/SceneManager';

class UIManager {
  private loginContainer: HTMLElement | null = null;
  private sceneContainer: HTMLElement | null = null;
  private overlayContainer: HTMLElement | null = null;
  private waitingContainer: HTMLElement | null = null;
  private validationPollInterval: number | null = null;
  private leftPanelCollapsed: boolean = true; // Ferme par defaut
  private sceneManager: SceneManager | null = null;
  private expandedGroups: Set<string> = new Set(); // Track which building type groups are expanded

  init(): void {
    this.createLoginPage();
    this.createWaitingPage();
    this.createSceneContainer();
    this.createOverlay();

    // Subscribe to store changes
    store.subscribe(() => this.updateOverlay());

    // Check if already logged in
    if (authManager.isAuthenticated()) {
      this.showScene();
    } else {
      this.showLogin();
    }

    // Auth change handler
    authManager.onAuthChange((authenticated) => {
      if (authenticated) {
        this.showScene();
        this.resetLoginForm();
      } else {
        this.showLogin();
      }
    });
  }

  private createLoginPage(): void {
    this.loginContainer = document.createElement('div');
    this.loginContainer.id = 'login-container';
    this.loginContainer.innerHTML = `
      <div class="login-box">
        <div class="login-brand">
          <img src="/logo-clean.svg" alt="WhookTown" class="login-logo" />
        </div>
        <p class="subtitle">3D Infrastructure Visualization</p>

        <div class="tabs">
          <button class="tab active" data-tab="email">Email</button>
          <button class="tab" data-tab="token">Token</button>
        </div>

        <form id="auth-form">
          <input type="email" id="email-input" placeholder="Email address" required>
          <button type="submit" id="submit-btn">Login</button>
          <p class="error" id="auth-error"></p>
        </form>

        <form id="token-form" style="display: none;">
          <input type="text" id="token-input" placeholder="API Token" required>
          <button type="submit" id="token-submit-btn">Login</button>
          <p class="error" id="token-error"></p>
        </form>

        <p class="signup-link">
          Don't have an account? <a href="https://app.whook.town" target="_blank" rel="noopener noreferrer">Sign up at app.whook.town</a>
        </p>
      </div>
    `;
    document.body.appendChild(this.loginContainer);

    // Tab switching
    const tabs = this.loginContainer.querySelectorAll('.tab');
    const emailForm = document.getElementById('auth-form');
    const tokenForm = document.getElementById('token-form');

    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        tabs.forEach((t) => t.classList.remove('active'));
        target.classList.add('active');

        const activeTab = target.dataset.tab;
        if (emailForm && tokenForm) {
          if (activeTab === 'token') {
            emailForm.style.display = 'none';
            tokenForm.style.display = 'flex';
          } else {
            emailForm.style.display = 'flex';
            tokenForm.style.display = 'none';
          }
        }
      });
    });

    // Email form submission
    emailForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('email-input') as HTMLInputElement).value;
      const errorEl = document.getElementById('auth-error');
      const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Loading...';
        const response = await authManager.login(email);

        // Check if validation is pending (email not yet validated)
        if (response.validation_pending) {
          this.showWaitingForValidation(response.app_token);
        }
        // If not pending, authManager.login() already called notifyAuthChange(true)
        // which triggers showScene() via the auth change listener
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = (err as Error).message;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
      }
    });

    // Token form submission
    tokenForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = (document.getElementById('token-input') as HTMLInputElement).value;
      const errorEl = document.getElementById('token-error');
      const submitBtn = document.getElementById('token-submit-btn') as HTMLButtonElement;

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Loading...';
        await authManager.loginWithToken(token);
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = (err as Error).message;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
      }
    });
  }

  private createWaitingPage(): void {
    this.waitingContainer = document.createElement('div');
    this.waitingContainer.id = 'waiting-container';
    this.waitingContainer.innerHTML = `
      <div class="waiting-box">
        <div class="waiting-brand">
          <img src="/logo-clean.svg" alt="WhookTown" class="waiting-logo" />
        </div>
        <h2>Check Your Email</h2>
        <p class="waiting-message">
          We've sent a validation link to your email address.<br/>
          Click the link to authenticate and display your 3D city.
        </p>
        <div class="waiting-spinner">
          <div class="spinner"></div>
          <p>Waiting for validation...</p>
        </div>
        <button id="cancel-waiting-btn" class="cancel-btn">Cancel</button>
      </div>
    `;
    this.waitingContainer.style.display = 'none';
    document.body.appendChild(this.waitingContainer);

    document.getElementById('cancel-waiting-btn')?.addEventListener('click', () => {
      this.stopValidationPolling();
      this.showLogin();
    });
  }

  showWaitingForValidation(token: string): void {
    if (this.loginContainer) this.loginContainer.style.display = 'none';
    if (this.sceneContainer) this.sceneContainer.style.display = 'none';
    if (this.overlayContainer) this.overlayContainer.style.display = 'none';
    if (this.waitingContainer) this.waitingContainer.style.display = 'flex';
    this.startValidationPolling(token);
  }

  private startValidationPolling(token: string): void {
    this.stopValidationPolling();
    this.validationPollInterval = window.setInterval(async () => {
      try {
        const status = await authManager.checkValidationStatus(token);
        if (status.validated) {
          this.stopValidationPolling();
          authManager.notifyAuthChange(true);
        } else if (status.expired) {
          this.stopValidationPolling();
          alert('Validation link has expired. Please try again.');
          this.showLogin();
        }
      } catch (error) {
        console.error('Validation poll error:', error);
        // Continue polling on transient errors
      }
    }, 3000); // Poll every 3 seconds
  }

  private stopValidationPolling(): void {
    if (this.validationPollInterval) {
      clearInterval(this.validationPollInterval);
      this.validationPollInterval = null;
    }
  }

  private createSceneContainer(): void {
    this.sceneContainer = document.createElement('div');
    this.sceneContainer.id = 'scene-container';
    this.sceneContainer.style.display = 'none';
    document.body.appendChild(this.sceneContainer);
  }

  private createOverlay(): void {
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'overlay';
    this.overlayContainer.innerHTML = `
      <div class="header">
        <div class="neon-brand">
          <img src="/logo-clean.svg" alt="" class="neon-logo" />
          <span class="neon-text">WhookTown</span>
        </div>
        <div class="status">
          <span class="indicator disconnected" id="connection-status"></span>
          <span id="connection-text">Disconnected</span>
        </div>
        <button id="labels-toggle-btn" title="Toggle building labels">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h16M4 12h10M4 17h6"/>
            <circle cx="18" cy="14" r="3"/>
            <path d="M18 11v6"/>
          </svg>
        </button>
        <button id="fullscreen-btn" title="Toggle fullscreen">
          <svg id="fullscreen-enter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
          <svg id="fullscreen-exit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        </button>
        <button id="logout-btn">Logout</button>
      </div>
      <button id="panel-toggle" class="panel-toggle" title="Toggle panel">
        <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12h18M3 6h18M3 18h18"/>
        </svg>
      </button>
      <div class="left-panel" id="left-panel">
        <div class="layout-selector" id="layout-selector">
          <label>City:</label>
          <select id="layout-select">
            <option value="">Waiting for layouts...</option>
          </select>
        </div>
        <div class="info-panel" id="info-panel">
          <h3>Buildings</h3>
          <div id="building-list"></div>
        </div>
      </div>
      <button id="recenter-btn" title="Recenter camera">
        <svg viewBox="0 0 24 24" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          <circle cx="12" cy="12" r="9" stroke-dasharray="4 2"/>
        </svg>
      </button>
    `;
    this.overlayContainer.style.display = 'none';
    document.body.appendChild(this.overlayContainer);

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      authManager.logout();
    });

    // Fullscreen toggle
    this.setupFullscreenToggle();

    // Layout selector - reload page to ensure clean scene state
    document.getElementById('layout-select')?.addEventListener('change', (e) => {
      const layoutId = (e.target as HTMLSelectElement).value;
      if (layoutId) {
        window.location.href = `${window.location.origin}${window.location.pathname}?layout=${layoutId}`;
      }
    });

    // Setup panel toggle
    this.setupPanelToggle();
  }

  private setupPanelToggle(): void {
    const toggleBtn = document.getElementById('panel-toggle');
    const leftPanel = document.getElementById('left-panel');

    // Restore state from localStorage (default is collapsed)
    const savedState = localStorage.getItem('leftPanelCollapsed');
    if (savedState === 'false') {
      // User explicitly opened the panel before
      this.leftPanelCollapsed = false;
    } else {
      // Default or 'true': keep collapsed
      leftPanel?.classList.add('collapsed');
      toggleBtn?.classList.add('collapsed');
    }

    toggleBtn?.addEventListener('click', () => {
      this.leftPanelCollapsed = !this.leftPanelCollapsed;

      if (this.leftPanelCollapsed) {
        leftPanel?.classList.add('collapsed');
        toggleBtn?.classList.add('collapsed');
      } else {
        leftPanel?.classList.remove('collapsed');
        toggleBtn?.classList.remove('collapsed');
      }

      // Persist state
      localStorage.setItem('leftPanelCollapsed', String(this.leftPanelCollapsed));
    });
  }

  private setupFullscreenToggle(): void {
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const enterIcon = document.getElementById('fullscreen-enter-icon');
    const exitIcon = document.getElementById('fullscreen-exit-icon');

    const updateIcons = (): void => {
      const isFullscreen = !!document.fullscreenElement;
      if (enterIcon && exitIcon) {
        enterIcon.style.display = isFullscreen ? 'none' : 'block';
        exitIcon.style.display = isFullscreen ? 'block' : 'none';
      }
    };

    fullscreenBtn?.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (err) {
        console.error('Fullscreen toggle failed:', err);
      }
    });

    // Listen for fullscreen changes (including ESC key exit)
    document.addEventListener('fullscreenchange', updateIcons);
  }

  private showLogin(): void {
    if (this.loginContainer) this.loginContainer.style.display = 'flex';
    if (this.sceneContainer) this.sceneContainer.style.display = 'none';
    if (this.overlayContainer) this.overlayContainer.style.display = 'none';
    if (this.waitingContainer) this.waitingContainer.style.display = 'none';
  }

  private resetLoginForm(): void {
    // Reset email form
    const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    const emailInput = document.getElementById('email-input') as HTMLInputElement;
    const emailErrorEl = document.getElementById('auth-error');

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
    }
    if (emailInput) {
      emailInput.value = '';
    }
    if (emailErrorEl) {
      emailErrorEl.textContent = '';
    }

    // Reset token form
    const tokenSubmitBtn = document.getElementById('token-submit-btn') as HTMLButtonElement;
    const tokenInput = document.getElementById('token-input') as HTMLInputElement;
    const tokenErrorEl = document.getElementById('token-error');

    if (tokenSubmitBtn) {
      tokenSubmitBtn.disabled = false;
      tokenSubmitBtn.textContent = 'Login';
    }
    if (tokenInput) {
      tokenInput.value = '';
    }
    if (tokenErrorEl) {
      tokenErrorEl.textContent = '';
    }
  }

  private showScene(): void {
    if (this.loginContainer) this.loginContainer.style.display = 'none';
    if (this.sceneContainer) this.sceneContainer.style.display = 'block';
    if (this.overlayContainer) this.overlayContainer.style.display = 'block';
    if (this.waitingContainer) this.waitingContainer.style.display = 'none';
  }

  private updateOverlay(): void {
    // Update connection status
    const statusEl = document.getElementById('connection-status');
    const textEl = document.getElementById('connection-text');

    if (store.isConnected()) {
      statusEl?.classList.remove('disconnected', 'connecting');
      statusEl?.classList.add('connected');
      if (textEl) textEl.textContent = 'Connected';
    } else if (store.isConnecting()) {
      statusEl?.classList.remove('connected', 'disconnected');
      statusEl?.classList.add('connecting');
      if (textEl) textEl.textContent = 'Connecting...';
    } else {
      statusEl?.classList.remove('connected', 'connecting');
      statusEl?.classList.add('disconnected');
      if (textEl) textEl.textContent = 'Disconnected';
    }

    // Update layout selector
    const layouts = store.getLayouts();
    const select = document.getElementById('layout-select') as HTMLSelectElement;
    const activeLayout = store.getActiveLayout();

    if (select && layouts.length > 0) {
      select.innerHTML = layouts
        .map((l) => `<option value="${l.id}" ${l.id === activeLayout?.id ? 'selected' : ''}>${l.name}</option>`)
        .join('');
    }

    // Update building list - grouped by type
    const buildingList = document.getElementById('building-list');
    if (buildingList && activeLayout) {
      // Group buildings by type
      const groupedByType = new Map<string, typeof activeLayout.buildings>();
      for (const b of activeLayout.buildings) {
        const type = b.type || 'unknown';
        if (!groupedByType.has(type)) {
          groupedByType.set(type, []);
        }
        groupedByType.get(type)!.push(b);
      }

      // Sort groups alphabetically
      const sortedTypes = Array.from(groupedByType.keys()).sort();

      // Generate HTML for each group
      buildingList.innerHTML = sortedTypes
        .map((type) => {
          const buildings = groupedByType.get(type)!;
          const isExpanded = this.expandedGroups.has(type);
          const collapsedClass = isExpanded ? '' : 'collapsed';

          const buildingsHtml = buildings
            .map((b) => {
              const state = store.getBuildingState(b.id);
              const statusClass = state?.status || 'unknown';
              return `
                <div class="building-item">
                  <span class="building-name">${b.name || b.type}</span>
                  <span class="building-status ${statusClass}">${state?.status || 'unknown'}</span>
                </div>
              `;
            })
            .join('');

          return `
            <div class="building-group ${collapsedClass}" data-type="${type}">
              <div class="building-group-header">
                <span class="building-group-title">${type}</span>
                <span class="building-group-count">${buildings.length}</span>
                <svg class="building-group-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div class="building-group-items">
                ${buildingsHtml}
              </div>
            </div>
          `;
        })
        .join('');

      // Setup click handlers for group headers
      this.setupBuildingGroupToggles();
    }
  }

  private setupBuildingGroupToggles(): void {
    const headers = document.querySelectorAll('.building-group-header');
    headers.forEach((header) => {
      header.addEventListener('click', (e) => {
        const group = (e.currentTarget as HTMLElement).closest('.building-group');
        const type = group?.getAttribute('data-type');
        if (type && group) {
          if (this.expandedGroups.has(type)) {
            this.expandedGroups.delete(type);
            group.classList.add('collapsed');
          } else {
            this.expandedGroups.add(type);
            group.classList.remove('collapsed');
          }
        }
      });
    });
  }

  getSceneContainer(): HTMLElement | null {
    return this.sceneContainer;
  }

  /**
   * Set the SceneManager reference for labels toggle
   */
  setSceneManager(sceneManager: SceneManager): void {
    this.sceneManager = sceneManager;
    this.setupLabelsToggle();
    this.setupRecenterButton();
  }

  private setupRecenterButton(): void {
    const recenterBtn = document.getElementById('recenter-btn');
    recenterBtn?.addEventListener('click', () => {
      if (this.sceneManager) {
        this.sceneManager.recenterCamera();
      }
    });
  }

  private setupLabelsToggle(): void {
    const labelsBtn = document.getElementById('labels-toggle-btn');

    // Click handler for local toggle
    labelsBtn?.addEventListener('click', () => {
      if (this.sceneManager) {
        this.sceneManager.toggleLabels();
        const isVisible = this.sceneManager.isLabelsVisible();
        labelsBtn.classList.toggle('active', isVisible);
        // Update store to sync with remote
        store.setLabelsVisible(isVisible);
      }
    });

    // Subscribe to store changes to sync button state with remote commands
    store.subscribe(() => {
      if (labelsBtn && this.sceneManager) {
        const storeVisible = store.getLabelsVisible();
        const actualVisible = this.sceneManager.isLabelsVisible();
        // Only update button if state matches (store was updated by remote command)
        if (storeVisible !== actualVisible) {
          // State mismatch means remote command changed store, but SceneManager
          // will be updated via handlePopupCommand, so just sync button
        }
        labelsBtn.classList.toggle('active', storeVisible);
      }
    });
  }

}

export const uiManager = new UIManager();
