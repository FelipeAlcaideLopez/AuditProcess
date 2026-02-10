const fs = require('fs');
const path = require('path');

const classesDir = 'force-app/main/default/classes';
const triggersDir = 'force-app/main/default/triggers';

const frameworkAnalysis = {
    triggerFramework: {
        detected: false,
        type: 'None',
        patterns: [],
        files: []
    },
    integrationPatterns: {
        hasNamedCredentials: false,
        hasCallouts: false,
        hasQueueable: false,
        hasBatch: false,
        hasSchedulable: false,
        hasHttpClient: false,
        patterns: [],
        files: []
    },
    designPatterns: {
        hasSelector: false,
        hasService: false,
        hasDomain: false,
        hasFactory: false,
        hasSingleton: false,
        hasBuilder: false,
        patterns: [],
        files: []
    },
    testPatterns: {
        hasTestDataFactory: false,
        hasMocking: false,
        hasTestSetup: false,
        patterns: [],
        files: []
    },
    findings: [],
    recommendations: []
};

// Known trigger framework patterns
const triggerFrameworks = {
    'fflib': {
        indicators: ['fflib_SObjectDomain', 'fflib_SObjectSelector', 'fflib_Application', 'fflib_SObjectUnitOfWork'],
        name: 'FFLib (Apex Enterprise Patterns)'
    },
    'nebula': {
        indicators: ['NebulaLogger', 'Logger.', 'LogEntryEventBuilder'],
        name: 'Nebula Logger'
    },
    'triggerHandler': {
        indicators: ['TriggerHandler', 'extends TriggerHandler', 'TriggerDispatcher'],
        name: 'Trigger Handler Pattern'
    },
    'kevinOHara': {
        indicators: ['TriggerHandler', 'run()', 'beforeInsert()', 'afterInsert()'],
        name: 'Kevin O\'Hara Trigger Framework'
    },
    'apexCommons': {
        indicators: ['ApexCommons', 'SelectorFactory', 'DomainFactory'],
        name: 'Apex Commons'
    },
    'customTriggerFramework': {
        indicators: ['TriggerFactory', 'ITriggerHandler', 'TriggerContext'],
        name: 'Custom Trigger Framework'
    }
};

// Analyze a single Apex class file
function analyzeApexClass(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.cls');
    const analysis = { name: fileName, patterns: [] };

    // Check for trigger framework patterns
    for (const [key, framework] of Object.entries(triggerFrameworks)) {
        for (const indicator of framework.indicators) {
            if (content.includes(indicator)) {
                if (!frameworkAnalysis.triggerFramework.detected) {
                    frameworkAnalysis.triggerFramework.detected = true;
                    frameworkAnalysis.triggerFramework.type = framework.name;
                }
                frameworkAnalysis.triggerFramework.patterns.push({
                    pattern: indicator,
                    file: fileName,
                    framework: framework.name
                });
                frameworkAnalysis.triggerFramework.files.push(fileName);
                break;
            }
        }
    }

    // Check for integration patterns
    if (content.includes('HttpRequest') || content.includes('HttpResponse') || content.includes('Http h = new Http')) {
        frameworkAnalysis.integrationPatterns.hasCallouts = true;
        frameworkAnalysis.integrationPatterns.patterns.push({ pattern: 'HTTP Callouts', file: fileName });
        frameworkAnalysis.integrationPatterns.files.push(fileName);
    }

    if (content.includes('implements Queueable') || content.includes('Queueable')) {
        frameworkAnalysis.integrationPatterns.hasQueueable = true;
        frameworkAnalysis.integrationPatterns.patterns.push({ pattern: 'Queueable', file: fileName });
    }

    if (content.includes('implements Database.Batchable') || content.includes('Database.Batchable')) {
        frameworkAnalysis.integrationPatterns.hasBatch = true;
        frameworkAnalysis.integrationPatterns.patterns.push({ pattern: 'Batch Apex', file: fileName });
    }

    if (content.includes('implements Schedulable') || content.includes('Schedulable')) {
        frameworkAnalysis.integrationPatterns.hasSchedulable = true;
        frameworkAnalysis.integrationPatterns.patterns.push({ pattern: 'Schedulable', file: fileName });
    }

    if (content.includes('callout=true') || content.includes('@future')) {
        frameworkAnalysis.integrationPatterns.patterns.push({ pattern: 'Future/Async Callout', file: fileName });
    }

    // Check for design patterns - Selector
    if (fileName.toLowerCase().includes('selector') ||
        content.includes('extends fflib_SObjectSelector') ||
        /class\s+\w*Selector\s+/i.test(content)) {
        frameworkAnalysis.designPatterns.hasSelector = true;
        frameworkAnalysis.designPatterns.patterns.push({ pattern: 'Selector Pattern', file: fileName });
        frameworkAnalysis.designPatterns.files.push(fileName);
    }

    // Check for design patterns - Service
    if (fileName.toLowerCase().includes('service') ||
        /class\s+\w*Service\s+/i.test(content)) {
        frameworkAnalysis.designPatterns.hasService = true;
        frameworkAnalysis.designPatterns.patterns.push({ pattern: 'Service Pattern', file: fileName });
        frameworkAnalysis.designPatterns.files.push(fileName);
    }

    // Check for design patterns - Domain
    if (fileName.toLowerCase().includes('domain') ||
        content.includes('extends fflib_SObjectDomain') ||
        /class\s+\w*Domain\s+/i.test(content)) {
        frameworkAnalysis.designPatterns.hasDomain = true;
        frameworkAnalysis.designPatterns.patterns.push({ pattern: 'Domain Pattern', file: fileName });
        frameworkAnalysis.designPatterns.files.push(fileName);
    }

    // Check for design patterns - Factory
    if (fileName.toLowerCase().includes('factory') ||
        /class\s+\w*Factory\s+/i.test(content)) {
        frameworkAnalysis.designPatterns.hasFactory = true;
        frameworkAnalysis.designPatterns.patterns.push({ pattern: 'Factory Pattern', file: fileName });
        frameworkAnalysis.designPatterns.files.push(fileName);
    }

    // Check for design patterns - Singleton
    if (content.includes('private static') && content.includes('getInstance()')) {
        frameworkAnalysis.designPatterns.hasSingleton = true;
        frameworkAnalysis.designPatterns.patterns.push({ pattern: 'Singleton Pattern', file: fileName });
    }

    // Check for design patterns - Builder
    if (fileName.toLowerCase().includes('builder') ||
        /class\s+\w*Builder\s+/i.test(content) ||
        (content.includes('return this;') && content.match(/return this;/g)?.length > 2)) {
        frameworkAnalysis.designPatterns.hasBuilder = true;
        frameworkAnalysis.designPatterns.patterns.push({ pattern: 'Builder Pattern', file: fileName });
    }

    // Check for test patterns
    if (fileName.toLowerCase().includes('testdatafactory') ||
        fileName.toLowerCase().includes('testfactory') ||
        fileName.toLowerCase().includes('testutil')) {
        frameworkAnalysis.testPatterns.hasTestDataFactory = true;
        frameworkAnalysis.testPatterns.patterns.push({ pattern: 'Test Data Factory', file: fileName });
        frameworkAnalysis.testPatterns.files.push(fileName);
    }

    if (content.includes('@TestSetup') || content.includes('@testSetup')) {
        frameworkAnalysis.testPatterns.hasTestSetup = true;
        frameworkAnalysis.testPatterns.patterns.push({ pattern: 'TestSetup Method', file: fileName });
    }

    if (content.includes('Mock') || content.includes('Stub') || content.includes('HttpCalloutMock')) {
        frameworkAnalysis.testPatterns.hasMocking = true;
        frameworkAnalysis.testPatterns.patterns.push({ pattern: 'Mocking/Stubbing', file: fileName });
    }

    return analysis;
}

// Analyze triggers
function analyzeTriggers() {
    if (!fs.existsSync(triggersDir)) return;

    const files = fs.readdirSync(triggersDir).filter(f => f.endsWith('.trigger'));
    const triggerInfo = {
        total: files.length,
        withLogic: 0,
        delegating: 0,
        triggers: []
    };

    files.forEach(file => {
        const content = fs.readFileSync(path.join(triggersDir, file), 'utf8');
        const triggerName = path.basename(file, '.trigger');

        // Check if trigger has logic or delegates
        const lineCount = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length;
        const hasHandler = content.includes('Handler') || content.includes('TriggerHandler') || content.includes('Dispatcher');

        if (lineCount > 10 && !hasHandler) {
            triggerInfo.withLogic++;
            triggerInfo.triggers.push({ name: triggerName, type: 'Has Logic', lines: lineCount });
        } else if (hasHandler) {
            triggerInfo.delegating++;
            triggerInfo.triggers.push({ name: triggerName, type: 'Delegating', lines: lineCount });
        }
    });

    frameworkAnalysis.triggerAnalysis = triggerInfo;
}

// Generate findings and recommendations
function generateFindings() {
    let findingId = 1;

    // Trigger framework findings
    if (!frameworkAnalysis.triggerFramework.detected) {
        frameworkAnalysis.findings.push({
            id: `FWK-${String(findingId++).padStart(3, '0')}`,
            category: 'Architecture',
            severity: 'Medium',
            title: 'No Trigger Framework Detected',
            description: 'No standard trigger framework pattern was detected in the codebase',
            impact: 'May lead to inconsistent trigger handling, difficult maintenance, and potential recursion issues',
            recommendation: 'Consider implementing a trigger framework like FFLib or Kevin O\'Hara\'s pattern',
            effort: 'High',
            tool: 'Framework Analysis'
        });
        frameworkAnalysis.recommendations.push('Implement a trigger framework for consistent trigger handling');
    } else {
        frameworkAnalysis.recommendations.push(`Continue using ${frameworkAnalysis.triggerFramework.type} consistently across all triggers`);
    }

    // Check for triggers with logic
    if (frameworkAnalysis.triggerAnalysis?.withLogic > 0) {
        frameworkAnalysis.findings.push({
            id: `FWK-${String(findingId++).padStart(3, '0')}`,
            category: 'Architecture',
            severity: 'Medium',
            title: `${frameworkAnalysis.triggerAnalysis.withLogic} Triggers with Business Logic`,
            description: 'Triggers contain business logic instead of delegating to handler classes',
            impact: 'Difficult to test, maintain, and may cause governor limit issues',
            recommendation: 'Move business logic to handler/service classes',
            effort: 'Medium',
            tool: 'Framework Analysis'
        });
    }

    // Design patterns findings
    if (!frameworkAnalysis.designPatterns.hasSelector && !frameworkAnalysis.designPatterns.hasService) {
        frameworkAnalysis.findings.push({
            id: `FWK-${String(findingId++).padStart(3, '0')}`,
            category: 'Architecture',
            severity: 'Low',
            title: 'No Separation of Concerns Pattern Detected',
            description: 'No Selector/Service/Domain layer separation detected',
            impact: 'Code may be harder to maintain and test as complexity grows',
            recommendation: 'Consider implementing separation of concerns with Selector, Service, and Domain layers',
            effort: 'High',
            tool: 'Framework Analysis'
        });
    }

    // Integration patterns
    if (frameworkAnalysis.integrationPatterns.hasCallouts && !frameworkAnalysis.integrationPatterns.hasQueueable) {
        frameworkAnalysis.findings.push({
            id: `FWK-${String(findingId++).padStart(3, '0')}`,
            category: 'Integration',
            severity: 'Info',
            title: 'HTTP Callouts Without Queueable Pattern',
            description: 'HTTP callouts detected but no Queueable implementation found',
            impact: 'May face mixed DML issues or callout limits in trigger context',
            recommendation: 'Consider using Queueable for async callout processing',
            effort: 'Medium',
            tool: 'Framework Analysis'
        });
    }

    // Test patterns
    if (!frameworkAnalysis.testPatterns.hasTestDataFactory) {
        frameworkAnalysis.findings.push({
            id: `FWK-${String(findingId++).padStart(3, '0')}`,
            category: 'Testing',
            severity: 'Low',
            title: 'No Test Data Factory Pattern Detected',
            description: 'No centralized test data factory class found',
            impact: 'Test data creation may be duplicated across test classes',
            recommendation: 'Create a TestDataFactory class for consistent test data creation',
            effort: 'Medium',
            tool: 'Framework Analysis'
        });
    }
}

// Main execution
console.log('=== Framework & Pattern Analysis ===\n');

// Analyze classes
if (fs.existsSync(classesDir)) {
    const files = fs.readdirSync(classesDir).filter(f => f.endsWith('.cls'));
    console.log(`Analyzing ${files.length} Apex classes...\n`);

    files.forEach(file => {
        analyzeApexClass(path.join(classesDir, file));
    });
}

// Analyze triggers
analyzeTriggers();

// Generate findings
generateFindings();

// Output results
console.log('--- Trigger Framework ---');
if (frameworkAnalysis.triggerFramework.detected) {
    console.log(`✓ Detected: ${frameworkAnalysis.triggerFramework.type}`);
    console.log(`  Files: ${[...new Set(frameworkAnalysis.triggerFramework.files)].slice(0, 5).join(', ')}`);
} else {
    console.log('✗ No trigger framework detected');
}

console.log('\n--- Integration Patterns ---');
console.log(`  HTTP Callouts: ${frameworkAnalysis.integrationPatterns.hasCallouts ? '✓' : '✗'}`);
console.log(`  Queueable: ${frameworkAnalysis.integrationPatterns.hasQueueable ? '✓' : '✗'}`);
console.log(`  Batch Apex: ${frameworkAnalysis.integrationPatterns.hasBatch ? '✓' : '✗'}`);
console.log(`  Schedulable: ${frameworkAnalysis.integrationPatterns.hasSchedulable ? '✓' : '✗'}`);

console.log('\n--- Design Patterns ---');
console.log(`  Selector: ${frameworkAnalysis.designPatterns.hasSelector ? '✓' : '✗'}`);
console.log(`  Service: ${frameworkAnalysis.designPatterns.hasService ? '✓' : '✗'}`);
console.log(`  Domain: ${frameworkAnalysis.designPatterns.hasDomain ? '✓' : '✗'}`);
console.log(`  Factory: ${frameworkAnalysis.designPatterns.hasFactory ? '✓' : '✗'}`);
console.log(`  Singleton: ${frameworkAnalysis.designPatterns.hasSingleton ? '✓' : '✗'}`);

console.log('\n--- Test Patterns ---');
console.log(`  Test Data Factory: ${frameworkAnalysis.testPatterns.hasTestDataFactory ? '✓' : '✗'}`);
console.log(`  TestSetup Methods: ${frameworkAnalysis.testPatterns.hasTestSetup ? '✓' : '✗'}`);
console.log(`  Mocking/Stubbing: ${frameworkAnalysis.testPatterns.hasMocking ? '✓' : '✗'}`);

if (frameworkAnalysis.triggerAnalysis) {
    console.log('\n--- Trigger Analysis ---');
    console.log(`  Total Triggers: ${frameworkAnalysis.triggerAnalysis.total}`);
    console.log(`  With Logic: ${frameworkAnalysis.triggerAnalysis.withLogic}`);
    console.log(`  Delegating: ${frameworkAnalysis.triggerAnalysis.delegating}`);
}

console.log(`\n--- Findings: ${frameworkAnalysis.findings.length} ---`);
frameworkAnalysis.findings.forEach(f => {
    console.log(`  [${f.severity}] ${f.title}`);
});

console.log('\n--- Recommendations ---');
frameworkAnalysis.recommendations.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r}`);
});

// Save results
fs.writeFileSync('docs/data/framework-analysis.json', JSON.stringify(frameworkAnalysis, null, 2));
fs.writeFileSync('docs/data/framework-findings.json', JSON.stringify(frameworkAnalysis.findings, null, 2));

console.log('\nResults saved to docs/data/framework-analysis.json');
