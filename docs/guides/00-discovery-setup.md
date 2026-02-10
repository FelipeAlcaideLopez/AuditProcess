# Phase 0: Discovery & Environment Setup

## Objective
Set up the audit environment, connect to the Salesforce org, and gather initial information.

---

## Prerequisites

### Required Tools
```bash
# Check Salesforce CLI is installed
sf --version

# Expected output: @salesforce/cli/X.X.X

# If not installed:
npm install -g @salesforce/cli

# Check Node.js version (required for ESLint, PMD)
node --version

# Check npm
npm --version
```

### Install Audit Tools
```bash
# Navigate to project root
cd /Users/felipe.lopez/Documents/VSC/AuditProcess

# Install PMD (if using Homebrew on macOS)
brew install pmd

# Or download from https://pmd.github.io/
# Extract and add to PATH

# Verify PMD installation
pmd --version

# Install ESLint and LWC plugin
npm install --save-dev eslint @babel/core @babel/eslint-parser @lwc/eslint-plugin-lwc

# Install Lightning Flow Scanner
sf plugins install lightning-flow-scanner

# Verify Flow Scanner
sf flow scan --help
```

---

## Step 1: Authenticate to Salesforce Org

### Command
```bash
# Login to production org
sf org login web --alias audit-org --instance-url https://login.salesforce.com

# Login to sandbox
sf org login web --alias audit-org --instance-url https://test.salesforce.com

# For SSO-enabled orgs
sf org login web --alias audit-org --instance-url https://[mydomain].my.salesforce.com
```

### Expected Output
```
Successfully authorized [username] with org ID 00DXXXXXXXXXXXXXXX
```

### Verification
```bash
# Verify connection
sf org display --target-org audit-org
```

### Output to Capture
Save the following information:
```json
{
  "org_id": "00DXXXXXXXXXXXXXXX",
  "username": "admin@company.com",
  "instance_url": "https://company.my.salesforce.com",
  "api_version": "59.0",
  "edition": "Enterprise Edition",
  "org_type": "Production"
}
```

---

## Step 2: Gather Org Information

### Query Org Details
```bash
# Get organization info
sf data query --query "SELECT Id, Name, OrganizationType, IsSandbox, InstanceName, TrialExpirationDate, LanguageLocaleKey, DefaultLocaleSidKey, TimeZoneSidKey FROM Organization" --target-org audit-org --json > docs/data/org-info.json
```

### Query Feature Licenses
```bash
# Feature licenses
sf data query --query "SELECT Id, Name, Status, TotalLicenses, UsedLicenses FROM UserLicense" --target-org audit-org --json > docs/data/user-licenses.json

# Permission Set Licenses
sf data query --query "SELECT Id, DeveloperName, MasterLabel, TotalLicenses, UsedLicenses FROM PermissionSetLicense" --target-org audit-org --json > docs/data/psl-licenses.json
```

### Query User Count
```bash
# Active users by profile
sf data query --query "SELECT Profile.Name, COUNT(Id) userCount FROM User WHERE IsActive = true GROUP BY Profile.Name ORDER BY COUNT(Id) DESC" --target-org audit-org --json > docs/data/users-by-profile.json

# Total user count
sf data query --query "SELECT COUNT(Id) FROM User WHERE IsActive = true" --target-org audit-org --json
```

---

## Step 3: List Available Metadata Types

### Command
```bash
# List all metadata types
sf org list metadata-types --target-org audit-org --json > docs/data/metadata-types.json
```

### Process Output
The output contains all available metadata types. Parse to identify what to extract:
```bash
# Count metadata types
cat docs/data/metadata-types.json | jq '.result.metadataObjects | length'

# List type names
cat docs/data/metadata-types.json | jq -r '.result.metadataObjects[].xmlName' | sort
```

---

## Step 4: Query Org Limits

### Via Apex Anonymous
Create file `scripts/apex/get-limits.apex`:
```apex
Map<String, System.OrgLimit> limitsMap = OrgLimits.getMap();
List<Map<String, Object>> limitsList = new List<Map<String, Object>>();

for(String limitName : limitsMap.keySet()) {
    System.OrgLimit ol = limitsMap.get(limitName);
    Map<String, Object> limitData = new Map<String, Object>{
        'name' => limitName,
        'value' => ol.getValue(),
        'limit' => ol.getLimit(),
        'percentage' => ol.getLimit() > 0 ?
            ((Decimal)ol.getValue() / ol.getLimit() * 100).setScale(2) : 0
    };
    limitsList.add(limitData);
}

System.debug(JSON.serializePretty(limitsList));
```

### Execute
```bash
sf apex run --file scripts/apex/get-limits.apex --target-org audit-org > docs/data/org-limits.txt
```

### Via REST API
```bash
# Open limits endpoint in browser
sf org open --target-org audit-org --path /services/data/v59.0/limits/

# Or use curl
sf org display --target-org audit-org --json | jq -r '.result.accessToken' > /tmp/token.txt
ACCESS_TOKEN=$(cat /tmp/token.txt)
INSTANCE_URL=$(sf org display --target-org audit-org --json | jq -r '.result.instanceUrl')

curl -H "Authorization: Bearer $ACCESS_TOKEN" \
     "$INSTANCE_URL/services/data/v59.0/limits/" > docs/data/org-limits-api.json
```

---

## Step 5: Create Project Structure

### Commands
```bash
# Create all required directories
mkdir -p docs/data
mkdir -p docs/analysis
mkdir -p docs/guides
mkdir -p reports/pmd
mkdir -p reports/eslint
mkdir -p reports/flow-scanner

# Create .gitignore for sensitive data
cat > docs/data/.gitignore << 'EOF'
# Ignore JSON files with org data
*.json
# Ignore text exports
*.txt
# Keep directory
!.gitignore
EOF
```

---

## Step 6: Configure PMD

### Create PMD Ruleset
Create file `config/apex-ruleset.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ruleset name="Salesforce Audit Ruleset"
         xmlns="http://pmd.sourceforge.net/ruleset/2.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd">

    <description>PMD rules for Salesforce org audit</description>

    <!-- Best Practices -->
    <rule ref="category/apex/bestpractices.xml/ApexAssertionsShouldIncludeMessage"/>
    <rule ref="category/apex/bestpractices.xml/ApexUnitTestClassShouldHaveAsserts"/>
    <rule ref="category/apex/bestpractices.xml/ApexUnitTestClassShouldHaveRunAs"/>
    <rule ref="category/apex/bestpractices.xml/ApexUnitTestMethodShouldHaveIsTestAnnotation"/>
    <rule ref="category/apex/bestpractices.xml/ApexUnitTestShouldNotUseSeeAllDataTrue"/>
    <rule ref="category/apex/bestpractices.xml/AvoidGlobalModifier"/>
    <rule ref="category/apex/bestpractices.xml/AvoidLogicInTrigger"/>
    <rule ref="category/apex/bestpractices.xml/DebugsShouldUseLoggingLevel"/>
    <rule ref="category/apex/bestpractices.xml/UnusedLocalVariable"/>

    <!-- Security -->
    <rule ref="category/apex/security.xml/ApexBadCrypto"/>
    <rule ref="category/apex/security.xml/ApexCRUDViolation"/>
    <rule ref="category/apex/security.xml/ApexDangerousMethods"/>
    <rule ref="category/apex/security.xml/ApexInsecureEndpoint"/>
    <rule ref="category/apex/security.xml/ApexOpenRedirect"/>
    <rule ref="category/apex/security.xml/ApexSharingViolations"/>
    <rule ref="category/apex/security.xml/ApexSOQLInjection"/>
    <rule ref="category/apex/security.xml/ApexSuggestUsingNamedCred"/>
    <rule ref="category/apex/security.xml/ApexXSSFromEscapeFalse"/>
    <rule ref="category/apex/security.xml/ApexXSSFromURLParam"/>

    <!-- Performance -->
    <rule ref="category/apex/performance.xml/AvoidDebugStatements"/>
    <rule ref="category/apex/performance.xml/AvoidNonRestrictiveQueries"/>
    <rule ref="category/apex/performance.xml/EagerlyLoadedDescribeSObjectResult"/>
    <rule ref="category/apex/performance.xml/OperationWithHighCostInLoop"/>
    <rule ref="category/apex/performance.xml/OperationWithLimitsInLoop"/>

    <!-- Design -->
    <rule ref="category/apex/design.xml/AvoidDeeplyNestedIfStmts"/>
    <rule ref="category/apex/design.xml/CognitiveComplexity"/>
    <rule ref="category/apex/design.xml/CyclomaticComplexity"/>
    <rule ref="category/apex/design.xml/ExcessiveParameterList"/>
    <rule ref="category/apex/design.xml/ExcessivePublicCount"/>
    <rule ref="category/apex/design.xml/TooManyFields"/>
    <rule ref="category/apex/design.xml/UnusedMethod"/>

    <!-- Error Prone -->
    <rule ref="category/apex/errorprone.xml/ApexCSRF"/>
    <rule ref="category/apex/errorprone.xml/AvoidDirectAccessTriggerMap"/>
    <rule ref="category/apex/errorprone.xml/AvoidHardcodingId"/>
    <rule ref="category/apex/errorprone.xml/AvoidNonExistentAnnotations"/>
    <rule ref="category/apex/errorprone.xml/EmptyCatchBlock"/>
    <rule ref="category/apex/errorprone.xml/EmptyIfStmt"/>
    <rule ref="category/apex/errorprone.xml/EmptyStatementBlock"/>
    <rule ref="category/apex/errorprone.xml/EmptyTryOrFinallyBlock"/>
    <rule ref="category/apex/errorprone.xml/EmptyWhileStmt"/>
    <rule ref="category/apex/errorprone.xml/InaccessibleAuraEnabledGetter"/>
    <rule ref="category/apex/errorprone.xml/MethodWithSameNameAsEnclosingClass"/>
    <rule ref="category/apex/errorprone.xml/OverrideBothEqualsAndHashcode"/>
    <rule ref="category/apex/errorprone.xml/TestMethodsMustBeInTestClasses"/>

    <!-- Code Style -->
    <rule ref="category/apex/codestyle.xml/ClassNamingConventions"/>
    <rule ref="category/apex/codestyle.xml/FieldNamingConventions"/>
    <rule ref="category/apex/codestyle.xml/ForLoopsMustUseBraces"/>
    <rule ref="category/apex/codestyle.xml/IfElseStmtsMustUseBraces"/>
    <rule ref="category/apex/codestyle.xml/IfStmtsMustUseBraces"/>
    <rule ref="category/apex/codestyle.xml/MethodNamingConventions"/>
    <rule ref="category/apex/codestyle.xml/WhileLoopsMustUseBraces"/>

</ruleset>
```

---

## Step 7: Configure ESLint for LWC

### Create ESLint Config
Create file `eslint.config.mjs`:
```javascript
import lwcPlugin from '@lwc/eslint-plugin-lwc';
import babelParser from '@babel/eslint-parser';

export default [
    {
        files: ['**/lwc/**/*.js'],
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    parserOpts: {
                        plugins: [
                            'classProperties',
                            ['decorators', { decoratorsBeforeExport: false }],
                        ],
                    },
                },
            },
        },
        plugins: {
            '@lwc/lwc': lwcPlugin,
        },
        rules: {
            // Core LWC Rules
            '@lwc/lwc/no-api-reassignments': 'error',
            '@lwc/lwc/no-deprecated': 'error',
            '@lwc/lwc/no-document-query': 'error',
            '@lwc/lwc/no-inner-html': 'error',
            '@lwc/lwc/no-leading-uppercase-api-name': 'error',
            '@lwc/lwc/valid-api': 'error',
            '@lwc/lwc/valid-track': 'error',
            '@lwc/lwc/valid-wire': 'error',

            // Best Practices
            '@lwc/lwc/no-async-operation': 'warn',
            '@lwc/lwc/no-leaky-event-listeners': 'error',
            '@lwc/lwc/consistent-component-name': 'error',
            '@lwc/lwc/no-attributes-during-construction': 'error',
        },
    },
];
```

---

## Step 8: Configure Flow Scanner

### Create Flow Scanner Config
Create file `.flowscannerrc`:
```json
{
    "rules": {
        "DMLStatementInALoop": {
            "severity": "error"
        },
        "SOQLQueryInALoop": {
            "severity": "error"
        },
        "HardcodedId": {
            "severity": "error"
        },
        "HardcodedUrl": {
            "severity": "warning"
        },
        "MissingNullHandler": {
            "severity": "warning"
        },
        "MissingFaultPath": {
            "severity": "warning"
        },
        "MissingFlowDescription": {
            "severity": "warning"
        },
        "FlowNamingConvention": {
            "severity": "warning"
        },
        "UnusedVariable": {
            "severity": "warning"
        },
        "UnconnectedElement": {
            "severity": "warning"
        },
        "UnsafeRunningContext": {
            "severity": "error"
        },
        "ProcessBuilder": {
            "severity": "warning"
        },
        "CyclomaticComplexity": {
            "severity": "warning",
            "threshold": 20
        },
        "OutdatedAPIVersion": {
            "severity": "warning"
        }
    }
}
```

---

## Output Checklist

After completing Phase 0, verify you have:

- [ ] Salesforce CLI authenticated to target org
- [ ] Org ID and basic information captured
- [ ] User license information exported
- [ ] Org limits captured
- [ ] Metadata types list exported
- [ ] PMD ruleset configured
- [ ] ESLint configured for LWC
- [ ] Flow Scanner configured
- [ ] Directory structure created

---

## Next Phase
Proceed to [01-metadata-extraction.md](01-metadata-extraction.md)
