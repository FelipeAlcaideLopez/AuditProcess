const { execSync } = require('child_process');
const fs = require('fs');

const targetOrg = 'TWC Dev';

const securityAnalysis = {
    highPrivilegeProfiles: [],
    highPrivilegePermSets: [],
    namedCredentials: [],
    connectedApps: [],
    activeUsers: 0,
    findings: []
};

let findingId = 1;

// Execute SOQL query and return results
function runQuery(query) {
    try {
        const cmd = `sf data query --query "${query}" --target-org "${targetOrg}" --json`;
        const result = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
        const json = JSON.parse(result);
        return json.result?.records || [];
    } catch (e) {
        console.error(`Query failed: ${e.message}`);
        return [];
    }
}

console.log('=== Security Analysis ===\n');

// 1. High Privilege Profiles
console.log('Checking high privilege profiles...');
const profiles = runQuery("SELECT Name, PermissionsModifyAllData, PermissionsViewAllData FROM Profile WHERE PermissionsModifyAllData = true");
securityAnalysis.highPrivilegeProfiles = profiles.map(p => ({
    name: p.Name,
    modifyAllData: p.PermissionsModifyAllData,
    viewAllData: p.PermissionsViewAllData
}));
console.log(`  Found ${profiles.length} profiles with ModifyAllData`);

if (profiles.length > 3) {
    securityAnalysis.findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'High',
        title: `${profiles.length} profiles with ModifyAllData permission`,
        description: 'Multiple profiles have ModifyAllData permission which bypasses all security',
        location: 'Profiles',
        impact: 'Users can access and modify all records regardless of sharing rules',
        recommendation: 'Review and minimize profiles with ModifyAllData permission',
        effort: 'Medium',
        tool: 'Security Analysis'
    });
}

// 2. High Privilege Permission Sets
console.log('Checking high privilege permission sets...');
const permSets = runQuery("SELECT Name, PermissionsModifyAllData, PermissionsViewAllData FROM PermissionSet WHERE PermissionsModifyAllData = true AND IsOwnedByProfile = false");
securityAnalysis.highPrivilegePermSets = permSets.map(p => ({
    name: p.Name,
    modifyAllData: p.PermissionsModifyAllData,
    viewAllData: p.PermissionsViewAllData
}));
console.log(`  Found ${permSets.length} permission sets with ModifyAllData`);

// 3. Named Credentials
console.log('Checking named credentials...');
const namedCreds = runQuery("SELECT DeveloperName, Endpoint FROM NamedCredential");
securityAnalysis.namedCredentials = namedCreds.map(nc => ({
    name: nc.DeveloperName,
    endpoint: nc.Endpoint
}));
console.log(`  Found ${namedCreds.length} named credentials`);

// 4. Connected Apps
console.log('Checking connected apps...');
const connectedApps = runQuery("SELECT Name, ContactEmail FROM ConnectedApplication");
securityAnalysis.connectedApps = connectedApps.map(ca => ({
    name: ca.Name,
    contactEmail: ca.ContactEmail
}));
console.log(`  Found ${connectedApps.length} connected apps`);

// 5. Active Users Count
console.log('Counting active users...');
const users = runQuery("SELECT COUNT(Id) total FROM User WHERE IsActive = true");
securityAnalysis.activeUsers = users[0]?.total || 0;
console.log(`  Active users: ${securityAnalysis.activeUsers}`);

// 6. Users with Modify All Data (via profile)
console.log('Checking users with high privilege access...');
const highPrivUsers = runQuery("SELECT COUNT(Id) total FROM User WHERE IsActive = true AND Profile.PermissionsModifyAllData = true");
const highPrivCount = highPrivUsers[0]?.total || 0;
console.log(`  Users with ModifyAllData via profile: ${highPrivCount}`);

if (highPrivCount > 10) {
    securityAnalysis.findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'High',
        title: `${highPrivCount} active users have ModifyAllData permission`,
        description: 'Large number of users have full data access',
        location: 'User Profiles',
        impact: 'Increased risk of data breach or accidental data modification',
        recommendation: 'Review user profiles and apply least privilege principle',
        effort: 'High',
        tool: 'Security Analysis'
    });
}

// 7. Check for without sharing classes in code
console.log('Checking for without sharing classes...');
const classesDir = 'force-app/main/default/classes';
let withoutSharingCount = 0;
const withoutSharingClasses = [];

if (fs.existsSync(classesDir)) {
    const files = fs.readdirSync(classesDir).filter(f => f.endsWith('.cls'));
    files.forEach(file => {
        const content = fs.readFileSync(`${classesDir}/${file}`, 'utf8');
        if (content.includes('without sharing')) {
            withoutSharingCount++;
            withoutSharingClasses.push(file.replace('.cls', ''));
        }
    });
}
console.log(`  Classes with 'without sharing': ${withoutSharingCount}`);

if (withoutSharingCount > 10) {
    securityAnalysis.findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'Medium',
        title: `${withoutSharingCount} Apex classes use 'without sharing'`,
        description: 'Classes bypass sharing rules which may expose data',
        location: withoutSharingClasses.slice(0, 5).join(', ') + (withoutSharingClasses.length > 5 ? '...' : ''),
        impact: 'Users may see/modify records they should not have access to',
        recommendation: 'Review each class and ensure without sharing is intentional',
        effort: 'Medium',
        tool: 'Security Analysis'
    });
}

// Output summary
console.log('\n=== Security Summary ===');
console.log(`High Privilege Profiles: ${securityAnalysis.highPrivilegeProfiles.length}`);
console.log(`High Privilege Perm Sets: ${securityAnalysis.highPrivilegePermSets.length}`);
console.log(`Named Credentials: ${securityAnalysis.namedCredentials.length}`);
console.log(`Connected Apps: ${securityAnalysis.connectedApps.length}`);
console.log(`Active Users: ${securityAnalysis.activeUsers}`);
console.log(`Without Sharing Classes: ${withoutSharingCount}`);
console.log(`\nFindings Generated: ${securityAnalysis.findings.length}`);

securityAnalysis.findings.forEach(f => {
    console.log(`  [${f.severity}] ${f.title}`);
});

// Save results
fs.writeFileSync('docs/data/security-findings.json', JSON.stringify(securityAnalysis.findings, null, 2));
fs.writeFileSync('docs/data/security-summary.json', JSON.stringify(securityAnalysis, null, 2));
fs.writeFileSync('docs/data/high-privilege-profiles.json', JSON.stringify(securityAnalysis.highPrivilegeProfiles, null, 2));
fs.writeFileSync('docs/data/high-privilege-permission-sets.json', JSON.stringify(securityAnalysis.highPrivilegePermSets, null, 2));
fs.writeFileSync('docs/data/named-credentials.json', JSON.stringify(securityAnalysis.namedCredentials, null, 2));
fs.writeFileSync('docs/data/connected-apps.json', JSON.stringify(securityAnalysis.connectedApps, null, 2));

console.log('\nResults saved to docs/data/security-*.json');
