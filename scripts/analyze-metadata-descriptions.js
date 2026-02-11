const fs = require('fs');
const path = require('path');

console.log('=== Metadata Description Analysis ===\n');
console.log('Checking for missing descriptions in metadata components...\n');

const baseDir = 'force-app/main/default';

// Results storage
const results = {
    objects: { total: 0, missing: 0, items: [] },
    fields: { total: 0, missing: 0, items: [] },
    flows: { total: 0, missing: 0, items: [] },
    apexClasses: { total: 0, missing: 0, items: [] },
    apexTriggers: { total: 0, missing: 0, items: [] },
    lwc: { total: 0, missing: 0, items: [] },
    permissionSets: { total: 0, missing: 0, items: [] },
    customLabels: { total: 0, missing: 0, items: [] },
    validationRules: { total: 0, missing: 0, items: [] },
    recordTypes: { total: 0, missing: 0, items: [] }
};

// Helper: Check if description exists and is meaningful
function hasDescription(content, tag = 'description') {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
    const match = content.match(regex);
    if (!match) return false;
    const desc = match[1].trim();
    // Check if description is meaningful (not just whitespace or very short)
    return desc.length >= 3;
}

// Helper: Get description value
function getDescription(content, tag = 'description') {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
}

// Helper: Safely read directory
function safeReadDir(dir) {
    try {
        return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    } catch (e) {
        return [];
    }
}

// Helper: Get files with extension
function getFiles(dir, extension) {
    return safeReadDir(dir).filter(f => f.endsWith(extension));
}

// 1. Analyze Custom Objects
console.log('Analyzing Custom Objects...');
const objectsDir = path.join(baseDir, 'objects');
const objectDirs = safeReadDir(objectsDir).filter(d => {
    const fullPath = path.join(objectsDir, d);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
});

objectDirs.forEach(objName => {
    const objPath = path.join(objectsDir, objName);
    const metaFile = path.join(objPath, `${objName}.object-meta.xml`);

    if (fs.existsSync(metaFile)) {
        results.objects.total++;
        const content = fs.readFileSync(metaFile, 'utf8');
        if (!hasDescription(content)) {
            results.objects.missing++;
            results.objects.items.push({
                name: objName,
                type: 'CustomObject',
                path: metaFile
            });
        }
    }

    // Analyze Fields within object
    const fieldsDir = path.join(objPath, 'fields');
    const fieldFiles = getFiles(fieldsDir, '.field-meta.xml');

    fieldFiles.forEach(fieldFile => {
        results.fields.total++;
        const content = fs.readFileSync(path.join(fieldsDir, fieldFile), 'utf8');
        const fieldName = fieldFile.replace('.field-meta.xml', '');

        if (!hasDescription(content)) {
            results.fields.missing++;
            results.fields.items.push({
                name: `${objName}.${fieldName}`,
                type: 'CustomField',
                path: path.join(fieldsDir, fieldFile)
            });
        }
    });

    // Analyze Validation Rules
    const vrDir = path.join(objPath, 'validationRules');
    const vrFiles = getFiles(vrDir, '.validationRule-meta.xml');

    vrFiles.forEach(vrFile => {
        results.validationRules.total++;
        const content = fs.readFileSync(path.join(vrDir, vrFile), 'utf8');
        const vrName = vrFile.replace('.validationRule-meta.xml', '');

        if (!hasDescription(content)) {
            results.validationRules.missing++;
            results.validationRules.items.push({
                name: `${objName}.${vrName}`,
                type: 'ValidationRule',
                path: path.join(vrDir, vrFile)
            });
        }
    });

    // Analyze Record Types
    const rtDir = path.join(objPath, 'recordTypes');
    const rtFiles = getFiles(rtDir, '.recordType-meta.xml');

    rtFiles.forEach(rtFile => {
        results.recordTypes.total++;
        const content = fs.readFileSync(path.join(rtDir, rtFile), 'utf8');
        const rtName = rtFile.replace('.recordType-meta.xml', '');

        if (!hasDescription(content)) {
            results.recordTypes.missing++;
            results.recordTypes.items.push({
                name: `${objName}.${rtName}`,
                type: 'RecordType',
                path: path.join(rtDir, rtFile)
            });
        }
    });
});

// 2. Analyze Flows
console.log('Analyzing Flows...');
const flowsDir = path.join(baseDir, 'flows');
const flowFiles = getFiles(flowsDir, '.flow-meta.xml');

flowFiles.forEach(flowFile => {
    results.flows.total++;
    const content = fs.readFileSync(path.join(flowsDir, flowFile), 'utf8');
    const flowName = flowFile.replace('.flow-meta.xml', '');

    if (!hasDescription(content)) {
        results.flows.missing++;
        results.flows.items.push({
            name: flowName,
            type: 'Flow',
            path: path.join(flowsDir, flowFile)
        });
    }
});

// 3. Analyze Apex Classes (check for class-level comments/description)
console.log('Analyzing Apex Classes...');
const classesDir = path.join(baseDir, 'classes');
const classFiles = getFiles(classesDir, '.cls');

classFiles.forEach(classFile => {
    results.apexClasses.total++;
    const content = fs.readFileSync(path.join(classesDir, classFile), 'utf8');
    const className = classFile.replace('.cls', '');

    // Check for class-level documentation (JSDoc style or Apex doc comments)
    const hasDocComment = /\/\*\*[\s\S]*?\*\/\s*(public|global|private)/.test(content) ||
                          /\/\/.*@description/i.test(content) ||
                          /\/\*\*\s*\n\s*\*\s*@description/i.test(content);

    // Also check the meta file for description
    const metaFile = path.join(classesDir, `${classFile}-meta.xml`);
    let hasMetaDescription = false;
    if (fs.existsSync(metaFile)) {
        const metaContent = fs.readFileSync(metaFile, 'utf8');
        hasMetaDescription = hasDescription(metaContent);
    }

    if (!hasDocComment && !hasMetaDescription) {
        results.apexClasses.missing++;
        results.apexClasses.items.push({
            name: className,
            type: 'ApexClass',
            path: path.join(classesDir, classFile)
        });
    }
});

// 4. Analyze Apex Triggers
console.log('Analyzing Apex Triggers...');
const triggersDir = path.join(baseDir, 'triggers');
const triggerFiles = getFiles(triggersDir, '.trigger');

triggerFiles.forEach(triggerFile => {
    results.apexTriggers.total++;
    const content = fs.readFileSync(path.join(triggersDir, triggerFile), 'utf8');
    const triggerName = triggerFile.replace('.trigger', '');

    // Check for trigger documentation
    const hasDocComment = /\/\*\*[\s\S]*?\*\/\s*trigger/.test(content) ||
                          /\/\/.*@description/i.test(content);

    if (!hasDocComment) {
        results.apexTriggers.missing++;
        results.apexTriggers.items.push({
            name: triggerName,
            type: 'ApexTrigger',
            path: path.join(triggersDir, triggerFile)
        });
    }
});

// 5. Analyze LWC Components
console.log('Analyzing LWC Components...');
const lwcDir = path.join(baseDir, 'lwc');
const lwcComponents = safeReadDir(lwcDir).filter(d => {
    const fullPath = path.join(lwcDir, d);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory() && !d.startsWith('__');
});

lwcComponents.forEach(compName => {
    results.lwc.total++;
    const metaFile = path.join(lwcDir, compName, `${compName}.js-meta.xml`);

    if (fs.existsSync(metaFile)) {
        const content = fs.readFileSync(metaFile, 'utf8');
        if (!hasDescription(content)) {
            results.lwc.missing++;
            results.lwc.items.push({
                name: compName,
                type: 'LightningComponentBundle',
                path: metaFile
            });
        }
    } else {
        results.lwc.missing++;
        results.lwc.items.push({
            name: compName,
            type: 'LightningComponentBundle',
            path: path.join(lwcDir, compName),
            note: 'Missing meta file'
        });
    }
});

// 6. Analyze Permission Sets
console.log('Analyzing Permission Sets...');
const permSetsDir = path.join(baseDir, 'permissionsets');
const permSetFiles = getFiles(permSetsDir, '.permissionset-meta.xml');

permSetFiles.forEach(psFile => {
    results.permissionSets.total++;
    const content = fs.readFileSync(path.join(permSetsDir, psFile), 'utf8');
    const psName = psFile.replace('.permissionset-meta.xml', '');

    if (!hasDescription(content)) {
        results.permissionSets.missing++;
        results.permissionSets.items.push({
            name: psName,
            type: 'PermissionSet',
            path: path.join(permSetsDir, psFile)
        });
    }
});

// 7. Analyze Custom Labels
console.log('Analyzing Custom Labels...');
const labelsFile = path.join(baseDir, 'labels', 'CustomLabels.labels-meta.xml');
if (fs.existsSync(labelsFile)) {
    const content = fs.readFileSync(labelsFile, 'utf8');
    const labelRegex = /<labels>([\s\S]*?)<\/labels>/g;
    let match;

    while ((match = labelRegex.exec(content)) !== null) {
        results.customLabels.total++;
        const labelContent = match[1];
        const nameMatch = labelContent.match(/<fullName>([^<]+)<\/fullName>/);
        const labelName = nameMatch ? nameMatch[1] : 'Unknown';

        // Custom labels use 'shortDescription' as description
        const hasShortDesc = /<shortDescription>([^<]+)<\/shortDescription>/.test(labelContent);

        if (!hasShortDesc) {
            results.customLabels.missing++;
            results.customLabels.items.push({
                name: labelName,
                type: 'CustomLabel',
                path: labelsFile
            });
        }
    }
}

// Calculate summary
const summary = {
    totalComponents: 0,
    totalMissing: 0,
    percentageMissing: 0,
    byType: {}
};

Object.entries(results).forEach(([type, data]) => {
    if (data.total > 0) {
        summary.totalComponents += data.total;
        summary.totalMissing += data.missing;
        summary.byType[type] = {
            total: data.total,
            missing: data.missing,
            percentage: Math.round((data.missing / data.total) * 100)
        };
    }
});

summary.percentageMissing = summary.totalComponents > 0
    ? Math.round((summary.totalMissing / summary.totalComponents) * 100)
    : 0;

// Generate findings
const findings = [];
let findingId = 1;

// Critical: Fields without descriptions (data integrity concern)
if (results.fields.missing > 0) {
    const percentage = Math.round((results.fields.missing / results.fields.total) * 100);
    findings.push({
        id: `DESC-${String(findingId++).padStart(3, '0')}`,
        category: 'Documentation',
        severity: percentage > 50 ? 'High' : (percentage > 25 ? 'Medium' : 'Low'),
        title: `${results.fields.missing} custom fields (${percentage}%) lack descriptions`,
        description: 'Custom fields without descriptions make it difficult to understand data model purpose and usage',
        location: 'Custom Objects > Fields',
        impact: 'Knowledge loss, onboarding difficulty, maintenance challenges',
        recommendation: 'Add meaningful descriptions to all custom fields explaining their business purpose',
        effort: results.fields.missing > 100 ? 'High' : 'Medium',
        tool: 'Description Analysis',
        details: results.fields.items.slice(0, 20) // Top 20 examples
    });
}

// Flows without descriptions
if (results.flows.missing > 0) {
    const percentage = Math.round((results.flows.missing / results.flows.total) * 100);
    findings.push({
        id: `DESC-${String(findingId++).padStart(3, '0')}`,
        category: 'Documentation',
        severity: percentage > 50 ? 'High' : 'Medium',
        title: `${results.flows.missing} flows (${percentage}%) lack descriptions`,
        description: 'Flows without descriptions make automation difficult to understand and maintain',
        location: 'Flows',
        impact: 'Difficult troubleshooting, unclear business logic',
        recommendation: 'Add descriptions explaining what each flow does and when it runs',
        effort: 'Medium',
        tool: 'Description Analysis',
        details: results.flows.items.slice(0, 20)
    });
}

// Apex Classes without documentation
if (results.apexClasses.missing > 0) {
    const percentage = Math.round((results.apexClasses.missing / results.apexClasses.total) * 100);
    findings.push({
        id: `DESC-${String(findingId++).padStart(3, '0')}`,
        category: 'Documentation',
        severity: percentage > 50 ? 'High' : 'Medium',
        title: `${results.apexClasses.missing} Apex classes (${percentage}%) lack documentation`,
        description: 'Apex classes without class-level documentation reduce code maintainability',
        location: 'Apex Classes',
        impact: 'Code comprehension difficulty, slower onboarding',
        recommendation: 'Add ApexDoc comments to all classes describing their purpose',
        effort: results.apexClasses.missing > 50 ? 'High' : 'Medium',
        tool: 'Description Analysis',
        details: results.apexClasses.items.slice(0, 20)
    });
}

// LWC without descriptions
if (results.lwc.missing > 0) {
    const percentage = results.lwc.total > 0
        ? Math.round((results.lwc.missing / results.lwc.total) * 100)
        : 0;
    findings.push({
        id: `DESC-${String(findingId++).padStart(3, '0')}`,
        category: 'Documentation',
        severity: percentage > 50 ? 'Medium' : 'Low',
        title: `${results.lwc.missing} LWC components (${percentage}%) lack descriptions`,
        description: 'LWC components without descriptions in meta files are harder to identify in App Builder',
        location: 'LWC Components',
        impact: 'Component discovery issues, admin confusion',
        recommendation: 'Add description tags to all LWC meta files',
        effort: 'Quick Win',
        tool: 'Description Analysis',
        details: results.lwc.items.slice(0, 20)
    });
}

// Permission Sets without descriptions
if (results.permissionSets.missing > 0) {
    const percentage = results.permissionSets.total > 0
        ? Math.round((results.permissionSets.missing / results.permissionSets.total) * 100)
        : 0;
    findings.push({
        id: `DESC-${String(findingId++).padStart(3, '0')}`,
        category: 'Documentation',
        severity: percentage > 70 ? 'Medium' : 'Low',
        title: `${results.permissionSets.missing} permission sets (${percentage}%) lack descriptions`,
        description: 'Permission sets without descriptions make security management difficult',
        location: 'Permission Sets',
        impact: 'Security audit difficulty, assignment confusion',
        recommendation: 'Add descriptions explaining the purpose and intended users',
        effort: 'Quick Win',
        tool: 'Description Analysis',
        details: results.permissionSets.items.slice(0, 20)
    });
}

// Objects without descriptions
if (results.objects.missing > 0) {
    findings.push({
        id: `DESC-${String(findingId++).padStart(3, '0')}`,
        category: 'Documentation',
        severity: 'Medium',
        title: `${results.objects.missing} custom objects lack descriptions`,
        description: 'Custom objects without descriptions reduce data model clarity',
        location: 'Custom Objects',
        impact: 'Data model comprehension, integration difficulty',
        recommendation: 'Add descriptions to all custom objects',
        effort: 'Quick Win',
        tool: 'Description Analysis',
        details: results.objects.items
    });
}

// Validation Rules without descriptions
if (results.validationRules.missing > 0) {
    const percentage = results.validationRules.total > 0
        ? Math.round((results.validationRules.missing / results.validationRules.total) * 100)
        : 0;
    findings.push({
        id: `DESC-${String(findingId++).padStart(3, '0')}`,
        category: 'Documentation',
        severity: percentage > 50 ? 'Medium' : 'Low',
        title: `${results.validationRules.missing} validation rules (${percentage}%) lack descriptions`,
        description: 'Validation rules without descriptions make it hard to understand their business purpose',
        location: 'Validation Rules',
        impact: 'Troubleshooting difficulty, business logic unclear',
        recommendation: 'Add descriptions explaining the business rule being enforced',
        effort: 'Medium',
        tool: 'Description Analysis',
        details: results.validationRules.items.slice(0, 20)
    });
}

// Triggers without documentation
if (results.apexTriggers.missing > 0) {
    findings.push({
        id: `DESC-${String(findingId++).padStart(3, '0')}`,
        category: 'Documentation',
        severity: 'Medium',
        title: `${results.apexTriggers.missing} Apex triggers lack documentation`,
        description: 'Triggers without documentation make automation difficult to understand',
        location: 'Apex Triggers',
        impact: 'Code comprehension, debugging difficulty',
        recommendation: 'Add documentation comments explaining trigger purpose and logic',
        effort: 'Medium',
        tool: 'Description Analysis',
        details: results.apexTriggers.items
    });
}

// AI Readiness finding - CRITICAL
if (summary.percentageMissing > 20) {
    findings.unshift({
        id: `DESC-AI`,
        category: 'Documentation',
        severity: 'Critical',
        title: 'Org not ready for AI-assisted development and analysis',
        description: `${summary.percentageMissing}% of metadata lacks descriptions. AI tools (Copilot, Claude, Agentforce, etc.) cannot understand component purposes without descriptions. This severely limits the ability to use AI for code analysis, automated documentation, impact analysis, and intelligent refactoring.`,
        location: 'Organization-wide',
        impact: 'AI tools cannot effectively analyze or assist with this codebase. Automated code reviews, impact analysis, and AI-powered development assistance will produce poor results or fail entirely. Future AI adoption will require significant remediation effort.',
        recommendation: 'Prioritize adding descriptions to all metadata components. Start with: 1) Custom Fields on core objects, 2) All Flows, 3) Apex Classes (ApexDoc), 4) LWC components. This is essential for AI readiness and future-proofing the org.',
        effort: 'High',
        tool: 'Description Analysis',
        aiImpact: true
    });
}

// Overall documentation health finding
if (summary.percentageMissing > 30) {
    findings.unshift({
        id: `DESC-000`,
        category: 'Documentation',
        severity: summary.percentageMissing > 60 ? 'High' : 'Medium',
        title: `${summary.percentageMissing}% of metadata components lack descriptions`,
        description: `${summary.totalMissing} out of ${summary.totalComponents} analyzed components are missing descriptions`,
        location: 'Organization-wide',
        impact: 'Significant knowledge gaps, onboarding challenges, maintenance difficulty',
        recommendation: 'Establish documentation standards and prioritize adding descriptions to critical components',
        effort: 'High',
        tool: 'Description Analysis'
    });
}

// Save results
const dataDir = 'docs/data';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(path.join(dataDir, 'description-analysis.json'), JSON.stringify({
    summary,
    results,
    generatedAt: new Date().toISOString()
}, null, 2));

fs.writeFileSync(path.join(dataDir, 'description-findings.json'), JSON.stringify(findings, null, 2));

// Console output
console.log('\n=== Analysis Results ===\n');
console.log(`Total Components Analyzed: ${summary.totalComponents}`);
console.log(`Components Missing Descriptions: ${summary.totalMissing} (${summary.percentageMissing}%)\n`);

console.log('By Component Type:');
console.log('─'.repeat(50));

Object.entries(summary.byType)
    .sort((a, b) => b[1].missing - a[1].missing)
    .forEach(([type, data]) => {
        const bar = '█'.repeat(Math.round(data.percentage / 5)) + '░'.repeat(20 - Math.round(data.percentage / 5));
        console.log(`${type.padEnd(18)} ${String(data.missing).padStart(4)}/${String(data.total).padStart(4)} ${bar} ${data.percentage}%`);
    });

console.log('\n' + '─'.repeat(50));
console.log(`Findings Generated: ${findings.length}`);
console.log(`\nResults saved to:`);
console.log(`  - ${dataDir}/description-analysis.json`);
console.log(`  - ${dataDir}/description-findings.json`);
