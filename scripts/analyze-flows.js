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
    issues: [],
    issuesSummary: {
        dmlInLoops: 0,
        noFaultPath: 0,
        hardcodedIds: 0,
        noDescription: 0,
        unusedVariables: 0,
        duplicateLabels: 0,
        missingNullChecks: 0,
        tooManyDecisions: 0,
        autoLaunchedWithScreens: 0,
        inactive: 0
    },
    // NEW: All flows with full details for drill-down
    allFlows: [],
    // NEW: Detailed issues by type for drill-down
    issueDetails: {
        dmlInLoops: [],
        noFaultPath: [],
        hardcodedIds: [],
        noDescription: [],
        unusedVariables: [],
        missingNullChecks: [],
        complexBranching: [],
        inactive: []
    }
};

// Simple flow XML analysis
function analyzeFlow(flowPath) {
    const content = fs.readFileSync(flowPath, 'utf8');
    const fileName = path.basename(flowPath, '.flow-meta.xml');

    const analysis = {
        name: fileName,
        type: 'Unknown',
        status: 'Unknown',
        elements: 0,
        decisions: 0,
        loops: 0,
        dmls: 0,
        subflows: 0,
        hardcodedIds: 0,
        screens: 0,
        recordLookups: 0,
        assignments: 0,
        variables: 0,
        issues: [],
        issueDetails: [], // NEW: Detailed issue information
        hasDescription: false,
        hasFaultConnector: false,
        description: '', // NEW: Store description if exists
        hardcodedIdsList: [], // NEW: Store actual hardcoded IDs found
        unusedVariablesList: [], // NEW: Store unused variable names
        dmlElements: [], // NEW: Store DML element names
        loopElements: [] // NEW: Store loop element names
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
        analysis.status = statusMatch[1];
        if (statusMatch[1] === 'Active') {
            flowAnalysis.byStatus.active++;
        } else {
            flowAnalysis.byStatus.inactive++;
            flowAnalysis.issuesSummary.inactive++;
        }
    }

    // Check for description
    const descMatch = content.match(/<description>([^<]+)<\/description>/);
    analysis.hasDescription = descMatch && descMatch[1].trim().length > 0;
    analysis.description = descMatch ? descMatch[1].trim() : '';

    // Check for fault connectors
    analysis.hasFaultConnector = content.includes('<faultConnector>') || content.includes('Fault');

    // Count elements
    analysis.decisions = (content.match(/<decisions>/g) || []).length;
    analysis.loops = (content.match(/<loops>/g) || []).length;
    analysis.dmls = (content.match(/<recordCreates>|<recordUpdates>|<recordDeletes>/g) || []).length;
    analysis.subflows = (content.match(/<subflows>/g) || []).length;
    analysis.screens = (content.match(/<screens>/g) || []).length;
    analysis.recordLookups = (content.match(/<recordLookups>/g) || []).length;
    analysis.assignments = (content.match(/<assignments>/g) || []).length;
    analysis.variables = (content.match(/<variables>/g) || []).length;

    // Count all elements
    const elementMatches = content.match(/<(decisions|assignments|loops|recordLookups|recordCreates|recordUpdates|recordDeletes|screens|subflows|actionCalls|collectionProcessors)>/g);
    analysis.elements = elementMatches ? elementMatches.length : 0;

    // Check for hardcoded IDs (more precise pattern)
    const idPattern = /(?<![a-zA-Z0-9])(001|003|005|006|00D|00Q|00U|500|a[0-9][0-9A-Za-z])[0-9A-Za-z]{12,15}(?![a-zA-Z0-9])/g;
    const potentialIds = content.match(idPattern) || [];
    analysis.hardcodedIds = potentialIds.length;
    analysis.hardcodedIdsList = [...new Set(potentialIds)]; // Store unique IDs

    // NEW: Extract DML element names
    const dmlElementPattern = /<(recordCreates|recordUpdates|recordDeletes)>[\s\S]*?<name>([^<]+)<\/name>/g;
    let dmlMatch;
    while ((dmlMatch = dmlElementPattern.exec(content)) !== null) {
        analysis.dmlElements.push({ type: dmlMatch[1], name: dmlMatch[2] });
    }

    // NEW: Extract loop element names
    const loopElementPattern = /<loops>[\s\S]*?<name>([^<]+)<\/name>/g;
    let loopMatch;
    while ((loopMatch = loopElementPattern.exec(content)) !== null) {
        analysis.loopElements.push(loopMatch[1]);
    }

    // Check for unused variables (variables defined but not referenced)
    const variableNames = [];
    const varMatches = content.matchAll(/<variables>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/variables>/g);
    for (const match of varMatches) {
        variableNames.push(match[1]);
    }
    let unusedVars = 0;
    const unusedVarsList = [];
    variableNames.forEach(varName => {
        // Check if variable is used outside its definition
        const regex = new RegExp(`\\{!${varName}[.}]|<value>${varName}</value>|<field>${varName}</field>`, 'g');
        const usages = (content.match(regex) || []).length;
        if (usages === 0) {
            unusedVars++;
            unusedVarsList.push(varName);
        }
    });
    analysis.unusedVariables = unusedVars;
    analysis.unusedVariablesList = unusedVarsList;

    // ==== ISSUE DETECTION ====

    // 1. DML in loops (Critical)
    if (analysis.loops > 0 && analysis.dmls > 0) {
        // More precise check - look for DML elements inside loop elements
        const loopPattern = /<loops>[\s\S]*?<\/loops>/g;
        const loops = content.match(loopPattern) || [];
        let dmlInLoop = false;
        loops.forEach(loop => {
            if (loop.includes('recordCreate') || loop.includes('recordUpdate') || loop.includes('recordDelete')) {
                dmlInLoop = true;
            }
        });
        if (dmlInLoop || (analysis.loops > 0 && analysis.dmls > analysis.loops)) {
            analysis.issues.push('DML operations inside loop');
            flowAnalysis.issuesSummary.dmlInLoops++;
        }
    }

    // 2. No fault path (High) - for flows with DML or callouts
    if (analysis.dmls > 0 && !analysis.hasFaultConnector) {
        analysis.issues.push('No fault handling path');
        flowAnalysis.issuesSummary.noFaultPath++;
    }

    // 3. Hardcoded IDs (High)
    if (analysis.hardcodedIds > 0) {
        analysis.issues.push(`${analysis.hardcodedIds} hardcoded IDs`);
        flowAnalysis.issuesSummary.hardcodedIds++;
    }

    // 4. No description (Medium)
    if (!analysis.hasDescription && analysis.status === 'Active') {
        analysis.issues.push('Missing description');
        flowAnalysis.issuesSummary.noDescription++;
    }

    // 5. Unused variables (Medium)
    if (analysis.unusedVariables > 0) {
        analysis.issues.push(`${analysis.unusedVariables} unused variables`);
        flowAnalysis.issuesSummary.unusedVariables++;
    }

    // 6. High complexity (Medium)
    if (analysis.elements > 20) {
        analysis.issues.push(`High complexity (${analysis.elements} elements)`);
        flowAnalysis.complexFlows.push({
            name: fileName,
            elements: analysis.elements,
            type: analysis.type
        });
    }

    // 7. Too many decisions (Medium) - complex branching
    if (analysis.decisions > 5) {
        analysis.issues.push(`Complex branching (${analysis.decisions} decisions)`);
        flowAnalysis.issuesSummary.tooManyDecisions++;
    }

    // 8. Auto-launched flow with screens (Error)
    if (analysis.type === 'AutoLaunchedFlow' && analysis.screens > 0) {
        analysis.issues.push('AutoLaunchedFlow with screen elements');
        flowAnalysis.issuesSummary.autoLaunchedWithScreens++;
    }

    // 9. Missing null checks in record lookups
    if (analysis.recordLookups > 0) {
        // Check if there are decisions right after lookups (proper null handling)
        const hasNullCheck = content.includes('wasSet') || content.includes('isNull');
        if (!hasNullCheck && analysis.recordLookups > analysis.decisions) {
            analysis.issues.push('Potential missing null checks after record lookup');
            flowAnalysis.issuesSummary.missingNullChecks++;
        }
    }

    // 10. Duplicate DML operations
    if (analysis.dmls > 3) {
        analysis.issues.push('Multiple DML operations - consider consolidation');
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

        // NEW: Store ALL flows with full details for drill-down
        flowAnalysis.allFlows.push({
            name: analysis.name,
            type: analysis.type,
            status: analysis.status,
            description: analysis.description,
            elements: analysis.elements,
            decisions: analysis.decisions,
            loops: analysis.loops,
            dmls: analysis.dmls,
            screens: analysis.screens,
            recordLookups: analysis.recordLookups,
            subflows: analysis.subflows,
            variables: analysis.variables,
            hasDescription: analysis.hasDescription,
            hasFaultConnector: analysis.hasFaultConnector,
            issues: analysis.issues,
            hardcodedIds: analysis.hardcodedIds,
            hardcodedIdsList: analysis.hardcodedIdsList,
            unusedVariables: analysis.unusedVariables,
            unusedVariablesList: analysis.unusedVariablesList,
            dmlElements: analysis.dmlElements,
            loopElements: analysis.loopElements
        });

        // NEW: Populate issue details by type for drill-down
        if (analysis.issues.some(i => i.includes('DML operations inside loop'))) {
            flowAnalysis.issueDetails.dmlInLoops.push({
                name: analysis.name,
                type: analysis.type,
                loops: analysis.loopElements,
                dmlElements: analysis.dmlElements
            });
        }
        if (analysis.issues.some(i => i.includes('No fault handling'))) {
            flowAnalysis.issueDetails.noFaultPath.push({
                name: analysis.name,
                type: analysis.type,
                dmlElements: analysis.dmlElements
            });
        }
        if (analysis.hardcodedIds > 0) {
            flowAnalysis.issueDetails.hardcodedIds.push({
                name: analysis.name,
                type: analysis.type,
                count: analysis.hardcodedIds,
                ids: analysis.hardcodedIdsList
            });
        }
        if (!analysis.hasDescription && analysis.status === 'Active') {
            flowAnalysis.issueDetails.noDescription.push({
                name: analysis.name,
                type: analysis.type,
                status: analysis.status
            });
        }
        if (analysis.unusedVariables > 0) {
            flowAnalysis.issueDetails.unusedVariables.push({
                name: analysis.name,
                type: analysis.type,
                count: analysis.unusedVariables,
                variables: analysis.unusedVariablesList
            });
        }
        if (analysis.issues.some(i => i.includes('missing null checks'))) {
            flowAnalysis.issueDetails.missingNullChecks.push({
                name: analysis.name,
                type: analysis.type,
                recordLookups: analysis.recordLookups
            });
        }
        if (analysis.decisions > 5) {
            flowAnalysis.issueDetails.complexBranching.push({
                name: analysis.name,
                type: analysis.type,
                decisions: analysis.decisions
            });
        }
        if (analysis.status !== 'Active') {
            flowAnalysis.issueDetails.inactive.push({
                name: analysis.name,
                type: analysis.type,
                status: analysis.status
            });
        }

        // Keep original issues array for backward compatibility
        if (analysis.issues.length > 0) {
            flowAnalysis.issues.push({
                name: analysis.name,
                type: analysis.type,
                status: analysis.status,
                issues: analysis.issues,
                elements: analysis.elements,
                // NEW: Add detailed info
                hardcodedIdsList: analysis.hardcodedIdsList,
                unusedVariablesList: analysis.unusedVariablesList,
                dmlElements: analysis.dmlElements,
                loopElements: analysis.loopElements
            });
        }
    });
}

// Generate findings for critical issues
// DML in loops - Critical
flowAnalysis.issues.filter(f => f.issues.some(i => i.includes('DML operations inside loop'))).forEach(flow => {
    findings.push({
        id: `FLOW-${String(findingId++).padStart(3, '0')}`,
        category: 'Flow',
        severity: 'Critical',
        title: `DML in loop: ${flow.name}`,
        description: 'Flow has DML operations inside a loop which will hit governor limits',
        location: `Flow: ${flow.name}`,
        impact: 'Governor limit exceptions in production, failed transactions',
        recommendation: 'Use collection variables and perform DML outside the loop',
        effort: 'Medium',
        tool: 'Flow Analysis'
    });
});

// No fault path - High
flowAnalysis.issues.filter(f => f.issues.some(i => i.includes('No fault handling'))).forEach(flow => {
    findings.push({
        id: `FLOW-${String(findingId++).padStart(3, '0')}`,
        category: 'Flow',
        severity: 'High',
        title: `No fault handling: ${flow.name}`,
        description: 'Flow with DML operations has no fault connector for error handling',
        location: `Flow: ${flow.name}`,
        impact: 'Silent failures, users not informed of errors, data inconsistency',
        recommendation: 'Add fault connectors to handle DML failures gracefully',
        effort: 'Quick Win',
        tool: 'Flow Analysis'
    });
});

// Hardcoded IDs - High
flowAnalysis.issues.filter(f => f.issues.some(i => i.includes('hardcoded IDs'))).forEach(flow => {
    findings.push({
        id: `FLOW-${String(findingId++).padStart(3, '0')}`,
        category: 'Flow',
        severity: 'High',
        title: `Hardcoded IDs in: ${flow.name}`,
        description: 'Flow contains hardcoded Salesforce record IDs',
        location: `Flow: ${flow.name}`,
        impact: 'Deployment failures between environments, broken functionality',
        recommendation: 'Replace hardcoded IDs with Custom Metadata, Custom Labels, or Get Records',
        effort: 'Medium',
        tool: 'Flow Analysis'
    });
});

// Complex flows - Medium
flowAnalysis.complexFlows.forEach(flow => {
    findings.push({
        id: `FLOW-${String(findingId++).padStart(3, '0')}`,
        category: 'Flow',
        severity: flow.elements > 40 ? 'High' : 'Medium',
        title: `High complexity Flow: ${flow.name}`,
        description: `Flow has ${flow.elements} elements which increases maintenance difficulty`,
        location: `Flow: ${flow.name}`,
        impact: 'Difficult to maintain, test, and debug; increased error risk',
        recommendation: 'Break into smaller subflows or consider Apex for complex logic',
        effort: 'High',
        tool: 'Flow Analysis'
    });
});

// Missing null checks - Medium
flowAnalysis.issues.filter(f => f.issues.some(i => i.includes('missing null checks'))).forEach(flow => {
    findings.push({
        id: `FLOW-${String(findingId++).padStart(3, '0')}`,
        category: 'Flow',
        severity: 'Medium',
        title: `Missing null checks: ${flow.name}`,
        description: 'Flow performs record lookups without apparent null checking',
        location: `Flow: ${flow.name}`,
        impact: 'Potential null pointer errors at runtime',
        recommendation: 'Add Decision elements to check if records were found before use',
        effort: 'Quick Win',
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

console.log('\nIssues Summary:');
console.log(`  DML in Loops: ${flowAnalysis.issuesSummary.dmlInLoops}`);
console.log(`  No Fault Path: ${flowAnalysis.issuesSummary.noFaultPath}`);
console.log(`  Hardcoded IDs: ${flowAnalysis.issuesSummary.hardcodedIds}`);
console.log(`  No Description: ${flowAnalysis.issuesSummary.noDescription}`);
console.log(`  Unused Variables: ${flowAnalysis.issuesSummary.unusedVariables}`);
console.log(`  Missing Null Checks: ${flowAnalysis.issuesSummary.missingNullChecks}`);
console.log(`  Complex Branching: ${flowAnalysis.issuesSummary.tooManyDecisions}`);
console.log(`  Inactive Flows: ${flowAnalysis.issuesSummary.inactive}`);

console.log(`\nComplex Flows (>20 elements): ${flowAnalysis.complexFlows.length}`);
flowAnalysis.complexFlows.slice(0, 5).forEach(f => {
    console.log(`  ${f.name}: ${f.elements} elements`);
});

console.log(`\nFlows with Issues: ${flowAnalysis.issues.length}`);
flowAnalysis.issues.slice(0, 10).forEach(f => {
    console.log(`  ${f.name}: ${f.issues.join(', ')}`);
});

// Save results
fs.writeFileSync('docs/data/flow-findings.json', JSON.stringify(findings, null, 2));
fs.writeFileSync('docs/data/flow-analysis.json', JSON.stringify(flowAnalysis, null, 2));

console.log(`\nGenerated ${findings.length} Flow findings`);
