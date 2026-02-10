# Phase 5: Security & Access Analysis

## Objective
Comprehensive security audit covering profiles, permission sets, sharing model, and field-level security.

---

## Prerequisites
- Phase 1 completed (metadata extracted)
- Profiles and Permission Sets retrieved
- Connected to org with admin access

---

## Step 1: Profile Analysis

### Query Profiles with Permissions
```bash
# All profiles with key permissions
sf data query --query "SELECT Id, Name, PermissionsModifyAllData, PermissionsViewAllData, PermissionsManageUsers, PermissionsCustomizeApplication, PermissionsAuthorApex, PermissionsEditPublicReports, PermissionsManageDataIntegrations FROM Profile ORDER BY Name" --target-org audit-org --json > docs/data/profile-permissions.json

# Users per profile
sf data query --query "SELECT Profile.Name, COUNT(Id) userCount FROM User WHERE IsActive = true GROUP BY Profile.Name ORDER BY COUNT(Id) DESC" --target-org audit-org --json > docs/data/users-by-profile.json

# System Administrator users
sf data query --query "SELECT Id, Name, Username, LastLoginDate, Profile.Name FROM User WHERE IsActive = true AND Profile.Name = 'System Administrator'" --target-org audit-org --json > docs/data/system-admin-users.json
```

### Identify Dangerous Profile Permissions
Create file `scripts/analyze-profiles.js`:
```javascript
const fs = require('fs');

const profiles = JSON.parse(fs.readFileSync('docs/data/profile-permissions.json', 'utf8'));
const userCounts = JSON.parse(fs.readFileSync('docs/data/users-by-profile.json', 'utf8'));

const findings = [];
const dangerousPermissions = [
    'PermissionsModifyAllData',
    'PermissionsViewAllData',
    'PermissionsManageUsers',
    'PermissionsCustomizeApplication',
    'PermissionsAuthorApex'
];

const userCountMap = {};
userCounts.result.records.forEach(r => {
    userCountMap[r.Profile.Name] = r.userCount;
});

console.log('=== Profile Security Analysis ===\n');

profiles.result.records.forEach(profile => {
    const dangerousEnabled = dangerousPermissions.filter(p => profile[p] === true);
    const userCount = userCountMap[profile.Name] || 0;

    if (dangerousEnabled.length > 0) {
        console.log(`Profile: ${profile.Name}`);
        console.log(`  Users: ${userCount}`);
        console.log(`  Dangerous Permissions: ${dangerousEnabled.join(', ')}`);

        if (profile.Name !== 'System Administrator' && dangerousEnabled.length > 0) {
            findings.push({
                profile: profile.Name,
                permissions: dangerousEnabled,
                userCount: userCount,
                severity: dangerousEnabled.includes('PermissionsModifyAllData') ? 'Critical' : 'High'
            });
        }
        console.log('');
    }
});

console.log(`\nProfiles with dangerous permissions (excluding Sys Admin): ${findings.length}`);

fs.writeFileSync('docs/data/dangerous-profiles.json', JSON.stringify(findings, null, 2));
```

### Execute
```bash
node scripts/analyze-profiles.js > docs/data/profile-analysis.txt
```

---

## Step 2: Permission Set Analysis

### Query Permission Sets
```bash
# Permission Sets (excluding profile-based)
sf data query --query "SELECT Id, Name, Label, IsCustom, PermissionsModifyAllData, PermissionsViewAllData, PermissionsManageUsers, Description FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Name" --target-org audit-org --json > docs/data/permission-sets-detail.json

# Permission Set assignments
sf data query --query "SELECT Assignee.Name, Assignee.Profile.Name, Assignee.IsActive, PermissionSet.Name, PermissionSet.Label FROM PermissionSetAssignment WHERE PermissionSet.IsOwnedByProfile = false AND Assignee.IsActive = true ORDER BY PermissionSet.Name" --target-org audit-org --json > docs/data/ps-assignments.json

# Permission Set Groups
sf data query --query "SELECT Id, DeveloperName, MasterLabel, Description, Status FROM PermissionSetGroup" --target-org audit-org --json > docs/data/ps-groups.json
```

### Analyze Permission Set Usage
```bash
# Count assignments per permission set
cat docs/data/ps-assignments.json | jq '[.result.records | group_by(.PermissionSet.Name)[] | {name: .[0].PermissionSet.Name, count: length}] | sort_by(-.count)' > docs/data/ps-usage-counts.json
```

### Check Permission Sets Best Practices
```bash
# Permission Sets with Modify All Data
cat docs/data/permission-sets-detail.json | jq '[.result.records[] | select(.PermissionsModifyAllData == true)]' > docs/data/ps-with-mad.json

# Count
echo "Permission Sets with Modify All Data: $(cat docs/data/ps-with-mad.json | jq 'length')"
```

---

## Step 3: Sharing Model Analysis

### Query Organization-Wide Defaults
```bash
# This requires Metadata API - check retrieved objects
find force-app -name "*.object-meta.xml" -exec grep -l "<sharingModel>" {} \; > docs/data/objects-with-sharing.txt

# Parse sharing models from object files
for obj in force-app/main/default/objects/*/; do
    objName=$(basename "$obj")
    if [ -f "$obj${objName}.object-meta.xml" ]; then
        sharingModel=$(grep -oP '(?<=<sharingModel>)[^<]+' "$obj${objName}.object-meta.xml" 2>/dev/null || echo "Not found")
        echo "$objName: $sharingModel"
    fi
done > docs/data/owd-by-object.txt
```

### Query Sharing Rules Count
```bash
# Account sharing rules
sf data query --query "SELECT COUNT(Id) FROM AccountShare WHERE RowCause = 'Rule'" --target-org audit-org --json

# Contact sharing rules
sf data query --query "SELECT COUNT(Id) FROM ContactShare WHERE RowCause = 'Rule'" --target-org audit-org --json

# Opportunity sharing rules
sf data query --query "SELECT COUNT(Id) FROM OpportunityShare WHERE RowCause = 'Rule'" --target-org audit-org --json
```

### Analyze Sharing Rule Complexity
```bash
# Parse sharing rules from metadata
find force-app -name "*.sharingRules-meta.xml" -exec basename {} \; > docs/data/sharing-rule-files.txt
```

---

## Step 4: Role Hierarchy Analysis

### Query Role Structure
```bash
# Role hierarchy
sf data query --query "SELECT Id, Name, DeveloperName, ParentRoleId, ParentRole.Name, (SELECT Id, Name FROM Users WHERE IsActive = true) FROM UserRole ORDER BY Name" --target-org audit-org --json > docs/data/role-hierarchy.json

# Role distribution
sf data query --query "SELECT UserRole.Name, COUNT(Id) FROM User WHERE IsActive = true AND UserRoleId != null GROUP BY UserRole.Name ORDER BY COUNT(Id) DESC" --target-org audit-org --json > docs/data/users-by-role.json
```

### Analyze Role Hierarchy Depth
Create file `scripts/analyze-roles.js`:
```javascript
const fs = require('fs');

const roles = JSON.parse(fs.readFileSync('docs/data/role-hierarchy.json', 'utf8'));

const roleMap = {};
roles.result.records.forEach(role => {
    roleMap[role.Id] = {
        name: role.Name,
        parentId: role.ParentRoleId,
        userCount: role.Users ? role.Users.records.length : 0
    };
});

// Calculate depth for each role
function getDepth(roleId, depth = 0) {
    const role = roleMap[roleId];
    if (!role || !role.parentId) return depth;
    return getDepth(role.parentId, depth + 1);
}

const analysis = [];
Object.keys(roleMap).forEach(roleId => {
    const role = roleMap[roleId];
    analysis.push({
        name: role.name,
        depth: getDepth(roleId),
        users: role.userCount
    });
});

// Sort by depth
analysis.sort((a, b) => b.depth - a.depth);

console.log('=== Role Hierarchy Analysis ===\n');
console.log(`Total Roles: ${analysis.length}`);
console.log(`Max Depth: ${Math.max(...analysis.map(r => r.depth))}`);
console.log(`\nRoles by Depth:`);

const byDepth = {};
analysis.forEach(r => {
    byDepth[r.depth] = (byDepth[r.depth] || 0) + 1;
});
Object.entries(byDepth).sort((a, b) => a[0] - b[0]).forEach(([depth, count]) => {
    console.log(`  Level ${depth}: ${count} roles`);
});

console.log('\nRoles with no users:');
analysis.filter(r => r.users === 0).forEach(r => {
    console.log(`  ${r.name}`);
});

fs.writeFileSync('docs/data/role-analysis.json', JSON.stringify(analysis, null, 2));
```

### Execute
```bash
node scripts/analyze-roles.js > docs/data/role-analysis.txt
```

---

## Step 5: Field-Level Security Check

### Query Field Accessibility
```bash
# This requires checking profile/permission set metadata
# Parse from retrieved profiles
for profile in force-app/main/default/profiles/*.profile-meta.xml; do
    profileName=$(basename "$profile" .profile-meta.xml)
    fieldCount=$(grep -c "<field>" "$profile" 2>/dev/null || echo "0")
    echo "$profileName: $fieldCount field permissions"
done > docs/data/fls-by-profile.txt
```

### Identify Sensitive Fields
```bash
# Search for fields that might contain PII or sensitive data
sf data query --query "SELECT QualifiedApiName, EntityDefinition.QualifiedApiName, DataType, IsEncrypted FROM FieldDefinition WHERE (QualifiedApiName LIKE '%SSN%' OR QualifiedApiName LIKE '%Social%' OR QualifiedApiName LIKE '%Tax%' OR QualifiedApiName LIKE '%Credit%' OR QualifiedApiName LIKE '%Password%' OR QualifiedApiName LIKE '%Secret%')" --target-org audit-org --json > docs/data/sensitive-fields.json 2>/dev/null || echo "Tooling API query - use alternative"
```

---

## Step 6: Guest User Security (if Communities)

### Check Guest User Access
```bash
# Guest user profiles
sf data query --query "SELECT Id, Name FROM Profile WHERE Name LIKE '%Guest%'" --target-org audit-org --json > docs/data/guest-profiles.json

# Site guest users
sf data query --query "SELECT Id, Name, Profile.Name FROM User WHERE UserType = 'Guest'" --target-org audit-org --json > docs/data/guest-users.json
```

---

## Step 7: Login History & Event Monitoring

### Query Login History
```bash
# Login history (last 30 days)
sf data query --query "SELECT UserId, User.Name, User.Profile.Name, LoginTime, LoginType, Status, SourceIp, Browser, Platform FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:30 ORDER BY LoginTime DESC LIMIT 1000" --target-org audit-org --json > docs/data/login-history.json

# Failed logins
sf data query --query "SELECT UserId, User.Name, LoginTime, Status, SourceIp FROM LoginHistory WHERE Status != 'Success' AND LoginTime = LAST_N_DAYS:7" --target-org audit-org --json > docs/data/failed-logins.json

# Login patterns
sf data query --query "SELECT User.Profile.Name, LoginType, COUNT(Id) cnt FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:30 GROUP BY User.Profile.Name, LoginType ORDER BY COUNT(Id) DESC" --target-org audit-org --json > docs/data/login-patterns.json
```

### Check Setup Audit Trail
```bash
# Recent setup changes (via Tooling API or UI export)
# Export from Setup > Security > View Setup Audit Trail
```

---

## Step 8: Generate Security Findings

Create file `scripts/generate-security-findings.js`:
```javascript
const fs = require('fs');

const findings = [];
let findingId = 1;

// Load data files
let dangerousProfiles = [];
let psWithMad = [];
let sysAdminUsers = { result: { records: [] } };
let guestUsers = { result: { records: [] } };
let failedLogins = { result: { records: [] } };

try { dangerousProfiles = JSON.parse(fs.readFileSync('docs/data/dangerous-profiles.json', 'utf8')); } catch(e) {}
try { psWithMad = JSON.parse(fs.readFileSync('docs/data/ps-with-mad.json', 'utf8')); } catch(e) {}
try { sysAdminUsers = JSON.parse(fs.readFileSync('docs/data/system-admin-users.json', 'utf8')); } catch(e) {}
try { guestUsers = JSON.parse(fs.readFileSync('docs/data/guest-users.json', 'utf8')); } catch(e) {}
try { failedLogins = JSON.parse(fs.readFileSync('docs/data/failed-logins.json', 'utf8')); } catch(e) {}

// Dangerous profiles
dangerousProfiles.forEach(profile => {
    findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: profile.severity,
        title: `Dangerous permissions on profile: ${profile.profile}`,
        description: `Profile "${profile.profile}" has elevated permissions: ${profile.permissions.join(', ')}. ${profile.userCount} users are assigned to this profile.`,
        location: `Profile: ${profile.profile}`,
        impact: 'Users can access or modify all data in the organization',
        recommendation: 'Remove elevated permissions and use specific sharing rules or permission sets instead',
        effort: 'Medium',
        tool: 'SOQL Analysis'
    });
});

// Permission Sets with Modify All Data
psWithMad.forEach(ps => {
    findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'Critical',
        title: `Permission Set with Modify All Data: ${ps.Name}`,
        description: `Permission Set "${ps.Label}" has Modify All Data permission enabled`,
        location: `Permission Set: ${ps.Name}`,
        impact: 'Any user assigned this permission set can modify all records',
        recommendation: 'Remove Modify All Data and implement specific object/field permissions',
        effort: 'Medium',
        tool: 'SOQL Analysis'
    });
});

// Excessive System Administrators
if (sysAdminUsers.result.records.length > 5) {
    findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'High',
        title: `Excessive System Administrator users: ${sysAdminUsers.result.records.length}`,
        description: `There are ${sysAdminUsers.result.records.length} active users with System Administrator profile. Best practice is to limit this number.`,
        location: 'User Management',
        impact: 'Increased risk of accidental or malicious changes, audit trail issues',
        recommendation: 'Review each admin user, create custom admin profiles with limited permissions',
        effort: 'Medium',
        tool: 'SOQL Analysis'
    });
}

// Failed login attempts
if (failedLogins.result.records && failedLogins.result.records.length > 50) {
    findings.push({
        id: `SEC-${String(findingId++).padStart(3, '0')}`,
        category: 'Security',
        severity: 'Medium',
        title: `High number of failed login attempts: ${failedLogins.result.records.length}`,
        description: `${failedLogins.result.records.length} failed login attempts in the last 7 days. This could indicate brute force attempts.`,
        location: 'Login History',
        impact: 'Potential unauthorized access attempts',
        recommendation: 'Review failed attempts, consider IP restrictions or MFA enforcement',
        effort: 'Quick Win',
        tool: 'Login History Analysis'
    });
}

fs.writeFileSync('docs/data/security-findings.json', JSON.stringify(findings, null, 2));
console.log(`Generated ${findings.length} Security findings`);
```

### Execute
```bash
node scripts/generate-security-findings.js
```

---

## Output Checklist

After completing Phase 5, verify you have:

- [ ] Profile permissions analyzed
- [ ] Dangerous profiles identified
- [ ] Permission Sets analyzed
- [ ] Permission Set usage mapped
- [ ] Organization-Wide Defaults documented
- [ ] Role hierarchy analyzed
- [ ] Guest user access reviewed
- [ ] Login history analyzed
- [ ] Security findings generated

### Expected Files
```
docs/data/profile-permissions.json
docs/data/users-by-profile.json
docs/data/system-admin-users.json
docs/data/dangerous-profiles.json
docs/data/profile-analysis.txt
docs/data/permission-sets-detail.json
docs/data/ps-assignments.json
docs/data/ps-with-mad.json
docs/data/owd-by-object.txt
docs/data/role-hierarchy.json
docs/data/role-analysis.json
docs/data/login-history.json
docs/data/failed-logins.json
docs/data/security-findings.json
```

---

## Next Phase
Proceed to [06-data-model-analysis.md](06-data-model-analysis.md)
