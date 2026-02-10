const fs = require('fs');

const findings = JSON.parse(fs.readFileSync('docs/data/all-findings.json', 'utf8'));
const summary = JSON.parse(fs.readFileSync('docs/data/findings-summary.json', 'utf8'));

// Load org details
let orgName = 'Unknown';
try {
    const orgDetails = JSON.parse(fs.readFileSync('docs/data/org-details.json', 'utf8'));
    orgName = orgDetails.result.records[0].Name;
} catch(e) {}

// Load limits
let limitsData = {};
try {
    limitsData = JSON.parse(fs.readFileSync('docs/data/org-limits-api.json', 'utf8'));
} catch(e) {}

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
    .map((f, i) => `${i + 1}. **${f.title}** (${f.severity})`);

// Storage calculations
let dataStorageUsed = 0, dataStorageMax = 1, fileStorageUsed = 0, fileStorageMax = 1;
if (limitsData.DataStorageMB) {
    dataStorageMax = limitsData.DataStorageMB.Max;
    dataStorageUsed = dataStorageMax - limitsData.DataStorageMB.Remaining;
}
if (limitsData.FileStorageMB) {
    fileStorageMax = limitsData.FileStorageMB.Max;
    fileStorageUsed = fileStorageMax - limitsData.FileStorageMB.Remaining;
}

// Load dynamic metrics
let metrics = {
    apexClasses: 0,
    triggers: 0,
    flows: 0,
    lwc: 0,
    namedCredentials: 0,
    activeUsers: 0,
    pmdViolations: 0
};

// Count files in force-app
const path = require('path');
try {
    const classesDir = 'force-app/main/default/classes';
    const triggersDir = 'force-app/main/default/triggers';
    const flowsDir = 'force-app/main/default/flows';
    const lwcDir = 'force-app/main/default/lwc';

    if (fs.existsSync(classesDir)) {
        metrics.apexClasses = fs.readdirSync(classesDir).filter(f => f.endsWith('.cls')).length;
    }
    if (fs.existsSync(triggersDir)) {
        metrics.triggers = fs.readdirSync(triggersDir).filter(f => f.endsWith('.trigger')).length;
    }
    if (fs.existsSync(flowsDir)) {
        metrics.flows = fs.readdirSync(flowsDir).filter(f => f.endsWith('.flow-meta.xml')).length;
    }
    if (fs.existsSync(lwcDir)) {
        metrics.lwc = fs.readdirSync(lwcDir).filter(f => fs.statSync(path.join(lwcDir, f)).isDirectory()).length;
    }
} catch(e) {}

// Load PMD violations
try {
    const pmdAnalysis = JSON.parse(fs.readFileSync('docs/data/pmd-analysis.json', 'utf8'));
    metrics.pmdViolations = pmdAnalysis.totalViolations || 0;
} catch(e) {}

// Load security metrics
try {
    const securitySummary = JSON.parse(fs.readFileSync('docs/data/security-summary.json', 'utf8'));
    metrics.namedCredentials = securitySummary.namedCredentials?.length || 0;
    metrics.activeUsers = securitySummary.activeUsers || 0;
} catch(e) {}

// Load flow analysis for active flows
try {
    const flowAnalysis = JSON.parse(fs.readFileSync('docs/data/flow-analysis.json', 'utf8'));
    metrics.activeFlows = flowAnalysis.byStatus?.active || metrics.flows;
} catch(e) {
    metrics.activeFlows = metrics.flows;
}

// Load package analysis
let packageInfo = { totalPackages: 0, byVendor: {}, packages: [] };
try {
    packageInfo = JSON.parse(fs.readFileSync('docs/data/package-analysis.json', 'utf8'));
    metrics.installedPackages = packageInfo.totalPackages || 0;
} catch(e) {
    metrics.installedPackages = 0;
}

// Load framework analysis
let frameworkInfo = { triggerFramework: { detected: false, type: 'None' } };
try {
    frameworkInfo = JSON.parse(fs.readFileSync('docs/data/framework-analysis.json', 'utf8'));
} catch(e) {}

// Generate markdown report
let report = `# Executive Summary - Salesforce Org Audit

**Org Name:** ${orgName}
**Audit Date:** ${new Date().toISOString().split('T')[0]}
**Org Type:** Sandbox

---

## Health Score

\`\`\`
Health Score: ${healthScore}/100
\`\`\`

${healthScore >= 75 ? '🟢 **Good** - The org is in good health with minor improvements needed' : healthScore >= 50 ? '🟡 **Needs Improvement** - Several areas require attention' : '🔴 **Critical** - Urgent issues need to be addressed'}

---

## Findings Overview

| Severity | Count | Percentage |
|----------|-------|------------|
| 🔴 Critical | ${summary.bySeverity.Critical || 0} | ${((summary.bySeverity.Critical || 0) / summary.total * 100).toFixed(0)}% |
| 🟠 High | ${summary.bySeverity.High || 0} | ${((summary.bySeverity.High || 0) / summary.total * 100).toFixed(0)}% |
| 🟡 Medium | ${summary.bySeverity.Medium || 0} | ${((summary.bySeverity.Medium || 0) / summary.total * 100).toFixed(0)}% |
| 🟢 Low | ${summary.bySeverity.Low || 0} | ${((summary.bySeverity.Low || 0) / summary.total * 100).toFixed(0)}% |
| ℹ️ Info | ${summary.bySeverity.Info || 0} | ${((summary.bySeverity.Info || 0) / summary.total * 100).toFixed(0)}% |
| **Total** | **${summary.total}** | 100% |

---

## Findings by Category

\`\`\`mermaid
pie title Findings by Category
${Object.entries(summary.byCategory).map(([cat, count]) =>
    `    "${cat}" : ${count}`
).join('\n')}
\`\`\`

| Category | Count |
|----------|-------|
${Object.entries(summary.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `| ${cat} | ${count} |`)
    .join('\n')}

---

## Key Risks (Critical Findings)

${findings.filter(f => f.severity === 'Critical').map(f =>
    `- **${f.title}**: ${f.impact}`
).join('\n') || 'No critical risks identified.'}

---

## Priority Actions (Top 5)

${priorityActions.join('\n')}

---

## Quick Wins

${findings.filter(f => f.effort === 'Quick Win').length} findings can be resolved with minimal effort:

${findings.filter(f => f.effort === 'Quick Win').slice(0, 10).map(f =>
    `- ${f.title} (${f.severity})`
).join('\n') || 'No quick wins identified.'}

---

## Storage & Limits Summary

| Resource | Used | Max | Usage |
|----------|------|-----|-------|
| Data Storage | ${dataStorageUsed} MB | ${dataStorageMax} MB | ${(dataStorageUsed/dataStorageMax*100).toFixed(1)}% |
| File Storage | ${fileStorageUsed} MB | ${fileStorageMax} MB | ${(fileStorageUsed/fileStorageMax*100).toFixed(1)}% |

---

## Effort Distribution

| Effort Level | Count | Percentage |
|--------------|-------|------------|
| Quick Win | ${summary.byEffort['Quick Win'] || 0} | ${((summary.byEffort['Quick Win'] || 0) / summary.total * 100).toFixed(0)}% |
| Medium | ${summary.byEffort['Medium'] || 0} | ${((summary.byEffort['Medium'] || 0) / summary.total * 100).toFixed(0)}% |
| High | ${summary.byEffort['High'] || 0} | ${((summary.byEffort['High'] || 0) / summary.total * 100).toFixed(0)}% |

---

## Key Metrics Analyzed

| Metric | Count |
|--------|-------|
| Custom Apex Classes | ${metrics.apexClasses} |
| Apex Triggers | ${metrics.triggers} |
| Active Flows | ${metrics.activeFlows} |
| LWC Components | ${metrics.lwc} |
| Installed Packages | ${metrics.installedPackages} |
| Named Credentials | ${metrics.namedCredentials} |
| Active Users | ${metrics.activeUsers} |
| PMD Violations | ${metrics.pmdViolations.toLocaleString()} |

---

## Installed Packages Summary

**Total Packages:** ${packageInfo.totalPackages}

| Vendor | Count |
|--------|-------|
${Object.entries(packageInfo.byVendor || {}).sort((a, b) => b[1] - a[1]).map(([vendor, count]) => `| ${vendor} | ${count} |`).join('\n')}

${packageInfo.packages?.slice(0, 10).map(p => `- **${p.name}** (${p.namespace}) v${p.version}`).join('\n') || 'No packages found'}

---

## Architecture Patterns Detected

- **Trigger Framework:** ${frameworkInfo.triggerFramework?.detected ? frameworkInfo.triggerFramework.type : 'Not detected'}
- **Selector Pattern:** ${frameworkInfo.designPatterns?.hasSelector ? 'Yes' : 'No'}
- **Service Pattern:** ${frameworkInfo.designPatterns?.hasService ? 'Yes' : 'No'}
- **Test Data Factory:** ${frameworkInfo.testPatterns?.hasTestDataFactory ? 'Yes' : 'No'}

---

## Analysis Tools Used

| Tool | Purpose |
|------|---------|
| PMD Apex | Static code analysis for Apex |
| Custom Flow Analyzer | Flow complexity and patterns |
| Framework Analyzer | Trigger frameworks and design patterns |
| SOQL Queries | Security and permissions analysis |
| REST API | Org limits extraction |

---

## Recommendations Summary

1. **Immediate (Critical):** Address ${summary.bySeverity.Critical || 0} critical findings immediately
2. **Short-term (High):** Plan remediation for ${summary.bySeverity.High || 0} high-priority items
3. **Medium-term (Medium):** Schedule ${summary.bySeverity.Medium || 0} medium-priority improvements
4. **Long-term (Low):** Consider ${summary.bySeverity.Low || 0} low-priority enhancements

---

## Next Steps

1. Review detailed findings in \`docs/data/all-findings.json\`
2. Prioritize remediation based on business impact
3. Create remediation backlog/tickets
4. Schedule follow-up audit in 3-6 months

---

*Report generated with Claude Code Audit Framework*
`;

fs.writeFileSync('docs/analysis/executive-summary.md', report);
console.log('Executive summary generated: docs/analysis/executive-summary.md');
