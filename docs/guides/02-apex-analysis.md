# Phase 2: Apex Code Analysis

## Objective
Analyze all Apex code using PMD static analysis and evaluate test coverage.

---

## Prerequisites
- Phase 1 completed (metadata extracted)
- PMD installed and configured
- Apex classes in `force-app/main/default/classes/`

---

## Step 1: Run PMD Analysis

### Execute PMD Scan
```bash
# Run PMD with custom ruleset
pmd check \
    --dir force-app/main/default/classes \
    --rulesets config/apex-ruleset.xml \
    --format html \
    --report-file reports/pmd/pmd-report.html \
    --cache .pmd-cache

# Also generate JSON output for processing
pmd check \
    --dir force-app/main/default/classes \
    --rulesets config/apex-ruleset.xml \
    --format json \
    --report-file reports/pmd/pmd-report.json
```

### Include Triggers
```bash
# Run PMD on triggers
pmd check \
    --dir force-app/main/default/triggers \
    --rulesets config/apex-ruleset.xml \
    --format json \
    --report-file reports/pmd/pmd-triggers.json
```

### Expected Output Format (JSON)
```json
{
  "formatVersion": 0,
  "pmdVersion": "7.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "files": [
    {
      "filename": "force-app/main/default/classes/AccountService.cls",
      "violations": [
        {
          "beginline": 45,
          "begincolumn": 9,
          "endline": 45,
          "endcolumn": 50,
          "rule": "OperationWithLimitsInLoop",
          "ruleset": "Performance",
          "priority": 2,
          "description": "Avoid DML/SOQL operations inside loops"
        }
      ]
    }
  ],
  "processingErrors": [],
  "configurationErrors": []
}
```

---

## Step 2: Process PMD Results

### Parse PMD Output Script
Create file `scripts/parse-pmd-results.js`:
```javascript
const fs = require('fs');

// Read PMD JSON output
const pmdReport = JSON.parse(fs.readFileSync('reports/pmd/pmd-report.json', 'utf8'));

// Initialize counters
const summary = {
    totalFiles: 0,
    totalViolations: 0,
    byPriority: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    byRule: {},
    byCategory: {
        'Best Practices': 0,
        'Security': 0,
        'Performance': 0,
        'Design': 0,
        'Error Prone': 0,
        'Code Style': 0
    },
    findings: []
};

// Process files
pmdReport.files.forEach(file => {
    if (file.violations && file.violations.length > 0) {
        summary.totalFiles++;
        file.violations.forEach(violation => {
            summary.totalViolations++;
            summary.byPriority[violation.priority]++;

            // Count by rule
            if (!summary.byRule[violation.rule]) {
                summary.byRule[violation.rule] = 0;
            }
            summary.byRule[violation.rule]++;

            // Count by category (ruleset)
            if (summary.byCategory[violation.ruleset]) {
                summary.byCategory[violation.ruleset]++;
            }

            // Add to findings
            summary.findings.push({
                file: file.filename.replace('force-app/main/default/classes/', ''),
                line: violation.beginline,
                rule: violation.rule,
                category: violation.ruleset,
                priority: violation.priority,
                description: violation.description
            });
        });
    }
});

// Sort rules by count
const sortedRules = Object.entries(summary.byRule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

// Generate report
console.log('=== PMD Analysis Summary ===\n');
console.log(`Total Files with Issues: ${summary.totalFiles}`);
console.log(`Total Violations: ${summary.totalViolations}\n`);

console.log('By Priority:');
console.log(`  Critical (1): ${summary.byPriority[1]}`);
console.log(`  High (2): ${summary.byPriority[2]}`);
console.log(`  Medium (3): ${summary.byPriority[3]}`);
console.log(`  Low (4): ${summary.byPriority[4]}`);
console.log(`  Info (5): ${summary.byPriority[5]}\n`);

console.log('By Category:');
Object.entries(summary.byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
});

console.log('\nTop 20 Rules Violated:');
sortedRules.forEach(([rule, count]) => {
    console.log(`  ${rule}: ${count}`);
});

// Save processed results
fs.writeFileSync('docs/data/pmd-summary.json', JSON.stringify(summary, null, 2));
console.log('\nSummary saved to docs/data/pmd-summary.json');
```

### Execute Processing
```bash
node scripts/parse-pmd-results.js > reports/pmd/pmd-summary.txt
```

---

## Step 3: Analyze Test Coverage

### Run All Tests with Coverage
```bash
# Run all local tests
sf apex run test \
    --test-level RunLocalTests \
    --code-coverage \
    --result-format json \
    --output-dir reports/test-results \
    --target-org audit-org \
    --wait 30
```

### Query Coverage Details
```bash
# Get code coverage
sf data query --query "SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate ORDER BY NumLinesUncovered DESC" --target-org audit-org --json > docs/data/code-coverage.json
```

### Process Coverage Results
Create file `scripts/analyze-coverage.js`:
```javascript
const fs = require('fs');

// Read coverage data
const coverage = JSON.parse(fs.readFileSync('docs/data/code-coverage.json', 'utf8'));

const results = {
    totalClasses: 0,
    totalCovered: 0,
    totalUncovered: 0,
    overallPercentage: 0,
    classesBelowThreshold: [],
    classesWithZeroCoverage: []
};

const THRESHOLD = 75;

coverage.result.records.forEach(record => {
    results.totalClasses++;
    results.totalCovered += record.NumLinesCovered;
    results.totalUncovered += record.NumLinesUncovered;

    const total = record.NumLinesCovered + record.NumLinesUncovered;
    const percentage = total > 0 ? (record.NumLinesCovered / total * 100).toFixed(2) : 0;

    if (percentage < THRESHOLD) {
        results.classesBelowThreshold.push({
            name: record.ApexClassOrTrigger.Name,
            covered: record.NumLinesCovered,
            uncovered: record.NumLinesUncovered,
            percentage: parseFloat(percentage)
        });
    }

    if (record.NumLinesCovered === 0 && record.NumLinesUncovered > 0) {
        results.classesWithZeroCoverage.push(record.ApexClassOrTrigger.Name);
    }
});

const totalLines = results.totalCovered + results.totalUncovered;
results.overallPercentage = totalLines > 0 ?
    (results.totalCovered / totalLines * 100).toFixed(2) : 0;

// Sort by percentage ascending
results.classesBelowThreshold.sort((a, b) => a.percentage - b.percentage);

console.log('=== Test Coverage Analysis ===\n');
console.log(`Overall Coverage: ${results.overallPercentage}%`);
console.log(`Total Lines Covered: ${results.totalCovered}`);
console.log(`Total Lines Uncovered: ${results.totalUncovered}`);
console.log(`\nClasses Below ${THRESHOLD}% Threshold: ${results.classesBelowThreshold.length}`);
console.log(`Classes with 0% Coverage: ${results.classesWithZeroCoverage.length}\n`);

if (results.classesWithZeroCoverage.length > 0) {
    console.log('Classes with Zero Coverage:');
    results.classesWithZeroCoverage.forEach(name => {
        console.log(`  - ${name}`);
    });
}

fs.writeFileSync('docs/data/coverage-analysis.json', JSON.stringify(results, null, 2));
console.log('\nAnalysis saved to docs/data/coverage-analysis.json');
```

### Execute
```bash
node scripts/analyze-coverage.js > reports/test-results/coverage-summary.txt
```

---

## Step 4: Identify Test Quality Issues

### Check for @SeeAllData Usage
```bash
# Find classes using @isTest(SeeAllData=true)
grep -r "@isTest.*seeAllData.*=.*true" force-app/main/default/classes/ --include="*.cls" > docs/data/seealldata-usage.txt

# Count occurrences
echo "Classes using @SeeAllData=true: $(wc -l < docs/data/seealldata-usage.txt)"
```

### Check for Tests Without Assertions
```bash
# Find test methods
grep -r "@isTest" force-app/main/default/classes/ --include="*.cls" -A 50 | \
    grep -B 5 "static.*void" | \
    grep -v "System.assert" > docs/data/potential-no-assert-tests.txt
```

### Check for Test Data Factory Pattern
```bash
# Find test data factory classes
grep -rl "TestDataFactory\|TestFactory\|TestUtil" force-app/main/default/classes/ --include="*.cls" > docs/data/test-factories.txt

# Count
echo "Test Factory Classes: $(wc -l < docs/data/test-factories.txt)"
```

---

## Step 5: Analyze Code Complexity

### Extract Complexity Metrics from PMD
```bash
# Filter complexity violations
cat reports/pmd/pmd-report.json | \
    jq '[.files[].violations[] | select(.rule | contains("Complexity"))]' \
    > docs/data/complexity-violations.json
```

### Large Classes Analysis
```bash
# Find classes over 500 lines
find force-app/main/default/classes -name "*.cls" -exec wc -l {} \; | \
    awk '$1 > 500' | sort -rn > docs/data/large-classes.txt

# Count
echo "Classes over 500 lines: $(wc -l < docs/data/large-classes.txt)"
```

### Trigger Framework Check
```bash
# Check if triggers have logic or delegate to handlers
for trigger in $(find force-app/main/default/triggers -name "*.trigger"); do
    lines=$(wc -l < "$trigger")
    if [ "$lines" -gt 30 ]; then
        echo "WARNING: $trigger has $lines lines (should delegate to handler)"
    fi
done > docs/data/trigger-analysis.txt
```

---

## Step 6: Security Scan Focus

### Extract Security Violations
```bash
# Filter security-related PMD violations
cat reports/pmd/pmd-report.json | \
    jq '[.files[].violations[] | select(.ruleset == "Security")]' \
    > docs/data/security-violations.json

# Count by rule
cat docs/data/security-violations.json | \
    jq 'group_by(.rule) | map({rule: .[0].rule, count: length}) | sort_by(-.count)' \
    > docs/data/security-violations-summary.json
```

### CRUD/FLS Check
```bash
# Find DML without Schema.sObjectType checks
grep -r "insert\|update\|delete\|upsert" force-app/main/default/classes/ --include="*.cls" | \
    grep -v "Test\|test" | \
    grep -v "Schema.sObjectType" > docs/data/potential-crud-violations.txt
```

### Hardcoded IDs Check
```bash
# Find potential hardcoded IDs (15 or 18 char patterns)
grep -rEo "'[a-zA-Z0-9]{15}'|'[a-zA-Z0-9]{18}'" force-app/main/default/classes/ --include="*.cls" | \
    grep -v "Test\|test" > docs/data/hardcoded-ids.txt
```

---

## Step 7: Generate Findings

### Convert to Audit Format
Create file `scripts/generate-apex-findings.js`:
```javascript
const fs = require('fs');

const pmdSummary = JSON.parse(fs.readFileSync('docs/data/pmd-summary.json', 'utf8'));
const coverageAnalysis = JSON.parse(fs.readFileSync('docs/data/coverage-analysis.json', 'utf8'));

// Map PMD priority to severity
const priorityToSeverity = {
    1: 'Critical',
    2: 'High',
    3: 'Medium',
    4: 'Low',
    5: 'Info'
};

// Map rules to effort
const ruleToEffort = {
    'OperationWithLimitsInLoop': 'Medium',
    'ApexSOQLInjection': 'Medium',
    'ApexCRUDViolation': 'Medium',
    'ApexSharingViolations': 'Quick Win',
    'AvoidHardcodingId': 'Quick Win',
    'EmptyCatchBlock': 'Quick Win',
    'AvoidDebugStatements': 'Quick Win',
    'ApexUnitTestClassShouldHaveAsserts': 'Medium',
    'CyclomaticComplexity': 'High',
    'CognitiveComplexity': 'High'
};

const findings = [];
let findingId = 1;

// Process PMD findings
pmdSummary.findings.forEach(violation => {
    findings.push({
        id: `APEX-${String(findingId++).padStart(3, '0')}`,
        category: violation.category === 'Security' ? 'Security' : 'Code Quality',
        severity: priorityToSeverity[violation.priority] || 'Medium',
        title: `PMD: ${violation.rule}`,
        description: violation.description,
        location: `${violation.file}:${violation.line}`,
        impact: getImpact(violation.rule),
        recommendation: getRecommendation(violation.rule),
        effort: ruleToEffort[violation.rule] || 'Medium',
        tool: `PMD (${violation.rule})`
    });
});

// Add coverage findings
if (parseFloat(coverageAnalysis.overallPercentage) < 75) {
    findings.push({
        id: `APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Code Quality',
        severity: 'High',
        title: 'Overall Test Coverage Below 75%',
        description: `Current coverage is ${coverageAnalysis.overallPercentage}%, below the minimum required 75%`,
        location: 'Org-wide',
        impact: 'Deployment to production may fail, untested code increases bug risk',
        recommendation: 'Add unit tests focusing on classes with lowest coverage',
        effort: 'High',
        tool: 'Test Coverage Analysis'
    });
}

// Add zero coverage findings
coverageAnalysis.classesWithZeroCoverage.forEach(className => {
    findings.push({
        id: `APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Code Quality',
        severity: 'Medium',
        title: `Class ${className} has 0% test coverage`,
        description: `The class ${className} has no test coverage`,
        location: `${className}.cls`,
        impact: 'Untested code, potential bugs in production',
        recommendation: 'Create unit tests for this class',
        effort: 'Medium',
        tool: 'Test Coverage Analysis'
    });
});

// Helper functions
function getImpact(rule) {
    const impacts = {
        'OperationWithLimitsInLoop': 'Governor limit exceptions in bulk operations',
        'ApexSOQLInjection': 'Security vulnerability - data breach risk',
        'ApexCRUDViolation': 'Security vulnerability - unauthorized data access',
        'AvoidHardcodingId': 'Deployment failures across environments',
        'CyclomaticComplexity': 'Difficult to maintain and test, higher bug risk'
    };
    return impacts[rule] || 'Code quality degradation';
}

function getRecommendation(rule) {
    const recommendations = {
        'OperationWithLimitsInLoop': 'Move DML/SOQL outside loops, use collections',
        'ApexSOQLInjection': 'Use bind variables or String.escapeSingleQuotes()',
        'ApexCRUDViolation': 'Add Schema.sObjectType.Object.isAccessible() checks',
        'AvoidHardcodingId': 'Use Custom Settings or Custom Metadata',
        'CyclomaticComplexity': 'Refactor into smaller methods, reduce decision points'
    };
    return recommendations[rule] || 'Review and fix according to PMD documentation';
}

// Save findings
fs.writeFileSync('docs/data/apex-findings.json', JSON.stringify(findings, null, 2));
console.log(`Generated ${findings.length} Apex findings`);
```

### Execute
```bash
node scripts/generate-apex-findings.js
```

---

## Output Checklist

After completing Phase 2, verify you have:

- [ ] PMD report generated (HTML and JSON)
- [ ] PMD violations processed and summarized
- [ ] Test coverage analyzed
- [ ] Classes with low/zero coverage identified
- [ ] Security violations extracted
- [ ] Complexity violations identified
- [ ] Large classes identified
- [ ] Trigger framework assessed
- [ ] Apex findings generated in standard format

### Expected Files
```
reports/pmd/pmd-report.html
reports/pmd/pmd-report.json
reports/pmd/pmd-triggers.json
reports/pmd/pmd-summary.txt
reports/test-results/coverage-summary.txt
docs/data/pmd-summary.json
docs/data/code-coverage.json
docs/data/coverage-analysis.json
docs/data/security-violations.json
docs/data/complexity-violations.json
docs/data/large-classes.txt
docs/data/apex-findings.json
```

---

## Next Phase
Proceed to [03-lwc-analysis.md](03-lwc-analysis.md)
