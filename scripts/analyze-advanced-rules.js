/**
 * Advanced Rules Analysis Script
 * Based on rules from Hubbl, Quality Clouds, CodeScan, PMD, and Lightning Flow Scanner
 *
 * This script adds additional checks not covered by basic analysis scripts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Advanced Rules Analysis ===\n');
console.log('Analyzing rules from industry best practices (Hubbl, Quality Clouds, PMD, Flow Scanner)...\n');

const findings = [];
let findingId = 1;

// Directories
const classesDir = 'force-app/main/default/classes';
const triggersDir = 'force-app/main/default/triggers';
const lwcDir = 'force-app/main/default/lwc';
const auraDir = 'force-app/main/default/aura';
const flowsDir = 'force-app/main/default/flows';
const objectsDir = 'force-app/main/default/objects';
const profilesDir = 'force-app/main/default/profiles';
const permSetsDir = 'force-app/main/default/permissionsets';
const workflowsDir = 'force-app/main/default/workflows';

// Helper to read all files in directory
function readAllFiles(dir, extension) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith(extension))
        .map(f => ({
            name: f.replace(extension, ''),
            path: path.join(dir, f),
            content: fs.readFileSync(path.join(dir, f), 'utf8')
        }));
}

// =============================================
// APEX ADVANCED RULES
// =============================================
console.log('1. Analyzing Apex Advanced Rules...');

const apexClasses = readAllFiles(classesDir, '.cls');
const apexTriggers = readAllFiles(triggersDir, '.trigger');

const apexAdvanced = {
    missingInheritedSharing: [],
    legacyFutureUsage: [],
    auraEnabledWithoutCacheable: [],
    hardcodedEndpoints: [],
    dynamicApexWithoutCrud: [],
    soqlWithoutLimit: [],
    emptyConstructors: [],
    unusedExceptions: [],
    missingTestDataFactory: false,
    triggerWithLogic: [],
    multipleTriggerPerObject: {},
    httpCalloutInLoop: [],
    noNullChecks: [],
    excessiveComments: []
};

apexClasses.forEach(cls => {
    const content = cls.content;
    const isTest = content.includes('@isTest') || content.includes('@IsTest');

    // 1. Missing inherited sharing (classes without any sharing declaration)
    if (!isTest && !content.match(/\b(with sharing|without sharing|inherited sharing)\b/)) {
        if (content.match(/class\s+\w+/)) {
            apexAdvanced.missingInheritedSharing.push(cls.name);
        }
    }

    // 2. Legacy @future usage (should use Queueable)
    if (content.includes('@future') && !content.includes('@Future')) {
        apexAdvanced.legacyFutureUsage.push(cls.name);
    }
    if (content.includes('@Future')) {
        apexAdvanced.legacyFutureUsage.push(cls.name);
    }

    // 3. AuraEnabled without cacheable (where applicable for getters)
    const auraEnabledMethods = content.match(/@AuraEnabled[^)]*\)[^{]*\{/g) || [];
    auraEnabledMethods.forEach(method => {
        if (method.includes('get') && !method.includes('cacheable')) {
            apexAdvanced.auraEnabledWithoutCacheable.push(cls.name);
        }
    });

    // 4. Hardcoded endpoints (not using Named Credentials)
    const hardcodedUrls = content.match(/['"]https?:\/\/[^'"]+['"]/g) || [];
    if (hardcodedUrls.length > 0) {
        apexAdvanced.hardcodedEndpoints.push({
            name: cls.name,
            count: hardcodedUrls.length,
            urls: hardcodedUrls.slice(0, 3)
        });
    }

    // 5. Dynamic SOQL/SOSL without CRUD check
    if (content.includes('Database.query') || content.includes('Search.query')) {
        if (!content.includes('Schema.sObjectType') && !content.includes('stripInaccessible') && !content.includes('SECURITY_ENFORCED')) {
            apexAdvanced.dynamicApexWithoutCrud.push(cls.name);
        }
    }

    // 6. SOQL without LIMIT clause
    const soqlQueries = content.match(/\[SELECT[^\]]+\]/gi) || [];
    soqlQueries.forEach(query => {
        if (!query.toLowerCase().includes('limit') && !query.toLowerCase().includes('count(')) {
            apexAdvanced.soqlWithoutLimit.push({
                class: cls.name,
                query: query.substring(0, 100)
            });
        }
    });

    // 7. HTTP callout patterns in potential loop
    if (content.includes('Http h = new Http()') || content.includes('HttpRequest')) {
        if (content.match(/for\s*\([^)]*\)\s*\{[^}]*Http/i) || content.match(/while\s*\([^)]*\)\s*\{[^}]*Http/i)) {
            apexAdvanced.httpCalloutInLoop.push(cls.name);
        }
    }

    // 8. Missing null checks after SOQL
    const soqlAssignments = content.match(/\w+\s*=\s*\[SELECT[^\]]+\]\s*;/gi) || [];
    soqlAssignments.forEach(assignment => {
        // Check if there's a null check nearby
        const varName = assignment.match(/(\w+)\s*=/)?.[1];
        if (varName && !content.includes(`${varName} != null`) && !content.includes(`${varName} == null`)) {
            apexAdvanced.noNullChecks.push({
                class: cls.name,
                variable: varName
            });
        }
    });

    // Check for Test Data Factory
    if (cls.name.includes('TestDataFactory') || cls.name.includes('TestFactory') || cls.name.includes('TestUtil')) {
        apexAdvanced.missingTestDataFactory = true;
    }
});

// 9. Triggers with logic (should use handler)
apexTriggers.forEach(trigger => {
    const content = trigger.content;
    const lines = content.split('\n').length;

    // If trigger has more than 20 lines, it likely has logic
    if (lines > 20) {
        apexAdvanced.triggerWithLogic.push({
            name: trigger.name,
            lines: lines
        });
    }

    // Check for multiple triggers per object
    const objectMatch = content.match(/trigger\s+\w+\s+on\s+(\w+)/);
    if (objectMatch) {
        const objectName = objectMatch[1];
        apexAdvanced.multipleTriggerPerObject[objectName] = (apexAdvanced.multipleTriggerPerObject[objectName] || 0) + 1;
    }
});

// Generate findings for Apex
if (apexAdvanced.missingInheritedSharing.length > 10) {
    findings.push({
        id: `ADV-APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'Medium',
        title: `${apexAdvanced.missingInheritedSharing.length} classes without explicit sharing declaration`,
        description: 'Classes without sharing declaration default to "without sharing" in some contexts',
        location: apexAdvanced.missingInheritedSharing.slice(0, 5).join(', ') + '...',
        impact: 'Potential security bypass, unpredictable behavior',
        recommendation: 'Add explicit "with sharing" or "inherited sharing" declaration',
        effort: 'Quick Win',
        tool: 'Advanced Rules Analysis'
    });
}

if (apexAdvanced.legacyFutureUsage.length > 0) {
    findings.push({
        id: `ADV-APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Best Practices',
        severity: 'Low',
        title: `${apexAdvanced.legacyFutureUsage.length} classes use @future annotation`,
        description: '@future is a legacy approach; Queueable provides more flexibility',
        location: apexAdvanced.legacyFutureUsage.slice(0, 5).join(', '),
        impact: 'Limited chaining, no job ID returned',
        recommendation: 'Migrate to Queueable interface for new async processing',
        effort: 'Medium',
        tool: 'Advanced Rules Analysis'
    });
}

if (apexAdvanced.hardcodedEndpoints.length > 0) {
    findings.push({
        id: `ADV-APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'High',
        title: `${apexAdvanced.hardcodedEndpoints.length} classes have hardcoded URLs/endpoints`,
        description: 'Hardcoded endpoints should use Named Credentials for security and portability',
        location: apexAdvanced.hardcodedEndpoints.map(e => e.name).join(', '),
        impact: 'Credential exposure, environment-specific issues',
        recommendation: 'Use Named Credentials for all external endpoints',
        effort: 'Medium',
        tool: 'Advanced Rules Analysis'
    });
}

if (apexAdvanced.dynamicApexWithoutCrud.length > 0) {
    findings.push({
        id: `ADV-APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'Critical',
        title: `${apexAdvanced.dynamicApexWithoutCrud.length} classes use dynamic SOQL without CRUD checks`,
        description: 'Database.query without security checks may bypass FLS',
        location: apexAdvanced.dynamicApexWithoutCrud.slice(0, 5).join(', '),
        impact: 'Field Level Security bypass, data exposure',
        recommendation: 'Add WITH SECURITY_ENFORCED or use stripInaccessible()',
        effort: 'Medium',
        tool: 'Advanced Rules Analysis'
    });
}

if (apexAdvanced.triggerWithLogic.length > 3) {
    findings.push({
        id: `ADV-APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Best Practices',
        severity: 'High',
        title: `${apexAdvanced.triggerWithLogic.length} triggers contain business logic`,
        description: 'Triggers should delegate to handler classes for testability',
        location: apexAdvanced.triggerWithLogic.map(t => t.name).join(', '),
        impact: 'Hard to test, hard to maintain, no single-trigger pattern',
        recommendation: 'Implement trigger framework (e.g., fflib TriggerHandler)',
        effort: 'High',
        tool: 'Advanced Rules Analysis'
    });
}

const multiTriggerObjects = Object.entries(apexAdvanced.multipleTriggerPerObject).filter(([, count]) => count > 1);
if (multiTriggerObjects.length > 0) {
    findings.push({
        id: `ADV-APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Best Practices',
        severity: 'High',
        title: `${multiTriggerObjects.length} objects have multiple triggers`,
        description: 'Multiple triggers on same object have unpredictable execution order',
        location: multiTriggerObjects.map(([obj, count]) => `${obj}: ${count} triggers`).join(', '),
        impact: 'Unpredictable behavior, race conditions',
        recommendation: 'Consolidate to single trigger per object with handler',
        effort: 'High',
        tool: 'Advanced Rules Analysis'
    });
}

if (!apexAdvanced.missingTestDataFactory) {
    findings.push({
        id: `ADV-APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Testing',
        severity: 'Medium',
        title: 'No Test Data Factory found',
        description: 'TestDataFactory pattern centralizes test data creation',
        location: 'N/A',
        impact: 'Duplicated test data setup, maintenance burden',
        recommendation: 'Create TestDataFactory class for reusable test data',
        effort: 'Medium',
        tool: 'Advanced Rules Analysis'
    });
}

if (apexAdvanced.httpCalloutInLoop.length > 0) {
    findings.push({
        id: `ADV-APEX-${String(findingId++).padStart(3, '0')}`,
        category: 'Performance',
        severity: 'Critical',
        title: `${apexAdvanced.httpCalloutInLoop.length} classes may have HTTP callouts in loops`,
        description: 'HTTP callouts in loops will hit callout limits',
        location: apexAdvanced.httpCalloutInLoop.join(', '),
        impact: 'Callout limit exceptions, slow performance',
        recommendation: 'Batch callouts or use Queueable chaining',
        effort: 'High',
        tool: 'Advanced Rules Analysis'
    });
}

console.log(`  - Classes without sharing declaration: ${apexAdvanced.missingInheritedSharing.length}`);
console.log(`  - Legacy @future usage: ${apexAdvanced.legacyFutureUsage.length}`);
console.log(`  - Hardcoded endpoints: ${apexAdvanced.hardcodedEndpoints.length}`);
console.log(`  - Dynamic SOQL without CRUD: ${apexAdvanced.dynamicApexWithoutCrud.length}`);
console.log(`  - Triggers with logic: ${apexAdvanced.triggerWithLogic.length}`);

// =============================================
// LWC ANALYSIS
// =============================================
console.log('\n2. Analyzing Lightning Web Components...');

const lwcComponents = [];
if (fs.existsSync(lwcDir)) {
    fs.readdirSync(lwcDir).filter(d => {
        const stat = fs.statSync(path.join(lwcDir, d));
        return stat.isDirectory() && !d.startsWith('__');
    }).forEach(component => {
        const componentDir = path.join(lwcDir, component);
        const jsFile = path.join(componentDir, `${component}.js`);
        const htmlFile = path.join(componentDir, `${component}.html`);
        const metaFile = path.join(componentDir, `${component}.js-meta.xml`);

        const analysis = {
            name: component,
            hasJs: fs.existsSync(jsFile),
            hasHtml: fs.existsSync(htmlFile),
            hasMeta: fs.existsSync(metaFile),
            issues: []
        };

        if (analysis.hasJs) {
            const jsContent = fs.readFileSync(jsFile, 'utf8');

            // Check for console.log
            if (jsContent.includes('console.log') || jsContent.includes('console.error')) {
                analysis.issues.push('Console statements');
            }

            // Check for @wire without error handling
            if (jsContent.includes('@wire') && !jsContent.includes('error')) {
                analysis.issues.push('Wire without error handling');
            }

            // Check for imperative Apex without try-catch
            if (jsContent.includes('import') && jsContent.includes('from \'@salesforce/apex')) {
                if (!jsContent.includes('try') && !jsContent.includes('.catch')) {
                    analysis.issues.push('Imperative Apex without error handling');
                }
            }

            // Check for hardcoded strings (i18n issue)
            const hardcodedStrings = jsContent.match(/['"][A-Z][^'"]{20,}['"]/g) || [];
            if (hardcodedStrings.length > 5) {
                analysis.issues.push(`${hardcodedStrings.length} hardcoded strings (i18n)`);
            }

            // Check for missing @api documentation
            const apiProperties = (jsContent.match(/@api\s+\w+/g) || []).length;
            const jsDocComments = (jsContent.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
            if (apiProperties > 0 && jsDocComments === 0) {
                analysis.issues.push('Missing JSDoc for @api properties');
            }
        }

        if (analysis.hasHtml) {
            const htmlContent = fs.readFileSync(htmlFile, 'utf8');

            // Check for accessibility issues
            if (htmlContent.includes('<button') && !htmlContent.includes('aria-')) {
                analysis.issues.push('Buttons without aria-labels');
            }

            // Check for inline styles
            if (htmlContent.includes('style=')) {
                analysis.issues.push('Inline styles (use CSS)');
            }
        }

        if (analysis.hasMeta) {
            const metaContent = fs.readFileSync(metaFile, 'utf8');

            // Check for missing description
            if (!metaContent.includes('<description>') || metaContent.includes('<description></description>')) {
                analysis.issues.push('Missing component description');
            }

            // Check API version
            const apiMatch = metaContent.match(/<apiVersion>([^<]+)<\/apiVersion>/);
            if (apiMatch && parseFloat(apiMatch[1]) < 55) {
                analysis.issues.push(`Old API version (${apiMatch[1]})`);
            }
        }

        lwcComponents.push(analysis);
    });
}

const lwcWithIssues = lwcComponents.filter(c => c.issues.length > 0);
if (lwcWithIssues.length > 0) {
    findings.push({
        id: `ADV-LWC-${String(findingId++).padStart(3, '0')}`,
        category: 'Code Quality',
        severity: 'Medium',
        title: `${lwcWithIssues.length} LWC components have issues`,
        description: 'Components with console statements, missing error handling, or accessibility issues',
        location: lwcWithIssues.slice(0, 5).map(c => c.name).join(', '),
        impact: 'Production errors, accessibility violations, maintainability',
        recommendation: 'Review and fix component issues',
        effort: 'Medium',
        tool: 'Advanced Rules Analysis'
    });
}

const lwcWithoutDescription = lwcComponents.filter(c => c.issues.includes('Missing component description'));
if (lwcWithoutDescription.length > 5) {
    findings.push({
        id: `ADV-LWC-${String(findingId++).padStart(3, '0')}`,
        category: 'Documentation',
        severity: 'Medium',
        title: `${lwcWithoutDescription.length} LWC components without description`,
        description: 'Component metadata should include description for AI tools and documentation',
        location: lwcWithoutDescription.slice(0, 5).map(c => c.name).join(', '),
        impact: 'AI tools cannot understand component purpose',
        recommendation: 'Add description to component meta files',
        effort: 'Quick Win',
        tool: 'Advanced Rules Analysis'
    });
}

console.log(`  - Total LWC components: ${lwcComponents.length}`);
console.log(`  - Components with issues: ${lwcWithIssues.length}`);
console.log(`  - Missing descriptions: ${lwcWithoutDescription.length}`);

// =============================================
// AURA COMPONENTS (Legacy Check)
// =============================================
console.log('\n3. Checking Aura Components (Legacy)...');

let auraCount = 0;
if (fs.existsSync(auraDir)) {
    auraCount = fs.readdirSync(auraDir).filter(d => {
        const stat = fs.statSync(path.join(auraDir, d));
        return stat.isDirectory();
    }).length;
}

if (auraCount > 10) {
    findings.push({
        id: `ADV-AURA-${String(findingId++).padStart(3, '0')}`,
        category: 'Technical Debt',
        severity: 'Medium',
        title: `${auraCount} Aura components found (legacy technology)`,
        description: 'Aura components should be migrated to LWC for better performance',
        location: auraDir,
        impact: 'Performance overhead, larger bundle size, deprecated framework',
        recommendation: 'Plan migration to Lightning Web Components',
        effort: 'High',
        tool: 'Advanced Rules Analysis'
    });
}

console.log(`  - Aura components: ${auraCount}`);

// =============================================
// WORKFLOW RULES (Deprecated)
// =============================================
console.log('\n4. Checking Workflow Rules (Deprecated)...');

let workflowCount = 0;
const workflowObjects = [];
if (fs.existsSync(workflowsDir)) {
    fs.readdirSync(workflowsDir).filter(f => f.endsWith('.workflow-meta.xml')).forEach(file => {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        const rules = (content.match(/<rules>/g) || []).length;
        const alerts = (content.match(/<alerts>/g) || []).length;
        const updates = (content.match(/<fieldUpdates>/g) || []).length;

        if (rules > 0 || alerts > 0 || updates > 0) {
            workflowCount += rules + alerts + updates;
            workflowObjects.push({
                object: file.replace('.workflow-meta.xml', ''),
                rules,
                alerts,
                updates
            });
        }
    });
}

if (workflowCount > 0) {
    findings.push({
        id: `ADV-WF-${String(findingId++).padStart(3, '0')}`,
        category: 'Technical Debt',
        severity: 'High',
        title: `${workflowCount} Workflow Rules found (deprecated)`,
        description: 'Workflow Rules are deprecated; migrate to Flow for continued support',
        location: workflowObjects.slice(0, 5).map(w => w.object).join(', '),
        impact: 'No new features, eventual deprecation',
        recommendation: 'Migrate Workflow Rules to Record-Triggered Flows',
        effort: 'High',
        tool: 'Advanced Rules Analysis'
    });
}

console.log(`  - Workflow Rules/Actions: ${workflowCount}`);

// =============================================
// PROCESS BUILDERS (Deprecated)
// =============================================
console.log('\n5. Checking Process Builders (Deprecated)...');

const processBuilders = [];
if (fs.existsSync(flowsDir)) {
    fs.readdirSync(flowsDir).filter(f => f.endsWith('.flow-meta.xml')).forEach(file => {
        const content = fs.readFileSync(path.join(flowsDir, file), 'utf8');
        if (content.includes('<processType>Workflow</processType>')) {
            processBuilders.push(file.replace('.flow-meta.xml', ''));
        }
    });
}

if (processBuilders.length > 0) {
    findings.push({
        id: `ADV-PB-${String(findingId++).padStart(3, '0')}`,
        category: 'Technical Debt',
        severity: 'High',
        title: `${processBuilders.length} Process Builders found (deprecated)`,
        description: 'Process Builder is deprecated; Salesforce recommends Flow',
        location: processBuilders.slice(0, 5).join(', '),
        impact: 'No new features, migration required before decommission',
        recommendation: 'Use Migrate to Flow tool in Setup',
        effort: 'High',
        tool: 'Advanced Rules Analysis'
    });
}

console.log(`  - Process Builders: ${processBuilders.length}`);

// =============================================
// SECURITY ADVANCED CHECKS
// =============================================
console.log('\n6. Advanced Security Analysis...');

const securityAdvanced = {
    profilesWithApiEnabled: 0,
    permSetsWithCriticalPerms: [],
    classesWithDangerousMethods: []
};

// Check profiles for API access
if (fs.existsSync(profilesDir)) {
    fs.readdirSync(profilesDir).filter(f => f.endsWith('.profile-meta.xml')).forEach(file => {
        const content = fs.readFileSync(path.join(profilesDir, file), 'utf8');
        if (content.includes('<apiEnabled>true</apiEnabled>')) {
            securityAdvanced.profilesWithApiEnabled++;
        }
    });
}

// Check permission sets for critical permissions
if (fs.existsSync(permSetsDir)) {
    fs.readdirSync(permSetsDir).filter(f => f.endsWith('.permissionset-meta.xml')).forEach(file => {
        const content = fs.readFileSync(path.join(permSetsDir, file), 'utf8');
        const name = file.replace('.permissionset-meta.xml', '');
        const criticalPerms = [];

        if (content.includes('<permissionsAuthorApex>true')) criticalPerms.push('AuthorApex');
        if (content.includes('<permissionsManageSharing>true')) criticalPerms.push('ManageSharing');
        if (content.includes('<permissionsManageUsers>true')) criticalPerms.push('ManageUsers');
        if (content.includes('<permissionsModifyAllData>true')) criticalPerms.push('ModifyAllData');
        if (content.includes('<permissionsViewSetup>true')) criticalPerms.push('ViewSetup');
        if (content.includes('<permissionsCustomizeApplication>true')) criticalPerms.push('CustomizeApp');

        if (criticalPerms.length > 0) {
            securityAdvanced.permSetsWithCriticalPerms.push({
                name,
                permissions: criticalPerms
            });
        }
    });
}

// Check for dangerous methods in Apex
const dangerousMethods = ['Messaging.sendEmail', 'UserInfo.getSessionId', 'Url.getFileFieldURL', 'EncodingUtil.base64Decode'];
apexClasses.forEach(cls => {
    const found = dangerousMethods.filter(method => cls.content.includes(method));
    if (found.length > 0) {
        securityAdvanced.classesWithDangerousMethods.push({
            name: cls.name,
            methods: found
        });
    }
});

if (securityAdvanced.permSetsWithCriticalPerms.length > 5) {
    findings.push({
        id: `ADV-SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'High',
        title: `${securityAdvanced.permSetsWithCriticalPerms.length} Permission Sets with critical permissions`,
        description: 'Permission Sets granting high-privilege access should be reviewed',
        location: securityAdvanced.permSetsWithCriticalPerms.slice(0, 5).map(p => p.name).join(', '),
        impact: 'Potential privilege escalation, audit concerns',
        recommendation: 'Review and restrict permission set assignments',
        effort: 'Medium',
        tool: 'Advanced Rules Analysis'
    });
}

if (securityAdvanced.classesWithDangerousMethods.length > 0) {
    findings.push({
        id: `ADV-SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'Medium',
        title: `${securityAdvanced.classesWithDangerousMethods.length} classes use potentially dangerous methods`,
        description: 'Methods like sendEmail, getSessionId require careful review',
        location: securityAdvanced.classesWithDangerousMethods.map(c => c.name).join(', '),
        impact: 'Security risks if misused',
        recommendation: 'Review usage and ensure proper authorization',
        effort: 'Medium',
        tool: 'Advanced Rules Analysis'
    });
}

console.log(`  - Profiles with API enabled: ${securityAdvanced.profilesWithApiEnabled}`);
console.log(`  - Permission Sets with critical perms: ${securityAdvanced.permSetsWithCriticalPerms.length}`);
console.log(`  - Classes with dangerous methods: ${securityAdvanced.classesWithDangerousMethods.length}`);

// =============================================
// FIELD ANALYSIS (Unused Fields Indicator)
// =============================================
console.log('\n7. Additional Field Analysis...');

const fieldIssues = {
    fieldsWithoutDescription: 0,
    formulaFieldsWithoutComment: 0,
    picklistsWithManyValues: []
};

if (fs.existsSync(objectsDir)) {
    fs.readdirSync(objectsDir).filter(d => {
        const stat = fs.statSync(path.join(objectsDir, d));
        return stat.isDirectory();
    }).forEach(objName => {
        const fieldsDir = path.join(objectsDir, objName, 'fields');
        if (fs.existsSync(fieldsDir)) {
            fs.readdirSync(fieldsDir).filter(f => f.endsWith('.field-meta.xml')).forEach(file => {
                const content = fs.readFileSync(path.join(fieldsDir, file), 'utf8');

                // Check for missing description
                if (!content.includes('<description>') || content.includes('<description></description>')) {
                    fieldIssues.fieldsWithoutDescription++;
                }

                // Check for formula without inline comment
                if (content.includes('<formula>')) {
                    if (!content.includes('/*') && !content.includes('//')) {
                        fieldIssues.formulaFieldsWithoutComment++;
                    }
                }

                // Check for picklists with many values
                const picklistValues = (content.match(/<value>/g) || []).length;
                if (picklistValues > 50) {
                    fieldIssues.picklistsWithManyValues.push({
                        object: objName,
                        field: file.replace('.field-meta.xml', ''),
                        values: picklistValues
                    });
                }
            });
        }
    });
}

if (fieldIssues.picklistsWithManyValues.length > 0) {
    findings.push({
        id: `ADV-FIELD-${String(findingId++).padStart(3, '0')}`,
        category: 'Design',
        severity: 'Medium',
        title: `${fieldIssues.picklistsWithManyValues.length} picklists with >50 values`,
        description: 'Large picklists may indicate a need for a related object',
        location: fieldIssues.picklistsWithManyValues.map(p => `${p.object}.${p.field}`).join(', '),
        impact: 'UI performance, maintainability',
        recommendation: 'Consider using Custom Metadata or related object instead',
        effort: 'Medium',
        tool: 'Advanced Rules Analysis'
    });
}

console.log(`  - Fields without description: ${fieldIssues.fieldsWithoutDescription}`);
console.log(`  - Formula fields without comments: ${fieldIssues.formulaFieldsWithoutComment}`);
console.log(`  - Large picklists (>50 values): ${fieldIssues.picklistsWithManyValues.length}`);

// =============================================
// SAVE RESULTS
// =============================================
console.log('\n=== Summary ===');
console.log(`Total Advanced Findings: ${findings.length}`);

const analysis = {
    apex: apexAdvanced,
    lwc: {
        total: lwcComponents.length,
        withIssues: lwcWithIssues.length,
        components: lwcComponents
    },
    aura: { count: auraCount },
    workflows: { count: workflowCount, objects: workflowObjects },
    processBuilders: processBuilders,
    security: securityAdvanced,
    fields: fieldIssues
};

fs.writeFileSync('docs/data/advanced-analysis.json', JSON.stringify(analysis, null, 2));
fs.writeFileSync('docs/data/advanced-findings.json', JSON.stringify(findings, null, 2));

console.log('\nFindings by category:');
const byCategory = findings.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
}, {});
Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
});

console.log('\nSaved to docs/data/advanced-analysis.json and docs/data/advanced-findings.json');
