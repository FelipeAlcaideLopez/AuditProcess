const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Object, Field & Metadata Analysis ===\n');

const objectsDir = 'force-app/main/default/objects';

// Parse XML helper
function parseXmlValue(xml, tag) {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g');
    const matches = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
        matches.push(match[1]);
    }
    return matches;
}

function countFiles(dir, extension) {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter(f => f.endsWith(extension)).length;
}

function getFiles(dir, extension) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith(extension));
}

// Analyze each object
console.log('Analyzing Objects...');
const objects = [];
const allRecordTypes = [];
const allValidationRules = [];
const allFields = [];

const objectDirs = fs.existsSync(objectsDir)
    ? fs.readdirSync(objectsDir).filter(d => fs.statSync(path.join(objectsDir, d)).isDirectory())
    : [];

objectDirs.forEach(objName => {
    const objPath = path.join(objectsDir, objName);

    // Count metadata types
    const fieldsDir = path.join(objPath, 'fields');
    const recordTypesDir = path.join(objPath, 'recordTypes');
    const validationRulesDir = path.join(objPath, 'validationRules');
    const listViewsDir = path.join(objPath, 'listViews');
    const webLinksDir = path.join(objPath, 'webLinks');

    const fieldCount = countFiles(fieldsDir, '.field-meta.xml');
    const recordTypeCount = countFiles(recordTypesDir, '.recordType-meta.xml');
    const validationRuleCount = countFiles(validationRulesDir, '.validationRule-meta.xml');
    const listViewCount = countFiles(listViewsDir, '.listView-meta.xml');
    const webLinkCount = countFiles(webLinksDir, '.webLink-meta.xml');

    // Analyze Fields
    const fieldFiles = getFiles(fieldsDir, '.field-meta.xml');
    const fields = fieldFiles.map(f => {
        const content = fs.readFileSync(path.join(fieldsDir, f), 'utf8');
        const fieldName = f.replace('.field-meta.xml', '');

        const typeMatch = content.match(/<type>([^<]+)<\/type>/);
        const type = typeMatch ? typeMatch[1] : 'Unknown';

        const requiredMatch = content.match(/<required>([^<]+)<\/required>/);
        const required = requiredMatch ? requiredMatch[1] === 'true' : false;

        const externalIdMatch = content.match(/<externalId>([^<]+)<\/externalId>/);
        const externalId = externalIdMatch ? externalIdMatch[1] === 'true' : false;

        const uniqueMatch = content.match(/<unique>([^<]+)<\/unique>/);
        const unique = uniqueMatch ? uniqueMatch[1] === 'true' : false;

        const formulaMatch = content.match(/<formula>/);
        const isFormula = !!formulaMatch;

        const trackHistoryMatch = content.match(/<trackHistory>([^<]+)<\/trackHistory>/);
        const trackHistory = trackHistoryMatch ? trackHistoryMatch[1] === 'true' : false;

        return {
            object: objName,
            name: fieldName,
            type,
            required,
            externalId,
            unique,
            isFormula,
            trackHistory
        };
    });
    allFields.push(...fields);

    // Analyze Record Types
    const rtFiles = getFiles(recordTypesDir, '.recordType-meta.xml');
    const recordTypes = rtFiles.map(f => {
        const content = fs.readFileSync(path.join(recordTypesDir, f), 'utf8');
        const rtName = f.replace('.recordType-meta.xml', '');

        const activeMatch = content.match(/<active>([^<]+)<\/active>/);
        const active = activeMatch ? activeMatch[1] === 'true' : true;

        const labelMatch = content.match(/<label>([^<]+)<\/label>/);
        const label = labelMatch ? labelMatch[1] : rtName;

        return {
            object: objName,
            name: rtName,
            label,
            active
        };
    });
    allRecordTypes.push(...recordTypes);

    // Analyze Validation Rules
    const vrFiles = getFiles(validationRulesDir, '.validationRule-meta.xml');
    const validationRules = vrFiles.map(f => {
        const content = fs.readFileSync(path.join(validationRulesDir, f), 'utf8');
        const vrName = f.replace('.validationRule-meta.xml', '');

        const activeMatch = content.match(/<active>([^<]+)<\/active>/);
        const active = activeMatch ? activeMatch[1] === 'true' : true;

        const formulaMatch = content.match(/<errorConditionFormula>([\s\S]*?)<\/errorConditionFormula>/);
        const formula = formulaMatch ? formulaMatch[1] : '';

        const messageMatch = content.match(/<errorMessage>([^<]+)<\/errorMessage>/);
        const message = messageMatch ? messageMatch[1] : '';

        // Check formula complexity
        const andCount = (formula.match(/AND\(/gi) || []).length;
        const orCount = (formula.match(/OR\(/gi) || []).length;
        const complexity = andCount + orCount;

        return {
            object: objName,
            name: vrName,
            active,
            formulaLength: formula.length,
            complexity,
            message: message.substring(0, 100)
        };
    });
    allValidationRules.push(...validationRules);

    // Check if managed package object
    const isManaged = objName.includes('__') && objName.split('__')[0].length > 0 &&
                      !objName.endsWith('__c') && !objName.endsWith('__mdt');
    const namespace = isManaged ? objName.split('__')[0] : null;

    objects.push({
        name: objName,
        isCustom: objName.endsWith('__c'),
        isCustomMetadata: objName.endsWith('__mdt'),
        isManaged,
        namespace,
        fields: fieldCount,
        recordTypes: recordTypeCount,
        validationRules: validationRuleCount,
        listViews: listViewCount,
        webLinks: webLinkCount
    });
});

// Salesforce Limits (Enterprise Edition defaults)
const LIMITS = {
    customFieldsPerObject: 500,
    rollupSummaryPerObject: 25,
    lookupPerObject: 40,
    masterDetailPerObject: 2,
    recordTypesPerObject: 200,
    validationRulesPerObject: 500,
    customObjectsOrg: 200,
    customFieldsOrg: 2000 // Practical limit warning
};

// Analyze limits per object
const limitsAnalysis = {
    objectsNearFieldLimit: [],
    objectsNearRollupLimit: [],
    objectsNearLookupLimit: [],
    orgFieldCount: allFields.length,
    orgCustomObjects: objects.filter(o => o.isCustom).length
};

objects.forEach(obj => {
    const objFields = allFields.filter(f => f.object === obj.name);
    const rollupCount = objFields.filter(f => f.type === 'Summary').length;
    const lookupCount = objFields.filter(f => f.type === 'Lookup' || f.type === 'MasterDetail').length;
    const masterDetailCount = objFields.filter(f => f.type === 'MasterDetail').length;

    // Store counts in object
    obj.rollupCount = rollupCount;
    obj.lookupCount = lookupCount;
    obj.masterDetailCount = masterDetailCount;

    // Check limits
    const fieldUsage = (obj.fields / LIMITS.customFieldsPerObject) * 100;
    const rollupUsage = (rollupCount / LIMITS.rollupSummaryPerObject) * 100;
    const lookupUsage = (lookupCount / LIMITS.lookupPerObject) * 100;

    if (fieldUsage > 50) {
        limitsAnalysis.objectsNearFieldLimit.push({
            name: obj.name,
            fields: obj.fields,
            limit: LIMITS.customFieldsPerObject,
            usage: Math.round(fieldUsage)
        });
    }

    if (rollupUsage > 50) {
        limitsAnalysis.objectsNearRollupLimit.push({
            name: obj.name,
            rollups: rollupCount,
            limit: LIMITS.rollupSummaryPerObject,
            usage: Math.round(rollupUsage)
        });
    }

    if (lookupUsage > 50) {
        limitsAnalysis.objectsNearLookupLimit.push({
            name: obj.name,
            lookups: lookupCount,
            limit: LIMITS.lookupPerObject,
            usage: Math.round(lookupUsage)
        });
    }
});

// Sort by usage
limitsAnalysis.objectsNearFieldLimit.sort((a, b) => b.usage - a.usage);
limitsAnalysis.objectsNearRollupLimit.sort((a, b) => b.usage - a.usage);
limitsAnalysis.objectsNearLookupLimit.sort((a, b) => b.usage - a.usage);

// Build analysis
const analysis = {
    summary: {
        totalObjects: objects.length,
        customObjects: objects.filter(o => o.isCustom).length,
        customMetadata: objects.filter(o => o.isCustomMetadata).length,
        managedObjects: objects.filter(o => o.isManaged).length,
        totalFields: allFields.length,
        totalRecordTypes: allRecordTypes.length,
        totalValidationRules: allValidationRules.length
    },
    limits: {
        config: LIMITS,
        objectsNearFieldLimit: limitsAnalysis.objectsNearFieldLimit,
        objectsNearRollupLimit: limitsAnalysis.objectsNearRollupLimit,
        objectsNearLookupLimit: limitsAnalysis.objectsNearLookupLimit,
        orgFieldUsage: Math.round((allFields.length / LIMITS.customFieldsOrg) * 100),
        orgObjectUsage: Math.round((objects.filter(o => o.isCustom).length / LIMITS.customObjectsOrg) * 100)
    },
    objects: objects.sort((a, b) => b.fields - a.fields),
    byNamespace: objects.filter(o => o.namespace).reduce((acc, o) => {
        acc[o.namespace] = (acc[o.namespace] || 0) + 1;
        return acc;
    }, {}),
    fieldAnalysis: {
        byType: allFields.reduce((acc, f) => {
            acc[f.type] = (acc[f.type] || 0) + 1;
            return acc;
        }, {}),
        formulaFields: allFields.filter(f => f.isFormula).length,
        requiredFields: allFields.filter(f => f.required).length,
        externalIdFields: allFields.filter(f => f.externalId).length,
        historyTrackedFields: allFields.filter(f => f.trackHistory).length,
        objectsWithMostFields: objects
            .filter(o => o.fields > 30)
            .sort((a, b) => b.fields - a.fields)
            .slice(0, 15)
    },
    recordTypes: {
        total: allRecordTypes.length,
        active: allRecordTypes.filter(rt => rt.active).length,
        inactive: allRecordTypes.filter(rt => !rt.active).length,
        byObject: allRecordTypes.reduce((acc, rt) => {
            acc[rt.object] = (acc[rt.object] || 0) + 1;
            return acc;
        }, {}),
        details: allRecordTypes
    },
    validationRules: {
        total: allValidationRules.length,
        active: allValidationRules.filter(vr => vr.active).length,
        inactive: allValidationRules.filter(vr => !vr.active).length,
        complex: allValidationRules.filter(vr => vr.complexity > 5 || vr.formulaLength > 500),
        byObject: allValidationRules.reduce((acc, vr) => {
            acc[vr.object] = (acc[vr.object] || 0) + 1;
            return acc;
        }, {}),
        details: allValidationRules
    }
};

// Generate findings
const findings = [];

// Objects with too many fields
analysis.fieldAnalysis.objectsWithMostFields.forEach(obj => {
    if (obj.fields > 100) {
        findings.push({
            id: `OBJ-001-${obj.name}`,
            title: `Object ${obj.name} has ${obj.fields} custom fields`,
            severity: obj.fields > 200 ? 'High' : 'Medium',
            category: 'Design',
            description: 'High field count impacts performance and maintainability',
            location: `force-app/main/default/objects/${obj.name}`,
            impact: 'Query performance, UI complexity, approaching limits',
            recommendation: 'Consider object decomposition or field consolidation',
            effort: 'High',
            tool: 'Object Analysis'
        });
    }
});

// Inactive Record Types
if (analysis.recordTypes.inactive > 5) {
    findings.push({
        id: 'RT-001',
        title: `${analysis.recordTypes.inactive} inactive Record Types found`,
        severity: 'Low',
        category: 'Governance',
        description: 'Inactive record types may be unused and can be removed',
        impact: 'Unnecessary metadata, confusion in admin',
        recommendation: 'Review and delete truly unused record types',
        effort: 'Low',
        tool: 'Object Analysis'
    });
}

// Inactive Validation Rules
const inactiveVRs = allValidationRules.filter(vr => !vr.active);
if (inactiveVRs.length > 10) {
    findings.push({
        id: 'VR-001',
        title: `${inactiveVRs.length} inactive Validation Rules found`,
        severity: 'Low',
        category: 'Governance',
        description: 'Inactive validation rules should be reviewed',
        impact: 'Technical debt, confusion',
        recommendation: 'Delete or reactivate based on business need',
        effort: 'Low',
        tool: 'Object Analysis'
    });
}

// Complex Validation Rules
analysis.validationRules.complex.forEach(vr => {
    if (vr.complexity > 10 || vr.formulaLength > 1000) {
        findings.push({
            id: `VR-002-${vr.object}-${vr.name}`,
            title: `Complex validation rule: ${vr.name} on ${vr.object}`,
            severity: 'Medium',
            category: 'Code Quality',
            description: `Formula length: ${vr.formulaLength}, AND/OR count: ${vr.complexity}`,
            location: `force-app/main/default/objects/${vr.object}/validationRules/${vr.name}.validationRule-meta.xml`,
            impact: 'Hard to maintain, potential performance impact',
            recommendation: 'Consider simplifying or moving logic to trigger',
            effort: 'Medium',
            tool: 'Object Analysis'
        });
    }
});

// Objects with many Record Types
Object.entries(analysis.recordTypes.byObject).forEach(([obj, count]) => {
    if (count > 10) {
        findings.push({
            id: `RT-002-${obj}`,
            title: `Object ${obj} has ${count} record types`,
            severity: 'Medium',
            category: 'Design',
            description: 'Too many record types can indicate design issues',
            impact: 'Complex page layouts, user confusion',
            recommendation: 'Review if all record types are necessary',
            effort: 'Medium',
            tool: 'Object Analysis'
        });
    }
});

// LIMITS FINDINGS

// Objects near field limit
limitsAnalysis.objectsNearFieldLimit.forEach(obj => {
    if (obj.usage >= 80) {
        findings.push({
            id: `LIMIT-FIELD-${obj.name}`,
            title: `${obj.name}: ${obj.usage}% of field limit used`,
            severity: obj.usage >= 90 ? 'Critical' : 'High',
            category: 'Limits',
            description: `Object has ${obj.fields}/${obj.limit} custom fields`,
            location: `Object: ${obj.name}`,
            impact: 'Cannot add new fields, may block future development',
            recommendation: 'Archive unused fields, consider object decomposition',
            effort: 'High',
            tool: 'Limits Analysis'
        });
    } else if (obj.usage >= 50) {
        findings.push({
            id: `LIMIT-FIELD-${obj.name}`,
            title: `${obj.name}: ${obj.usage}% of field limit used`,
            severity: 'Medium',
            category: 'Limits',
            description: `Object has ${obj.fields}/${obj.limit} custom fields`,
            location: `Object: ${obj.name}`,
            impact: 'Monitor field growth, plan field governance',
            recommendation: 'Review unused fields, establish field naming standards',
            effort: 'Medium',
            tool: 'Limits Analysis'
        });
    }
});

// Objects near rollup summary limit
limitsAnalysis.objectsNearRollupLimit.forEach(obj => {
    if (obj.usage >= 80) {
        findings.push({
            id: `LIMIT-ROLLUP-${obj.name}`,
            title: `${obj.name}: ${obj.usage}% of rollup summary limit used`,
            severity: obj.usage >= 90 ? 'Critical' : 'High',
            category: 'Limits',
            description: `Object has ${obj.rollups}/${obj.limit} rollup summary fields`,
            location: `Object: ${obj.name}`,
            impact: 'Cannot add new rollups, may block reporting requirements',
            recommendation: 'Use DLRS or Flow for additional rollups, review necessity of existing',
            effort: 'Medium',
            tool: 'Limits Analysis'
        });
    } else if (obj.usage >= 50) {
        findings.push({
            id: `LIMIT-ROLLUP-${obj.name}`,
            title: `${obj.name}: ${obj.usage}% of rollup summary limit used`,
            severity: 'Medium',
            category: 'Limits',
            description: `Object has ${obj.rollups}/${obj.limit} rollup summary fields`,
            location: `Object: ${obj.name}`,
            impact: 'Limited capacity for future rollups',
            recommendation: 'Consider Flow or DLRS for new rollup requirements',
            effort: 'Low',
            tool: 'Limits Analysis'
        });
    }
});

// Objects near lookup limit
limitsAnalysis.objectsNearLookupLimit.forEach(obj => {
    if (obj.usage >= 80) {
        findings.push({
            id: `LIMIT-LOOKUP-${obj.name}`,
            title: `${obj.name}: ${obj.usage}% of relationship limit used`,
            severity: 'High',
            category: 'Limits',
            description: `Object has ${obj.lookups}/${obj.limit} lookup/master-detail relationships`,
            location: `Object: ${obj.name}`,
            impact: 'Cannot add new relationships',
            recommendation: 'Review data model, consider junction objects',
            effort: 'High',
            tool: 'Limits Analysis'
        });
    }
});

// Save results
fs.writeFileSync('docs/data/object-analysis.json', JSON.stringify(analysis, null, 2));
fs.writeFileSync('docs/data/object-findings.json', JSON.stringify(findings, null, 2));

console.log(`\nAnalysis complete:`);
console.log(`  Objects: ${analysis.summary.totalObjects}`);
console.log(`    - Custom: ${analysis.summary.customObjects}`);
console.log(`    - Custom Metadata: ${analysis.summary.customMetadata}`);
console.log(`  Fields: ${analysis.summary.totalFields}`);
console.log(`    - Formula: ${analysis.fieldAnalysis.formulaFields}`);
console.log(`    - Required: ${analysis.fieldAnalysis.requiredFields}`);
console.log(`  Record Types: ${analysis.summary.totalRecordTypes} (${analysis.recordTypes.active} active)`);
console.log(`  Validation Rules: ${analysis.summary.totalValidationRules} (${analysis.validationRules.active} active)`);
console.log(`  Findings: ${findings.length}`);
console.log(`\nSaved to docs/data/object-analysis.json`);
