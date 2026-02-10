const fs = require('fs');
const path = require('path');

const findingFiles = [
    'docs/data/apex-findings.json',
    'docs/data/flow-findings.json',
    'docs/data/security-findings.json',
    'docs/data/framework-findings.json',
    'docs/data/package-findings.json',
    'docs/data/object-findings.json',
    'docs/data/layout-findings.json',
    'docs/data/apex-coverage-findings.json'
];

const allFindings = [];
const summary = {
    total: 0,
    bySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 },
    byCategory: {},
    byTool: {},
    byEffort: { 'Quick Win': 0, 'Medium': 0, 'High': 0 }
};

// Load and merge all findings
findingFiles.forEach(file => {
    try {
        const findings = JSON.parse(fs.readFileSync(file, 'utf8'));
        findings.forEach(finding => {
            allFindings.push(finding);
            summary.total++;

            // Count by severity
            summary.bySeverity[finding.severity] =
                (summary.bySeverity[finding.severity] || 0) + 1;

            // Count by category
            summary.byCategory[finding.category] =
                (summary.byCategory[finding.category] || 0) + 1;

            // Count by tool
            const tool = finding.tool.split(' ')[0];
            summary.byTool[tool] = (summary.byTool[tool] || 0) + 1;

            // Count by effort
            summary.byEffort[finding.effort] =
                (summary.byEffort[finding.effort] || 0) + 1;
        });
    } catch (e) {
        console.log(`Skipping ${file}: ${e.message}`);
    }
});

// Add optimizer findings manually
const optimizerFindings = [
    {
        id: 'OPT-001',
        category: 'Governance',
        severity: 'Medium',
        title: '197 unused Permission Sets detected',
        description: 'Permission Sets have no user assignments',
        location: 'Permission Sets',
        impact: 'Org clutter, confusion during permission management',
        recommendation: 'Review and delete unused Permission Sets',
        effort: 'Quick Win',
        tool: 'Optimizer Analysis'
    },
    {
        id: 'OPT-002',
        category: 'Technical Debt',
        severity: 'Medium',
        title: 'Apex classes on old API versions (v35-v42)',
        description: 'Multiple classes running on API versions below v50',
        location: 'Apex Classes',
        impact: 'May miss platform improvements and security patches',
        recommendation: 'Update classes to API version 58+',
        effort: 'Medium',
        tool: 'Optimizer Analysis'
    }
];

optimizerFindings.forEach(finding => {
    allFindings.push(finding);
    summary.total++;
    summary.bySeverity[finding.severity]++;
    summary.byCategory[finding.category] = (summary.byCategory[finding.category] || 0) + 1;
    summary.byTool['Optimizer'] = (summary.byTool['Optimizer'] || 0) + 1;
    summary.byEffort[finding.effort] = (summary.byEffort[finding.effort] || 0) + 1;
});

// Sort findings by severity
const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
allFindings.sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity]
);

// Renumber findings
allFindings.forEach((finding, index) => {
    finding.id = `AUDIT-${String(index + 1).padStart(3, '0')}`;
});

// Output summary
console.log('=== Audit Findings Consolidation ===\n');
console.log(`Total Findings: ${summary.total}\n`);

console.log('By Severity:');
Object.entries(summary.bySeverity)
    .filter(([, count]) => count > 0)
    .forEach(([severity, count]) => {
        console.log(`  ${severity}: ${count}`);
    });

console.log('\nBy Category:');
Object.entries(summary.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
    });

console.log('\nBy Effort:');
Object.entries(summary.byEffort)
    .filter(([, count]) => count > 0)
    .forEach(([effort, count]) => {
        console.log(`  ${effort}: ${count}`);
    });

// Save consolidated data
fs.writeFileSync('docs/data/all-findings.json',
    JSON.stringify(allFindings, null, 2));
fs.writeFileSync('docs/data/findings-summary.json',
    JSON.stringify(summary, null, 2));

console.log('\nConsolidated findings saved to docs/data/all-findings.json');
