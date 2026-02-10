const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Apex Classes & Coverage Analysis ===\n');

// Get org info for REST API calls
let accessToken, instanceUrl;
try {
    const orgInfo = JSON.parse(execSync('sf org display --json', { encoding: 'utf8' }));
    accessToken = orgInfo.result.accessToken;
    instanceUrl = orgInfo.result.instanceUrl;
} catch (e) {
    console.error('Could not get org info. Make sure you are authenticated.');
    process.exit(1);
}

function toolingQuery(query) {
    const encodedQuery = encodeURIComponent(query);
    const cmd = `curl -s -H "Authorization: Bearer ${accessToken}" "${instanceUrl}/services/data/v59.0/tooling/query/?q=${encodedQuery}"`;
    try {
        const result = JSON.parse(execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }));
        return result.records || [];
    } catch (e) {
        console.warn('Tooling API query failed:', e.message);
        return [];
    }
}

// 1. Get all Apex Classes
console.log('Fetching Apex Classes...');
const apexClasses = toolingQuery(`
    SELECT Id, Name, NamespacePrefix, ApiVersion, Status, IsValid, LengthWithoutComments,
           CreatedDate, LastModifiedDate, CreatedBy.Name, LastModifiedBy.Name
    FROM ApexClass
    WHERE NamespacePrefix = null
    ORDER BY Name
`);

console.log(`Found ${apexClasses.length} custom Apex classes`);

// 2. Get Apex Code Coverage
console.log('Fetching Code Coverage...');
const coverageRecords = toolingQuery(`
    SELECT ApexClassOrTriggerId, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered
    FROM ApexCodeCoverageAggregate
    ORDER BY ApexClassOrTrigger.Name
`);

// Build coverage map
const coverageMap = {};
coverageRecords.forEach(cov => {
    if (cov.ApexClassOrTrigger?.Name) {
        const total = (cov.NumLinesCovered || 0) + (cov.NumLinesUncovered || 0);
        coverageMap[cov.ApexClassOrTrigger.Name] = {
            covered: cov.NumLinesCovered || 0,
            uncovered: cov.NumLinesUncovered || 0,
            total: total,
            percentage: total > 0 ? ((cov.NumLinesCovered / total) * 100).toFixed(1) : 0
        };
    }
});

// 3. Get Apex Triggers
console.log('Fetching Apex Triggers...');
const apexTriggers = toolingQuery(`
    SELECT Id, Name, TableEnumOrId, ApiVersion, Status, IsValid, LengthWithoutComments,
           CreatedDate, LastModifiedDate
    FROM ApexTrigger
    WHERE NamespacePrefix = null
    ORDER BY Name
`);

// 4. Analyze classes from local files
const classesDir = 'force-app/main/default/classes';
const localClasses = [];

if (fs.existsSync(classesDir)) {
    const classFiles = fs.readdirSync(classesDir).filter(f => f.endsWith('.cls'));

    classFiles.forEach(file => {
        const content = fs.readFileSync(path.join(classesDir, file), 'utf8');
        const className = file.replace('.cls', '');
        const lines = content.split('\n').length;

        // Detect class type
        let classType = 'Standard';
        const isTestClass = content.includes('@isTest') || content.includes('@IsTest');

        if (isTestClass) {
            classType = 'Test';
        } else if (content.includes('implements Schedulable')) {
            classType = 'Schedulable';
        } else if (content.includes('implements Batchable') || content.includes('implements Database.Batchable')) {
            classType = 'Batch';
        } else if (content.includes('implements Queueable')) {
            classType = 'Queueable';
        } else if (content.includes('extends TriggerHandler') || content.includes('TriggerHandler')) {
            classType = 'Trigger Handler';
        } else if (className.endsWith('Controller') || className.endsWith('Ctrl')) {
            classType = 'Controller';
        } else if (className.endsWith('Service') || className.endsWith('Svc')) {
            classType = 'Service';
        } else if (className.endsWith('Selector') || className.endsWith('Sel')) {
            classType = 'Selector';
        } else if (className.endsWith('Helper') || className.endsWith('Util') || className.endsWith('Utils')) {
            classType = 'Utility';
        }

        // Test class bad practices analysis
        let testIssues = [];
        if (isTestClass) {
            // Check for SeeAllData=true (bad practice)
            if (content.match(/SeeAllData\s*=\s*true/i)) {
                testIssues.push('SeeAllData=true');
            }

            // Check for missing asserts
            const hasAssert = content.match(/System\.assert/i) ||
                             content.match(/Assert\./i) ||
                             content.match(/System\.assertEquals/i) ||
                             content.match(/System\.assertNotEquals/i);
            if (!hasAssert) {
                testIssues.push('No assertions');
            }

            // Check for hardcoded IDs
            if (content.match(/['"][a-zA-Z0-9]{15,18}['"]/)) {
                testIssues.push('Hardcoded IDs');
            }

            // Check for @testSetup usage (good practice if missing)
            const hasTestSetup = content.match(/@testSetup/i) || content.match(/@TestSetup/i);

            // Check for Test.startTest/stopTest
            const hasStartStop = content.includes('Test.startTest') && content.includes('Test.stopTest');
            if (!hasStartStop) {
                testIssues.push('Missing Test.startTest/stopTest');
            }

            // Check for SOQL in test methods (should use test data factory)
            const soqlInTest = (content.match(/\[SELECT/gi) || []).length;
            if (soqlInTest > 5) {
                testIssues.push(`Excessive SOQL (${soqlInTest} queries)`);
            }

            // Check for DML in loops
            if (content.match(/for\s*\([^)]*\)\s*\{[^}]*\b(insert|update|delete|upsert)\b/i)) {
                testIssues.push('DML in loop');
            }

            // Check for future methods being tested
            const testsFuture = content.includes('Test.startTest') &&
                               content.includes('@future') === false &&
                               content.includes('Test.stopTest');
        }

        // Check sharing model
        let sharingModel = 'Not Specified';
        if (content.includes('with sharing')) {
            sharingModel = 'with sharing';
        } else if (content.includes('without sharing')) {
            sharingModel = 'without sharing';
        } else if (content.includes('inherited sharing')) {
            sharingModel = 'inherited sharing';
        }

        // Get API version from meta file
        let apiVersion = null;
        const metaFile = path.join(classesDir, file + '-meta.xml');
        if (fs.existsSync(metaFile)) {
            const metaContent = fs.readFileSync(metaFile, 'utf8');
            const versionMatch = metaContent.match(/<apiVersion>([^<]+)<\/apiVersion>/);
            if (versionMatch) {
                apiVersion = parseFloat(versionMatch[1]);
            }
        }

        localClasses.push({
            name: className,
            lines,
            type: classType,
            sharingModel,
            apiVersion,
            testIssues: testIssues
        });
    });
}

// 5. Merge data and build analysis
const classesAnalysis = localClasses.map(local => {
    const coverage = coverageMap[local.name];
    const orgClass = apexClasses.find(c => c.Name === local.name);

    return {
        name: local.name,
        type: local.type,
        lines: local.lines,
        linesWithoutComments: orgClass?.LengthWithoutComments || local.lines,
        apiVersion: local.apiVersion || orgClass?.ApiVersion,
        sharingModel: local.sharingModel,
        isValid: orgClass?.IsValid ?? true,
        coverage: coverage ? parseFloat(coverage.percentage) : null,
        coveredLines: coverage?.covered || 0,
        uncoveredLines: coverage?.uncovered || 0,
        lastModified: orgClass?.LastModifiedDate,
        lastModifiedBy: orgClass?.LastModifiedBy?.Name,
        testIssues: local.testIssues || []
    };
});

// 6. Calculate statistics
const testClasses = classesAnalysis.filter(c => c.type === 'Test');
const nonTestClasses = classesAnalysis.filter(c => c.type !== 'Test');
const classesWithCoverage = nonTestClasses.filter(c => c.coverage !== null);

const totalCoveredLines = classesWithCoverage.reduce((sum, c) => sum + c.coveredLines, 0);
const totalUncoveredLines = classesWithCoverage.reduce((sum, c) => sum + c.uncoveredLines, 0);
const totalLines = totalCoveredLines + totalUncoveredLines;
const orgCoverage = totalLines > 0 ? ((totalCoveredLines / totalLines) * 100).toFixed(1) : 0;

const lowCoverageClasses = classesWithCoverage.filter(c => c.coverage < 75);
const zeroCoverageClasses = classesWithCoverage.filter(c => c.coverage === 0);
const oldApiClasses = classesAnalysis.filter(c => c.apiVersion && c.apiVersion < 50);
const withoutSharingClasses = nonTestClasses.filter(c => c.sharingModel === 'without sharing');

// Test class issues analysis
const testClassesWithIssues = testClasses.filter(c => c.testIssues && c.testIssues.length > 0);
const testIssuesSummary = {
    seeAllData: testClasses.filter(c => c.testIssues?.includes('SeeAllData=true')).length,
    noAssertions: testClasses.filter(c => c.testIssues?.includes('No assertions')).length,
    hardcodedIds: testClasses.filter(c => c.testIssues?.includes('Hardcoded IDs')).length,
    missingStartStop: testClasses.filter(c => c.testIssues?.includes('Missing Test.startTest/stopTest')).length,
    excessiveSoql: testClasses.filter(c => c.testIssues?.some(i => i.startsWith('Excessive SOQL'))).length,
    dmlInLoop: testClasses.filter(c => c.testIssues?.includes('DML in loop')).length
};

// Build analysis object
const analysis = {
    summary: {
        totalClasses: classesAnalysis.length,
        testClasses: testClasses.length,
        nonTestClasses: nonTestClasses.length,
        triggers: apexTriggers.length,
        orgCoverage: parseFloat(orgCoverage),
        classesWithCoverage: classesWithCoverage.length,
        lowCoverageCount: lowCoverageClasses.length,
        zeroCoverageCount: zeroCoverageClasses.length,
        oldApiVersionCount: oldApiClasses.length,
        withoutSharingCount: withoutSharingClasses.length,
        testClassesWithIssues: testClassesWithIssues.length,
        testIssuesSummary: testIssuesSummary
    },
    byType: classesAnalysis.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
    }, {}),
    bySharingModel: nonTestClasses.reduce((acc, c) => {
        acc[c.sharingModel] = (acc[c.sharingModel] || 0) + 1;
        return acc;
    }, {}),
    byApiVersion: classesAnalysis.reduce((acc, c) => {
        if (c.apiVersion) {
            const version = `v${Math.floor(c.apiVersion)}`;
            acc[version] = (acc[version] || 0) + 1;
        }
        return acc;
    }, {}),
    coverageDistribution: {
        '0%': zeroCoverageClasses.length,
        '1-49%': classesWithCoverage.filter(c => c.coverage > 0 && c.coverage < 50).length,
        '50-74%': classesWithCoverage.filter(c => c.coverage >= 50 && c.coverage < 75).length,
        '75-89%': classesWithCoverage.filter(c => c.coverage >= 75 && c.coverage < 90).length,
        '90-100%': classesWithCoverage.filter(c => c.coverage >= 90).length
    },
    classes: classesAnalysis.sort((a, b) => (a.coverage ?? 999) - (b.coverage ?? 999)),
    lowCoverageClasses: lowCoverageClasses.sort((a, b) => a.coverage - b.coverage).slice(0, 20),
    oldApiClasses: oldApiClasses.sort((a, b) => a.apiVersion - b.apiVersion),
    withoutSharingClasses: withoutSharingClasses.map(c => c.name),
    triggers: apexTriggers.map(t => ({
        name: t.Name,
        object: t.TableEnumOrId,
        apiVersion: t.ApiVersion,
        isValid: t.IsValid,
        lines: t.LengthWithoutComments
    })),
    testClassIssues: testClassesWithIssues.map(c => ({
        name: c.name,
        lines: c.lines,
        issues: c.testIssues
    })).sort((a, b) => b.issues.length - a.issues.length)
};

// Generate findings
const findings = [];

// Low org coverage
if (parseFloat(orgCoverage) < 75) {
    findings.push({
        id: 'APEX-COV-001',
        title: `Org code coverage at ${orgCoverage}% (below 75% threshold)`,
        severity: parseFloat(orgCoverage) < 50 ? 'Critical' : 'High',
        category: 'Testing',
        description: `${lowCoverageClasses.length} classes have less than 75% coverage`,
        impact: 'Cannot deploy to production, potential bugs in untested code',
        recommendation: 'Increase test coverage for critical business logic',
        effort: 'High',
        tool: 'Apex Analysis'
    });
}

// Zero coverage classes
if (zeroCoverageClasses.length > 5) {
    findings.push({
        id: 'APEX-COV-002',
        title: `${zeroCoverageClasses.length} classes have 0% code coverage`,
        severity: 'High',
        category: 'Testing',
        description: 'These classes have no test coverage at all',
        impact: 'Untested code is prone to bugs and blocks deployment',
        recommendation: 'Create unit tests for uncovered classes',
        effort: 'High',
        tool: 'Apex Analysis'
    });
}

// Old API versions
if (oldApiClasses.length > 10) {
    findings.push({
        id: 'APEX-API-001',
        title: `${oldApiClasses.length} classes on API version below v50`,
        severity: 'Medium',
        category: 'Technical Debt',
        description: 'Old API versions may miss security patches and features',
        impact: 'Potential security vulnerabilities, deprecated features',
        recommendation: 'Update classes to API version 58+',
        effort: 'Medium',
        tool: 'Apex Analysis'
    });
}

// Without sharing classes
if (withoutSharingClasses.length > 5) {
    findings.push({
        id: 'APEX-SEC-001',
        title: `${withoutSharingClasses.length} classes use 'without sharing'`,
        severity: 'Medium',
        category: 'Security',
        description: 'Classes running without sharing bypass record-level security',
        impact: 'Potential data exposure to unauthorized users',
        recommendation: 'Review and justify each without sharing usage',
        effort: 'Medium',
        tool: 'Apex Analysis'
    });
}

// Test class issues - SeeAllData
if (testIssuesSummary.seeAllData > 0) {
    findings.push({
        id: 'APEX-TEST-001',
        title: `${testIssuesSummary.seeAllData} test classes use SeeAllData=true`,
        severity: 'High',
        category: 'Testing',
        description: 'Test classes using SeeAllData=true depend on org data and are non-portable',
        impact: 'Tests may fail in different orgs, deployment issues, data dependency',
        recommendation: 'Create test data in @TestSetup methods or use Test Data Factory',
        effort: 'Medium',
        tool: 'Apex Analysis'
    });
}

// Test class issues - No assertions
if (testIssuesSummary.noAssertions > 0) {
    findings.push({
        id: 'APEX-TEST-002',
        title: `${testIssuesSummary.noAssertions} test classes have no assertions`,
        severity: 'High',
        category: 'Testing',
        description: 'Test classes without assertions only verify that code runs without errors',
        impact: 'Tests provide false confidence, bugs may go undetected',
        recommendation: 'Add System.assert, System.assertEquals, or Assert.* statements',
        effort: 'Medium',
        tool: 'Apex Analysis'
    });
}

// Test class issues - Hardcoded IDs
if (testIssuesSummary.hardcodedIds > 0) {
    findings.push({
        id: 'APEX-TEST-003',
        title: `${testIssuesSummary.hardcodedIds} test classes have hardcoded IDs`,
        severity: 'Medium',
        category: 'Testing',
        description: 'Hardcoded record IDs in tests are non-portable across orgs',
        impact: 'Tests fail when deployed to different org, maintenance burden',
        recommendation: 'Use dynamic queries or Test Data Factory to create records',
        effort: 'Medium',
        tool: 'Apex Analysis'
    });
}

// Test class issues - Missing Test.startTest/stopTest
if (testIssuesSummary.missingStartStop > 3) {
    findings.push({
        id: 'APEX-TEST-004',
        title: `${testIssuesSummary.missingStartStop} test classes missing Test.startTest/stopTest`,
        severity: 'Low',
        category: 'Testing',
        description: 'Test.startTest/stopTest resets governor limits for accurate testing',
        impact: 'May miss governor limit issues in production',
        recommendation: 'Wrap test execution with Test.startTest() and Test.stopTest()',
        effort: 'Quick Win',
        tool: 'Apex Analysis'
    });
}

// Test class issues - DML in loops
if (testIssuesSummary.dmlInLoop > 0) {
    findings.push({
        id: 'APEX-TEST-005',
        title: `${testIssuesSummary.dmlInLoop} test classes have DML operations in loops`,
        severity: 'Medium',
        category: 'Testing',
        description: 'DML in loops is a bad practice even in test classes',
        impact: 'Tests may hit governor limits, demonstrates poor coding patterns',
        recommendation: 'Bulkify DML operations using collections',
        effort: 'Medium',
        tool: 'Apex Analysis'
    });
}

// Save results
fs.writeFileSync('docs/data/apex-classes-analysis.json', JSON.stringify(analysis, null, 2));
fs.writeFileSync('docs/data/apex-coverage-findings.json', JSON.stringify(findings, null, 2));

console.log(`\nAnalysis complete:`);
console.log(`  Total Classes: ${analysis.summary.totalClasses}`);
console.log(`    - Test Classes: ${analysis.summary.testClasses}`);
console.log(`    - Non-Test Classes: ${analysis.summary.nonTestClasses}`);
console.log(`  Triggers: ${analysis.summary.triggers}`);
console.log(`  Org Coverage: ${analysis.summary.orgCoverage}%`);
console.log(`  Classes < 75% coverage: ${analysis.summary.lowCoverageCount}`);
console.log(`  Classes at 0% coverage: ${analysis.summary.zeroCoverageCount}`);
console.log(`  Old API versions (<50): ${analysis.summary.oldApiVersionCount}`);
console.log(`  'without sharing' classes: ${analysis.summary.withoutSharingCount}`);
console.log(`\n  Test Class Issues:`);
console.log(`    - Test classes with issues: ${testClassesWithIssues.length}`);
console.log(`    - SeeAllData=true: ${testIssuesSummary.seeAllData}`);
console.log(`    - No assertions: ${testIssuesSummary.noAssertions}`);
console.log(`    - Hardcoded IDs: ${testIssuesSummary.hardcodedIds}`);
console.log(`    - Missing Test.startTest/stopTest: ${testIssuesSummary.missingStartStop}`);
console.log(`    - DML in loops: ${testIssuesSummary.dmlInLoop}`);
console.log(`  Findings: ${findings.length}`);
console.log(`\nSaved to docs/data/apex-classes-analysis.json`);
