const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Layout & FlexiPage Analysis ===\n');

const layoutsDir = 'force-app/main/default/layouts';
const flexipagesDir = 'force-app/main/default/flexipages';

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

function parseXmlAttribute(xml, tag, attr) {
    const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'g');
    const matches = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
        matches.push(match[1]);
    }
    return matches;
}

// Analyze Layouts
console.log('Analyzing Layouts...');
const layouts = [];
const layoutFiles = fs.existsSync(layoutsDir)
    ? fs.readdirSync(layoutsDir).filter(f => f.endsWith('.layout-meta.xml'))
    : [];

layoutFiles.forEach(file => {
    const content = fs.readFileSync(path.join(layoutsDir, file), 'utf8');
    const name = file.replace('.layout-meta.xml', '');
    const objectName = name.split('-')[0];

    // Count sections
    const sections = (content.match(/<layoutSections>/g) || []).length;

    // Count fields in layout
    const fields = parseXmlValue(content, 'field');

    // Check for related lists
    const relatedLists = (content.match(/<relatedLists>/g) || []).length;

    // Check for custom buttons
    const customButtons = parseXmlValue(content, 'customButtons');

    // Check for mobile cards
    const mobileCards = (content.match(/<platformActionList>/g) || []).length;

    // Check namespace (managed package)
    const isManaged = objectName.includes('__') && !objectName.endsWith('__c') && !objectName.endsWith('__mdt');
    const namespace = isManaged ? objectName.split('__')[0] : null;

    layouts.push({
        name,
        objectName,
        sections,
        fieldCount: fields.length,
        relatedLists,
        customButtons: customButtons.length,
        hasMobileConfig: mobileCards > 0,
        isManaged,
        namespace
    });
});

// Analyze FlexiPages
console.log('Analyzing FlexiPages...');
const flexipages = [];
const flexipageFiles = fs.existsSync(flexipagesDir)
    ? fs.readdirSync(flexipagesDir).filter(f => f.endsWith('.flexipage-meta.xml'))
    : [];

flexipageFiles.forEach(file => {
    const content = fs.readFileSync(path.join(flexipagesDir, file), 'utf8');
    const name = file.replace('.flexipage-meta.xml', '');

    // Get page type
    const typeMatch = content.match(/<type>([^<]+)<\/type>/);
    const pageType = typeMatch ? typeMatch[1] : 'Unknown';

    // Get master label
    const labelMatch = content.match(/<masterLabel>([^<]+)<\/masterLabel>/);
    const label = labelMatch ? labelMatch[1] : name;

    // Count components
    const components = (content.match(/<componentInstance>/g) || []).length;

    // Get component names
    const componentNames = parseXmlValue(content, 'componentName');

    // Check for custom vs standard components
    const customComponents = componentNames.filter(c => c.includes(':') || c.includes('__'));
    const standardComponents = componentNames.filter(c => !c.includes(':') && !c.includes('__'));

    // Check for LWC usage
    const lwcComponents = componentNames.filter(c => c.startsWith('c__') || c.includes(':c_'));

    // Check for Aura usage
    const auraComponents = componentNames.filter(c => c.includes(':') && !c.startsWith('c__'));

    // Check regions/tabs
    const regions = (content.match(/<flexiPageRegions>/g) || []).length;

    // Sobject type for record pages
    const sobjectMatch = content.match(/<sobjectType>([^<]+)<\/sobjectType>/);
    const sobjectType = sobjectMatch ? sobjectMatch[1] : null;

    flexipages.push({
        name,
        label,
        type: pageType,
        sobjectType,
        componentCount: components,
        regions,
        customComponents: customComponents.length,
        standardComponents: standardComponents.length,
        lwcCount: lwcComponents.length,
        auraCount: auraComponents.length,
        components: componentNames.slice(0, 10) // First 10 for reference
    });
});

// Analysis Summary
const analysis = {
    layouts: {
        total: layouts.length,
        byObject: layouts.reduce((acc, l) => {
            acc[l.objectName] = (acc[l.objectName] || 0) + 1;
            return acc;
        }, {}),
        managed: layouts.filter(l => l.isManaged).length,
        custom: layouts.filter(l => !l.isManaged).length,
        avgFieldsPerLayout: (layouts.reduce((sum, l) => sum + l.fieldCount, 0) / layouts.length).toFixed(1),
        layoutsWithManyFields: layouts.filter(l => l.fieldCount > 50).map(l => ({
            name: l.name,
            fields: l.fieldCount
        })),
        byNamespace: layouts.filter(l => l.namespace).reduce((acc, l) => {
            acc[l.namespace] = (acc[l.namespace] || 0) + 1;
            return acc;
        }, {})
    },
    flexipages: {
        total: flexipages.length,
        byType: flexipages.reduce((acc, f) => {
            acc[f.type] = (acc[f.type] || 0) + 1;
            return acc;
        }, {}),
        avgComponentsPerPage: (flexipages.reduce((sum, f) => sum + f.componentCount, 0) / flexipages.length).toFixed(1),
        totalLwcUsage: flexipages.reduce((sum, f) => sum + f.lwcCount, 0),
        totalAuraUsage: flexipages.reduce((sum, f) => sum + f.auraCount, 0),
        complexPages: flexipages.filter(f => f.componentCount > 15).map(f => ({
            name: f.name,
            components: f.componentCount,
            type: f.type
        })),
        recordPages: flexipages.filter(f => f.type === 'RecordPage').length,
        homePages: flexipages.filter(f => f.type === 'HomePage').length,
        appPages: flexipages.filter(f => f.type === 'AppPage').length,
        utilityBar: flexipages.filter(f => f.type === 'UtilityBar').length
    },
    details: {
        layouts: layouts.sort((a, b) => b.fieldCount - a.fieldCount).slice(0, 30),
        flexipages: flexipages.sort((a, b) => b.componentCount - a.componentCount).slice(0, 30)
    }
};

// Generate findings
const findings = [];

// Complex FlexiPages
analysis.flexipages.complexPages.forEach(page => {
    if (page.components > 20) {
        findings.push({
            id: `FLX-001-${page.name}`,
            title: `FlexiPage "${page.name}" has ${page.components} components`,
            severity: page.components > 30 ? 'High' : 'Medium',
            category: 'UI Performance',
            description: `Complex Lightning pages with many components can impact load time`,
            location: `force-app/main/default/flexipages/${page.name}.flexipage-meta.xml`,
            impact: 'Slower page load times, poor user experience',
            recommendation: 'Consider splitting into tabs or removing unused components',
            effort: 'Medium',
            tool: 'Layout Analysis'
        });
    }
});

// Layouts with too many fields
analysis.layouts.layoutsWithManyFields.forEach(layout => {
    if (layout.fields > 75) {
        findings.push({
            id: `LAY-001-${layout.name}`,
            title: `Layout "${layout.name}" has ${layout.fields} fields`,
            severity: layout.fields > 100 ? 'High' : 'Medium',
            category: 'UI Performance',
            description: `Layouts with many fields slow down page rendering`,
            location: `force-app/main/default/layouts/${layout.name}.layout-meta.xml`,
            impact: 'Slower page load, difficult to navigate',
            recommendation: 'Use page layouts sections, tabs, or multiple record types',
            effort: 'Medium',
            tool: 'Layout Analysis'
        });
    }
});

// Check Aura vs LWC ratio
const auraRatio = analysis.flexipages.totalAuraUsage /
    (analysis.flexipages.totalLwcUsage + analysis.flexipages.totalAuraUsage + 1);
if (auraRatio > 0.7 && analysis.flexipages.totalAuraUsage > 10) {
    findings.push({
        id: 'FLX-002',
        title: `High Aura component usage (${(auraRatio * 100).toFixed(0)}% of components)`,
        severity: 'Medium',
        category: 'Technical Debt',
        description: `${analysis.flexipages.totalAuraUsage} Aura vs ${analysis.flexipages.totalLwcUsage} LWC components`,
        impact: 'Aura is being deprecated, LWC offers better performance',
        recommendation: 'Plan migration from Aura to LWC for custom components',
        effort: 'High',
        tool: 'Layout Analysis'
    });
}

// Save results
fs.writeFileSync('docs/data/layout-analysis.json', JSON.stringify(analysis, null, 2));
fs.writeFileSync('docs/data/layout-findings.json', JSON.stringify(findings, null, 2));

console.log(`\nAnalysis complete:`);
console.log(`  Layouts: ${analysis.layouts.total} (${analysis.layouts.custom} custom, ${analysis.layouts.managed} managed)`);
console.log(`  FlexiPages: ${analysis.flexipages.total}`);
console.log(`    - Record Pages: ${analysis.flexipages.recordPages}`);
console.log(`    - Home Pages: ${analysis.flexipages.homePages}`);
console.log(`    - App Pages: ${analysis.flexipages.appPages}`);
console.log(`  LWC Usage: ${analysis.flexipages.totalLwcUsage}`);
console.log(`  Aura Usage: ${analysis.flexipages.totalAuraUsage}`);
console.log(`  Findings: ${findings.length}`);
console.log(`\nSaved to docs/data/layout-analysis.json`);
