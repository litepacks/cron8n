export function getHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cron8n - Workflow Manager</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #121212;
      --bg-secondary: #1e1e1e;
      --bg-tertiary: #2a2a2a;
      --text-primary: #e0e0e0;
      --text-secondary: #a0a0a0;
      --accent: #3b82f6;
      --success: #22c55e;
      --warning: #eab308;
      --border: #333;
    }
    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
    }
    .navbar {
      background: var(--bg-secondary) !important;
      border-bottom: 1px solid var(--border);
    }
    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
    }
    .card:hover {
      border-color: var(--accent);
    }
    .modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
    }
    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
    }
    .btn-primary:hover {
      background: #2563eb;
      border-color: #2563eb;
    }
    .badge-deployed { background: var(--success); color: #000; }
    .badge-local { background: var(--warning); color: #000; }
    .badge-active { background: var(--success); color: #000; }
    .badge-inactive { background: #555; }
    .cron-badge {
      font-family: monospace;
      font-size: 0.85em;
      background: var(--bg-tertiary);
      color: var(--accent);
    }
    .shell-command {
      font-family: monospace;
      font-size: 0.85em;
      background: var(--bg-primary);
      padding: 0.5rem;
      border-radius: 4px;
      color: var(--success);
      border: 1px solid var(--border);
    }
    .logo {
      font-weight: 600;
      color: var(--text-primary);
    }
    .form-control, .form-select {
      background: var(--bg-tertiary);
      border-color: var(--border);
      color: var(--text-primary);
    }
    .form-control:focus, .form-select:focus {
      background: var(--bg-tertiary);
      border-color: var(--accent);
      color: var(--text-primary);
      box-shadow: none;
    }
    .toast-container { z-index: 9999; }
    .text-muted { color: var(--text-secondary) !important; }
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg sticky-top">
    <div class="container">
      <a class="navbar-brand logo" href="#">
        <i class="bi bi-terminal me-2"></i>cron8n
      </a>
      <div class="d-flex align-items-center gap-3">
        <button class="btn btn-outline-secondary btn-sm" id="auth-status-btn" onclick="App.showAuthModal()">
          <span id="auth-status"></span>
        </button>
        <button class="btn btn-primary btn-sm" onclick="App.showNewModal()">
          <i class="bi bi-plus-lg me-1"></i>New Workflow
        </button>
      </div>
    </div>
  </nav>

  <main class="container py-4" id="app"></main>

  <!-- Toast Container -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3" id="toasts"></div>

  <!-- New/Edit Workflow Modal -->
  <div class="modal fade" id="workflowModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="modalTitle">New Workflow</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <form id="workflowForm">
            <input type="hidden" id="editSlug">
            
            <div class="mb-3">
              <label class="form-label">Workflow Name</label>
              <input type="text" class="form-control" id="wfName" required placeholder="My Cron Job">
            </div>

            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">Cron Schedule</label>
                <select class="form-select" id="cronPreset">
                  <option value="">Select preset or custom...</option>
                </select>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label">Custom Expression</label>
                <input type="text" class="form-control font-monospace" id="cronExpression" placeholder="*/5 * * * *">
                <div class="form-text" id="cronHelp"></div>
              </div>
            </div>

            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">Timezone</label>
                <select class="form-select" id="timezone"></select>
              </div>
              <div class="col-md-6 mb-3" id="templateGroup">
                <label class="form-label">Template</label>
                <select class="form-select" id="template"></select>
              </div>
            </div>

            <div class="mb-3" id="shellCommandGroup" style="display:none;">
              <label class="form-label">Shell Command</label>
              <textarea class="form-control font-monospace" id="shellCommand" rows="3" placeholder="echo 'Hello World'"></textarea>
            </div>

            <div id="nextRuns" class="alert alert-info" style="display:none;">
              <strong><i class="bi bi-calendar-event me-1"></i>Next runs:</strong>
              <ul class="mb-0 mt-2" id="nextRunsList"></ul>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="App.saveWorkflow()">
            <i class="bi bi-check-lg me-1"></i>Save
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Auth Modal -->
  <div class="modal fade" id="authModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-key me-2"></i>n8n Connection
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div id="authConnected" style="display:none;">
            <div class="alert alert-success">
              <i class="bi bi-check-circle me-2"></i>
              Connected to <strong id="connectedUrl"></strong>
            </div>
            <button class="btn btn-outline-danger w-100" onclick="App.disconnectAuth()">
              <i class="bi bi-x-circle me-1"></i>Disconnect
            </button>
          </div>
          
          <form id="authForm">
            <div class="mb-3">
              <label class="form-label">n8n Base URL</label>
              <input type="url" class="form-control" id="authBaseUrl" required 
                     placeholder="https://n8n.example.com">
              <div class="form-text">Your n8n instance URL (without trailing slash)</div>
            </div>

            <div class="mb-3">
              <label class="form-label">Authentication Mode</label>
              <select class="form-select" id="authMode">
                <option value="apiKey">API Key (X-N8N-API-KEY header)</option>
                <option value="bearerToken">Bearer Token (Authorization header)</option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label" id="secretLabel">API Key</label>
              <input type="password" class="form-control" id="authSecret" required 
                     placeholder="Enter your API key or token">
              <div class="form-text">
                Generate an API key in n8n: Settings → n8n API
              </div>
            </div>

            <div id="authError" class="alert alert-danger" style="display:none;"></div>
          </form>
        </div>
        <div class="modal-footer" id="authFormFooter">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="App.saveAuth()" id="authSaveBtn">
            <i class="bi bi-plug me-1"></i>Connect
          </button>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/mithril@2/mithril.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // State
    const State = {
      workflows: [],
      templates: [],
      presets: [],
      timezones: [],
      auth: { authenticated: false },
      loading: true
    };

    // API
    const API = {
      async get(url) {
        const res = await fetch(url);
        return res.json();
      },
      async post(url, data) {
        const options = { method: 'POST' };
        if (data) {
          options.headers = { 'Content-Type': 'application/json' };
          options.body = JSON.stringify(data);
        }
        const res = await fetch(url, options);
        return res.json();
      },
      async put(url, data) {
        const options = { method: 'PUT' };
        if (data) {
          options.headers = { 'Content-Type': 'application/json' };
          options.body = JSON.stringify(data);
        }
        const res = await fetch(url, options);
        return res.json();
      },
      async delete(url) {
        const res = await fetch(url, { method: 'DELETE' });
        return res.json();
      }
    };

    // Toast helper
    function showToast(message, type = 'success') {
      const container = document.getElementById('toasts');
      const toast = document.createElement('div');
      toast.className = \`toast align-items-center text-bg-\${type} border-0 show\`;
      toast.innerHTML = \`
        <div class="d-flex">
          <div class="toast-body">\${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      \`;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    // Workflow Card Component
    const WorkflowCard = {
      view(vnode) {
        const { manifest, workflow } = vnode.attrs.data;
        const isDeployed = !!manifest.lastDeployedWorkflowId;
        const shellNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.executeCommand');
        const shellCommand = shellNode?.parameters?.command;

        return m('.col-md-6.col-lg-4.mb-4', 
          m('.card.workflow-card.h-100', [
            m('.card-body', [
              m('.d-flex.justify-content-between.align-items-start.mb-2', [
                m('h5.card-title.mb-0', manifest.name),
                m('div', [
                  isDeployed 
                    ? m('span.badge.badge-deployed.me-1', 'Deployed')
                    : m('span.badge.badge-local.me-1', 'Local'),
                  manifest.lastDeployedWorkflowId && workflow.active
                    ? m('span.badge.badge-active', 'Active')
                    : m('span.badge.badge-inactive', 'Inactive')
                ])
              ]),
              m('p.card-text', [
                m('span.badge.cron-badge.me-2', manifest.cronExpression),
                m('small.text-muted', manifest.timezone)
              ]),
              shellCommand && m('.shell-command.mt-2.text-truncate', { title: shellCommand }, 
                '$ ' + shellCommand
              ),
              m('small.text-muted.d-block.mt-2', 
                'Template: ' + manifest.template
              )
            ]),
            m('.card-footer.bg-transparent.border-0.pt-0', [
              m('.btn-group.btn-group-sm.w-100', [
                m('button.btn.btn-outline-primary', { 
                  onclick: () => App.editWorkflow(manifest.slug) 
                }, [m('i.bi.bi-pencil')]),
                m('button.btn.btn-outline-success', { 
                  onclick: () => App.deployWorkflow(manifest.slug),
                  disabled: !State.auth.authenticated
                }, [m('i.bi.bi-cloud-upload')]),
                isDeployed && m('button.btn.btn-outline-warning', { 
                  onclick: () => App.toggleActive(manifest.slug, !workflow.active)
                }, [m('i.bi', { class: workflow.active ? 'bi-pause' : 'bi-play' })]),
                m('button.btn.btn-outline-secondary', { 
                  onclick: () => App.archiveWorkflow(manifest.slug),
                  title: 'Archive'
                }, [m('i.bi.bi-archive')])
              ])
            ])
          ])
        );
      }
    };

    // Main App Component
    const AppComponent = {
      view() {
        if (State.loading) {
          return m('.text-center.py-5', [
            m('.spinner-border.text-primary', { role: 'status' }),
            m('p.mt-3.text-muted', 'Loading workflows...')
          ]);
        }

        if (State.workflows.length === 0) {
          return m('.text-center.py-5', [
            m('i.bi.bi-inbox.display-1.text-muted'),
            m('h4.mt-3', 'No workflows yet'),
            m('p.text-muted', 'Create your first cron workflow to get started'),
            m('button.btn.btn-primary.btn-lg.mt-3', { onclick: App.showNewModal }, [
              m('i.bi.bi-plus-lg.me-2'),
              'Create Workflow'
            ])
          ]);
        }

        return m('.row', State.workflows.map(wf => 
          m(WorkflowCard, { key: wf.manifest.slug, data: wf })
        ));
      }
    };

    // App Logic
    const App = {
      async init() {
        // Load initial data
        const [auth, workflows, templates, presets, timezones] = await Promise.all([
          API.get('/api/auth'),
          API.get('/api/workflows'),
          API.get('/api/templates'),
          API.get('/api/cron-presets'),
          API.get('/api/timezones')
        ]);

        State.auth = auth;
        State.workflows = workflows.workflows || [];
        State.templates = templates.templates || [];
        State.presets = presets.presets || [];
        State.timezones = timezones.timezones || [];
        State.loading = false;

        // Update auth status
        this.updateAuthStatus(auth);

        // Populate form selects
        this.populateSelects();
        
        // Setup auth modal events
        document.getElementById('authMode').addEventListener('change', (e) => {
          document.getElementById('secretLabel').textContent = 
            e.target.value === 'apiKey' ? 'API Key' : 'Bearer Token';
        });
        
        // Mount app
        m.mount(document.getElementById('app'), AppComponent);
      },

      populateSelects() {
        // Presets
        const presetSelect = document.getElementById('cronPreset');
        presetSelect.innerHTML = '<option value="">Select preset or custom...</option>';
        State.presets.forEach(p => {
          presetSelect.innerHTML += \`<option value="\${p.expression}">\${p.name} (\${p.expression})</option>\`;
        });

        // Timezones
        const tzSelect = document.getElementById('timezone');
        tzSelect.innerHTML = '';
        State.timezones.forEach(tz => {
          const selected = tz === 'Europe/Istanbul' ? 'selected' : '';
          tzSelect.innerHTML += \`<option value="\${tz}" \${selected}>\${tz}</option>\`;
        });

        // Templates
        const templateSelect = document.getElementById('template');
        templateSelect.innerHTML = '';
        State.templates.forEach(t => {
          templateSelect.innerHTML += \`<option value="\${t.value}">\${t.name}</option>\`;
        });

        // Event listeners
        presetSelect.addEventListener('change', (e) => {
          if (e.target.value) {
            document.getElementById('cronExpression').value = e.target.value;
            this.validateCron();
          }
        });

        document.getElementById('cronExpression').addEventListener('input', () => this.validateCron());
        
        templateSelect.addEventListener('change', (e) => {
          document.getElementById('shellCommandGroup').style.display = 
            e.target.value === 'shell-command' ? 'block' : 'none';
        });
      },

      updateAuthStatus(auth) {
        State.auth = auth;
        document.getElementById('auth-status').innerHTML = auth.authenticated
          ? '<i class="bi bi-check-circle me-1"></i>Connected'
          : '<i class="bi bi-exclamation-triangle me-1"></i>Not connected';
        
        const btn = document.getElementById('auth-status-btn');
        btn.className = auth.authenticated 
          ? 'btn btn-outline-success btn-sm'
          : 'btn btn-outline-warning btn-sm';
      },

      showAuthModal() {
        const isConnected = State.auth.authenticated;
        document.getElementById('authConnected').style.display = isConnected ? 'block' : 'none';
        document.getElementById('authForm').style.display = isConnected ? 'none' : 'block';
        document.getElementById('authFormFooter').style.display = isConnected ? 'none' : 'flex';
        
        if (isConnected) {
          document.getElementById('connectedUrl').textContent = State.auth.baseUrl;
        } else {
          document.getElementById('authForm').reset();
          document.getElementById('authError').style.display = 'none';
        }
        
        new bootstrap.Modal(document.getElementById('authModal')).show();
      },

      async saveAuth() {
        const baseUrl = document.getElementById('authBaseUrl').value.trim();
        const authMode = document.getElementById('authMode').value;
        const secret = document.getElementById('authSecret').value;
        
        if (!baseUrl || !secret) {
          document.getElementById('authError').style.display = 'block';
          document.getElementById('authError').textContent = 'Please fill all fields';
          return;
        }

        document.getElementById('authSaveBtn').disabled = true;
        document.getElementById('authSaveBtn').innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Connecting...';
        document.getElementById('authError').style.display = 'none';

        const result = await API.post('/api/auth', { baseUrl, authMode, secret });
        
        document.getElementById('authSaveBtn').disabled = false;
        document.getElementById('authSaveBtn').innerHTML = '<i class="bi bi-plug me-1"></i>Connect';

        if (result.error) {
          document.getElementById('authError').style.display = 'block';
          document.getElementById('authError').textContent = result.error;
          return;
        }

        showToast('Connected to n8n!');
        bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
        
        // Refresh auth status
        const auth = await API.get('/api/auth');
        this.updateAuthStatus(auth);
      },

      async disconnectAuth() {
        if (!confirm('Disconnect from n8n?')) return;
        
        await API.delete('/api/auth');
        showToast('Disconnected from n8n');
        bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
        
        this.updateAuthStatus({ authenticated: false });
      },

      async validateCron() {
        const expr = document.getElementById('cronExpression').value;
        const tz = document.getElementById('timezone').value;
        
        if (!expr) {
          document.getElementById('nextRuns').style.display = 'none';
          document.getElementById('cronHelp').textContent = '';
          return;
        }

        const result = await API.post('/api/validate-cron', { expression: expr, timezone: tz });
        
        if (result.isValid) {
          document.getElementById('cronHelp').innerHTML = '<span class="text-success">✓ Valid</span>';
          document.getElementById('nextRuns').style.display = 'block';
          document.getElementById('nextRunsList').innerHTML = result.nextRuns
            .slice(0, 5)
            .map(d => '<li>' + new Date(d).toLocaleString() + '</li>')
            .join('');
        } else {
          document.getElementById('cronHelp').innerHTML = \`<span class="text-danger">✗ \${result.error}</span>\`;
          document.getElementById('nextRuns').style.display = 'none';
        }
      },

      showNewModal() {
        document.getElementById('modalTitle').textContent = 'New Workflow';
        document.getElementById('editSlug').value = '';
        document.getElementById('workflowForm').reset();
        document.getElementById('templateGroup').style.display = 'block';
        document.getElementById('shellCommandGroup').style.display = 'none';
        document.getElementById('nextRuns').style.display = 'none';
        document.getElementById('timezone').value = 'Europe/Istanbul';
        new bootstrap.Modal(document.getElementById('workflowModal')).show();
      },

      async editWorkflow(slug) {
        const result = await API.get('/api/workflows/' + slug);
        if (result.error) {
          showToast(result.error, 'danger');
          return;
        }

        const { manifest, workflow } = result;
        const shellNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.executeCommand');

        document.getElementById('modalTitle').textContent = 'Edit Workflow';
        document.getElementById('editSlug').value = slug;
        document.getElementById('wfName').value = manifest.name;
        document.getElementById('cronExpression').value = manifest.cronExpression;
        document.getElementById('timezone').value = manifest.timezone;
        document.getElementById('templateGroup').style.display = 'none';
        
        if (shellNode) {
          document.getElementById('shellCommandGroup').style.display = 'block';
          document.getElementById('shellCommand').value = shellNode.parameters?.command || '';
        } else {
          document.getElementById('shellCommandGroup').style.display = 'none';
        }

        this.validateCron();
        new bootstrap.Modal(document.getElementById('workflowModal')).show();
      },

      async saveWorkflow() {
        const slug = document.getElementById('editSlug').value;
        const data = {
          name: document.getElementById('wfName').value,
          cronExpression: document.getElementById('cronExpression').value,
          timezone: document.getElementById('timezone').value,
          template: document.getElementById('template').value,
          shellCommand: document.getElementById('shellCommand').value || undefined
        };

        if (!data.name || !data.cronExpression) {
          showToast('Please fill required fields', 'warning');
          return;
        }

        let result;
        if (slug) {
          result = await API.put('/api/workflows/' + slug, data);
        } else {
          result = await API.post('/api/workflows', data);
        }

        if (result.error) {
          showToast(result.error, 'danger');
          return;
        }

        showToast(slug ? 'Workflow updated!' : 'Workflow created!');
        bootstrap.Modal.getInstance(document.getElementById('workflowModal')).hide();
        await this.refresh();
      },

      async deployWorkflow(slug) {
        if (!confirm('Deploy workflow to n8n?')) return;
        
        const result = await API.post('/api/workflows/' + slug + '/deploy');
        if (result.error) {
          showToast(result.error, 'danger');
          return;
        }

        showToast('Deployed successfully! ID: ' + result.workflowId);
        await this.refresh();
      },

      async toggleActive(slug, active) {
        const result = await API.post('/api/workflows/' + slug + '/activate', { active });
        if (result.error) {
          showToast(result.error, 'danger');
          return;
        }

        showToast(active ? 'Workflow activated!' : 'Workflow deactivated!');
        await this.refresh();
      },

      async archiveWorkflow(slug) {
        if (!confirm('Archive this workflow? It will be moved to the archived folder.')) return;

        const result = await API.delete('/api/workflows/' + slug);
        if (result.error) {
          showToast(result.error, 'danger');
          return;
        }

        showToast('Workflow archived');
        await this.refresh();
      },

      async refresh() {
        const workflows = await API.get('/api/workflows');
        State.workflows = workflows.workflows || [];
        m.redraw();
      }
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', () => App.init());
  </script>
</body>
</html>`;
}
