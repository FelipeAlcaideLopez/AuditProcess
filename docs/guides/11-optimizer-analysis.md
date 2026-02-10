# Phase 11: Salesforce Optimizer Analysis

## Objective
Leverage Salesforce Optimizer to get official recommendations and compare with audit findings.

---

## Step 1: Run Salesforce Optimizer

### Access Optimizer
1. Navigate to **Setup** → **Optimizer** (or search "Optimizer" in Setup Quick Find)
2. Click **Run Optimizer** or **Run Report**
3. Wait for the report to generate (can take 5-15 minutes)

### Alternative: Lightning Experience Transition Assistant
If migrating from Classic:
- Setup → **Lightning Experience Transition Assistant**
- Run **Readiness Check**

---

## Step 2: Export Optimizer Data

### Manual Export
1. Open Optimizer report in Setup
2. Use browser developer tools to capture the JSON response:
   - Open Network tab (F12)
   - Reload Optimizer page
   - Find the API call containing recommendations
   - Copy response as JSON

### Via API (if available)
```bash
# Optimizer API endpoint (requires proper access)
TOKEN=`cat /tmp/sf_token.txt`
INSTANCE=`cat /tmp/sf_instance.txt`
curl -s -H "Authorization: Bearer $TOKEN" \
     "$INSTANCE/services/data/v59.0/tooling/query/?q=SELECT+Id,OptimizerReportId,Name+FROM+OptimizerReport" \
     > docs/data/optimizer-reports.json
```

---

## Step 3: Optimizer Categories

Salesforce Optimizer analyzes the following areas:

### 1. Feature Usage
- Unused custom fields
- Unused custom objects
- Unused permission sets
- Unused apps

### 2. Security & Access
- Users with excessive permissions
- Password policies
- Login IP ranges
- Session settings

### 3. Maintenance
- Deprecated features
- API version compliance
- Platform changes

### 4. Performance
- Large data volumes
- Complex sharing rules
- Inefficient page layouts

### 5. Best Practices
- Field-level security gaps
- Profile vs Permission Set usage
- Lightning readiness

---

## Step 4: Map Optimizer to Audit Findings

### Create Mapping Script
Create file `scripts/map-optimizer-findings.js`:
```javascript
const fs = require('fs');

// Load optimizer data (manually captured or via API)
let optimizerData = { recommendations: [] };
try {
    optimizerData = JSON.parse(fs.readFileSync('docs/data/optimizer-export.json', 'utf8'));
} catch(e) {
    console.log('Note: Optimizer data not available. Add manually.');
}

// Map optimizer categories to audit categories
const categoryMapping = {
    'FEATURE_ADOPTION': 'Governance',
    'SECURITY': 'Security',
    'CUSTOMIZATION': 'Data Model',
    'PERFORMANCE': 'Performance',
    'MAINTENANCE': 'Technical Debt'
};

// Load existing findings
const existingFindings = [];
const findingFiles = [
    'docs/data/apex-findings.json',
    'docs/data/flow-findings.json',
    'docs/data/security-findings.json'
];

findingFiles.forEach(file => {
    try {
        const findings = JSON.parse(fs.readFileSync(file, 'utf8'));
        existingFindings.push(...findings);
    } catch(e) {}
});

// Cross-reference optimizer recommendations with audit findings
const crossReference = {
    matchedFindings: [],
    optimizerOnly: [],
    auditOnly: []
};

// Output comparison
console.log('=== Optimizer vs Audit Comparison ===\n');
console.log(`Audit Findings: ${existingFindings.length}`);
console.log(`Optimizer Recommendations: ${optimizerData.recommendations?.length || 0}`);

fs.writeFileSync('docs/data/optimizer-audit-comparison.json',
    JSON.stringify(crossReference, null, 2));
```

---

## Step 5: Key Optimizer Checks

### Query-based Optimizer Checks

```bash
# Unused Custom Fields (no data in last 90 days)
# This requires Field History Tracking or manual analysis

# Unused Permission Sets (no assignments)
sf data query --query "SELECT Id, Name FROM PermissionSet WHERE IsOwnedByProfile = false AND Id NOT IN (SELECT PermissionSetId FROM PermissionSetAssignment)" --target-org audit-org --json > docs/data/unused-permission-sets.json

# Users with System Administrator profile
sf data query --query "SELECT COUNT() FROM User WHERE Profile.Name = 'System Administrator' AND IsActive = true" --target-org audit-org --json

# API Version Analysis
sf data query --query "SELECT ApiVersion, COUNT(Id) cnt FROM ApexClass GROUP BY ApiVersion ORDER BY ApiVersion" --target-org audit-org --json > docs/data/apex-api-versions.json

# Old API versions (< v50)
sf data query --query "SELECT Name, ApiVersion FROM ApexClass WHERE ApiVersion < 50 ORDER BY ApiVersion" --target-org audit-org --json > docs/data/old-api-classes.json
```

---

## Step 6: Generate Optimizer Findings

### Create Optimizer Findings Script
Create file `scripts/generate-optimizer-findings.js`:
```javascript
const fs = require('fs');

const findings = [];
let findingId = 1;

// Check API versions
try {
    const apiVersions = JSON.parse(fs.readFileSync('docs/data/apex-api-versions.json', 'utf8'));
    const oldVersions = apiVersions.result.records.filter(r => r.ApiVersion < 50);

    if (oldVersions.length > 0) {
        const totalOld = oldVersions.reduce((sum, r) => sum + r.cnt, 0);
        findings.push({
            id: `OPT-${String(findingId++).padStart(3, '0')}`,
            category: 'Technical Debt',
            severity: 'Medium',
            title: `${totalOld} Apex classes on old API versions`,
            description: 'Classes are running on API versions below v50',
            location: 'Apex Classes',
            impact: 'May miss platform improvements and security patches',
            recommendation: 'Update classes to API version 58+',
            effort: 'Medium',
            tool: 'Optimizer Analysis'
        });
    }
} catch(e) {}

// Check unused permission sets
try {
    const unused = JSON.parse(fs.readFileSync('docs/data/unused-permission-sets.json', 'utf8'));
    if (unused.result.records.length > 10) {
        findings.push({
            id: `OPT-${String(findingId++).padStart(3, '0')}`,
            category: 'Governance',
            severity: 'Low',
            title: `${unused.result.records.length} unused Permission Sets`,
            description: 'Permission Sets have no user assignments',
            location: 'Permission Sets',
            impact: 'Org clutter, confusion during permission management',
            recommendation: 'Review and delete unused Permission Sets',
            effort: 'Quick Win',
            tool: 'Optimizer Analysis'
        });
    }
} catch(e) {}

fs.writeFileSync('docs/data/optimizer-findings.json', JSON.stringify(findings, null, 2));
console.log(`Generated ${findings.length} Optimizer findings`);
```

---

## Step 7: Manual Optimizer Checklist

Use this checklist to manually record Optimizer findings:

### Feature Usage
- [ ] Number of unused custom fields: ___
- [ ] Number of unused custom objects: ___
- [ ] Number of unused apps: ___
- [ ] Inactive workflow rules count: ___

### Security
- [ ] Password policy compliance: Pass / Fail
- [ ] Session timeout configured: Yes / No
- [ ] Login IP restrictions: Configured / Not configured
- [ ] MFA enabled: Yes / Partial / No

### Performance
- [ ] Objects with >1M records: ___
- [ ] Complex sharing rules: ___
- [ ] Record types per object (max): ___

### Maintenance
- [ ] Components on deprecated API: ___
- [ ] Classic-only components: ___
- [ ] Visualforce pages to migrate: ___

---

## Output Files
```
docs/data/optimizer-export.json         # Manual export from Optimizer UI
docs/data/optimizer-findings.json       # Generated findings
docs/data/apex-api-versions.json        # API version distribution
docs/data/old-api-classes.json          # Classes on old API versions
docs/data/unused-permission-sets.json   # Permission sets without assignments
docs/data/optimizer-audit-comparison.json
```

---

## Integration with Main Audit

The Optimizer findings should be merged with the main audit report in Phase 10:

1. Add `docs/data/optimizer-findings.json` to the findingFiles array in `consolidate-findings.js`
2. Run consolidation to include Optimizer findings in the executive summary
3. Compare Optimizer recommendations vs audit findings for completeness

---

## Next Phase
Return to [10-report-generation.md](10-report-generation.md) to consolidate all findings including Optimizer.
