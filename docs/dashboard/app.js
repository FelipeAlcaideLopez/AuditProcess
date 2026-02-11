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
    layoutAnalysis: {},
    apexClassesAnalysis: {},
    descriptionAnalysis: {},
    advancedAnalysis: {},
    advancedFindings: []
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
        { key: 'layoutAnalysis', path: '/data/layout-analysis.json' },
        { key: 'apexClassesAnalysis', path: '/data/apex-classes-analysis.json' },
        { key: 'descriptionAnalysis', path: '/data/description-analysis.json' },
        { key: 'advancedAnalysis', path: '/data/advanced-analysis.json' },
        { key: 'advancedFindings', path: '/data/advanced-findings.json' }
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
    renderApexClasses();
    renderFlowAnalysis();
    renderObjects();
    renderLayouts();
    renderPackages();
    renderSecurity();
    renderArchitecture();
    renderDocumentation();
    renderAdvancedRules();
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

        // Metrics - make clickable to filter findings
        document.getElementById('total-findings').innerHTML = `<span class="clickable" onclick="navigateToFindings('')">${summary.total}</span>`;
        document.getElementById('critical-count').innerHTML = (summary.bySeverity?.Critical || 0) > 0 ?
            `<span class="clickable" onclick="navigateToFindings('Critical')">${summary.bySeverity.Critical}</span>` : '0';
        document.getElementById('high-count').innerHTML = (summary.bySeverity?.High || 0) > 0 ?
            `<span class="clickable" onclick="navigateToFindings('High')">${summary.bySeverity.High}</span>` : '0';
        document.getElementById('medium-count').innerHTML = (summary.bySeverity?.Medium || 0) > 0 ?
            `<span class="clickable" onclick="navigateToFindings('Medium')">${summary.bySeverity.Medium}</span>` : '0';

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
    const pmd = data.pmdAnalysis || {};
    const flow = data.flowAnalysis || {};
    const pkg = data.packageAnalysis || {};
    const sec = data.securitySummary || {};
    const obj = data.objectAnalysis || {};
    const layout = data.layoutAnalysis || {};

    // Count apex files from byFile if totalFiles not available
    const apexCount = pmd.totalFiles || (pmd.byFile ? Object.keys(pmd.byFile).length : null) || pmd.topFiles?.length || '?';

    const metrics = [
        { label: 'Apex Classes', value: apexCount },
        { label: 'PMD Violations', value: pmd.totalViolations?.toLocaleString() || '0' },
        { label: 'Total Flows', value: flow.totalFlows || '0' },
        { label: 'Active Flows', value: flow.byStatus?.active || '0' },
        { label: 'FlexiPages', value: layout.flexipages?.total || '0' },
        { label: 'Installed Packages', value: pkg.totalPackages || '0' },
        { label: 'Active Users', value: sec.activeUsers || '0' },
        { label: 'Named Credentials', value: sec.namedCredentials?.length || '0' }
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
    console.log('PMD Data:', pmd); // Debug

    if (!pmd || !pmd.totalViolations) {
        console.warn('No PMD data available');
        return;
    }

    // Make summary clickable
    const summaryEl = document.getElementById('pmd-summary');
    summaryEl.innerHTML = `<span class="clickable" onclick="showAllPMDViolations()">${pmd.totalViolations.toLocaleString()} violations</span> found across ${pmd.totalFiles || '?'} files`;

    // Category chart with click handler
    if (pmd.byCategory && Object.keys(pmd.byCategory).length > 0) {
        const ctx = document.getElementById('pmd-category-chart');
        if (ctx) {
            const sorted = Object.entries(pmd.byCategory).sort((a, b) => b[1] - a[1]);
            const chart = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: sorted.map(([cat]) => cat),
                    datasets: [{
                        data: sorted.map(([, count]) => count),
                        backgroundColor: '#1A3E5C'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true } },
                    onClick: (e, elements) => {
                        if (elements.length > 0) {
                            const category = sorted[elements[0].index][0];
                            showCategoryViolations(category);
                        }
                    }
                }
            });
            ctx.style.cursor = 'pointer';
        }
    }

    // Rules chart with click handler
    if (pmd.topRules && pmd.topRules.length > 0) {
        const ctx = document.getElementById('pmd-rules-chart');
        if (ctx) {
            const top10 = pmd.topRules.slice(0, 10);
            new Chart(ctx.getContext('2d'), {
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
                    scales: { x: { beginAtZero: true } },
                    onClick: (e, elements) => {
                        if (elements.length > 0) {
                            const rule = top10[elements[0].index].rule;
                            showRuleViolations(rule);
                        }
                    }
                }
            });
            ctx.style.cursor = 'pointer';
        }
    }

    // Files table - CLICKABLE ROWS
    if (pmd.topFiles && pmd.topFiles.length > 0) {
        const tbody = document.querySelector('#pmd-files-table tbody');
        if (tbody) {
            tbody.innerHTML = pmd.topFiles.slice(0, 15).map(f => `
                <tr class="clickable-row" onclick="showFileViolations('${f.file}')">
                    <td><span class="clickable">${f.file}</span></td>
                    <td>${f.violations}</td>
                </tr>
            `).join('');
        }
    }
}

// PMD: Show all violations
function showAllPMDViolations() {
    const pmd = data.pmdAnalysis;
    if (!pmd?.allViolations) {
        alert('Detailed violation data not available. Please re-run: npm run audit:pmd');
        return;
    }

    openModal(`All PMD Violations (${pmd.allViolations.length})`, pmd.allViolations, [
        { key: 'file', header: 'File', type: 'file' },
        { key: 'line', header: 'Line', type: 'line' },
        { key: 'rule', header: 'Rule', type: 'text' },
        { key: 'severity', header: 'Severity', type: 'severity' },
        { key: 'category', header: 'Category', type: 'text' },
        { key: 'message', header: 'Message', type: 'message' }
    ]);
}

// Apex Classes & Coverage Section
function renderApexClasses() {
    const apex = data.apexClassesAnalysis;
    if (!apex?.summary) return;

    const summary = apex.summary;

    // Summary text
    document.getElementById('apex-classes-summary').textContent =
        `${summary.totalClasses} classes (${summary.testClasses} test, ${summary.nonTestClasses} non-test), ${summary.triggers} triggers`;

    // Coverage score circle
    const coverage = summary.orgCoverage || 0;
    document.getElementById('coverage-value').textContent = coverage;
    const circle = document.getElementById('coverage-circle');
    const status = document.getElementById('coverage-status');

    if (coverage >= 75) {
        circle.className = 'score-circle excellent';
        status.textContent = 'Meets Requirement';
        status.style.color = '#2e844a';
    } else if (coverage >= 50) {
        circle.className = 'score-circle needs-work';
        status.textContent = 'Below Threshold';
        status.style.color = '#ff9a3c';
    } else {
        circle.className = 'score-circle critical';
        status.textContent = 'Critical - Blocks Deploy';
        status.style.color = '#c23934';
    }

    // Metrics - make clickable
    document.getElementById('total-apex-classes').innerHTML = `<span class="clickable" onclick="showAllApexClasses()">${summary.totalClasses || 0}</span>`;
    document.getElementById('test-classes').innerHTML = `<span class="clickable" onclick="showApexClassesByType('Test')">${summary.testClasses || 0}</span>`;
    document.getElementById('non-test-classes').innerHTML = `<span class="clickable" onclick="showApexClassesByType('Non-Test')">${summary.nonTestClasses || 0}</span>`;
    document.getElementById('apex-triggers').innerHTML = `<span class="clickable" onclick="showApexTriggers()">${summary.triggers || 0}</span>`;
    document.getElementById('zero-coverage').innerHTML = summary.zeroCoverageCount > 0 ?
        `<span class="clickable" onclick="showZeroCoverageClasses()">${summary.zeroCoverageCount}</span>` : '0';
    document.getElementById('low-coverage').innerHTML = summary.lowCoverageCount > 0 ?
        `<span class="clickable" onclick="showLowCoverageClasses()">${summary.lowCoverageCount}</span>` : '0';
    document.getElementById('old-api-classes').innerHTML = summary.oldApiVersionCount > 0 ?
        `<span class="clickable" onclick="showOldApiClasses()">${summary.oldApiVersionCount}</span>` : '0';
    document.getElementById('without-sharing').innerHTML = summary.withoutSharingCount > 0 ?
        `<span class="clickable" onclick="showWithoutSharingClasses()">${summary.withoutSharingCount}</span>` : '0';

    // Test class issues metrics - make clickable
    const testIssues = summary.testIssuesSummary || {};
    const makeClickable = (id, val, issueType) => {
        const el = document.getElementById(id);
        if (val > 0) {
            el.innerHTML = `<span class="clickable" onclick="showTestClassIssuesByType('${issueType}')">${val}</span>`;
        } else {
            el.textContent = '0';
        }
    };
    makeClickable('test-seealldata', testIssues.seeAllData, 'SeeAllData=true');
    makeClickable('test-no-assertions', testIssues.noAssertions, 'No Assertions');
    makeClickable('test-hardcoded-ids', testIssues.hardcodedIds, 'Hardcoded IDs');
    makeClickable('test-missing-startstop', testIssues.missingStartStop, 'Missing Test.startTest');
    makeClickable('test-dml-loops', testIssues.dmlInLoop, 'DML in Loop');
    document.getElementById('test-with-issues').innerHTML = summary.testClassesWithIssues > 0 ?
        `<span class="clickable" onclick="showTestClassIssues()">${summary.testClassesWithIssues}</span>` : '0';

    // Coverage distribution chart
    if (apex.coverageDistribution) {
        const ctx = document.getElementById('coverage-distribution-chart').getContext('2d');
        const dist = apex.coverageDistribution;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(dist),
                datasets: [{
                    data: Object.values(dist),
                    backgroundColor: ['#c23934', '#fe5c4c', '#ff9a3c', '#4bca81', '#2e844a']
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // Class type chart
    if (apex.byType) {
        const ctx = document.getElementById('class-type-chart').getContext('2d');
        const types = Object.entries(apex.byType).sort((a, b) => b[1] - a[1]);

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: types.map(([t]) => t),
                datasets: [{
                    data: types.map(([, c]) => c),
                    backgroundColor: ['#0176d3', '#1b96ff', '#57a3fd', '#aacbff', '#d8edff', '#706e6b', '#ff9a3c', '#4bca81']
                }]
            },
            options: {
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // API Version chart
    if (apex.byApiVersion) {
        const ctx = document.getElementById('api-version-chart').getContext('2d');
        const versions = Object.entries(apex.byApiVersion).sort((a, b) => {
            const vA = parseInt(a[0].replace('v', ''));
            const vB = parseInt(b[0].replace('v', ''));
            return vA - vB;
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: versions.map(([v]) => v),
                datasets: [{
                    data: versions.map(([, c]) => c),
                    backgroundColor: versions.map(([v]) => {
                        const ver = parseInt(v.replace('v', ''));
                        if (ver < 50) return '#c23934';
                        if (ver < 55) return '#ff9a3c';
                        return '#2e844a';
                    })
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // Sharing model chart
    if (apex.bySharingModel) {
        const ctx = document.getElementById('sharing-model-chart').getContext('2d');
        const sharing = Object.entries(apex.bySharingModel);

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sharing.map(([s]) => s),
                datasets: [{
                    data: sharing.map(([, c]) => c),
                    backgroundColor: ['#2e844a', '#c23934', '#0176d3', '#706e6b']
                }]
            },
            options: {
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // Low coverage table
    if (apex.lowCoverageClasses) {
        const tbody = document.querySelector('#low-coverage-table tbody');
        tbody.innerHTML = apex.lowCoverageClasses.map(c => `
            <tr>
                <td>${c.name}</td>
                <td>${c.type}</td>
                <td style="color: ${c.coverage < 50 ? '#c23934' : '#ff9a3c'}">${c.coverage}%</td>
                <td>${c.coveredLines}</td>
                <td>${c.uncoveredLines}</td>
            </tr>
        `).join('');
    }

    // Old API table
    if (apex.oldApiClasses) {
        const tbody = document.querySelector('#old-api-table tbody');
        tbody.innerHTML = apex.oldApiClasses.slice(0, 15).map(c => `
            <tr>
                <td>${c.name}</td>
                <td>${c.type}</td>
                <td style="color: ${c.apiVersion < 45 ? '#c23934' : '#ff9a3c'}">v${c.apiVersion}</td>
            </tr>
        `).join('');
    }

    // Test class issues table
    if (apex.testClassIssues) {
        const tbody = document.querySelector('#test-issues-table tbody');
        tbody.innerHTML = apex.testClassIssues.slice(0, 20).map(c => `
            <tr>
                <td>${c.name}</td>
                <td>${c.lines}</td>
                <td style="color: ${c.issues.length > 2 ? '#c23934' : '#ff9a3c'}">${c.issues.join(', ')}</td>
            </tr>
        `).join('');
    }

    // Triggers table
    if (apex.triggers) {
        const tbody = document.querySelector('#apex-triggers-table tbody');
        tbody.innerHTML = apex.triggers.map(t => `
            <tr>
                <td>${t.name}</td>
                <td>${t.object}</td>
                <td>v${t.apiVersion}</td>
                <td>${t.lines || '-'}</td>
            </tr>
        `).join('');
    }
}

// Flow Analysis Section
function renderFlowAnalysis() {
    const flow = data.flowAnalysis;
    if (!flow.totalFlows) return;

    // Make summary clickable
    const summaryEl = document.getElementById('flow-summary');
    summaryEl.innerHTML = `<span class="clickable" onclick="showAllFlows()">${flow.totalFlows} flows</span> analyzed, <span class="clickable" onclick="showFlowsWithIssues()">${flow.issues?.length || 0} with potential issues</span>`;

    // Make main metrics clickable
    document.getElementById('total-flows').innerHTML = `<span class="clickable" onclick="showAllFlows()">${flow.totalFlows}</span>`;
    document.getElementById('active-flows').textContent = flow.byStatus?.active || 0;
    document.getElementById('complex-flows').innerHTML = `<span class="clickable" onclick="showComplexFlows()">${flow.complexFlows?.length || 0}</span>`;
    document.getElementById('flows-with-issues').innerHTML = `<span class="clickable" onclick="showFlowsWithIssues()">${flow.issues?.length || 0}</span>`;

    // Issues summary metrics - make clickable
    const issues = flow.issuesSummary || {};
    const setClickableMetric = (id, val, issueType) => {
        const el = document.getElementById(id);
        if (el) {
            if (val > 0) {
                el.innerHTML = `<span class="clickable" onclick="showFlowIssueDetails('${issueType}')">${val}</span>`;
            } else {
                el.textContent = val || 0;
            }
        }
    };
    setClickableMetric('flow-dml-loops', issues.dmlInLoops, 'dmlInLoops');
    setClickableMetric('flow-no-fault', issues.noFaultPath, 'noFaultPath');
    setClickableMetric('flow-hardcoded', issues.hardcodedIds, 'hardcodedIds');
    setClickableMetric('flow-no-desc', issues.noDescription, 'noDescription');
    setClickableMetric('flow-unused-vars', issues.unusedVariables, 'unusedVariables');
    setClickableMetric('flow-inactive', issues.inactive, 'inactive');

    // Type chart (bar chart, more compact)
    if (flow.byType) {
        const ctx = document.getElementById('flow-type-chart');
        if (ctx) {
            const types = Object.entries(flow.byType).sort((a, b) => b[1] - a[1]);
            new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: types.map(([type]) => type),
                    datasets: [{
                        data: types.map(([, count]) => count),
                        backgroundColor: '#1A3E5C'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true } }
                }
            });
        }
    }

    // Issues distribution chart
    if (flow.issuesSummary) {
        const ctx = document.getElementById('flow-issues-chart');
        if (ctx) {
            const issueData = [
                { label: 'DML in Loops', value: issues.dmlInLoops || 0, color: '#c23934' },
                { label: 'No Fault Path', value: issues.noFaultPath || 0, color: '#fe5c4c' },
                { label: 'Hardcoded IDs', value: issues.hardcodedIds || 0, color: '#fe5c4c' },
                { label: 'No Description', value: issues.noDescription || 0, color: '#ff9a3c' },
                { label: 'Missing Null Checks', value: issues.missingNullChecks || 0, color: '#ff9a3c' },
                { label: 'Complex Branching', value: issues.tooManyDecisions || 0, color: '#ff9a3c' }
            ].filter(i => i.value > 0);

            new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: issueData.map(i => i.label),
                    datasets: [{
                        data: issueData.map(i => i.value),
                        backgroundColor: issueData.map(i => i.color)
                    }]
                },
                options: {
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true } }
                }
            });
        }
    }

    // Complex flows table - make clickable
    if (flow.complexFlows) {
        const tbody = document.querySelector('#complex-flows-table tbody');
        const flowIssues = flow.issues || [];

        tbody.innerHTML = flow.complexFlows.map(f => {
            const issues = flowIssues.find(i => i.name === f.name)?.issues || [];
            return `
                <tr class="clickable-row" onclick="showFlowDetails('${f.name}')">
                    <td><span class="clickable">${f.name}</span></td>
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

    // Make summary clickable
    const summaryEl = document.getElementById('object-summary');
    summaryEl.innerHTML = `<span class="clickable" onclick="showAllObjects()">${obj.summary.totalObjects} objects</span> with <span class="clickable" onclick="showAllFields()">${obj.summary.totalFields} custom fields</span>`;

    // Make metrics clickable
    document.getElementById('custom-objects').innerHTML = `<span class="clickable" onclick="showAllObjects()">${obj.summary.customObjects || 0}</span>`;
    document.getElementById('custom-metadata').innerHTML = obj.summary.customMetadata > 0 ?
        `<span class="clickable" onclick="showCustomMetadata()">${obj.summary.customMetadata}</span>` : '0';
    document.getElementById('custom-fields').innerHTML = `<span class="clickable" onclick="showAllFields()">${obj.summary.totalFields || 0}</span>`;
    document.getElementById('total-record-types').innerHTML = obj.summary.totalRecordTypes > 0 ?
        `<span class="clickable" onclick="showAllRecordTypes()">${obj.summary.totalRecordTypes}</span>` : '0';
    document.getElementById('total-validation-rules').innerHTML = obj.summary.totalValidationRules > 0 ?
        `<span class="clickable" onclick="showAllValidationRules()">${obj.summary.totalValidationRules}</span>` : '0';

    // Limits analysis
    if (obj.limits) {
        const limits = obj.limits;
        const nearFieldLimit = limits.objectsNearFieldLimit || [];
        const nearRollupLimit = limits.objectsNearRollupLimit || [];

        // Show alert if any objects are near limits
        if (nearFieldLimit.some(o => o.usage >= 70) || nearRollupLimit.some(o => o.usage >= 70)) {
            const alertEl = document.getElementById('limits-alert');
            alertEl.style.display = 'block';
            document.getElementById('limits-alert-text').textContent =
                `${nearFieldLimit.filter(o => o.usage >= 70).length} objects are approaching field limits`;
        }

        // Field limit chart
        if (nearFieldLimit.length > 0) {
            const ctx = document.getElementById('field-limit-chart');
            if (ctx) {
                new Chart(ctx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: nearFieldLimit.slice(0, 10).map(o => o.name.replace('__c', '')),
                        datasets: [{
                            label: '% of 500 limit',
                            data: nearFieldLimit.slice(0, 10).map(o => o.usage),
                            backgroundColor: nearFieldLimit.slice(0, 10).map(o => {
                                if (o.usage >= 80) return '#c23934';
                                if (o.usage >= 60) return '#ff9a3c';
                                return '#00A650';
                            })
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        plugins: { legend: { display: false } },
                        scales: { x: { beginAtZero: true, max: 100 } }
                    }
                });
            }
        }

        // Rollup limit chart
        if (nearRollupLimit.length > 0) {
            const ctx = document.getElementById('rollup-limit-chart');
            if (ctx) {
                new Chart(ctx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: nearRollupLimit.slice(0, 10).map(o => o.name.replace('__c', '')),
                        datasets: [{
                            label: '% of 25 limit',
                            data: nearRollupLimit.slice(0, 10).map(o => o.usage),
                            backgroundColor: nearRollupLimit.slice(0, 10).map(o => {
                                if (o.usage >= 80) return '#c23934';
                                if (o.usage >= 60) return '#ff9a3c';
                                return '#00A650';
                            })
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        plugins: { legend: { display: false } },
                        scales: { x: { beginAtZero: true, max: 100 } }
                    }
                });
            }
        }

        // Limits table
        const allLimitObjects = [...new Set([
            ...nearFieldLimit.map(o => o.name),
            ...nearRollupLimit.map(o => o.name),
            ...(limits.objectsNearLookupLimit || []).map(o => o.name)
        ])];

        if (allLimitObjects.length > 0) {
            const tbody = document.querySelector('#limits-table tbody');
            if (tbody) {
                tbody.innerHTML = allLimitObjects.slice(0, 15).map(name => {
                    const fieldData = nearFieldLimit.find(o => o.name === name);
                    const rollupData = nearRollupLimit.find(o => o.name === name);
                    const lookupData = (limits.objectsNearLookupLimit || []).find(o => o.name === name);
                    const objData = obj.objects.find(o => o.name === name);

                    return `
                        <tr>
                            <td>${name}</td>
                            <td>${fieldData?.fields || objData?.fields || '-'}</td>
                            <td style="color: ${fieldData?.usage >= 80 ? '#c23934' : fieldData?.usage >= 60 ? '#ff9a3c' : '#00A650'}">${fieldData?.usage || '-'}%</td>
                            <td>${rollupData ? rollupData.rollups + '/25' : objData?.rollupCount || '-'}</td>
                            <td>${lookupData ? lookupData.lookups + '/40' : objData?.lookupCount || '-'}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    }

    // Field types chart
    if (obj.fieldAnalysis?.byType) {
        const ctx = document.getElementById('field-type-chart');
        if (ctx) {
            const types = Object.entries(obj.fieldAnalysis.byType).sort((a, b) => b[1] - a[1]).slice(0, 10);
            new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: types.map(([t]) => t),
                    datasets: [{
                        data: types.map(([, c]) => c),
                        backgroundColor: '#1A3E5C'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true } }
                }
            });
        }
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

// Documentation Section
function renderDocumentation() {
    const doc = data.descriptionAnalysis;
    if (!doc?.summary) return;

    const summary = doc.summary;
    const results = doc.results || {};

    // Documentation coverage (inverse of missing percentage)
    const coverage = 100 - (summary.percentageMissing || 0);

    document.getElementById('doc-summary').textContent =
        `${summary.totalMissing} components missing descriptions out of ${summary.totalComponents} analyzed`;

    // AI Readiness Alert
    const aiAlert = document.getElementById('ai-alert');
    const aiAlertText = document.getElementById('ai-alert-text');

    if (summary.percentageMissing > 20) {
        aiAlert.style.display = 'flex';
        aiAlert.className = 'ai-readiness-alert';
        aiAlertText.textContent = `${summary.percentageMissing}% of metadata lacks descriptions. AI tools (Copilot, Claude, Agentforce) cannot understand component purposes without descriptions. This severely limits automated analysis, code reviews, impact analysis, and AI-assisted development capabilities.`;
    } else {
        aiAlert.style.display = 'flex';
        aiAlert.className = 'ai-readiness-alert good';
        document.querySelector('.ai-alert-content h3').textContent = 'AI Ready';
        aiAlertText.textContent = `Good documentation coverage (${coverage}%). AI tools can effectively analyze and assist with this codebase.`;
    }

    // Score circle
    document.getElementById('doc-score-value').textContent = coverage;
    const circle = document.getElementById('doc-score-circle');
    const status = document.getElementById('doc-score-status');

    if (coverage >= 80) {
        circle.className = 'score-circle excellent';
        status.textContent = 'Well Documented';
        status.style.color = '#2e844a';
    } else if (coverage >= 60) {
        circle.className = 'score-circle good';
        status.textContent = 'Needs Improvement';
        status.style.color = '#4bca81';
    } else if (coverage >= 40) {
        circle.className = 'score-circle needs-work';
        status.textContent = 'Poor Documentation';
        status.style.color = '#ff9a3c';
    } else {
        circle.className = 'score-circle critical';
        status.textContent = 'Critical Gap';
        status.style.color = '#c23934';
    }

    // Metrics - make clickable
    document.getElementById('doc-total-components').textContent = summary.totalComponents || 0;
    document.getElementById('doc-missing-total').innerHTML = summary.totalMissing > 0 ?
        `<span class="clickable" onclick="showAllMissingDescriptions()">${summary.totalMissing}</span>` : '0';
    document.getElementById('doc-fields-missing').innerHTML = (results.fields?.missing || 0) > 0 ?
        `<span class="clickable" onclick="showMissingDescriptions('fields')">${results.fields.missing}</span>` : '0';
    document.getElementById('doc-classes-missing').innerHTML = (results.apexClasses?.missing || 0) > 0 ?
        `<span class="clickable" onclick="showMissingDescriptions('apexClasses')">${results.apexClasses.missing}</span>` : '0';
    document.getElementById('doc-flows-missing').innerHTML = (results.flows?.missing || 0) > 0 ?
        `<span class="clickable" onclick="showMissingDescriptions('flows')">${results.flows.missing}</span>` : '0';
    document.getElementById('doc-lwc-missing').innerHTML = (results.lwc?.missing || 0) > 0 ?
        `<span class="clickable" onclick="showMissingDescriptions('lwc')">${results.lwc.missing}</span>` : '0';

    // Missing by type chart
    if (summary.byType) {
        const ctx = document.getElementById('doc-by-type-chart').getContext('2d');
        const types = Object.entries(summary.byType)
            .filter(([, data]) => data.missing > 0)
            .sort((a, b) => b[1].missing - a[1].missing);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: types.map(([type]) => type),
                datasets: [{
                    label: 'Missing',
                    data: types.map(([, data]) => data.missing),
                    backgroundColor: '#c23934'
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }
        });
    }

    // Coverage by type chart
    if (summary.byType) {
        const ctx = document.getElementById('doc-coverage-chart').getContext('2d');
        const types = Object.entries(summary.byType)
            .sort((a, b) => a[1].percentage - b[1].percentage);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: types.map(([type]) => type),
                datasets: [{
                    label: 'Documented %',
                    data: types.map(([, data]) => 100 - data.percentage),
                    backgroundColor: types.map(([, data]) => {
                        const documented = 100 - data.percentage;
                        if (documented >= 80) return '#2e844a';
                        if (documented >= 60) return '#4bca81';
                        if (documented >= 40) return '#ff9a3c';
                        return '#c23934';
                    })
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, max: 100 } }
            }
        });
    }

    // Fields table
    if (results.fields?.items) {
        const tbody = document.querySelector('#fields-no-desc-table tbody');
        tbody.innerHTML = results.fields.items.slice(0, 20).map(f => {
            const parts = f.name.split('.');
            const obj = parts[0] || '';
            const field = parts[1] || f.name;
            return `
                <tr>
                    <td>${field}</td>
                    <td>${obj}</td>
                    <td style="font-size: 0.75rem; color: #706e6b;">${f.path || ''}</td>
                </tr>
            `;
        }).join('');
    }

    // Classes table
    if (results.apexClasses?.items) {
        const tbody = document.querySelector('#classes-no-desc-table tbody');
        tbody.innerHTML = results.apexClasses.items.slice(0, 20).map(c => `
            <tr>
                <td>${c.name}</td>
                <td style="font-size: 0.75rem; color: #706e6b;">${c.path || ''}</td>
            </tr>
        `).join('');
    }

    // Flows table
    if (results.flows?.items) {
        const tbody = document.querySelector('#flows-no-desc-table tbody');
        tbody.innerHTML = results.flows.items.map(f => `
            <tr>
                <td>${f.name}</td>
                <td style="font-size: 0.75rem; color: #706e6b;">${f.path || ''}</td>
            </tr>
        `).join('');
    }

    // LWC table
    if (results.lwc?.items) {
        const tbody = document.querySelector('#lwc-no-desc-table tbody');
        tbody.innerHTML = results.lwc.items.map(l => `
            <tr>
                <td>${l.name}</td>
                <td style="font-size: 0.75rem; color: #706e6b;">${l.path || ''}</td>
            </tr>
        `).join('');
    }
}

// Advanced Rules Section (Hubbl, Quality Clouds, CodeScan patterns)
function renderAdvancedRules() {
    const adv = data.advancedAnalysis;
    const findings = data.advancedFindings || [];

    if (!adv?.apex) return;

    // Apex metrics
    const apex = adv.apex || {};
    document.getElementById('adv-missing-sharing').textContent = apex.missingInheritedSharing?.length || 0;
    document.getElementById('adv-legacy-future').textContent = apex.legacyFutureUsage?.length || 0;
    document.getElementById('adv-hardcoded-urls').textContent = apex.hardcodedEndpoints?.length || 0;
    document.getElementById('adv-dynamic-soql').textContent = apex.dynamicApexWithoutCrud?.length || 0;
    document.getElementById('adv-trigger-logic').textContent = apex.triggerWithLogic?.length || 0;
    document.getElementById('adv-http-loops').textContent = apex.httpCalloutInLoop?.length || 0;

    // LWC metrics
    const lwc = adv.lwc || {};
    document.getElementById('adv-lwc-total').textContent = lwc.total || 0;
    document.getElementById('adv-lwc-issues').textContent = lwc.withIssues || 0;

    const lwcNoDesc = lwc.components?.filter(c => c.issues?.includes('Missing component description'))?.length || 0;
    document.getElementById('adv-lwc-no-desc').textContent = lwcNoDesc;

    // Deprecated tech
    document.getElementById('adv-aura-count').textContent = adv.aura?.count || 0;
    document.getElementById('adv-workflow-count').textContent = adv.workflows?.count || 0;
    document.getElementById('adv-pb-count').textContent = adv.processBuilders?.length || 0;

    // Security advanced
    const sec = adv.security || {};
    document.getElementById('adv-api-profiles').textContent = sec.profilesWithApiEnabled || 0;
    document.getElementById('adv-critical-permsets').textContent = sec.permSetsWithCriticalPerms?.length || 0;
    document.getElementById('adv-dangerous-methods').textContent = sec.classesWithDangerousMethods?.length || 0;

    // Advanced findings table
    if (findings.length > 0) {
        const tbody = document.querySelector('#advanced-findings-table tbody');
        tbody.innerHTML = findings.map(f => `
            <tr>
                <td>${f.id}</td>
                <td><span class="badge severity ${f.severity}">${f.severity}</span></td>
                <td><span class="badge category">${f.category}</span></td>
                <td>${f.title}</td>
                <td style="font-size: 0.8rem; color: #706e6b;">${f.recommendation || '-'}</td>
            </tr>
        `).join('');
    }

    // LWC issues table
    if (lwc.components) {
        const lwcWithIssues = lwc.components.filter(c => c.issues?.length > 0);
        const tbody = document.querySelector('#lwc-issues-table tbody');
        tbody.innerHTML = lwcWithIssues.map(c => `
            <tr>
                <td>${c.name}</td>
                <td style="color: ${c.issues.length > 2 ? '#c23934' : '#ff9a3c'}">${c.issues.join(', ')}</td>
            </tr>
        `).join('');
    }

    // Hardcoded URLs table
    if (apex.hardcodedEndpoints?.length > 0) {
        const tbody = document.querySelector('#hardcoded-urls-table tbody');
        tbody.innerHTML = apex.hardcodedEndpoints.map(e => `
            <tr>
                <td>${e.name}</td>
                <td>${e.count}</td>
                <td style="font-size: 0.75rem; font-family: monospace; color: #706e6b;">${e.urls?.slice(0, 2).join(', ') || '-'}</td>
            </tr>
        `).join('');
    }

    // Update summary text
    const totalIssues = findings.length;
    const criticalCount = findings.filter(f => f.severity === 'Critical').length;
    const highCount = findings.filter(f => f.severity === 'High').length;

    document.getElementById('advanced-summary').innerHTML =
        `Found <strong>${totalIssues}</strong> advanced findings: ` +
        `<span style="color: var(--critical);">${criticalCount} Critical</span>, ` +
        `<span style="color: var(--high);">${highCount} High</span>`;
}

// ============================================
// MODAL DRILL-DOWN FUNCTIONALITY
// ============================================

let modalState = {
    data: [],
    filteredData: [],
    columns: [],
    currentPage: 1,
    itemsPerPage: 50,
    title: ''
};

// Open modal with data
function openModal(title, data, columns) {
    modalState.title = title;
    modalState.data = data;
    modalState.filteredData = [...data];
    modalState.columns = columns;
    modalState.currentPage = 1;

    document.getElementById('modal-title').textContent = title;

    // Populate file filter if applicable
    populateFileFilter();

    // Reset filters
    document.getElementById('modal-filter-severity').value = '';
    document.getElementById('modal-search').value = '';

    // Render table
    renderModalTable();

    // Show modal
    document.getElementById('detail-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    document.getElementById('detail-modal').classList.remove('active');
    document.body.style.overflow = '';
}

// Close on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Populate file filter dropdown
function populateFileFilter() {
    const fileFilter = document.getElementById('modal-filter-file');
    fileFilter.innerHTML = '<option value="">All Files</option>';

    const files = [...new Set(modalState.data.map(d => d.file).filter(Boolean))];
    files.sort().forEach(file => {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = file;
        fileFilter.appendChild(option);
    });
}

// Apply filters
function applyModalFilters() {
    const severity = document.getElementById('modal-filter-severity').value;
    const file = document.getElementById('modal-filter-file').value;
    const search = document.getElementById('modal-search').value.toLowerCase();

    modalState.filteredData = modalState.data.filter(item => {
        if (severity && item.severity !== severity) return false;
        if (file && item.file !== file) return false;
        if (search) {
            const searchableText = Object.values(item).join(' ').toLowerCase();
            if (!searchableText.includes(search)) return false;
        }
        return true;
    });

    modalState.currentPage = 1;
    renderModalTable();
}

// Render table with current data
function renderModalTable() {
    const { filteredData, columns, currentPage, itemsPerPage } = modalState;

    // Update count
    document.getElementById('modal-count').textContent = `${filteredData.length} items`;

    // Calculate pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredData.slice(start, end);

    // Render header
    const thead = document.getElementById('modal-thead');
    thead.innerHTML = `<tr>${columns.map(col => `<th>${col.header}</th>`).join('')}</tr>`;

    // Render body
    const tbody = document.getElementById('modal-tbody');
    tbody.innerHTML = pageData.map(item => {
        return `<tr>${columns.map(col => {
            const value = item[col.key];

            // Apply formatters
            if (col.type === 'severity') {
                return `<td><span class="severity-badge ${value}">${value}</span></td>`;
            } else if (col.type === 'file') {
                return `<td><span class="file-name">${value || '-'}</span></td>`;
            } else if (col.type === 'line') {
                return `<td><span class="line-number">${value || '-'}</span></td>`;
            } else if (col.type === 'message') {
                return `<td><span class="message-text">${value || '-'}</span></td>`;
            } else if (col.type === 'list') {
                const list = Array.isArray(value) ? value.slice(0, 5).join(', ') : value;
                const more = Array.isArray(value) && value.length > 5 ? ` (+${value.length - 5} more)` : '';
                return `<td>${list}${more}</td>`;
            } else {
                return `<td>${value !== undefined && value !== null ? value : '-'}</td>`;
            }
        }).join('')}</tr>`;
    }).join('');

    // Update pagination
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

// Change page
function changePage(delta) {
    const totalPages = Math.ceil(modalState.filteredData.length / modalState.itemsPerPage) || 1;
    modalState.currentPage = Math.max(1, Math.min(totalPages, modalState.currentPage + delta));
    renderModalTable();
}

// Export to CSV
function exportToCSV() {
    const { filteredData, columns, title } = modalState;

    // Header row
    const headers = columns.map(col => col.header);

    // Data rows
    const rows = filteredData.map(item => {
        return columns.map(col => {
            let value = item[col.key];
            if (Array.isArray(value)) value = value.join('; ');
            // Escape quotes and wrap in quotes if contains comma
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            return value !== undefined && value !== null ? value : '';
        });
    });

    // Create CSV content
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ============================================
// DRILL-DOWN CLICK HANDLERS
// ============================================

// PMD: Show all violations for a specific rule
function showRuleViolations(rule) {
    const pmd = data.pmdAnalysis;
    if (!pmd?.allViolations) {
        alert('Detailed violation data not available. Please re-run: npm run audit:pmd');
        return;
    }

    const violations = pmd.allViolations.filter(v => v.rule === rule);

    openModal(`${rule} Violations (${violations.length})`, violations, [
        { key: 'file', header: 'File', type: 'file' },
        { key: 'line', header: 'Line', type: 'line' },
        { key: 'severity', header: 'Severity', type: 'severity' },
        { key: 'message', header: 'Message', type: 'message' }
    ]);
}

// PMD: Show all violations for a specific file
function showFileViolations(fileName) {
    const pmd = data.pmdAnalysis;
    if (!pmd?.allViolations) {
        alert('Detailed violation data not available. Please re-run: npm run audit:pmd');
        return;
    }

    const violations = pmd.allViolations.filter(v => v.file === fileName);

    openModal(`Violations in ${fileName} (${violations.length})`, violations, [
        { key: 'line', header: 'Line', type: 'line' },
        { key: 'rule', header: 'Rule', type: 'text' },
        { key: 'severity', header: 'Severity', type: 'severity' },
        { key: 'category', header: 'Category', type: 'text' },
        { key: 'message', header: 'Message', type: 'message' }
    ]);
}

// PMD: Show all violations by severity
function showSeverityViolations(severity) {
    const pmd = data.pmdAnalysis;
    if (!pmd?.allViolations) {
        alert('Detailed violation data not available. Please re-run: npm run audit:pmd');
        return;
    }

    const violations = pmd.allViolations.filter(v => v.severity === severity);

    openModal(`${severity} Violations (${violations.length})`, violations, [
        { key: 'file', header: 'File', type: 'file' },
        { key: 'line', header: 'Line', type: 'line' },
        { key: 'rule', header: 'Rule', type: 'text' },
        { key: 'message', header: 'Message', type: 'message' }
    ]);
}

// PMD: Show all violations by category
function showCategoryViolations(category) {
    const pmd = data.pmdAnalysis;
    if (!pmd?.allViolations) {
        alert('Detailed violation data not available. Please re-run: npm run audit:pmd');
        return;
    }

    const violations = pmd.allViolations.filter(v => v.category === category);

    openModal(`${category} Violations (${violations.length})`, violations, [
        { key: 'file', header: 'File', type: 'file' },
        { key: 'line', header: 'Line', type: 'line' },
        { key: 'rule', header: 'Rule', type: 'text' },
        { key: 'severity', header: 'Severity', type: 'severity' },
        { key: 'message', header: 'Message', type: 'message' }
    ]);
}

// Flow: Show all flows
function showAllFlows() {
    const flow = data.flowAnalysis;
    if (!flow?.allFlows) {
        alert('Detailed flow data not available. Please re-run: npm run audit:flows');
        return;
    }

    openModal(`All Flows (${flow.allFlows.length})`, flow.allFlows, [
        { key: 'name', header: 'Flow Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'status', header: 'Status', type: 'text' },
        { key: 'elements', header: 'Elements', type: 'text' },
        { key: 'issues', header: 'Issues', type: 'list' }
    ]);
}

// Flow: Show flows with specific issue type
function showFlowIssueDetails(issueType) {
    const flow = data.flowAnalysis;
    if (!flow?.issueDetails) {
        alert('Detailed flow data not available. Please re-run: npm run audit:flows');
        return;
    }

    const issueMap = {
        'dmlInLoops': { data: flow.issueDetails.dmlInLoops, title: 'Flows with DML in Loops' },
        'noFaultPath': { data: flow.issueDetails.noFaultPath, title: 'Flows without Fault Handling' },
        'hardcodedIds': { data: flow.issueDetails.hardcodedIds, title: 'Flows with Hardcoded IDs' },
        'noDescription': { data: flow.issueDetails.noDescription, title: 'Flows without Description' },
        'unusedVariables': { data: flow.issueDetails.unusedVariables, title: 'Flows with Unused Variables' },
        'missingNullChecks': { data: flow.issueDetails.missingNullChecks, title: 'Flows Missing Null Checks' },
        'complexBranching': { data: flow.issueDetails.complexBranching, title: 'Flows with Complex Branching' },
        'inactive': { data: flow.issueDetails.inactive, title: 'Inactive Flows' }
    };

    const issue = issueMap[issueType];
    if (!issue) return;

    let columns = [
        { key: 'name', header: 'Flow Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' }
    ];

    // Add specific columns based on issue type
    if (issueType === 'hardcodedIds') {
        columns.push({ key: 'count', header: 'ID Count', type: 'text' });
        columns.push({ key: 'ids', header: 'IDs Found', type: 'list' });
    } else if (issueType === 'unusedVariables') {
        columns.push({ key: 'count', header: 'Var Count', type: 'text' });
        columns.push({ key: 'variables', header: 'Variables', type: 'list' });
    } else if (issueType === 'complexBranching') {
        columns.push({ key: 'decisions', header: 'Decisions', type: 'text' });
    }

    openModal(`${issue.title} (${issue.data.length})`, issue.data, columns);
}

// Flow: Show flows with any issues
function showFlowsWithIssues() {
    const flow = data.flowAnalysis;
    if (!flow?.issues) {
        alert('Flow data not available. Please re-run: npm run audit:flows');
        return;
    }

    openModal(`Flows with Issues (${flow.issues.length})`, flow.issues, [
        { key: 'name', header: 'Flow Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'status', header: 'Status', type: 'text' },
        { key: 'elements', header: 'Elements', type: 'text' },
        { key: 'issues', header: 'Issues Found', type: 'list' }
    ]);
}

// Flow: Show complex flows
function showComplexFlows() {
    const flow = data.flowAnalysis;
    if (!flow?.complexFlows) return;

    openModal(`Complex Flows (${flow.complexFlows.length})`, flow.complexFlows, [
        { key: 'name', header: 'Flow Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'elements', header: 'Elements', type: 'text' }
    ]);
}

// Flow: Show single flow details
function showFlowDetails(flowName) {
    const flow = data.flowAnalysis;
    if (!flow?.allFlows) {
        alert('Detailed flow data not available. Please re-run: npm run audit:flows');
        return;
    }

    const flowData = flow.allFlows.find(f => f.name === flowName);
    if (!flowData) return;

    // Create a detail view for single flow
    const details = [
        { property: 'Name', value: flowData.name },
        { property: 'Type', value: flowData.type },
        { property: 'Status', value: flowData.status },
        { property: 'Description', value: flowData.description || 'No description' },
        { property: 'Total Elements', value: flowData.elements },
        { property: 'Decisions', value: flowData.decisions },
        { property: 'Loops', value: flowData.loops },
        { property: 'DML Operations', value: flowData.dmls },
        { property: 'Screens', value: flowData.screens },
        { property: 'Record Lookups', value: flowData.recordLookups },
        { property: 'Subflows', value: flowData.subflows },
        { property: 'Variables', value: flowData.variables },
        { property: 'Has Fault Handling', value: flowData.hasFaultConnector ? 'Yes' : 'No' },
        { property: 'Issues', value: flowData.issues?.join(', ') || 'None' }
    ];

    if (flowData.hardcodedIdsList?.length > 0) {
        details.push({ property: 'Hardcoded IDs', value: flowData.hardcodedIdsList.join(', ') });
    }
    if (flowData.unusedVariablesList?.length > 0) {
        details.push({ property: 'Unused Variables', value: flowData.unusedVariablesList.join(', ') });
    }

    openModal(`Flow Details: ${flowName}`, details, [
        { key: 'property', header: 'Property', type: 'text' },
        { key: 'value', header: 'Value', type: 'text' }
    ]);
}

// Apex Classes: Show all classes
function showAllApexClasses() {
    const apex = data.apexClassesAnalysis;
    if (!apex?.classes) {
        alert('Apex class data not available. Please re-run: npm run audit:apex');
        return;
    }

    openModal(`All Apex Classes (${apex.classes.length})`, apex.classes, [
        { key: 'name', header: 'Class Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'coverage', header: 'Coverage %', type: 'text' },
        { key: 'lines', header: 'Lines', type: 'text' },
        { key: 'apiVersion', header: 'API', type: 'text' },
        { key: 'sharingModel', header: 'Sharing', type: 'text' }
    ]);
}

// Apex Classes: Show classes with low coverage
function showLowCoverageClasses() {
    const apex = data.apexClassesAnalysis;
    if (!apex?.classes) return;

    const lowCoverage = apex.classes.filter(c => c.coverage !== null && c.coverage < 75);

    openModal(`Classes with <75% Coverage (${lowCoverage.length})`, lowCoverage, [
        { key: 'name', header: 'Class Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'coverage', header: 'Coverage %', type: 'text' },
        { key: 'coveredLines', header: 'Covered', type: 'text' },
        { key: 'uncoveredLines', header: 'Uncovered', type: 'text' }
    ]);
}

// Apex Classes: Show test classes with issues
function showTestClassIssues() {
    const apex = data.apexClassesAnalysis;
    if (!apex?.testClassIssues) return;

    openModal(`Test Classes with Issues (${apex.testClassIssues.length})`, apex.testClassIssues, [
        { key: 'name', header: 'Test Class', type: 'text' },
        { key: 'lines', header: 'Lines', type: 'text' },
        { key: 'issues', header: 'Issues Found', type: 'list' }
    ]);
}

// Apex Classes: Show classes by type (Test or Non-Test)
function showApexClassesByType(classType) {
    const apex = data.apexClassesAnalysis;
    if (!apex?.classes) return;

    let filtered;
    if (classType === 'Test') {
        filtered = apex.classes.filter(c => c.isTest === true);
    } else {
        filtered = apex.classes.filter(c => c.isTest === false);
    }

    openModal(`${classType} Classes (${filtered.length})`, filtered, [
        { key: 'name', header: 'Class Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'coverage', header: 'Coverage %', type: 'text' },
        { key: 'lines', header: 'Lines', type: 'text' },
        { key: 'apiVersion', header: 'API', type: 'text' },
        { key: 'sharingModel', header: 'Sharing', type: 'text' }
    ]);
}

// Apex Classes: Show triggers
function showApexTriggers() {
    const apex = data.apexClassesAnalysis;
    if (!apex?.triggers) return;

    openModal(`Apex Triggers (${apex.triggers.length})`, apex.triggers, [
        { key: 'name', header: 'Trigger Name', type: 'text' },
        { key: 'object', header: 'Object', type: 'text' },
        { key: 'apiVersion', header: 'API Version', type: 'text' },
        { key: 'lines', header: 'Lines', type: 'text' }
    ]);
}

// Apex Classes: Show zero coverage classes
function showZeroCoverageClasses() {
    const apex = data.apexClassesAnalysis;
    if (!apex?.classes) return;

    const zeroCoverage = apex.classes.filter(c => c.coverage === 0 && c.isTest === false);

    openModal(`Classes with 0% Coverage (${zeroCoverage.length})`, zeroCoverage, [
        { key: 'name', header: 'Class Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'lines', header: 'Total Lines', type: 'text' },
        { key: 'apiVersion', header: 'API', type: 'text' }
    ]);
}

// Apex Classes: Show old API version classes
function showOldApiClasses() {
    const apex = data.apexClassesAnalysis;
    if (!apex?.oldApiClasses) return;

    openModal(`Classes on Old API Versions (${apex.oldApiClasses.length})`, apex.oldApiClasses, [
        { key: 'name', header: 'Class Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'apiVersion', header: 'API Version', type: 'text' }
    ]);
}

// Apex Classes: Show without sharing classes
function showWithoutSharingClasses() {
    const apex = data.apexClassesAnalysis;
    if (!apex?.classes) return;

    const withoutSharing = apex.classes.filter(c => c.sharingModel === 'without sharing');

    openModal(`Classes Without Sharing (${withoutSharing.length})`, withoutSharing, [
        { key: 'name', header: 'Class Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'lines', header: 'Lines', type: 'text' },
        { key: 'apiVersion', header: 'API', type: 'text' }
    ]);
}

// Apex Classes: Show test classes with specific issue type
function showTestClassIssuesByType(issueType) {
    const apex = data.apexClassesAnalysis;
    if (!apex?.testClassIssues) return;

    const filtered = apex.testClassIssues.filter(c => c.issues.includes(issueType));

    openModal(`Test Classes: ${issueType} (${filtered.length})`, filtered, [
        { key: 'name', header: 'Test Class', type: 'text' },
        { key: 'lines', header: 'Lines', type: 'text' },
        { key: 'issues', header: 'All Issues', type: 'list' }
    ]);
}

// Objects: Show all objects
function showAllObjects() {
    const obj = data.objectAnalysis;
    if (!obj?.objects) return;

    openModal(`All Objects (${obj.objects.length})`, obj.objects, [
        { key: 'name', header: 'Object Name', type: 'text' },
        { key: 'fields', header: 'Fields', type: 'text' },
        { key: 'recordTypes', header: 'Record Types', type: 'text' },
        { key: 'validationRules', header: 'Val. Rules', type: 'text' },
        { key: 'rollupCount', header: 'Rollups', type: 'text' },
        { key: 'lookupCount', header: 'Lookups', type: 'text' }
    ]);
}

// Objects: Show all fields
function showAllFields() {
    const obj = data.objectAnalysis;
    if (!obj?.fieldAnalysis?.allFields) {
        // Try to build from objects
        if (obj?.objects) {
            const fields = [];
            obj.objects.forEach(o => {
                if (o.fieldDetails) {
                    o.fieldDetails.forEach(f => {
                        fields.push({
                            name: f.name,
                            object: o.name,
                            type: f.type,
                            description: f.description || '-'
                        });
                    });
                }
            });
            if (fields.length > 0) {
                openModal(`Custom Fields (${fields.length})`, fields, [
                    { key: 'name', header: 'Field Name', type: 'text' },
                    { key: 'object', header: 'Object', type: 'text' },
                    { key: 'type', header: 'Type', type: 'text' },
                    { key: 'description', header: 'Description', type: 'text' }
                ]);
                return;
            }
        }
        alert('Field details not available. Run object analysis with --detailed flag.');
        return;
    }

    openModal(`All Custom Fields (${obj.fieldAnalysis.allFields.length})`, obj.fieldAnalysis.allFields, [
        { key: 'name', header: 'Field Name', type: 'text' },
        { key: 'object', header: 'Object', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'description', header: 'Description', type: 'text' }
    ]);
}

// Objects: Show custom metadata
function showCustomMetadata() {
    const obj = data.objectAnalysis;
    if (!obj?.objects) return;

    const metadata = obj.objects.filter(o => o.name.endsWith('__mdt'));

    openModal(`Custom Metadata Types (${metadata.length})`, metadata, [
        { key: 'name', header: 'Metadata Type', type: 'text' },
        { key: 'fields', header: 'Fields', type: 'text' }
    ]);
}

// Objects: Show all record types
function showAllRecordTypes() {
    const obj = data.objectAnalysis;
    if (!obj?.recordTypes?.details) return;

    openModal(`Record Types (${obj.recordTypes.details.length})`, obj.recordTypes.details, [
        { key: 'object', header: 'Object', type: 'text' },
        { key: 'name', header: 'Record Type', type: 'text' },
        { key: 'label', header: 'Label', type: 'text' },
        { key: 'active', header: 'Active', type: 'text' }
    ]);
}

// Objects: Show all validation rules
function showAllValidationRules() {
    const obj = data.objectAnalysis;
    if (!obj?.validationRules?.details) return;

    openModal(`Validation Rules (${obj.validationRules.details.length})`, obj.validationRules.details, [
        { key: 'object', header: 'Object', type: 'text' },
        { key: 'name', header: 'Rule Name', type: 'text' },
        { key: 'active', header: 'Active', type: 'text' },
        { key: 'complexity', header: 'Complexity', type: 'text' }
    ]);
}

// Objects: Show objects near field limit
function showObjectsNearFieldLimit() {
    const obj = data.objectAnalysis;
    if (!obj?.limits?.objectsNearFieldLimit) return;

    openModal(`Objects Near Field Limit`, obj.limits.objectsNearFieldLimit, [
        { key: 'name', header: 'Object', type: 'text' },
        { key: 'fields', header: 'Fields', type: 'text' },
        { key: 'usage', header: 'Usage %', type: 'text' },
        { key: 'remaining', header: 'Remaining', type: 'text' }
    ]);
}

// Documentation: Show all missing descriptions by type
function showMissingDescriptions(type) {
    const doc = data.descriptionAnalysis;
    if (!doc?.results?.[type]?.items) return;

    const items = doc.results[type].items;
    const typeLabels = {
        'fields': 'Fields',
        'apexClasses': 'Apex Classes',
        'flows': 'Flows',
        'lwc': 'LWC Components'
    };

    openModal(`${typeLabels[type] || type} Missing Descriptions (${items.length})`, items, [
        { key: 'name', header: 'Name', type: 'text' },
        { key: 'path', header: 'Path', type: 'text' }
    ]);
}

// Documentation: Show all missing descriptions across all types
function showAllMissingDescriptions() {
    const doc = data.descriptionAnalysis;
    if (!doc?.results) return;

    const allMissing = [];

    // Collect from all types
    Object.entries(doc.results).forEach(([type, data]) => {
        if (data.items) {
            data.items.forEach(item => {
                allMissing.push({
                    name: item.name,
                    type: type,
                    path: item.path || '-'
                });
            });
        }
    });

    openModal(`All Missing Descriptions (${allMissing.length})`, allMissing, [
        { key: 'name', header: 'Component Name', type: 'text' },
        { key: 'type', header: 'Type', type: 'text' },
        { key: 'path', header: 'Path', type: 'text' }
    ]);
}

// Navigation helper: Switch to findings tab with filter
function navigateToFindings(severity) {
    // Switch to findings tab
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

    const findingsBtn = document.querySelector('.nav-btn[data-section="findings"]');
    if (findingsBtn) {
        findingsBtn.classList.add('active');
    }
    document.getElementById('findings').classList.add('active');

    // Apply severity filter if provided
    if (severity) {
        document.getElementById('severity-filter').value = severity;
        filterFindings();
    }
}

// Start loading data
loadData();
