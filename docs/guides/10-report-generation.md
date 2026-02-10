# Phase 10: Report Generation

## Objective
Consolidate all findings and generate final audit reports.

---

## Step 1: Consolidate All Findings

### Merge All Finding Files
Create file `scripts/consolidate-findings.js`:
```javascript
const fs = require('fs');
const path = require('path');

const findingFiles = [
    'docs/data/apex-findings.json',
    'docs/data/lwc-findings.json',
    'docs/data/flow-findings.json',
    'docs/data/security-findings.json',
    'docs/data/data-model-findings.json',
    'docs/data/limits-findings.json',
    'docs/data/integration-findings.json',
    'docs/data/governance-findings-manual.json'
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
            const tool = finding.tool.split(' ')[0]; // Get first word
            summary.byTool[tool] = (summary.byTool[tool] || 0) + 1;

            // Count by effort
            summary.byEffort[finding.effort] =
                (summary.byEffort[finding.effort] || 0) + 1;
        });
    } catch (e) {
        console.log(`Skipping ${file}: ${e.message}`);
    }
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
```

### Execute
```bash
node scripts/consolidate-findings.js > docs/data/consolidation-summary.txt
```

---

## Step 2: Generate Executive Summary

### Create Executive Summary Script
Create file `scripts/generate-executive-summary.js`:
```javascript
const fs = require('fs');

const findings = JSON.parse(fs.readFileSync('docs/data/all-findings.json', 'utf8'));
const summary = JSON.parse(fs.readFileSync('docs/data/findings-summary.json', 'utf8'));

// Calculate health score
const severityWeights = { Critical: 10, High: 5, Medium: 2, Low: 1, Info: 0 };
const debtScore = Object.entries(summary.bySeverity)
    .reduce((sum, [sev, count]) => sum + (severityWeights[sev] * count), 0);

const maxPossibleScore = summary.total * 10;
const healthScore = maxPossibleScore > 0 ?
    Math.max(0, 100 - (debtScore / maxPossibleScore * 100)).toFixed(0) : 100;

// Get top 5 priority actions
const priorityActions = findings
    .filter(f => f.severity === 'Critical' || f.severity === 'High')
    .slice(0, 5)
    .map((f, i) => `${i + 1}. ${f.title}`);

// Generate markdown report
let report = `# Executive Summary - Salesforce Org Audit

**Audit Date:** ${new Date().toISOString().split('T')[0]}
**Org ID:** [ORG_ID]

---

## Health Score

\`\`\`
Health Score: ${healthScore}/100
\`\`\`

${healthScore >= 75 ? '🟢 Good' : healthScore >= 50 ? '🟡 Needs Improvement' : '🔴 Critical'}

---

## Findings Overview

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${summary.bySeverity.Critical || 0} |
| 🟠 High | ${summary.bySeverity.High || 0} |
| 🟡 Medium | ${summary.bySeverity.Medium || 0} |
| 🟢 Low | ${summary.bySeverity.Low || 0} |
| **Total** | **${summary.total}** |

---

## Findings by Category

\`\`\`mermaid
pie title Findings by Category
${Object.entries(summary.byCategory).map(([cat, count]) =>
    `    "${cat}" : ${count}`
).join('\n')}
\`\`\`

---

## Key Risks

${findings.filter(f => f.severity === 'Critical').map(f =>
    `- **${f.title}**: ${f.impact}`
).join('\n') || 'No critical risks identified.'}

---

## Priority Actions (Top 5)

${priorityActions.map(a => `- ${a}`).join('\n')}

---

## Quick Wins

${findings.filter(f => f.effort === 'Quick Win').length} findings can be resolved with minimal effort:

${findings.filter(f => f.effort === 'Quick Win').slice(0, 10).map(f =>
    `- ${f.title} (${f.severity})`
).join('\n')}

---

## Effort Distribution

| Effort Level | Count | Percentage |
|--------------|-------|------------|
| Quick Win | ${summary.byEffort['Quick Win'] || 0} | ${((summary.byEffort['Quick Win'] || 0) / summary.total * 100).toFixed(0)}% |
| Medium | ${summary.byEffort['Medium'] || 0} | ${((summary.byEffort['Medium'] || 0) / summary.total * 100).toFixed(0)}% |
| High | ${summary.byEffort['High'] || 0} | ${((summary.byEffort['High'] || 0) / summary.total * 100).toFixed(0)}% |

---

## Recommendations Summary

1. **Immediate (Critical):** Address ${summary.bySeverity.Critical || 0} critical findings immediately
2. **Short-term (High):** Plan remediation for ${summary.bySeverity.High || 0} high-priority items
3. **Medium-term (Medium):** Schedule ${summary.bySeverity.Medium || 0} medium-priority improvements
4. **Long-term (Low):** Consider ${summary.bySeverity.Low || 0} low-priority enhancements

---

## Next Steps

1. Review detailed findings in individual analysis documents
2. Prioritize remediation based on business impact
3. Create remediation backlog/tickets
4. Schedule follow-up audit in 3-6 months

`;

fs.writeFileSync('docs/12-executive-summary.md', report);
console.log('Executive summary generated: docs/12-executive-summary.md');
```

### Execute
```bash
node scripts/generate-executive-summary.js
```

---

## Step 3: Generate All Findings Report

### Create Detailed Findings Report
Create file `scripts/generate-findings-report.js`:
```javascript
const fs = require('fs');

const findings = JSON.parse(fs.readFileSync('docs/data/all-findings.json', 'utf8'));

let report = `# Complete Audit Findings

**Generated:** ${new Date().toISOString()}
**Total Findings:** ${findings.length}

---

`;

// Group by severity
const severities = ['Critical', 'High', 'Medium', 'Low', 'Info'];

severities.forEach(severity => {
    const sevFindings = findings.filter(f => f.severity === severity);
    if (sevFindings.length === 0) return;

    report += `## ${severity} (${sevFindings.length})\n\n`;

    sevFindings.forEach(f => {
        report += `### ${f.id}: ${f.title}\n\n`;
        report += `| Property | Value |\n`;
        report += `|----------|-------|\n`;
        report += `| **Category** | ${f.category} |\n`;
        report += `| **Severity** | ${f.severity} |\n`;
        report += `| **Location** | \`${f.location}\` |\n`;
        report += `| **Tool** | ${f.tool} |\n`;
        report += `| **Effort** | ${f.effort} |\n\n`;
        report += `**Description:** ${f.description}\n\n`;
        report += `**Impact:** ${f.impact}\n\n`;
        report += `**Recommendation:** ${f.recommendation}\n\n`;
        report += `---\n\n`;
    });
});

fs.writeFileSync('docs/11-all-findings.md', report);
console.log('Findings report generated: docs/11-all-findings.md');
```

### Execute
```bash
node scripts/generate-findings-report.js
```

---

## Step 4: Generate Remediation Plan

### Create Remediation Plan
Create file `scripts/generate-remediation-plan.js`:
```javascript
const fs = require('fs');

const findings = JSON.parse(fs.readFileSync('docs/data/all-findings.json', 'utf8'));

// Group by effort
const quickWins = findings.filter(f => f.effort === 'Quick Win');
const medium = findings.filter(f => f.effort === 'Medium');
const high = findings.filter(f => f.effort === 'High');

let report = `# Remediation Plan

**Generated:** ${new Date().toISOString()}

---

## Phase 1: Quick Wins (${quickWins.length} items)

Focus on immediate, low-effort improvements:

| ID | Title | Category | Severity |
|----|-------|----------|----------|
${quickWins.map(f =>
    `| ${f.id} | ${f.title} | ${f.category} | ${f.severity} |`
).join('\n')}

---

## Phase 2: Medium Effort (${medium.length} items)

Planned improvements requiring moderate effort:

| ID | Title | Category | Severity |
|----|-------|----------|----------|
${medium.map(f =>
    `| ${f.id} | ${f.title} | ${f.category} | ${f.severity} |`
).join('\n')}

---

## Phase 3: High Effort (${high.length} items)

Strategic improvements requiring significant planning:

| ID | Title | Category | Severity |
|----|-------|----------|----------|
${high.map(f =>
    `| ${f.id} | ${f.title} | ${f.category} | ${f.severity} |`
).join('\n')}

---

## Prioritization Matrix

\`\`\`
Priority = Severity × (1 / Effort)

Quick Wins + Critical/High = Do First
High Effort + Low Severity = Consider Later
\`\`\`

---

## Suggested Approach

1. **Immediate Actions (Days 1-7)**
   - Address all Critical findings
   - Complete Quick Wins with High severity

2. **Short-term (Days 8-30)**
   - Complete remaining Quick Wins
   - Begin Medium effort items

3. **Medium-term (Days 31-90)**
   - Complete Medium effort items
   - Plan High effort improvements

4. **Long-term (90+ days)**
   - Execute High effort improvements
   - Continuous improvement cycle

---

## Success Metrics

- [ ] All Critical findings resolved
- [ ] All High severity findings resolved
- [ ] Test coverage > 85%
- [ ] No PMD Critical/High violations
- [ ] All Flows pass Flow Scanner
- [ ] Health Score > 80

`;

fs.writeFileSync('docs/13-remediation-plan.md', report);
console.log('Remediation plan generated: docs/13-remediation-plan.md');
```

### Execute
```bash
node scripts/generate-remediation-plan.js
```

---

## Step 5: Export JSON Data

### Create Final Data Export
```bash
# Create consolidated JSON export
cat << 'EOF' > scripts/create-data-export.js
const fs = require('fs');

const exportData = {
    metadata: {
        exportDate: new Date().toISOString(),
        toolsUsed: ['PMD', 'ESLint', 'Lightning Flow Scanner', 'SOQL Analysis']
    },
    findings: JSON.parse(fs.readFileSync('docs/data/all-findings.json', 'utf8')),
    summary: JSON.parse(fs.readFileSync('docs/data/findings-summary.json', 'utf8'))
};

// Add additional data if available
try {
    exportData.limits = JSON.parse(fs.readFileSync('docs/data/limits-analysis.json', 'utf8'));
} catch(e) {}

try {
    exportData.integrations = JSON.parse(fs.readFileSync('docs/data/integration-assessment.json', 'utf8'));
} catch(e) {}

fs.writeFileSync('docs/14-audit-data.json', JSON.stringify(exportData, null, 2));
console.log('Data export created: docs/14-audit-data.json');
EOF

node scripts/create-data-export.js
```

---

## Output Checklist

### Final Deliverables
```
docs/
├── analysis/
│   ├── 01-org-overview.md
│   ├── 02-apex-analysis.md
│   ├── 03-lwc-analysis.md
│   ├── 04-flow-analysis.md
│   ├── 05-data-model-analysis.md
│   ├── 06-security-analysis.md
│   ├── 07-integration-analysis.md
│   ├── 08-storage-analysis.md
│   ├── 09-limits-analysis.md
│   └── 10-performance-analysis.md
├── 11-all-findings.md
├── 12-executive-summary.md
├── 13-remediation-plan.md
└── 14-audit-data.json
```

---

## Final Steps

1. Review all generated reports for accuracy
2. Add org-specific context where needed
3. Share Executive Summary with stakeholders
4. Create tickets/backlog items from findings
5. Schedule follow-up audit

---

## Audit Complete! 🎉
