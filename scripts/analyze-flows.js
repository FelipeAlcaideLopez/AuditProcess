const fs = require('fs');
const path = require('path');

const flowsDir = 'force-app/main/default/flows';
const findings = [];
let findingId = 1;

const flowAnalysis = {
    totalFlows: 0,
    byType: {},
    byStatus: { active: 0, inactive: 0 },
    complexFlows: [],
    issues: []
};

// Simple flow XML analysis
function analyzeFlow(flowPath) {
    const content = fs.readFileSync(flowPath, 'utf8');
    const fileName = path.basename(flowPath, '.flow-meta.xml');

    const analysis = {
        name: fileName,
        type: 'Unknown',
        elements: 0,
        decisions: 0,
        loops: 0,
        dmls: 0,
        subflows: 0,
        hardcodedIds: 0,
        issues: []
    };

    // Get flow type
    const typeMatch = content.match(/<processType>([^<]+)<\/processType>/);
    if (typeMatch) {
        analysis.type = typeMatch[1];
        flowAnalysis.byType[analysis.type] = (flowAnalysis.byType[analysis.type] || 0) + 1;
    }

    // Check status
    const statusMatch = content.match(/<status>([^<]+)<\/status>/);
    if (statusMatch) {
        if (statusMatch[1] === 'Active') flowAnalysis.byStatus.active++;
        else flowAnalysis.byStatus.inactive++;
    }

    // Count elements
    analysis.decisions = (content.match(/<decisions>/g) || []).length;
    analysis.loops = (content.match(/<loops>/g) || []).length;
    analysis.dmls = (content.match(/<recordCreates>|<recordUpdates>|<recordDeletes>/g) || []).length;
    analysis.subflows = (content.match(/<subflows>/g) || []).length;

    // Count all elements
    const elementMatches = content.match(/<(decisions|assignments|loops|recordLookups|recordCreates|recordUpdates|recordDeletes|screens|subflows|actionCalls)>/g);
    analysis.elements = elementMatches ? elementMatches.length : 0;

    // Check for hardcoded IDs
    const idPattern = /[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}/g;
    const potentialIds = content.match(idPattern) || [];
    analysis.hardcodedIds = potentialIds.filter(id => {
        // Check if it looks like a Salesforce ID (starts with valid prefix)
        return /^(001|003|005|006|00D|500|a[0-9a-zA-Z]{2})/i.test(id);
    }).length;

    // Check for issues

    // DML in loops
    if (analysis.loops > 0 && analysis.dmls > 0) {
        analysis.issues.push('Potential DML in loop pattern');
    }

    // High complexity
    if (analysis.elements > 20) {
        analysis.issues.push('High complexity flow (>20 elements)');
        flowAnalysis.complexFlows.push({ name: fileName, elements: analysis.elements });
    }

    // Hardcoded IDs
    if (analysis.hardcodedIds > 0) {
        analysis.issues.push(`${analysis.hardcodedIds} potential hardcoded IDs`);
    }

    // Too many decisions (complex branching)
    if (analysis.decisions > 5) {
        analysis.issues.push('Complex branching logic (>5 decisions)');
    }

    return analysis;
}

// Process all flows
if (fs.existsSync(flowsDir)) {
    const files = fs.readdirSync(flowsDir).filter(f => f.endsWith('.flow-meta.xml'));
    flowAnalysis.totalFlows = files.length;

    files.forEach(file => {
        const flowPath = path.join(flowsDir, file);
        const analysis = analyzeFlow(flowPath);

        if (analysis.issues.length > 0) {
            flowAnalysis.issues.push({
                name: analysis.name,
                type: analysis.type,
                issues: analysis.issues,
                elements: analysis.elements
            });
        }
    });
}

// Generate findings
flowAnalysis.complexFlows.forEach(flow => {
    findings.push({
        id: `FLOW-${String(findingId++).padStart(3, '0')}`,
        category: 'Flow Design',
        severity: flow.elements > 30 ? 'High' : 'Medium',
        title: `High complexity Flow: ${flow.name}`,
        description: `Flow has ${flow.elements} elements which increases maintenance difficulty`,
        location: `Flow: ${flow.name}`,
        impact: 'Difficult to maintain, test, and debug',
        recommendation: 'Consider breaking into smaller subflows or converting to Apex for complex logic',
        effort: 'Medium',
        tool: 'Flow Analysis'
    });
});

flowAnalysis.issues.filter(f => f.issues.includes('Potential DML in loop pattern')).forEach(flow => {
    findings.push({
        id: `FLOW-${String(findingId++).padStart(3, '0')}`,
        category: 'Flow Performance',
        severity: 'High',
        title: `Potential DML in loop: ${flow.name}`,
        description: 'Flow may have DML operations inside a loop',
        location: `Flow: ${flow.name}`,
        impact: 'Governor limit exceptions in production',
        recommendation: 'Review flow logic to ensure DML operations are bulkified',
        effort: 'Medium',
        tool: 'Flow Analysis'
    });
});

// Output summary
console.log('=== Flow Analysis Summary ===\n');
console.log(`Total Flows: ${flowAnalysis.totalFlows}`);
console.log(`Active: ${flowAnalysis.byStatus.active}`);
console.log(`Inactive: ${flowAnalysis.byStatus.inactive}\n`);

console.log('By Type:');
Object.entries(flowAnalysis.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });

console.log(`\nComplex Flows (>20 elements): ${flowAnalysis.complexFlows.length}`);
flowAnalysis.complexFlows.slice(0, 5).forEach(f => {
    console.log(`  ${f.name}: ${f.elements} elements`);
});

console.log(`\nFlows with Issues: ${flowAnalysis.issues.length}`);
flowAnalysis.issues.slice(0, 5).forEach(f => {
    console.log(`  ${f.name}: ${f.issues.join(', ')}`);
});

// Save results
fs.writeFileSync('docs/data/flow-findings.json', JSON.stringify(findings, null, 2));
fs.writeFileSync('docs/data/flow-analysis.json', JSON.stringify(flowAnalysis, null, 2));

console.log(`\nGenerated ${findings.length} Flow findings`);
