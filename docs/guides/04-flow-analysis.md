# Phase 4: Flow & Automation Analysis

## Objective
Analyze all Flows using Lightning Flow Scanner and review automation health.

---

## Prerequisites
- Phase 1 completed (metadata extracted)
- Lightning Flow Scanner plugin installed
- Flows in `force-app/main/default/flows/`

---

## Step 1: Run Lightning Flow Scanner

### Execute Flow Scanner
```bash
# Run Flow Scanner on all flows
sf flow scan \
    --directory force-app/main/default/flows \
    --format json \
    > reports/flow-scanner/flow-scan-results.json

# Also generate table output
sf flow scan \
    --directory force-app/main/default/flows \
    --format table \
    > reports/flow-scanner/flow-scan-summary.txt
```

### Expected Output Format (JSON)
```json
{
    "results": [
        {
            "flow": "Update_Account_Flow",
            "violations": [
                {
                    "rule": "DMLStatementInALoop",
                    "severity": "error",
                    "message": "DML operation found inside a loop",
                    "element": "Update_Record_1",
                    "line": null
                }
            ]
        }
    ],
    "summary": {
        "totalFlows": 25,
        "flowsWithViolations": 8,
        "totalViolations": 15
    }
}
```

---

## Step 2: Process Flow Scanner Results

### Parse Flow Scanner Output
Create file `scripts/parse-flow-results.js`:
```javascript
const fs = require('fs');

// Read Flow Scanner output
let flowReport;
try {
    flowReport = JSON.parse(fs.readFileSync('reports/flow-scanner/flow-scan-results.json', 'utf8'));
} catch (e) {
    console.error('Error reading flow scan results:', e.message);
    process.exit(1);
}

// Initialize summary
const summary = {
    totalFlows: 0,
    flowsWithViolations: 0,
    totalViolations: 0,
    bySeverity: { error: 0, warning: 0, note: 0 },
    byRule: {},
    byFlow: {},
    findings: []
};

// Rule severity mapping
const ruleSeverityMap = {
    'DMLStatementInALoop': 'Critical',
    'SOQLQueryInALoop': 'Critical',
    'ActionCallsInLoop': 'High',
    'UnsafeRunningContext': 'Critical',
    'HardcodedId': 'High',
    'HardcodedUrl': 'Medium',
    'MissingNullHandler': 'Medium',
    'MissingFaultPath': 'Medium',
    'MissingFlowDescription': 'Low',
    'FlowNamingConvention': 'Low',
    'UnusedVariable': 'Low',
    'UnconnectedElement': 'Medium',
    'ProcessBuilder': 'Medium',
    'CyclomaticComplexity': 'Medium',
    'OutdatedAPIVersion': 'Low'
};

// Rule recommendations
const ruleRecommendations = {
    'DMLStatementInALoop': 'Collect records in a collection variable and perform a single DML after the loop',
    'SOQLQueryInALoop': 'Move Get Records outside the loop, filter by collection of IDs',
    'ActionCallsInLoop': 'Use bulkified Apex action that accepts a collection',
    'UnsafeRunningContext': 'Change to "System Mode with Sharing" or "User Mode"',
    'HardcodedId': 'Use variables, formulas, or Get Records to retrieve IDs dynamically',
    'HardcodedUrl': 'Use $API formulas or Custom Labels/Metadata for URLs',
    'MissingNullHandler': 'Add a Decision element after Get Records to check for null',
    'MissingFaultPath': 'Connect fault path to handle errors gracefully',
    'MissingFlowDescription': 'Add description explaining flow purpose and usage',
    'FlowNamingConvention': 'Use format: Domain_Description (e.g., Account_UpdateStatus)',
    'UnusedVariable': 'Remove variables that are not referenced',
    'UnconnectedElement': 'Connect or delete orphan elements',
    'ProcessBuilder': 'Migrate Process Builder to Flow (record-triggered)',
    'CyclomaticComplexity': 'Break into subflows or multiple record-triggered flows',
    'OutdatedAPIVersion': 'Open and save flow to update API version'
};

// Process results
if (flowReport.results) {
    flowReport.results.forEach(flow => {
        summary.totalFlows++;

        if (flow.violations && flow.violations.length > 0) {
            summary.flowsWithViolations++;
            summary.byFlow[flow.flow] = flow.violations.length;

            flow.violations.forEach(violation => {
                summary.totalViolations++;

                // Count by severity
                const severity = violation.severity || 'warning';
                summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;

                // Count by rule
                if (!summary.byRule[violation.rule]) {
                    summary.byRule[violation.rule] = 0;
                }
                summary.byRule[violation.rule]++;

                // Add to findings
                summary.findings.push({
                    flow: flow.flow,
                    rule: violation.rule,
                    severity: ruleSeverityMap[violation.rule] || 'Medium',
                    element: violation.element,
                    message: violation.message,
                    recommendation: ruleRecommendations[violation.rule] || 'Review and fix'
                });
            });
        }
    });
}

// Output summary
console.log('=== Flow Scanner Analysis Summary ===\n');
console.log(`Total Flows Scanned: ${summary.totalFlows}`);
console.log(`Flows with Violations: ${summary.flowsWithViolations}`);
console.log(`Total Violations: ${summary.totalViolations}\n`);

console.log('By Severity:');
console.log(`  Errors: ${summary.bySeverity.error || 0}`);
console.log(`  Warnings: ${summary.bySeverity.warning || 0}`);
console.log(`  Notes: ${summary.bySeverity.note || 0}\n`);

console.log('By Rule:');
Object.entries(summary.byRule)
    .sort((a, b) => b[1] - a[1])
    .forEach(([rule, count]) => {
        console.log(`  ${rule}: ${count}`);
    });

console.log('\nFlows with Most Violations:');
Object.entries(summary.byFlow)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([flow, count]) => {
        console.log(`  ${flow}: ${count}`);
    });

fs.writeFileSync('docs/data/flow-scanner-summary.json', JSON.stringify(summary, null, 2));
console.log('\nSummary saved to docs/data/flow-scanner-summary.json');
```

### Execute
```bash
node scripts/parse-flow-results.js > reports/flow-scanner/flow-analysis.txt
```

---

## Step 3: Inventory All Automations

### Query Active Flows
```bash
sf data query --query "SELECT Id, ApiName, Label, ProcessType, TriggerType, Status, Description, LastModifiedDate, LastModifiedBy.Name FROM FlowDefinitionView WHERE IsActive = true ORDER BY ProcessType, ApiName" --target-org audit-org --json > docs/data/active-flows.json
```

### Categorize Flows by Type
```bash
# Count by type
sf data query --query "SELECT ProcessType, COUNT(Id) cnt FROM FlowDefinitionView WHERE IsActive = true GROUP BY ProcessType ORDER BY COUNT(Id) DESC" --target-org audit-org --json > docs/data/flows-by-type.json
```

### Flow Types Reference
| ProcessType | Description | Recommendation |
|-------------|-------------|----------------|
| `AutoLaunchedFlow` | Record-triggered or invocable | Check trigger type |
| `Workflow` | Process Builder | Migrate to Flow |
| `Flow` | Screen Flow | Review for optimization |
| `CustomEvent` | Platform Event-triggered | Check subscription |
| `InvocableProcess` | Invocable Process | Migrate to Flow |

### Check Process Builders
```bash
# List active Process Builders (should migrate)
sf data query --query "SELECT ApiName, Label, Description, LastModifiedDate FROM FlowDefinitionView WHERE ProcessType = 'Workflow' AND IsActive = true" --target-org audit-org --json > docs/data/process-builders-active.json

# Count
echo "Active Process Builders: $(cat docs/data/process-builders-active.json | jq '.result.records | length')"
```

### Check Workflow Rules (Legacy)
```bash
# Workflow rules should be migrated
sf project retrieve start --metadata Workflow --target-org audit-org --output-dir force-app 2>/dev/null

# List workflow files
find force-app -name "*.workflow-meta.xml" > docs/data/workflow-files.txt
```

---

## Step 4: Analyze Flow Complexity

### Flow Element Counts
Create file `scripts/analyze-flow-complexity.js`:
```javascript
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const flowsPath = 'force-app/main/default/flows';
const results = [];

// Check if directory exists
if (!fs.existsSync(flowsPath)) {
    console.log('Flows directory not found');
    process.exit(0);
}

const parser = new xml2js.Parser();

fs.readdirSync(flowsPath).forEach(file => {
    if (file.endsWith('.flow-meta.xml')) {
        const flowContent = fs.readFileSync(path.join(flowsPath, file), 'utf8');

        // Count elements (simple regex approach)
        const flowData = {
            name: file.replace('.flow-meta.xml', ''),
            decisions: (flowContent.match(/<decisions>/g) || []).length,
            loops: (flowContent.match(/<loops>/g) || []).length,
            recordCreates: (flowContent.match(/<recordCreates>/g) || []).length,
            recordUpdates: (flowContent.match(/<recordUpdates>/g) || []).length,
            recordDeletes: (flowContent.match(/<recordDeletes>/g) || []).length,
            recordLookups: (flowContent.match(/<recordLookups>/g) || []).length,
            screens: (flowContent.match(/<screens>/g) || []).length,
            subflows: (flowContent.match(/<subflows>/g) || []).length,
            assignments: (flowContent.match(/<assignments>/g) || []).length,
            actionCalls: (flowContent.match(/<actionCalls>/g) || []).length
        };

        // Calculate complexity score
        flowData.totalElements = Object.values(flowData)
            .filter(v => typeof v === 'number')
            .reduce((a, b) => a + b, 0) - flowData.totalElements;

        flowData.complexityScore =
            (flowData.decisions * 2) +
            (flowData.loops * 3) +
            (flowData.recordCreates + flowData.recordUpdates + flowData.recordDeletes) +
            (flowData.recordLookups) +
            (flowData.subflows) +
            (flowData.actionCalls * 2);

        results.push(flowData);
    }
});

// Sort by complexity
results.sort((a, b) => b.complexityScore - a.complexityScore);

console.log('=== Flow Complexity Analysis ===\n');
console.log('Top 10 Most Complex Flows:');
results.slice(0, 10).forEach((flow, i) => {
    console.log(`${i + 1}. ${flow.name}`);
    console.log(`   Complexity Score: ${flow.complexityScore}`);
    console.log(`   Elements: Decisions=${flow.decisions}, Loops=${flow.loops}, DML=${flow.recordCreates + flow.recordUpdates + flow.recordDeletes}`);
});

// Identify high-complexity flows
const highComplexity = results.filter(f => f.complexityScore > 20);
console.log(`\nFlows with High Complexity (>20): ${highComplexity.length}`);

fs.writeFileSync('docs/data/flow-complexity.json', JSON.stringify(results, null, 2));
```

### Execute (if xml2js is available)
```bash
npm install xml2js --save-dev
node scripts/analyze-flow-complexity.js > docs/data/flow-complexity-summary.txt
```

---

## Step 5: Check Flow Best Practices

### Flows Without Descriptions
```bash
# Parse flows for missing descriptions
for flow in force-app/main/default/flows/*.flow-meta.xml; do
    if ! grep -q "<description>" "$flow"; then
        echo "Missing description: $(basename "$flow" .flow-meta.xml)"
    fi
done > docs/data/flows-missing-description.txt
```

### Flows Without Fault Paths
```bash
# Check for fault connectors
for flow in force-app/main/default/flows/*.flow-meta.xml; do
    # Flows with DML should have fault paths
    if grep -q "<recordCreates>\|<recordUpdates>\|<recordDeletes>" "$flow"; then
        if ! grep -q "<faultConnector>" "$flow"; then
            echo "Missing fault path: $(basename "$flow" .flow-meta.xml)"
        fi
    fi
done > docs/data/flows-missing-fault-path.txt
```

### Check Trigger Order
```bash
# Flows should have trigger order set (Spring '22+)
for flow in force-app/main/default/flows/*.flow-meta.xml; do
    if grep -q "<processType>AutoLaunchedFlow</processType>" "$flow"; then
        if grep -q "<start>" "$flow" && ! grep -q "<triggerOrder>" "$flow"; then
            echo "Missing trigger order: $(basename "$flow" .flow-meta.xml)"
        fi
    fi
done > docs/data/flows-missing-trigger-order.txt
```

---

## Step 6: Generate Flow Findings

### Create Findings Script
Create file `scripts/generate-flow-findings.js`:
```javascript
const fs = require('fs');

const flowSummary = JSON.parse(fs.readFileSync('docs/data/flow-scanner-summary.json', 'utf8'));

// Read additional analysis files
let missingDescriptions = [];
let missingFaultPaths = [];
let processBuilders = { result: { records: [] } };

try {
    missingDescriptions = fs.readFileSync('docs/data/flows-missing-description.txt', 'utf8')
        .split('\n')
        .filter(line => line.startsWith('Missing description:'))
        .map(line => line.replace('Missing description: ', ''));
} catch (e) {}

try {
    missingFaultPaths = fs.readFileSync('docs/data/flows-missing-fault-path.txt', 'utf8')
        .split('\n')
        .filter(line => line.startsWith('Missing fault path:'))
        .map(line => line.replace('Missing fault path: ', ''));
} catch (e) {}

try {
    processBuilders = JSON.parse(fs.readFileSync('docs/data/process-builders-active.json', 'utf8'));
} catch (e) {}

const findings = [];
let findingId = 1;

// Process Flow Scanner findings
flowSummary.findings.forEach(violation => {
    findings.push({
        id: `FLOW-${String(findingId++).padStart(3, '0')}`,
        category: violation.rule.includes('Unsafe') ? 'Security' : 'Performance',
        severity: violation.severity,
        title: `Flow Scanner: ${violation.rule}`,
        description: violation.message,
        location: `Flow: ${violation.flow}${violation.element ? ` (Element: ${violation.element})` : ''}`,
        impact: getImpact(violation.rule),
        recommendation: violation.recommendation,
        effort: getEffort(violation.rule),
        tool: `Lightning Flow Scanner (${violation.rule})`
    });
});

// Add Process Builder findings
if (processBuilders.result && processBuilders.result.records) {
    processBuilders.result.records.forEach(pb => {
        findings.push({
            id: `FLOW-${String(findingId++).padStart(3, '0')}`,
            category: 'Configuration',
            severity: 'Medium',
            title: `Process Builder should be migrated to Flow: ${pb.Label}`,
            description: 'Process Builders are legacy automation. Salesforce recommends migrating to Flow.',
            location: `Process Builder: ${pb.ApiName}`,
            impact: 'Technical debt, reduced functionality compared to Flows',
            recommendation: 'Use Migrate to Flow tool or recreate as record-triggered Flow',
            effort: 'Medium',
            tool: 'Automation Inventory'
        });
    });
}

function getImpact(rule) {
    const impacts = {
        'DMLStatementInALoop': 'Governor limit exceptions, transaction failures with bulk data',
        'SOQLQueryInALoop': 'Governor limit exceptions, performance degradation',
        'UnsafeRunningContext': 'Security vulnerability - users may access unauthorized data',
        'HardcodedId': 'Flow will fail when deployed to different environments',
        'MissingFaultPath': 'Unhandled errors will cause cryptic failures for users'
    };
    return impacts[rule] || 'Flow quality and maintainability affected';
}

function getEffort(rule) {
    const efforts = {
        'MissingFlowDescription': 'Quick Win',
        'FlowNamingConvention': 'Quick Win',
        'UnusedVariable': 'Quick Win',
        'OutdatedAPIVersion': 'Quick Win',
        'MissingFaultPath': 'Quick Win',
        'MissingNullHandler': 'Quick Win',
        'DMLStatementInALoop': 'Medium',
        'SOQLQueryInALoop': 'Medium',
        'CyclomaticComplexity': 'High'
    };
    return efforts[rule] || 'Medium';
}

fs.writeFileSync('docs/data/flow-findings.json', JSON.stringify(findings, null, 2));
console.log(`Generated ${findings.length} Flow findings`);
```

### Execute
```bash
node scripts/generate-flow-findings.js
```

---

## Output Checklist

After completing Phase 4, verify you have:

- [ ] Flow Scanner report generated
- [ ] Violations processed and summarized
- [ ] Active flows inventory created
- [ ] Flows categorized by type
- [ ] Process Builders identified (for migration)
- [ ] Workflow Rules identified (legacy)
- [ ] Flow complexity analyzed
- [ ] Missing descriptions identified
- [ ] Missing fault paths identified
- [ ] Flow findings generated in standard format

### Expected Files
```
reports/flow-scanner/flow-scan-results.json
reports/flow-scanner/flow-scan-summary.txt
reports/flow-scanner/flow-analysis.txt
docs/data/flow-scanner-summary.json
docs/data/active-flows.json
docs/data/flows-by-type.json
docs/data/process-builders-active.json
docs/data/flow-complexity.json
docs/data/flows-missing-description.txt
docs/data/flows-missing-fault-path.txt
docs/data/flow-findings.json
```

---

## Next Phase
Proceed to [05-security-analysis.md](05-security-analysis.md)
