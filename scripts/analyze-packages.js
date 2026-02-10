const { execSync } = require('child_process');
const fs = require('fs');

const targetOrg = process.env.SF_TARGET_ORG || 'TWC Dev';

const packageAnalysis = {
    totalPackages: 0,
    byVendor: {},
    byCategory: {},
    packages: [],
    findings: [],
    recommendations: []
};

// Known package categories and vendors
const packageInfo = {
    // nCino ecosystem
    'nCino': { vendor: 'nCino', category: 'Core Banking', description: 'Core Bank Operating System' },
    'nFORCE': { vendor: 'nCino', category: 'Core Banking', description: 'Force.com Framework' },
    'LLC_BI': { vendor: 'nCino', category: 'Core Banking', description: 'Platform' },
    'nCRED': { vendor: 'nCino', category: 'Credit', description: 'Credit Analysis' },
    'NDOC': { vendor: 'nCino', category: 'Documents', description: 'Document Manager' },
    'nFUSE': { vendor: 'nCino', category: 'Integration', description: 'Integration Platform' },
    'nFORMS': { vendor: 'nCino', category: 'Documents', description: 'Forms' },
    'DOCU': { vendor: 'nCino/DocuSign', category: 'E-Signature', description: 'DocuSign Integration' },
    'SESOC': { vendor: 'nCino', category: 'E-Signature', description: 'Shared E-Signature Objects' },
    'nCinoCB': { vendor: 'nCino', category: 'Cloud Banking', description: 'Cloud Banking SDK' },
    'nDX': { vendor: 'nCino', category: 'Analytics', description: 'Benchmarking & Analytics' },
    'nBIDCA': { vendor: 'nCino', category: 'Analytics', description: 'Business Intelligence' },
    'nBIDC': { vendor: 'nCino', category: 'Analytics', description: 'BI Child' },
    'SCALC': { vendor: 'nCino', category: 'Calculations', description: 'Sherman Calculations' },
    'MTRNS': { vendor: 'nCino', category: 'Integration', description: 'Mapping and Transformation' },
    'EFPIO': { vendor: 'nCino', category: 'Integration', description: 'Event Framework' },
    'DMAdmin': { vendor: 'nCino', category: 'Documents', description: 'Document Manager Admin' },
    'ncinoocr': { vendor: 'nCino', category: 'Automation', description: 'Automated Spreading' },
    'nPUSH': { vendor: 'nCino', category: 'DevOps', description: 'Automatic Upgrades' },
    'nDESIGN': { vendor: 'nCino', category: 'UI', description: 'Layout Designer' },
    'LLC_HI': { vendor: 'nCino', category: 'Banking', description: 'Households' },
    'matrix_manager': { vendor: 'nCino', category: 'Calculations', description: 'Matrix Manager' },

    // Salesforce
    'sf_com_apps': { vendor: 'Salesforce', category: 'Platform', description: 'Connected Apps' },

    // Other common ISV packages
    'CONGA': { vendor: 'Conga', category: 'Documents', description: 'Document Generation' },
    'APXTConga4': { vendor: 'Conga', category: 'Documents', description: 'Conga Composer' },
    'dsfs': { vendor: 'DocuSign', category: 'E-Signature', description: 'DocuSign for Salesforce' },
    'SDOCS': { vendor: 'S-Docs', category: 'Documents', description: 'Document Generation' },
    'Loop': { vendor: 'Nintex', category: 'Documents', description: 'Nintex DocGen' }
};

// Get installed packages via Tooling API
function getInstalledPackages() {
    try {
        const orgInfo = JSON.parse(execSync(`sf org display --target-org "${targetOrg}" --json 2>/dev/null`, { encoding: 'utf8' }));
        const accessToken = orgInfo.result.accessToken;
        const instanceUrl = orgInfo.result.instanceUrl;

        const query = encodeURIComponent("SELECT Id,SubscriberPackage.Name,SubscriberPackage.NamespacePrefix,SubscriberPackageVersion.MajorVersion,SubscriberPackageVersion.MinorVersion,SubscriberPackageVersion.PatchVersion,SubscriberPackageVersion.ReleaseState FROM InstalledSubscriberPackage ORDER BY SubscriberPackage.Name");
        const curlCmd = `curl -s -H "Authorization: Bearer ${accessToken}" "${instanceUrl}/services/data/v59.0/tooling/query/?q=${query}"`;
        const result = execSync(curlCmd, { encoding: 'utf8' });
        return JSON.parse(result);
    } catch (e) {
        console.error(`Failed to get packages: ${e.message}`);
        return { records: [] };
    }
}

// Analyze packages
console.log('=== Installed Packages Analysis ===\n');

const packagesData = getInstalledPackages();
packageAnalysis.totalPackages = packagesData.totalSize || 0;

console.log(`Total Packages: ${packageAnalysis.totalPackages}\n`);

packagesData.records?.forEach(pkg => {
    const namespace = pkg.SubscriberPackage?.NamespacePrefix || 'unmanaged';
    const name = pkg.SubscriberPackage?.Name || 'Unknown';
    const version = `${pkg.SubscriberPackageVersion?.MajorVersion || 0}.${pkg.SubscriberPackageVersion?.MinorVersion || 0}.${pkg.SubscriberPackageVersion?.PatchVersion || 0}`;
    const releaseState = pkg.SubscriberPackageVersion?.ReleaseState || 'Unknown';

    const info = packageInfo[namespace] || { vendor: 'Unknown', category: 'Other', description: name };

    const packageEntry = {
        name: name,
        namespace: namespace,
        version: version,
        releaseState: releaseState,
        vendor: info.vendor,
        category: info.category,
        description: info.description
    };

    packageAnalysis.packages.push(packageEntry);

    // Count by vendor
    packageAnalysis.byVendor[info.vendor] = (packageAnalysis.byVendor[info.vendor] || 0) + 1;

    // Count by category
    packageAnalysis.byCategory[info.category] = (packageAnalysis.byCategory[info.category] || 0) + 1;
});

// Output by vendor
console.log('--- By Vendor ---');
Object.entries(packageAnalysis.byVendor)
    .sort((a, b) => b[1] - a[1])
    .forEach(([vendor, count]) => {
        console.log(`  ${vendor}: ${count}`);
    });

// Output by category
console.log('\n--- By Category ---');
Object.entries(packageAnalysis.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
    });

// List all packages
console.log('\n--- Package Details ---');
packageAnalysis.packages.forEach(pkg => {
    console.log(`  ${pkg.name}`);
    console.log(`    Namespace: ${pkg.namespace}, Version: ${pkg.version}`);
    console.log(`    Vendor: ${pkg.vendor}, Category: ${pkg.category}`);
});

// Generate findings
let findingId = 1;

// Check for outdated packages (major version < current year - 2)
const currentYear = new Date().getFullYear();
const outdatedPackages = packageAnalysis.packages.filter(pkg => {
    const majorVersion = parseInt(pkg.version.split('.')[0]);
    return majorVersion > 0 && majorVersion < 1;  // Most SF packages don't use year versioning
});

// Check for beta/pilot packages
const betaPackages = packageAnalysis.packages.filter(pkg =>
    pkg.releaseState === 'Beta' || pkg.releaseState === 'Pilot'
);

if (betaPackages.length > 0) {
    packageAnalysis.findings.push({
        id: `PKG-${String(findingId++).padStart(3, '0')}`,
        category: 'Packages',
        severity: 'Medium',
        title: `${betaPackages.length} packages in Beta/Pilot state`,
        description: `Packages in non-released state: ${betaPackages.map(p => p.name).join(', ')}`,
        location: 'Installed Packages',
        impact: 'Beta packages may have stability issues or breaking changes',
        recommendation: 'Monitor for GA releases and plan upgrades',
        effort: 'Low',
        tool: 'Package Analysis'
    });
}

// Check for multiple vendors (complexity indicator)
const vendorCount = Object.keys(packageAnalysis.byVendor).length;
if (vendorCount > 5) {
    packageAnalysis.findings.push({
        id: `PKG-${String(findingId++).padStart(3, '0')}`,
        category: 'Packages',
        severity: 'Info',
        title: `${vendorCount} different package vendors installed`,
        description: 'Multiple ISV vendors increase integration complexity',
        location: 'Installed Packages',
        impact: 'Higher maintenance overhead and potential conflicts',
        recommendation: 'Document vendor relationships and support contracts',
        effort: 'Low',
        tool: 'Package Analysis'
    });
}

// Generate recommendations
if (packageAnalysis.byVendor['nCino'] > 0) {
    packageAnalysis.recommendations.push('nCino ecosystem detected - ensure versions are compatible with each other');
    packageAnalysis.recommendations.push('Review nCino release notes for upgrade planning');
}

if (packageAnalysis.byCategory['E-Signature'] > 0) {
    packageAnalysis.recommendations.push('E-Signature packages found - verify compliance with document retention policies');
}

if (packageAnalysis.byCategory['Integration'] > 0) {
    packageAnalysis.recommendations.push('Integration packages found - document external system dependencies');
}

// Output findings
console.log(`\n--- Findings: ${packageAnalysis.findings.length} ---`);
packageAnalysis.findings.forEach(f => {
    console.log(`  [${f.severity}] ${f.title}`);
});

console.log('\n--- Recommendations ---');
packageAnalysis.recommendations.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r}`);
});

// Save results
fs.writeFileSync('docs/data/package-analysis.json', JSON.stringify(packageAnalysis, null, 2));
fs.writeFileSync('docs/data/package-findings.json', JSON.stringify(packageAnalysis.findings, null, 2));

console.log('\nResults saved to docs/data/package-analysis.json');
