# Phase 3: Lightning Web Components (LWC) Analysis

## Objective
Analyze all LWC components using ESLint with @lwc/eslint-plugin-lwc.

---

## Prerequisites
- Phase 1 completed (metadata extracted)
- ESLint and LWC plugin installed
- LWC components in `force-app/main/default/lwc/`

---

## Step 1: Run ESLint Analysis

### Execute ESLint Scan
```bash
# Run ESLint on all LWC JavaScript files
npx eslint force-app/main/default/lwc/**/*.js \
    --format json \
    --output-file reports/eslint/eslint-report.json

# Also generate HTML report
npx eslint force-app/main/default/lwc/**/*.js \
    --format html \
    --output-file reports/eslint/eslint-report.html

# Generate stylish output for quick review
npx eslint force-app/main/default/lwc/**/*.js \
    --format stylish \
    > reports/eslint/eslint-summary.txt
```

### Expected Output Format (JSON)
```json
[
  {
    "filePath": "/path/to/force-app/main/default/lwc/accountCard/accountCard.js",
    "messages": [
      {
        "ruleId": "@lwc/lwc/no-document-query",
        "severity": 2,
        "message": "Avoid using document.querySelector",
        "line": 28,
        "column": 15,
        "nodeType": "CallExpression",
        "endLine": 28,
        "endColumn": 45
      }
    ],
    "errorCount": 1,
    "warningCount": 0,
    "fixableErrorCount": 0,
    "fixableWarningCount": 0
  }
]
```

---

## Step 2: Process ESLint Results

### Parse ESLint Output Script
Create file `scripts/parse-eslint-results.js`:
```javascript
const fs = require('fs');
const path = require('path');

// Read ESLint JSON output
const eslintReport = JSON.parse(fs.readFileSync('reports/eslint/eslint-report.json', 'utf8'));

// Initialize summary
const summary = {
    totalFiles: eslintReport.length,
    filesWithIssues: 0,
    totalErrors: 0,
    totalWarnings: 0,
    byRule: {},
    byComponent: {},
    findings: []
};

// Severity mapping
const severityMap = {
    1: 'Warning',
    2: 'Error'
};

// Rule to category mapping
const ruleCategories = {
    '@lwc/lwc/no-api-reassignments': 'Best Practices',
    '@lwc/lwc/no-deprecated': 'Maintenance',
    '@lwc/lwc/no-document-query': 'Best Practices',
    '@lwc/lwc/no-inner-html': 'Security',
    '@lwc/lwc/valid-api': 'Correctness',
    '@lwc/lwc/valid-track': 'Correctness',
    '@lwc/lwc/valid-wire': 'Correctness',
    '@lwc/lwc/no-async-operation': 'Performance',
    '@lwc/lwc/no-leaky-event-listeners': 'Performance',
    '@lwc/lwc/consistent-component-name': 'Code Style'
};

// Process files
eslintReport.forEach(file => {
    if (file.messages && file.messages.length > 0) {
        summary.filesWithIssues++;

        // Get component name
        const componentMatch = file.filePath.match(/lwc\/([^/]+)\//);
        const componentName = componentMatch ? componentMatch[1] : 'unknown';

        if (!summary.byComponent[componentName]) {
            summary.byComponent[componentName] = { errors: 0, warnings: 0 };
        }

        file.messages.forEach(message => {
            if (message.severity === 2) {
                summary.totalErrors++;
                summary.byComponent[componentName].errors++;
            } else {
                summary.totalWarnings++;
                summary.byComponent[componentName].warnings++;
            }

            // Count by rule
            const ruleId = message.ruleId || 'unknown';
            if (!summary.byRule[ruleId]) {
                summary.byRule[ruleId] = { errors: 0, warnings: 0 };
            }
            if (message.severity === 2) {
                summary.byRule[ruleId].errors++;
            } else {
                summary.byRule[ruleId].warnings++;
            }

            // Add to findings
            summary.findings.push({
                component: componentName,
                file: path.basename(file.filePath),
                line: message.line,
                column: message.column,
                rule: ruleId,
                category: ruleCategories[ruleId] || 'Other',
                severity: severityMap[message.severity],
                message: message.message
            });
        });
    }
});

// Output summary
console.log('=== ESLint LWC Analysis Summary ===\n');
console.log(`Total Files Scanned: ${summary.totalFiles}`);
console.log(`Files with Issues: ${summary.filesWithIssues}`);
console.log(`Total Errors: ${summary.totalErrors}`);
console.log(`Total Warnings: ${summary.totalWarnings}\n`);

console.log('Issues by Rule:');
Object.entries(summary.byRule)
    .sort((a, b) => (b[1].errors + b[1].warnings) - (a[1].errors + a[1].warnings))
    .forEach(([rule, counts]) => {
        console.log(`  ${rule}: ${counts.errors} errors, ${counts.warnings} warnings`);
    });

console.log('\nComponents with Most Issues:');
Object.entries(summary.byComponent)
    .sort((a, b) => (b[1].errors + b[1].warnings) - (a[1].errors + a[1].warnings))
    .slice(0, 10)
    .forEach(([component, counts]) => {
        console.log(`  ${component}: ${counts.errors} errors, ${counts.warnings} warnings`);
    });

// Save processed results
fs.writeFileSync('docs/data/eslint-summary.json', JSON.stringify(summary, null, 2));
console.log('\nSummary saved to docs/data/eslint-summary.json');
```

### Execute Processing
```bash
node scripts/parse-eslint-results.js > reports/eslint/eslint-analysis.txt
```

---

## Step 3: Inventory LWC Components

### List All Components
```bash
# List all LWC component directories
find force-app/main/default/lwc -maxdepth 1 -type d ! -name "lwc" | \
    sed 's/.*\///' | sort > docs/data/lwc-component-list.txt

# Count components
echo "Total LWC Components: $(wc -l < docs/data/lwc-component-list.txt)"
```

### Analyze Component Structure
Create file `scripts/analyze-lwc-structure.js`:
```javascript
const fs = require('fs');
const path = require('path');

const lwcPath = 'force-app/main/default/lwc';
const components = [];

// Read all component directories
const dirs = fs.readdirSync(lwcPath).filter(d => {
    return fs.statSync(path.join(lwcPath, d)).isDirectory();
});

dirs.forEach(componentName => {
    const componentPath = path.join(lwcPath, componentName);
    const files = fs.readdirSync(componentPath);

    const component = {
        name: componentName,
        hasJs: files.some(f => f.endsWith('.js') && !f.includes('.test.')),
        hasHtml: files.some(f => f.endsWith('.html')),
        hasCss: files.some(f => f.endsWith('.css')),
        hasTest: files.some(f => f.includes('.test.js') || f.includes('__tests__')),
        hasMeta: files.some(f => f.endsWith('.js-meta.xml')),
        fileCount: files.length,
        files: files
    };

    // Read meta file for exposed/targets info
    const metaFile = files.find(f => f.endsWith('.js-meta.xml'));
    if (metaFile) {
        const metaContent = fs.readFileSync(path.join(componentPath, metaFile), 'utf8');
        component.isExposed = metaContent.includes('<isExposed>true</isExposed>');
        component.targets = [];

        const targetMatches = metaContent.match(/<target>([^<]+)<\/target>/g);
        if (targetMatches) {
            component.targets = targetMatches.map(t => t.replace(/<\/?target>/g, ''));
        }
    }

    // Check JS file size
    const jsFile = files.find(f => f.endsWith('.js') && !f.includes('.test.'));
    if (jsFile) {
        const jsContent = fs.readFileSync(path.join(componentPath, jsFile), 'utf8');
        component.jsLines = jsContent.split('\n').length;

        // Check for @api, @track, @wire usage
        component.hasApi = jsContent.includes('@api');
        component.hasTrack = jsContent.includes('@track');
        component.hasWire = jsContent.includes('@wire');
    }

    components.push(component);
});

// Generate summary
const summary = {
    totalComponents: components.length,
    withTests: components.filter(c => c.hasTest).length,
    withoutTests: components.filter(c => !c.hasTest).length,
    exposed: components.filter(c => c.isExposed).length,
    usingApi: components.filter(c => c.hasApi).length,
    usingTrack: components.filter(c => c.hasTrack).length,
    usingWire: components.filter(c => c.hasWire).length,
    largeComponents: components.filter(c => c.jsLines > 300).map(c => ({
        name: c.name,
        lines: c.jsLines
    })).sort((a, b) => b.lines - a.lines),
    components: components
};

console.log('=== LWC Component Analysis ===\n');
console.log(`Total Components: ${summary.totalComponents}`);
console.log(`With Tests: ${summary.withTests} (${(summary.withTests/summary.totalComponents*100).toFixed(1)}%)`);
console.log(`Without Tests: ${summary.withoutTests}`);
console.log(`Exposed Components: ${summary.exposed}`);
console.log(`\nDecorator Usage:`);
console.log(`  @api: ${summary.usingApi} components`);
console.log(`  @track: ${summary.usingTrack} components`);
console.log(`  @wire: ${summary.usingWire} components`);

if (summary.largeComponents.length > 0) {
    console.log(`\nLarge Components (>300 lines):`);
    summary.largeComponents.forEach(c => {
        console.log(`  ${c.name}: ${c.lines} lines`);
    });
}

fs.writeFileSync('docs/data/lwc-structure.json', JSON.stringify(summary, null, 2));
console.log('\nStructure saved to docs/data/lwc-structure.json');
```

### Execute
```bash
node scripts/analyze-lwc-structure.js > docs/data/lwc-structure-summary.txt
```

---

## Step 4: Check Security Issues

### innerHTML Usage
```bash
# Find innerHTML usage
grep -rn "innerHTML" force-app/main/default/lwc --include="*.js" > docs/data/lwc-innerhtml-usage.txt

# Count
echo "innerHTML usages: $(wc -l < docs/data/lwc-innerhtml-usage.txt)"
```

### Document Query Usage
```bash
# Find document.querySelector usage
grep -rn "document\.querySelector\|document\.getElementById\|document\.getElementsBy" \
    force-app/main/default/lwc --include="*.js" > docs/data/lwc-document-query.txt
```

### Eval Usage (Critical)
```bash
# Find eval usage (security risk)
grep -rn "eval(" force-app/main/default/lwc --include="*.js" > docs/data/lwc-eval-usage.txt
```

---

## Step 5: Analyze Aura Components (if present)

### Count Aura Components
```bash
# List Aura components
find force-app/main/default/aura -maxdepth 1 -type d ! -name "aura" 2>/dev/null | \
    sed 's/.*\///' | sort > docs/data/aura-component-list.txt

# Count
if [ -s docs/data/aura-component-list.txt ]; then
    echo "Total Aura Components: $(wc -l < docs/data/aura-component-list.txt)"
    echo "WARNING: Consider migrating Aura components to LWC"
else
    echo "No Aura components found"
fi
```

### Identify Migration Candidates
```bash
# List Aura components that could be LWC
for dir in force-app/main/default/aura/*/; do
    component=$(basename "$dir")
    # Check if component uses features not supported in LWC
    if ! grep -q "aura:iteration\|aura:if" "$dir"*.cmp 2>/dev/null; then
        echo "$component - Good candidate for LWC migration"
    fi
done > docs/data/aura-migration-candidates.txt
```

---

## Step 6: Generate LWC Findings

### Create Findings Script
Create file `scripts/generate-lwc-findings.js`:
```javascript
const fs = require('fs');

const eslintSummary = JSON.parse(fs.readFileSync('docs/data/eslint-summary.json', 'utf8'));
const lwcStructure = JSON.parse(fs.readFileSync('docs/data/lwc-structure.json', 'utf8'));

const findings = [];
let findingId = 1;

// Map rules to severity and recommendations
const ruleConfig = {
    '@lwc/lwc/no-inner-html': {
        severity: 'High',
        category: 'Security',
        impact: 'XSS vulnerability - untrusted content could execute malicious scripts',
        recommendation: 'Use template directives and dynamic components instead of innerHTML',
        effort: 'Medium'
    },
    '@lwc/lwc/no-document-query': {
        severity: 'Medium',
        category: 'Code Quality',
        impact: 'Breaks component encapsulation, can cause issues with shadow DOM',
        recommendation: 'Use this.template.querySelector() for component-scoped queries',
        effort: 'Quick Win'
    },
    '@lwc/lwc/no-api-reassignments': {
        severity: 'Medium',
        category: 'Code Quality',
        impact: 'Unexpected behavior, data flow issues',
        recommendation: 'Use internal properties or getters/setters instead',
        effort: 'Medium'
    },
    '@lwc/lwc/no-deprecated': {
        severity: 'Medium',
        category: 'Maintenance',
        impact: 'Future compatibility issues, technical debt',
        recommendation: 'Replace with current API equivalents',
        effort: 'Medium'
    },
    '@lwc/lwc/no-leaky-event-listeners': {
        severity: 'Medium',
        category: 'Performance',
        impact: 'Memory leaks, degraded performance over time',
        recommendation: 'Remove event listeners in disconnectedCallback',
        effort: 'Quick Win'
    }
};

// Process ESLint findings
eslintSummary.findings.forEach(violation => {
    const config = ruleConfig[violation.rule] || {
        severity: violation.severity === 'Error' ? 'Medium' : 'Low',
        category: 'Code Quality',
        impact: 'Code quality issue',
        recommendation: 'Review and fix according to ESLint documentation',
        effort: 'Medium'
    };

    findings.push({
        id: `LWC-${String(findingId++).padStart(3, '0')}`,
        category: config.category,
        severity: config.severity,
        title: `ESLint: ${violation.rule.replace('@lwc/lwc/', '')}`,
        description: violation.message,
        location: `${violation.component}/${violation.file}:${violation.line}`,
        impact: config.impact,
        recommendation: config.recommendation,
        effort: config.effort,
        tool: `ESLint (${violation.rule})`
    });
});

// Add findings for components without tests
lwcStructure.components.filter(c => !c.hasTest && c.isExposed).forEach(component => {
    findings.push({
        id: `LWC-${String(findingId++).padStart(3, '0')}`,
        category: 'Code Quality',
        severity: 'Medium',
        title: `No Jest tests for exposed component: ${component.name}`,
        description: `The exposed LWC component ${component.name} has no Jest test file`,
        location: `lwc/${component.name}/`,
        impact: 'Untested UI components may have bugs affecting user experience',
        recommendation: 'Add Jest tests covering component functionality',
        effort: 'Medium',
        tool: 'LWC Structure Analysis'
    });
});

// Add findings for large components
lwcStructure.largeComponents.forEach(component => {
    findings.push({
        id: `LWC-${String(findingId++).padStart(3, '0')}`,
        category: 'Code Quality',
        severity: 'Low',
        title: `Large component: ${component.name} (${component.lines} lines)`,
        description: `Component has ${component.lines} lines of JavaScript, consider refactoring`,
        location: `lwc/${component.name}/${component.name}.js`,
        impact: 'Large components are harder to maintain and test',
        recommendation: 'Break into smaller child components',
        effort: 'High',
        tool: 'LWC Structure Analysis'
    });
});

fs.writeFileSync('docs/data/lwc-findings.json', JSON.stringify(findings, null, 2));
console.log(`Generated ${findings.length} LWC findings`);
```

### Execute
```bash
node scripts/generate-lwc-findings.js
```

---

## Output Checklist

After completing Phase 3, verify you have:

- [ ] ESLint report generated (HTML and JSON)
- [ ] ESLint violations processed and summarized
- [ ] Component inventory created
- [ ] Component structure analyzed (tests, decorators, size)
- [ ] Security issues identified (innerHTML, document query)
- [ ] Aura components listed (if any)
- [ ] LWC findings generated in standard format

### Expected Files
```
reports/eslint/eslint-report.html
reports/eslint/eslint-report.json
reports/eslint/eslint-summary.txt
reports/eslint/eslint-analysis.txt
docs/data/eslint-summary.json
docs/data/lwc-component-list.txt
docs/data/lwc-structure.json
docs/data/lwc-structure-summary.txt
docs/data/lwc-innerhtml-usage.txt
docs/data/lwc-document-query.txt
docs/data/aura-component-list.txt
docs/data/lwc-findings.json
```

---

## Next Phase
Proceed to [04-flow-analysis.md](04-flow-analysis.md)
