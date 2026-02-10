const fs = require('fs');

// Load PMD report
let pmdReport;
try {
    pmdReport = JSON.parse(fs.readFileSync('reports/pmd/pmd-report.json', 'utf8'));
} catch(e) {
    console.error('Error reading PMD report:', e.message);
    process.exit(1);
}

// Analyze violations
const analysis = {
    totalViolations: 0,
    bySeverity: {},
    byRule: {},
    byCategory: {},
    byFile: {},
    findings: []
};

// Map PMD priorities to severity
const priorityToSeverity = {
    1: 'Critical',
    2: 'High',
    3: 'Medium',
    4: 'Low',
    5: 'Info'
};

// Rule to category mapping
const ruleCategories = {
    'ApexCRUDViolation': 'Security',
    'ApexSOQLInjection': 'Security',
    'ApexBadCrypto': 'Security',
    'ApexInsecureEndpoint': 'Security',
    'ApexSharingViolations': 'Security',
    'ApexOpenRedirect': 'Security',
    'ApexXSSFromEscapeFalse': 'Security',
    'ApexXSSFromURLParam': 'Security',
    'ApexSuggestUsingNamedCred': 'Security',
    'ApexDangerousMethods': 'Security',
    'OperationWithLimitsInLoop': 'Performance',
    'OperationWithHighCostInLoop': 'Performance',
    'AvoidDebugStatements': 'Performance',
    'EagerlyLoadedDescribeSObjectResult': 'Performance',
    'CyclomaticComplexity': 'Design',
    'CognitiveComplexity': 'Design',
    'ExcessiveClassLength': 'Design',
    'ExcessiveParameterList': 'Design',
    'TooManyFields': 'Design',
    'AvoidDeeplyNestedIfStmts': 'Design',
    'ApexDoc': 'Documentation',
    'ApexUnitTestClassShouldHaveAsserts': 'Testing',
    'ApexUnitTestShouldNotUseSeeAllDataTrue': 'Testing',
    'ApexUnitTestMethodShouldHaveIsTestAnnotation': 'Testing',
    'AvoidLogicInTrigger': 'Best Practices',
    'AvoidGlobalModifier': 'Best Practices',
    'AvoidHardcodingId': 'Error Prone',
    'EmptyCatchBlock': 'Error Prone',
    'EmptyIfStmt': 'Error Prone'
};

let findingId = 1;

// Process all files and violations
pmdReport.files.forEach(file => {
    const fileName = file.filename.split('/').pop();

    file.violations.forEach(violation => {
        analysis.totalViolations++;

        const severity = priorityToSeverity[violation.priority] || 'Medium';
        const rule = violation.rule;
        const category = ruleCategories[rule] || 'Code Quality';

        // Count by severity
        analysis.bySeverity[severity] = (analysis.bySeverity[severity] || 0) + 1;

        // Count by rule
        if (!analysis.byRule[rule]) {
            analysis.byRule[rule] = { count: 0, severity: severity, category: category };
        }
        analysis.byRule[rule].count++;

        // Count by category
        analysis.byCategory[category] = (analysis.byCategory[category] || 0) + 1;

        // Count by file
        if (!analysis.byFile[fileName]) {
            analysis.byFile[fileName] = { count: 0, violations: [] };
        }
        analysis.byFile[fileName].count++;
    });
});

// Generate consolidated findings for top issues
Object.entries(analysis.byRule)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20) // Top 20 rules with most violations
    .forEach(([rule, data]) => {
        analysis.findings.push({
            id: `PMD-${String(findingId++).padStart(3, '0')}`,
            category: data.category,
            severity: data.severity,
            title: `${rule} violations found (${data.count} occurrences)`,
            description: `PMD rule ${rule} was triggered ${data.count} times across the codebase`,
            location: 'Multiple Apex classes',
            impact: getImpactDescription(rule),
            recommendation: getRecommendation(rule),
            effort: data.count > 50 ? 'High' : data.count > 10 ? 'Medium' : 'Quick Win',
            tool: 'PMD Apex Analysis',
            occurrences: data.count
        });
    });

function getImpactDescription(rule) {
    const impacts = {
        'ApexCRUDViolation': 'Users may access or modify records they should not have access to',
        'ApexSOQLInjection': 'Potential SQL injection vulnerability exposing data',
        'OperationWithLimitsInLoop': 'Governor limit exceptions in production',
        'CyclomaticComplexity': 'Code is difficult to understand, test, and maintain',
        'ApexDoc': 'Reduced code maintainability and knowledge transfer',
        'AvoidDebugStatements': 'Performance degradation and log pollution',
        'AvoidLogicInTrigger': 'Hard to test and maintain code',
        'EmptyCatchBlock': 'Errors silently ignored, debugging difficulties'
    };
    return impacts[rule] || 'Code quality and maintainability impact';
}

function getRecommendation(rule) {
    const recommendations = {
        'ApexCRUDViolation': 'Add CRUD/FLS checks before DML operations using Security.stripInaccessible or WITH SECURITY_ENFORCED',
        'ApexSOQLInjection': 'Use bind variables instead of string concatenation in SOQL queries',
        'OperationWithLimitsInLoop': 'Move SOQL/DML operations outside loops, use collections and bulk operations',
        'CyclomaticComplexity': 'Refactor complex methods into smaller, single-responsibility methods',
        'ApexDoc': 'Add ApexDoc comments to public classes and methods',
        'AvoidDebugStatements': 'Remove System.debug statements or use a logging framework with appropriate log levels',
        'AvoidLogicInTrigger': 'Move trigger logic to handler classes following trigger framework pattern',
        'EmptyCatchBlock': 'Add appropriate error handling or logging in catch blocks'
    };
    return recommendations[rule] || 'Review and fix according to PMD rule guidelines';
}

// Output summary
console.log('=== PMD Analysis Summary ===\n');
console.log(`Total Violations: ${analysis.totalViolations}\n`);

console.log('By Severity:');
Object.entries(analysis.bySeverity)
    .sort((a, b) => {
        const order = ['Critical', 'High', 'Medium', 'Low', 'Info'];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
    })
    .forEach(([severity, count]) => {
        console.log(`  ${severity}: ${count}`);
    });

console.log('\nBy Category:');
Object.entries(analysis.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
    });

console.log('\nTop 10 Rules Violated:');
Object.entries(analysis.byRule)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .forEach(([rule, data]) => {
        console.log(`  ${rule}: ${data.count} (${data.severity})`);
    });

console.log('\nTop 10 Files with Most Violations:');
Object.entries(analysis.byFile)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .forEach(([file, data]) => {
        console.log(`  ${file}: ${data.count} violations`);
    });

// Save results
fs.writeFileSync('docs/data/apex-findings.json', JSON.stringify(analysis.findings, null, 2));
fs.writeFileSync('docs/data/pmd-analysis.json', JSON.stringify(analysis, null, 2));

console.log(`\nGenerated ${analysis.findings.length} Apex findings`);
console.log('Results saved to docs/data/apex-findings.json and docs/data/pmd-analysis.json');
