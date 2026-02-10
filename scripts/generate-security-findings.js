const fs = require('fs');

const findings = [];
let findingId = 1;

// Load data files
let highPrivilegeProfiles = { result: { records: [] } };
let highPrivilegePermSets = { result: { records: [] } };
let namedCredentials = { result: { records: [] } };
let orgLimits = {};

try {
    highPrivilegeProfiles = JSON.parse(fs.readFileSync('docs/data/high-privilege-profiles.json', 'utf8'));
} catch(e) {}

try {
    highPrivilegePermSets = JSON.parse(fs.readFileSync('docs/data/high-privilege-permission-sets.json', 'utf8'));
} catch(e) {}

try {
    namedCredentials = JSON.parse(fs.readFileSync('docs/data/named-credentials.json', 'utf8'));
} catch(e) {}

try {
    orgLimits = JSON.parse(fs.readFileSync('docs/data/org-limits-api.json', 'utf8'));
} catch(e) {}

// Security Analysis
const securitySummary = {
    highPrivilegeProfiles: highPrivilegeProfiles.result?.records?.length || 0,
    highPrivilegePermSets: highPrivilegePermSets.result?.records?.length || 0,
    namedCredentials: namedCredentials.result?.records?.length || 0,
    findings: []
};

// Check for high-privilege profile usage
if (securitySummary.highPrivilegeProfiles > 5) {
    findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'High',
        title: `${securitySummary.highPrivilegeProfiles} profiles with elevated privileges`,
        description: 'Multiple profiles have ModifyAllData, ViewAllData, or ManageUsers permissions',
        location: 'Profile Configuration',
        impact: 'Potential security risk with excessive privileged access',
        recommendation: 'Review profile permissions and apply principle of least privilege',
        effort: 'Medium',
        tool: 'Security Analysis'
    });
}

// Check for high-privilege permission sets
if (securitySummary.highPrivilegePermSets > 0) {
    findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'Medium',
        title: `${securitySummary.highPrivilegePermSets} permission sets with elevated privileges`,
        description: 'Permission sets have ModifyAllData, ViewAllData, or ManageUsers permissions',
        location: 'Permission Set Configuration',
        impact: 'Users assigned these permission sets have elevated access',
        recommendation: 'Review assignments and ensure only authorized users have these permissions',
        effort: 'Medium',
        tool: 'Security Analysis'
    });
}

// Check org limits for storage
if (orgLimits.DataStorageMB) {
    const used = orgLimits.DataStorageMB.Max - orgLimits.DataStorageMB.Remaining;
    const percentage = (used / orgLimits.DataStorageMB.Max * 100).toFixed(1);

    if (percentage > 80) {
        findings.push({
            id: `SEC-${String(findingId++).padStart(3, '0')}`,
            category: 'Limits',
            severity: percentage > 90 ? 'Critical' : 'High',
            title: `Data Storage at ${percentage}% capacity`,
            description: `Using ${used}MB of ${orgLimits.DataStorageMB.Max}MB data storage`,
            location: 'Org Limits',
            impact: 'Operations may fail when storage limit is reached',
            recommendation: 'Implement data archiving strategy or increase storage allocation',
            effort: 'High',
            tool: 'Org Limits API'
        });
    }

    securitySummary.dataStorageUsed = used;
    securitySummary.dataStorageMax = orgLimits.DataStorageMB.Max;
    securitySummary.dataStoragePercentage = percentage;
}

if (orgLimits.FileStorageMB) {
    const used = orgLimits.FileStorageMB.Max - orgLimits.FileStorageMB.Remaining;
    const percentage = (used / orgLimits.FileStorageMB.Max * 100).toFixed(1);

    if (percentage > 80) {
        findings.push({
            id: `SEC-${String(findingId++).padStart(3, '0')}`,
            category: 'Limits',
            severity: percentage > 90 ? 'Critical' : 'High',
            title: `File Storage at ${percentage}% capacity`,
            description: `Using ${used}MB of ${orgLimits.FileStorageMB.Max}MB file storage`,
            location: 'Org Limits',
            impact: 'File uploads may fail when storage limit is reached',
            recommendation: 'Archive old files or increase storage allocation',
            effort: 'High',
            tool: 'Org Limits API'
        });
    }

    securitySummary.fileStorageUsed = used;
    securitySummary.fileStorageMax = orgLimits.FileStorageMB.Max;
    securitySummary.fileStoragePercentage = percentage;
}

// Check for named credentials usage
if (securitySummary.namedCredentials < 3) {
    findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'Medium',
        title: 'Limited use of Named Credentials',
        description: `Only ${securitySummary.namedCredentials} Named Credentials configured`,
        location: 'Named Credentials',
        impact: 'Integrations may use hardcoded credentials or insecure authentication',
        recommendation: 'Review integrations and migrate to Named Credentials for credential management',
        effort: 'Medium',
        tool: 'Security Analysis'
    });
}

// Output summary
console.log('=== Security Analysis Summary ===\n');
console.log(`High Privilege Profiles: ${securitySummary.highPrivilegeProfiles}`);
console.log(`High Privilege Permission Sets: ${securitySummary.highPrivilegePermSets}`);
console.log(`Named Credentials: ${securitySummary.namedCredentials}`);

if (securitySummary.dataStoragePercentage) {
    console.log(`\nData Storage: ${securitySummary.dataStorageUsed}MB / ${securitySummary.dataStorageMax}MB (${securitySummary.dataStoragePercentage}%)`);
}
if (securitySummary.fileStoragePercentage) {
    console.log(`File Storage: ${securitySummary.fileStorageUsed}MB / ${securitySummary.fileStorageMax}MB (${securitySummary.fileStoragePercentage}%)`);
}

console.log(`\nGenerated ${findings.length} Security findings`);

// Save results
fs.writeFileSync('docs/data/security-findings.json', JSON.stringify(findings, null, 2));
fs.writeFileSync('docs/data/security-summary.json', JSON.stringify(securitySummary, null, 2));
