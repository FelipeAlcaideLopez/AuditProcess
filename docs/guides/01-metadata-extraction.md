# Phase 1: Metadata Extraction

## Objective
Extract all relevant metadata from the Salesforce org for analysis.

---

## Prerequisites
- Phase 0 completed
- Authenticated to target org (`audit-org`)
- Project structure created

---

## Step 1: Retrieve Code Metadata

### Apex Classes
```bash
# Retrieve all Apex classes (deposits in force-app/main/default/classes/)
sf project retrieve start --metadata ApexClass --target-org audit-org

# Count classes retrieved
ls force-app/main/default/classes/*.cls 2>/dev/null | wc -l

# List classes with line counts
wc -l force-app/main/default/classes/*.cls 2>/dev/null | sort -rn | head -20
```

### Apex Triggers
```bash
# Retrieve all triggers (deposits in force-app/main/default/triggers/)
sf project retrieve start --metadata ApexTrigger --target-org audit-org

# List triggers
ls force-app/main/default/triggers/*.trigger 2>/dev/null | wc -l
```

### Query Apex Metadata
```bash
# Apex class details
sf data query --query "SELECT Id, Name, ApiVersion, Status, IsValid, LengthWithoutComments, NamespacePrefix FROM ApexClass ORDER BY LengthWithoutComments DESC" --target-org audit-org --json > docs/data/apex-classes.json

# Apex trigger details
sf data query --query "SELECT Id, Name, TableEnumOrId, ApiVersion, Status, IsValid, LengthWithoutComments FROM ApexTrigger" --target-org audit-org --json > docs/data/apex-triggers.json

# Test coverage
sf apex run test --test-level RunLocalTests --code-coverage --result-format json --target-org audit-org > docs/data/test-coverage.json
```

---

## Step 2: Retrieve Lightning Components

### LWC Components
```bash
# Retrieve all LWC bundles (deposits in force-app/main/default/lwc/)
sf project retrieve start --metadata LightningComponentBundle --target-org audit-org

# Count LWC components
ls -d force-app/main/default/lwc/*/ 2>/dev/null | wc -l
```

### Aura Components
```bash
# Retrieve all Aura bundles
sf project retrieve start --metadata AuraDefinitionBundle --target-org audit-org

# Count Aura components
ls -d force-app/main/default/aura/*/ 2>/dev/null | wc -l
```

### Static Resources
```bash
# Retrieve static resources
sf project retrieve start --metadata StaticResource --target-org audit-org

# List with sizes
ls -la force-app/main/default/staticresources/
```

---

## Step 3: Retrieve Automation Metadata

### Flows
```bash
# Retrieve all flows (deposits in force-app/main/default/flows/)
sf project retrieve start --metadata Flow --target-org audit-org

# Query flow metadata
sf data query --query "SELECT Id, ApiName, Label, ProcessType, TriggerType, Status, Description, LastModifiedDate, LastModifiedBy.Name FROM FlowDefinitionView WHERE IsActive = true" --target-org audit-org --json > docs/data/flows-active.json

# Count flows by type
sf data query --query "SELECT ProcessType, COUNT(Id) FROM FlowDefinitionView WHERE IsActive = true GROUP BY ProcessType" --target-org audit-org --json > docs/data/flows-by-type.json
```

### Workflow Rules (Legacy)
```bash
# Retrieve workflows
sf project retrieve start --metadata Workflow --target-org audit-org

# Query workflow rules
sf data query --query "SELECT Id, Name, TableEnumOrId FROM WorkflowRule WHERE TableEnumOrId != null" --target-org audit-org --json > docs/data/workflow-rules.json 2>/dev/null || echo "No access to WorkflowRule object"
```

### Process Builders (Legacy)
```bash
# Process Builders are stored as Flows with ProcessType = 'Workflow'
sf data query --query "SELECT Id, ApiName, ProcessType, Status FROM FlowDefinitionView WHERE ProcessType = 'Workflow'" --target-org audit-org --json > docs/data/process-builders.json
```

### Approval Processes
```bash
# Retrieve approval processes
sf project retrieve start --metadata ApprovalProcess --target-org audit-org
```

---

## Step 4: Retrieve Data Model Metadata

### Custom Objects
```bash
# Retrieve all custom objects
sf project retrieve start --metadata CustomObject --target-org audit-org

# Query object metadata
sf data query --query "SELECT QualifiedApiName, Label, IsCustomizable, KeyPrefix, RecordTypesEnabled, Description FROM EntityDefinition WHERE IsCustomizable = true ORDER BY QualifiedApiName" --target-org audit-org --json > docs/data/custom-objects.json

# Count custom objects
sf data query --query "SELECT COUNT() FROM EntityDefinition WHERE IsCustomizable = true AND QualifiedApiName LIKE '%__c'" --target-org audit-org --json
```

### Custom Fields
```bash
# Query field counts by object
sf data query --query "SELECT EntityDefinition.QualifiedApiName, COUNT(Id) fieldCount FROM FieldDefinition WHERE EntityDefinition.IsCustomizable = true GROUP BY EntityDefinition.QualifiedApiName ORDER BY COUNT(Id) DESC" --target-org audit-org --json > docs/data/fields-by-object.json
```

### Validation Rules
```bash
# Retrieve validation rules
sf project retrieve start --metadata ValidationRule --target-org audit-org

# Query validation rule counts
sf data query --query "SELECT EntityDefinition.QualifiedApiName, COUNT(Id) FROM ValidationRule WHERE Active = true GROUP BY EntityDefinition.QualifiedApiName" --target-org audit-org --json > docs/data/validation-rules.json 2>/dev/null || echo "Query via Tooling API instead"
```

### Record Types
```bash
# Query record types
sf data query --query "SELECT Id, Name, SobjectType, IsActive, Description, DeveloperName FROM RecordType ORDER BY SobjectType" --target-org audit-org --json > docs/data/record-types.json
```

---

## Step 5: Retrieve Security Metadata

### Profiles
```bash
# Retrieve all profiles
sf project retrieve start --metadata Profile --target-org audit-org

# Query profiles
sf data query --query "SELECT Id, Name, UserLicenseId, UserLicense.Name FROM Profile ORDER BY Name" --target-org audit-org --json > docs/data/profiles.json

# Profiles with dangerous permissions
sf data query --query "SELECT Id, Name, PermissionsModifyAllData, PermissionsViewAllData, PermissionsManageUsers FROM Profile WHERE PermissionsModifyAllData = true OR PermissionsViewAllData = true" --target-org audit-org --json > docs/data/profiles-dangerous.json
```

### Permission Sets
```bash
# Retrieve permission sets
sf project retrieve start --metadata PermissionSet --target-org audit-org

# Query permission sets
sf data query --query "SELECT Id, Name, Label, IsCustom, IsOwnedByProfile, PermissionsModifyAllData, PermissionsViewAllData FROM PermissionSet WHERE IsOwnedByProfile = false ORDER BY Name" --target-org audit-org --json > docs/data/permission-sets.json

# Permission set assignments
sf data query --query "SELECT Assignee.Name, Assignee.Profile.Name, PermissionSet.Name FROM PermissionSetAssignment WHERE Assignee.IsActive = true AND PermissionSet.IsOwnedByProfile = false ORDER BY PermissionSet.Name" --target-org audit-org --json > docs/data/permission-set-assignments.json
```

### Permission Set Groups
```bash
# Retrieve permission set groups
sf project retrieve start --metadata PermissionSetGroup --target-org audit-org

# Query groups
sf data query --query "SELECT Id, DeveloperName, MasterLabel, Description FROM PermissionSetGroup" --target-org audit-org --json > docs/data/permission-set-groups.json
```

### Sharing Rules
```bash
# Retrieve sharing rules
sf project retrieve start --metadata SharingRules --target-org audit-org

# Query sharing rule counts by object
sf data query --query "SELECT COUNT(Id) FROM AccountShare WHERE RowCause = 'Rule'" --target-org audit-org --json > docs/data/account-share-count.json
```

### Roles
```bash
# Query role hierarchy
sf data query --query "SELECT Id, Name, DeveloperName, ParentRoleId, (SELECT Id FROM Users WHERE IsActive = true) FROM UserRole ORDER BY Name" --target-org audit-org --json > docs/data/roles.json
```

---

## Step 6: Retrieve Integration Metadata

### Named Credentials
```bash
# Retrieve named credentials
sf project retrieve start --metadata NamedCredential --target-org audit-org

# Query named credentials
sf data query --query "SELECT Id, DeveloperName, Endpoint, PrincipalType FROM NamedCredential" --target-org audit-org --json > docs/data/named-credentials.json
```

### Connected Apps
```bash
# Retrieve connected apps
sf project retrieve start --metadata ConnectedApp --target-org audit-org

# Query connected apps
sf data query --query "SELECT Id, Name, Description, ContactEmail FROM ConnectedApplication" --target-org audit-org --json > docs/data/connected-apps.json
```

### Remote Site Settings
```bash
# Retrieve remote sites
sf project retrieve start --metadata RemoteSiteSetting --target-org audit-org
```

### External Services
```bash
# Retrieve external services
sf project retrieve start --metadata ExternalServiceRegistration --target-org audit-org
```

---

## Step 7: Retrieve Application Metadata

### Custom Applications
```bash
# Retrieve apps
sf project retrieve start --metadata CustomApplication --target-org audit-org
```

### Lightning Pages (FlexiPages)
```bash
# Retrieve lightning pages
sf project retrieve start --metadata FlexiPage --target-org audit-org

# List pages
find force-app -name "*.flexipage-meta.xml" | wc -l
```

### Custom Tabs
```bash
# Retrieve tabs
sf project retrieve start --metadata CustomTab --target-org audit-org
```

### Quick Actions
```bash
# Retrieve quick actions
sf project retrieve start --metadata QuickAction --target-org audit-org
```

---

## Step 8: Retrieve Additional Metadata

### Custom Settings & Custom Metadata
```bash
# Retrieve custom settings
sf project retrieve start --metadata CustomSetting --target-org audit-org

# Retrieve custom metadata types
sf project retrieve start --metadata CustomMetadata --target-org audit-org
```

### Email Templates
```bash
# Retrieve email templates
sf project retrieve start --metadata EmailTemplate --target-org audit-org
```

### Reports & Dashboards
```bash
# Retrieve reports (be careful - can be many)
sf project retrieve start --metadata Report --target-org audit-org

# Retrieve dashboards
sf project retrieve start --metadata Dashboard --target-org audit-org
```

### Installed Packages
```bash
# Query installed packages
sf data query --query "SELECT Id, SubscriberPackage.Name, SubscriberPackage.NamespacePrefix, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, SubscriberPackageVersion.PatchVersion FROM InstalledSubscriberPackage" --target-org audit-org --json > docs/data/installed-packages.json
```

---

## Step 9: Bulk Metadata Retrieval (Alternative)

### Using package.xml
Create file `manifest/package.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>*</members>
        <name>ApexClass</name>
    </types>
    <types>
        <members>*</members>
        <name>ApexTrigger</name>
    </types>
    <types>
        <members>*</members>
        <name>LightningComponentBundle</name>
    </types>
    <types>
        <members>*</members>
        <name>AuraDefinitionBundle</name>
    </types>
    <types>
        <members>*</members>
        <name>Flow</name>
    </types>
    <types>
        <members>*</members>
        <name>CustomObject</name>
    </types>
    <types>
        <members>*</members>
        <name>Profile</name>
    </types>
    <types>
        <members>*</members>
        <name>PermissionSet</name>
    </types>
    <types>
        <members>*</members>
        <name>NamedCredential</name>
    </types>
    <types>
        <members>*</members>
        <name>ConnectedApp</name>
    </types>
    <version>59.0</version>
</Package>
```

### Execute Bulk Retrieval
```bash
sf project retrieve start --manifest manifest/package.xml --target-org audit-org
```

---

## Step 10: Generate Metadata Summary

### Create Summary Script
Create file `scripts/generate-metadata-summary.sh`:
```bash
#!/bin/bash

echo "=== Metadata Extraction Summary ===" > docs/data/extraction-summary.txt
echo "Generated: $(date)" >> docs/data/extraction-summary.txt
echo "" >> docs/data/extraction-summary.txt

echo "Apex Classes: $(find force-app -name '*.cls' 2>/dev/null | wc -l | tr -d ' ')" >> docs/data/extraction-summary.txt
echo "Apex Triggers: $(find force-app -name '*.trigger' 2>/dev/null | wc -l | tr -d ' ')" >> docs/data/extraction-summary.txt
echo "LWC Components: $(find force-app -path '**/lwc/**' -name '*.js' 2>/dev/null | wc -l | tr -d ' ')" >> docs/data/extraction-summary.txt
echo "Aura Components: $(find force-app -type d -path '**/aura/*' 2>/dev/null | wc -l | tr -d ' ')" >> docs/data/extraction-summary.txt
echo "Flows: $(find force-app -name '*.flow-meta.xml' 2>/dev/null | wc -l | tr -d ' ')" >> docs/data/extraction-summary.txt
echo "Custom Objects: $(find force-app -name '*.object-meta.xml' 2>/dev/null | wc -l | tr -d ' ')" >> docs/data/extraction-summary.txt
echo "Profiles: $(find force-app -name '*.profile-meta.xml' 2>/dev/null | wc -l | tr -d ' ')" >> docs/data/extraction-summary.txt
echo "Permission Sets: $(find force-app -name '*.permissionset-meta.xml' 2>/dev/null | wc -l | tr -d ' ')" >> docs/data/extraction-summary.txt

cat docs/data/extraction-summary.txt
```

### Execute
```bash
chmod +x scripts/generate-metadata-summary.sh
./scripts/generate-metadata-summary.sh
```

---

## Output Checklist

After completing Phase 1, verify you have:

- [ ] All Apex classes retrieved
- [ ] All Apex triggers retrieved
- [ ] All LWC components retrieved
- [ ] All Aura components retrieved
- [ ] All Flows retrieved
- [ ] Custom objects and fields metadata
- [ ] Profiles and Permission Sets
- [ ] Sharing rules
- [ ] Named Credentials and Connected Apps
- [ ] Metadata summary generated

### Expected Files in `docs/data/`
```
apex-classes.json
apex-triggers.json
test-coverage.json
flows-active.json
flows-by-type.json
custom-objects.json
fields-by-object.json
record-types.json
profiles.json
profiles-dangerous.json
permission-sets.json
permission-set-assignments.json
roles.json
named-credentials.json
connected-apps.json
installed-packages.json
extraction-summary.txt
```

---

## Next Phase
Proceed to [02-apex-analysis.md](02-apex-analysis.md)
