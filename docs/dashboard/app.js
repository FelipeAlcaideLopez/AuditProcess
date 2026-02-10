// Salesforce Org Audit Dashboard
// This dashboard loads JSON data from ../data/ and visualizes it

let data = {
    findings: [],
    summary: {},
    pmdAnalysis: {},
    flowAnalysis: {},
    packageAnalysis: {},
    securitySummary: {},
    frameworkAnalysis: {},
    orgDetails: {},
    objectAnalysis: {},
    layoutAnalysis: {}
};

// Load all data files
async function loadData() {
    const files = [
        { key: 'findings', path: '/data/all-findings.json' },
        { key: 'summary', path: '/data/findings-summary.json' },
        { key: 'pmdAnalysis', path: '/data/pmd-analysis.json' },
        { key: 'flowAnalysis', path: '/data/flow-analysis.json' },
        { key: 'packageAnalysis', path: '/data/package-analysis.json' },
        { key: 'securitySummary', path: '/data/security-summary.json' },
        { key: 'frameworkAnalysis', path: '/data/framework-analysis.json' },
        { key: 'orgDetails', path: '/data/org-details.json' },
        { key: 'highPrivProfiles', path: '/data/high-privilege-profiles.json' },
        { key: 'namedCredentials', path: '/data/named-credentials.json' },
        { key: 'objectAnalysis', path: '/data/object-analysis.json' },
        { key: 'layoutAnalysis', path: '/data/layout-analysis.json' }
    ];

    for (const file of files) {
        try {
            const response = await fetch(file.path);
            if (response.ok) {
                data[file.key] = await response.json();
            }
        } catch (e) {
            console.warn(`Could not load ${file.path}`);
        }
    }

    initDashboard();
}

// Initialize dashboard
function initDashboard() {
    setupNavigation();
    renderOverview();
    renderFindings();
    renderApexAnalysis();
    renderFlowAnalysis();
    renderObjects();
    renderLayouts();
    renderPackages();
    renderSecurity();
    renderArchitecture();
    renderRecommendations();
}

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.section).classList.add('active');
        });
    });
}

// Overview Section
function renderOverview() {
    // Org info
    if (data.orgDetails?.result?.records?.[0]) {
        document.getElementById('org-name').textContent = data.orgDetails.result.records[0].Name;
    }
    document.getElementById('audit-date').textContent = new Date().toLocaleDateString();

    // Health score
    const summary = data.summary;
    if (summary.total) {
        const severityWeights = { Critical: 10, High: 5, Medium: 2, Low: 1, Info: 0 };
        const debtScore = Object.entries(summary.bySeverity || {})
            .reduce((sum, [sev, count]) => sum + (severityWeights[sev] * count), 0);
        const maxScore = summary.total * 10;
        const healthScore = Math.max(0, 100 - (debtScore / maxScore * 100)).toFixed(0);

        document.getElementById('health-value').textContent = healthScore;
        const circle = document.getElementById('health-circle');
        const status = document.getElementById('health-status');

        if (healthScore >= 90) {
            circle.className = 'score-circle excellent';
            status.textContent = 'Excellent';
            status.style.color = '#2e844a';
        } else if (healthScore >= 75) {
            circle.className = 'score-circle good';
            status.textContent = 'Good';
            status.style.color = '#4bca81';
        } else if (healthScore >= 60) {
            circle.className = 'score-circle needs-work';
            status.textContent = 'Needs Improvement';
            status.style.color = '#ff9a3c';
        } else {
            circle.className = 'score-circle critical';
            status.textContent = 'Critical';
            status.style.color = '#c23934';
        }

        // Metrics
        document.getElementById('total-findings').textContent = summary.total;
        document.getElementById('critical-count').textContent = summary.bySeverity?.Critical || 0;
        document.getElementById('high-count').textContent = summary.bySeverity?.High || 0;
        document.getElementById('medium-count').textContent = summary.bySeverity?.Medium || 0;

        // Category chart
        renderCategoryChart(summary.byCategory || {});

        // Severity chart
        renderSeverityChart(summary.bySeverity || {});

        // Key metrics
        renderKeyMetrics();
    }
}

function renderCategoryChart(categoryData) {
    const ctx = document.getElementById('category-chart').getContext('2d');
    const sorted = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([cat]) => cat),
            datasets: [{
                data: sorted.map(([, count]) => count),
                backgroundColor: '#0176d3'
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
}

function renderSeverityChart(severityData) {
    const ctx = document.getElementById('severity-chart').getContext('2d');
    const colors = {
        Critical: '#c23934',
        High: '#fe5c4c',
        Medium: '#ff9a3c',
        Low: '#2e844a',
        Info: '#0070d2'
    };

    const labels = Object.keys(severityData).filter(k => severityData[k] > 0);
    const values = labels.map(k => severityData[k]);
    const bgColors = labels.map(k => colors[k]);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: bgColors
            }]
        },
        options: {
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

function renderKeyMetrics() {
    const metricsContainer = document.getElementById('key-metrics');
    const pmd = data.pmdAnalysis;
    const flow = data.flowAnalysis;
    const pkg = data.packageAnalysis;
    const sec = data.securitySummary;

    const metrics = [
        { label: 'Apex Classes', value: pmd.totalFiles || '?' },
        { label: 'PMD Violations', value: pmd.totalViolations?.toLocaleString() || '?' },
        { label: 'Total Flows', value: flow.totalFlows || '?' },
        { label: 'Active Flows', value: flow.byStatus?.active || '?' },
        { label: 'Installed Packages', value: pkg.totalPackages || '?' },
        { label: 'Active Users', value: sec.activeUsers || '?' },
        { label: 'Named Credentials', value: sec.namedCredentials?.length || '?' }
    ];

    metricsContainer.innerHTML = metrics.map(m => `
        <div class="stat-item">
            <div class="value">${m.value}</div>
            <div class="label">${m.label}</div>
        </div>
    `).join('');
}

// Findings Section
function renderFindings() {
    const findings = data.findings || [];
    const categories = [...new Set(findings.map(f => f.category))];

    // Populate category filter
    const categoryFilter = document.getElementById('category-filter');
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });

    // Filter event listeners
    document.getElementById('severity-filter').addEventListener('change', filterFindings);
    document.getElementById('category-filter').addEventListener('change', filterFindings);
    document.getElementById('search-filter').addEventListener('input', filterFindings);

    filterFindings();
}

function filterFindings() {
    const severity = document.getElementById('severity-filter').value;
    const category = document.getElementById('category-filter').value;
    const search = document.getElementById('search-filter').value.toLowerCase();

    let filtered = data.findings || [];

    if (severity) {
        filtered = filtered.filter(f => f.severity === severity);
    }
    if (category) {
        filtered = filtered.filter(f => f.category === category);
    }
    if (search) {
        filtered = filtered.filter(f =>
            f.title.toLowerCase().includes(search) ||
            f.description?.toLowerCase().includes(search) ||
            f.location?.toLowerCase().includes(search)
        );
    }

    const container = document.getElementById('findings-list');
    container.innerHTML = filtered.map(f => `
        <div class="finding-item ${f.severity}" onclick="this.classList.toggle('expanded')">
            <div class="finding-header">
                <span class="finding-title">${f.title}</span>
                <div class="finding-badges">
                    <span class="badge severity ${f.severity}">${f.severity}</span>
                    <span class="badge category">${f.category}</span>
                </div>
            </div>
            <div class="finding-details">
                <div class="detail-row">
                    <span class="detail-label">ID</span>
                    <span class="detail-value">${f.id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Location</span>
                    <span class="detail-value">${f.location || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value">${f.description || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Impact</span>
                    <span class="detail-value">${f.impact || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Recommendation</span>
                    <span class="detail-value">${f.recommendation || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Effort</span>
                    <span class="detail-value">${f.effort || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Tool</span>
                    <span class="detail-value">${f.tool || 'N/A'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Apex Analysis Section
function renderApexAnalysis() {
    const pmd = data.pmdAnalysis;
    if (!pmd.totalViolations) return;

    document.getElementById('pmd-summary').textContent =
        `${pmd.totalViolations.toLocaleString()} violations found across ${pmd.totalFiles || '?'} files`;

    // Category chart
    if (pmd.byCategory) {
        const ctx = document.getElementById('pmd-category-chart').getContext('2d');
        const sorted = Object.entries(pmd.byCategory).sort((a, b) => b[1] - a[1]);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(([cat]) => cat),
                datasets: [{
                    data: sorted.map(([, count]) => count),
                    backgroundColor: '#0176d3'
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    }

    // Rules chart
    if (pmd.topRules) {
        const ctx = document.getElementById('pmd-rules-chart').getContext('2d');
        const top10 = pmd.topRules.slice(0, 10);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10.map(r => r.rule),
                datasets: [{
                    data: top10.map(r => r.count),
                    backgroundColor: top10.map(r => {
                        if (r.severity === 'Critical') return '#c23934';
                        if (r.severity === 'High') return '#fe5c4c';
                        return '#ff9a3c';
                    })
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    }

    // Files table
    if (pmd.topFiles) {
        const tbody = document.querySelector('#pmd-files-table tbody');
        tbody.innerHTML = pmd.topFiles.slice(0, 15).map(f => `
            <tr>
                <td>${f.file}</td>
                <td>${f.violations}</td>
            </tr>
        `).join('');
    }
}

// Flow Analysis Section
function renderFlowAnalysis() {
    const flow = data.flowAnalysis;
    if (!flow.totalFlows) return;

    document.getElementById('flow-summary').textContent =
        `${flow.totalFlows} flows analyzed, ${flow.issues?.length || 0} with potential issues`;

    document.getElementById('total-flows').textContent = flow.totalFlows;
    document.getElementById('active-flows').textContent = flow.byStatus?.active || 0;
    document.getElementById('complex-flows').textContent = flow.complexFlows?.length || 0;
    document.getElementById('flows-with-issues').textContent = flow.issues?.length || 0;

    // Type chart
    if (flow.byType) {
        const ctx = document.getElementById('flow-type-chart').getContext('2d');
        const types = Object.entries(flow.byType);

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: types.map(([type]) => type),
                datasets: [{
                    data: types.map(([, count]) => count),
                    backgroundColor: ['#0176d3', '#1b96ff', '#57a3fd', '#aacbff', '#d8edff']
                }]
            },
            options: {
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // Complex flows table
    if (flow.complexFlows) {
        const tbody = document.querySelector('#complex-flows-table tbody');
        const flowIssues = flow.issues || [];

        tbody.innerHTML = flow.complexFlows.map(f => {
            const issues = flowIssues.find(i => i.name === f.name)?.issues || [];
            return `
                <tr>
                    <td>${f.name}</td>
                    <td>${f.elements}</td>
                    <td>${issues.join(', ') || '-'}</td>
                </tr>
            `;
        }).join('');
    }
}

// Packages Section
function renderPackages() {
    const pkg = data.packageAnalysis;
    if (!pkg.totalPackages) return;

    document.getElementById('package-summary').textContent =
        `${pkg.totalPackages} packages from ${Object.keys(pkg.byVendor || {}).length} vendors`;

    // Vendor chart
    if (pkg.byVendor) {
        const ctx = document.getElementById('vendor-chart').getContext('2d');
        const vendors = Object.entries(pkg.byVendor).sort((a, b) => b[1] - a[1]);

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: vendors.map(([v]) => v),
                datasets: [{
                    data: vendors.map(([, c]) => c),
                    backgroundColor: ['#0176d3', '#1b96ff', '#57a3fd', '#aacbff', '#d8edff', '#706e6b']
                }]
            },
            options: {
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // Category chart
    if (pkg.byCategory) {
        const ctx = document.getElementById('package-category-chart').getContext('2d');
        const categories = Object.entries(pkg.byCategory).sort((a, b) => b[1] - a[1]);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories.map(([c]) => c),
                datasets: [{
                    data: categories.map(([, count]) => count),
                    backgroundColor: '#0176d3'
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    }

    // Packages table
    if (pkg.packages) {
        const tbody = document.querySelector('#packages-table tbody');
        tbody.innerHTML = pkg.packages.map(p => `
            <tr>
                <td>${p.name}</td>
                <td><code>${p.namespace}</code></td>
                <td>${p.version}</td>
                <td>${p.vendor}</td>
                <td>${p.category}</td>
            </tr>
        `).join('');
    }
}

// Security Section
function renderSecurity() {
    const sec = data.securitySummary;

    document.getElementById('active-users').textContent = sec.activeUsers || 0;
    document.getElementById('high-priv-profiles').textContent = sec.highPrivilegeProfiles?.length || 0;
    document.getElementById('high-priv-permsets').textContent = sec.highPrivilegePermSets?.length || 0;
    document.getElementById('named-creds').textContent = sec.namedCredentials?.length || 0;

    // Profiles table
    const profiles = data.highPrivProfiles || sec.highPrivilegeProfiles || [];
    if (profiles.length) {
        const tbody = document.querySelector('#profiles-table tbody');
        tbody.innerHTML = profiles.map(p => `
            <tr>
                <td>${p.name || p.Name}</td>
                <td>${p.modifyAllData ? 'Yes' : 'No'}</td>
                <td>${p.viewAllData ? 'Yes' : 'No'}</td>
            </tr>
        `).join('');
    }

    // Named credentials table
    const namedCreds = data.namedCredentials || sec.namedCredentials || [];
    if (namedCreds.length) {
        const tbody = document.querySelector('#named-creds-table tbody');
        tbody.innerHTML = namedCreds.map(nc => `
            <tr>
                <td>${nc.name}</td>
                <td>${nc.endpoint || 'N/A'}</td>
            </tr>
        `).join('');
    }
}

// Architecture Section
function renderArchitecture() {
    const fw = data.frameworkAnalysis;
    if (!fw) return;

    // Trigger framework
    const triggerCard = document.getElementById('trigger-framework');
    if (fw.triggerFramework?.detected) {
        triggerCard.querySelector('.pattern-status').textContent = 'Detected';
        triggerCard.querySelector('.pattern-status').className = 'pattern-status detected';
        triggerCard.querySelector('.pattern-detail').textContent = fw.triggerFramework.type;
    } else {
        triggerCard.querySelector('.pattern-status').textContent = 'Not Detected';
        triggerCard.querySelector('.pattern-status').className = 'pattern-status not-detected';
    }

    // Design patterns
    const patterns = [
        { id: 'selector-pattern', key: 'hasSelector' },
        { id: 'service-pattern', key: 'hasService' },
        { id: 'domain-pattern', key: 'hasDomain' },
        { id: 'factory-pattern', key: 'hasFactory' },
        { id: 'test-factory', key: 'hasTestDataFactory', source: 'testPatterns' }
    ];

    patterns.forEach(p => {
        const card = document.getElementById(p.id);
        const source = p.source ? fw[p.source] : fw.designPatterns;
        const detected = source?.[p.key];

        card.querySelector('.pattern-status').textContent = detected ? 'Detected' : 'Not Detected';
        card.querySelector('.pattern-status').className = 'pattern-status ' + (detected ? 'detected' : 'not-detected');
    });

    // Integration patterns
    const intPatterns = [
        { id: 'http-callouts', key: 'hasCallouts' },
        { id: 'queueable', key: 'hasQueueable' },
        { id: 'batch-apex', key: 'hasBatch' },
        { id: 'schedulable', key: 'hasSchedulable' }
    ];

    intPatterns.forEach(p => {
        const card = document.getElementById(p.id);
        const detected = fw.integrationPatterns?.[p.key];

        card.querySelector('.pattern-status').textContent = detected ? 'Detected' : 'Not Detected';
        card.querySelector('.pattern-status').className = 'pattern-status ' + (detected ? 'detected' : 'not-detected');
    });

    // Triggers table
    if (fw.triggerAnalysis?.triggers) {
        const tbody = document.querySelector('#triggers-table tbody');
        tbody.innerHTML = fw.triggerAnalysis.triggers.map(t => `
            <tr>
                <td>${t.name}</td>
                <td>${t.type}</td>
                <td>${t.lines}</td>
            </tr>
        `).join('');
    }
}

// Objects & Fields Section
function renderObjects() {
    const obj = data.objectAnalysis;
    if (!obj?.summary) return;

    document.getElementById('object-summary').textContent =
        `${obj.summary.totalObjects} objects with ${obj.summary.totalFields} custom fields`;

    document.getElementById('custom-objects').textContent = obj.summary.customObjects || 0;
    document.getElementById('custom-metadata').textContent = obj.summary.customMetadata || 0;
    document.getElementById('custom-fields').textContent = obj.summary.totalFields || 0;
    document.getElementById('total-record-types').textContent = obj.summary.totalRecordTypes || 0;
    document.getElementById('total-validation-rules').textContent = obj.summary.totalValidationRules || 0;

    // Field types chart
    if (obj.fieldAnalysis?.byType) {
        const ctx = document.getElementById('field-type-chart').getContext('2d');
        const types = Object.entries(obj.fieldAnalysis.byType).sort((a, b) => b[1] - a[1]).slice(0, 10);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: types.map(([t]) => t),
                datasets: [{
                    data: types.map(([, c]) => c),
                    backgroundColor: '#0176d3'
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    }

    // Validation rules by object chart
    if (obj.validationRules?.byObject) {
        const ctx = document.getElementById('vr-by-object-chart').getContext('2d');
        const vrData = Object.entries(obj.validationRules.byObject).sort((a, b) => b[1] - a[1]).slice(0, 10);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: vrData.map(([o]) => o.replace('__c', '')),
                datasets: [{
                    data: vrData.map(([, c]) => c),
                    backgroundColor: '#ff9a3c'
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    }

    // Objects table
    if (obj.objects) {
        const tbody = document.querySelector('#objects-table tbody');
        tbody.innerHTML = obj.objects.slice(0, 20).map(o => `
            <tr>
                <td>${o.name}</td>
                <td>${o.fields}</td>
                <td>${o.recordTypes}</td>
                <td>${o.validationRules}</td>
            </tr>
        `).join('');
    }

    // Record Types table
    if (obj.recordTypes?.details) {
        const tbody = document.querySelector('#record-types-table tbody');
        tbody.innerHTML = obj.recordTypes.details.map(rt => `
            <tr>
                <td>${rt.object}</td>
                <td>${rt.label || rt.name}</td>
                <td>${rt.active ? 'Yes' : 'No'}</td>
            </tr>
        `).join('');
    }

    // Validation Rules table
    if (obj.validationRules?.details) {
        const tbody = document.querySelector('#validation-rules-table tbody');
        tbody.innerHTML = obj.validationRules.details.map(vr => `
            <tr>
                <td>${vr.object}</td>
                <td>${vr.name}</td>
                <td>${vr.active ? 'Yes' : 'No'}</td>
                <td>${vr.complexity || 0}</td>
            </tr>
        `).join('');
    }
}

// Layouts & Pages Section
function renderLayouts() {
    const layout = data.layoutAnalysis;
    if (!layout?.layouts) return;

    document.getElementById('layout-summary').textContent =
        `${layout.layouts.total} layouts and ${layout.flexipages.total} Lightning pages`;

    document.getElementById('total-layouts').textContent = layout.layouts.total || 0;
    document.getElementById('total-flexipages').textContent = layout.flexipages.total || 0;
    document.getElementById('lwc-usage').textContent = layout.flexipages.totalLwcUsage || 0;
    document.getElementById('aura-usage').textContent = layout.flexipages.totalAuraUsage || 0;

    // FlexiPage types chart
    if (layout.flexipages?.byType) {
        const ctx = document.getElementById('flexipage-type-chart').getContext('2d');
        const types = Object.entries(layout.flexipages.byType);

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: types.map(([t]) => t),
                datasets: [{
                    data: types.map(([, c]) => c),
                    backgroundColor: ['#0176d3', '#1b96ff', '#57a3fd', '#aacbff', '#d8edff']
                }]
            },
            options: {
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // Layout complexity comparison chart
    const ctx = document.getElementById('layout-complexity-chart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Avg Fields/Layout', 'Avg Components/Page'],
            datasets: [{
                label: 'Average',
                data: [
                    parseFloat(layout.layouts.avgFieldsPerLayout) || 0,
                    parseFloat(layout.flexipages.avgComponentsPerPage) || 0
                ],
                backgroundColor: ['#0176d3', '#ff9a3c']
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Complex FlexiPages table
    if (layout.flexipages?.complexPages) {
        const tbody = document.querySelector('#complex-flexipages-table tbody');
        tbody.innerHTML = layout.flexipages.complexPages.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${p.type}</td>
                <td>${p.components}</td>
            </tr>
        `).join('');
    }

    // Complex Layouts table
    if (layout.layouts?.layoutsWithManyFields) {
        const tbody = document.querySelector('#complex-layouts-table tbody');
        tbody.innerHTML = layout.layouts.layoutsWithManyFields.map(l => `
            <tr>
                <td>${l.name}</td>
                <td>${l.name.split('-')[0]}</td>
                <td>${l.fields}</td>
            </tr>
        `).join('');
    }
}

// Recommendations Section
function renderRecommendations() {
    const findings = data.findings || [];

    // Group by severity
    const critical = findings.filter(f => f.severity === 'Critical');
    const high = findings.filter(f => f.severity === 'High');
    const medium = findings.filter(f => f.severity === 'Medium');
    const low = findings.filter(f => f.severity === 'Low' || f.severity === 'Info');

    // Render each group
    renderRecommendationGroup('critical-recommendations', critical);
    renderRecommendationGroup('high-recommendations', high);
    renderRecommendationGroup('medium-recommendations', medium);
    renderRecommendationGroup('low-recommendations', low);

    // Effort chart
    const summary = data.summary;
    if (summary?.byEffort) {
        const ctx = document.getElementById('effort-chart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(summary.byEffort),
                datasets: [{
                    data: Object.values(summary.byEffort),
                    backgroundColor: ['#2e844a', '#ff9a3c', '#c23934']
                }]
            },
            options: {
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // Quick wins
    const quickWins = findings.filter(f => f.effort === 'Quick Win' || f.effort === 'Low');
    const quickWinsList = document.getElementById('quick-wins-list');
    quickWinsList.innerHTML = quickWins.slice(0, 5).map(f => `
        <div class="quick-win-item">
            <strong>${f.title}</strong>
            <div style="color: #706e6b; font-size: 0.8rem;">${f.recommendation || ''}</div>
        </div>
    `).join('') || '<p>No quick wins identified</p>';
}

function renderRecommendationGroup(containerId, findings) {
    const container = document.getElementById(containerId);
    if (!findings.length) {
        container.innerHTML = '<p style="color: #706e6b;">No findings in this category</p>';
        return;
    }

    container.innerHTML = findings.slice(0, 5).map(f => `
        <div class="recommendation-item">
            <div class="title">${f.title}</div>
            <div class="action">${f.recommendation || 'Review and remediate'}</div>
        </div>
    `).join('');
}

// Start loading data
loadData();
