# Phase 9: Governance Review

## Objective
Conduct governance assessment using questionnaire and gather organizational context.

---

## Step 1: Prepare Questionnaire Session

### Pre-Session Data Collection
Before the governance interview, collect automated data:

```bash
# Sandbox information
sf data query --query "SELECT Id, SandboxName, Description, LicenseType FROM SandboxInfo" --target-org audit-org --json > docs/data/sandboxes.json 2>/dev/null || echo "Requires production org access"

# Installed packages
sf data query --query "SELECT Id, SubscriberPackage.Name, SubscriberPackage.NamespacePrefix, SubscriberPackageVersion.Name FROM InstalledSubscriberPackage" --target-org audit-org --json > docs/data/installed-packages.json

# Active users last 30 days
sf data query --query "SELECT COUNT(Id) FROM User WHERE IsActive = true AND LastLoginDate = LAST_N_DAYS:30" --target-org audit-org --json > docs/data/active-users-30d.json

# Users never logged in
sf data query --query "SELECT Id, Name, Profile.Name, CreatedDate FROM User WHERE IsActive = true AND LastLoginDate = null" --target-org audit-org --json > docs/data/users-never-logged-in.json
```

---

## Step 2: Governance Questionnaire Execution

### Print Questionnaire for Interview
The full questionnaire is in `CLAUDE.md` under "Governance & Process Questionnaire".

Create interview summary file `docs/governance-responses.md`:

```markdown
# Governance Interview Responses

**Date:** YYYY-MM-DD
**Interviewee(s):** Name, Role
**Interviewer:** Name

## Section 1: Release Management & DevOps

### Q1.1 Deployment Method
- [x] Change Sets
- [ ] SFDX / SF CLI
- [ ] Third-party tool: _________
- [ ] Manual configuration
- [ ] Mixed approach

**Notes:** _________________

### Q1.2 CI/CD Pipeline
- [ ] Yes - fully automated
- [ ] Yes - partially automated
- [x] No - manual deployments
- [ ] Planned but not implemented

**Notes:** _________________

[Continue with all questions...]
```

---

## Step 3: Analyze Governance Gaps

### Create Governance Analysis Script
Create file `scripts/analyze-governance.js`:
```javascript
const fs = require('fs');

// This script processes governance responses
// In practice, you would parse the markdown responses

const governanceAssessment = {
    categories: {
        releaseManagement: { score: 0, maxScore: 10, findings: [] },
        changeManagement: { score: 0, maxScore: 10, findings: [] },
        testing: { score: 0, maxScore: 10, findings: [] },
        documentation: { score: 0, maxScore: 10, findings: [] },
        compliance: { score: 0, maxScore: 10, findings: [] },
        support: { score: 0, maxScore: 10, findings: [] },
        training: { score: 0, maxScore: 10, findings: [] },
        continuity: { score: 0, maxScore: 10, findings: [] }
    },
    overallScore: 0,
    findings: []
};

let findingId = 1;

// Example scoring logic (customize based on responses)
function scoreReleaseManagement(responses) {
    let score = 0;

    // CI/CD Pipeline
    if (responses.cicd === 'fully_automated') score += 3;
    else if (responses.cicd === 'partially_automated') score += 2;
    else if (responses.cicd === 'planned') score += 1;

    // Source Control
    if (responses.sourceControl === 'git') score += 2;
    else if (responses.sourceControl === 'other') score += 1;

    // Deployment Method
    if (responses.deploymentMethod === 'sfdx') score += 2;
    else if (responses.deploymentMethod === 'thirdparty') score += 2;
    else if (responses.deploymentMethod === 'changesets') score += 1;

    // Sandbox Strategy
    if (responses.sandboxes > 3) score += 2;
    else if (responses.sandboxes > 1) score += 1;

    // Deployment Checklist
    if (responses.deploymentChecklist === 'yes_followed') score += 1;

    return Math.min(score, 10);
}

// Generate findings based on gaps
function generateGovernanceFindings(assessment) {
    const findings = [];

    // Release Management gaps
    if (assessment.categories.releaseManagement.score < 5) {
        findings.push({
            id: `GOV-${String(findingId++).padStart(3, '0')}`,
            category: 'Governance',
            severity: 'High',
            title: 'Immature Release Management Process',
            description: 'Release management practices are below recommended maturity level',
            location: 'Process',
            impact: 'Higher risk of deployment failures, longer release cycles',
            recommendation: 'Implement CI/CD pipeline, adopt source control, standardize deployment process',
            effort: 'High',
            tool: 'Governance Assessment'
        });
    }

    // Documentation gaps
    if (assessment.categories.documentation.score < 5) {
        findings.push({
            id: `GOV-${String(findingId++).padStart(3, '0')}`,
            category: 'Governance',
            severity: 'Medium',
            title: 'Insufficient Technical Documentation',
            description: 'Technical documentation is incomplete or outdated',
            location: 'Process',
            impact: 'Knowledge silos, slower onboarding, maintenance challenges',
            recommendation: 'Create ERD, document integrations, establish documentation standards',
            effort: 'Medium',
            tool: 'Governance Assessment'
        });
    }

    // Compliance gaps
    if (assessment.categories.compliance.score < 5) {
        findings.push({
            id: `GOV-${String(findingId++).padStart(3, '0')}`,
            category: 'Governance',
            severity: 'Critical',
            title: 'Compliance Gaps Identified',
            description: 'Required compliance controls may not be fully implemented',
            location: 'Process',
            impact: 'Regulatory risk, potential fines, audit failures',
            recommendation: 'Review compliance requirements, implement required controls',
            effort: 'High',
            tool: 'Governance Assessment'
        });
    }

    return findings;
}

// Output governance report
console.log('=== Governance Assessment Summary ===\n');
console.log('Category Scores:');
Object.entries(governanceAssessment.categories).forEach(([cat, data]) => {
    const bar = '█'.repeat(data.score) + '░'.repeat(10 - data.score);
    console.log(`${cat.padEnd(20)} [${bar}] ${data.score}/${data.maxScore}`);
});

const totalScore = Object.values(governanceAssessment.categories)
    .reduce((sum, cat) => sum + cat.score, 0);
const maxTotal = Object.values(governanceAssessment.categories)
    .reduce((sum, cat) => sum + cat.maxScore, 0);

console.log(`\nOverall Score: ${totalScore}/${maxTotal} (${(totalScore/maxTotal*100).toFixed(0)}%)`);

// Save results
fs.writeFileSync('docs/data/governance-assessment.json',
    JSON.stringify(governanceAssessment, null, 2));
```

---

## Step 4: Compliance Checklist

### Check for Compliance Indicators
```bash
# Shield Platform Encryption
sf data query --query "SELECT Id, DeveloperName FROM TenantSecret LIMIT 1" --target-org audit-org --json > docs/data/shield-status.json 2>/dev/null || echo "Shield not enabled"

# Event Monitoring
sf data query --query "SELECT Id FROM EventLogFile LIMIT 1" --target-org audit-org --json > docs/data/event-monitoring-status.json 2>/dev/null || echo "Event Monitoring not available"

# Data Classification fields
grep -r "securityClassification\|complianceCategorization" force-app/main/default/objects --include="*.field-meta.xml" > docs/data/data-classification-fields.txt
```

---

## Step 5: Generate Governance Findings

### Manual Finding Entry
Create file `docs/data/governance-findings-manual.json`:
```json
[
    {
        "id": "GOV-001",
        "category": "Governance",
        "severity": "High",
        "title": "No CI/CD Pipeline",
        "description": "Deployments are manual using Change Sets without automated testing",
        "location": "Release Management Process",
        "impact": "Higher risk of deployment failures, no automated regression testing",
        "recommendation": "Implement CI/CD using GitHub Actions, GitLab CI, or Copado",
        "effort": "High",
        "tool": "Governance Interview"
    },
    {
        "id": "GOV-002",
        "category": "Governance",
        "severity": "Medium",
        "title": "No Data Backup Solution",
        "description": "Organization relies solely on Salesforce's data recovery services",
        "location": "Business Continuity",
        "impact": "Data loss risk, long recovery time if needed",
        "recommendation": "Implement backup solution (OwnBackup, Spanning, etc.)",
        "effort": "Medium",
        "tool": "Governance Interview"
    }
]
```

---

## Output Files
```
docs/data/sandboxes.json
docs/data/installed-packages.json
docs/data/active-users-30d.json
docs/data/users-never-logged-in.json
docs/governance-responses.md
docs/data/governance-assessment.json
docs/data/governance-findings-manual.json
```

---

## Next Phase
Proceed to [10-report-generation.md](10-report-generation.md)
