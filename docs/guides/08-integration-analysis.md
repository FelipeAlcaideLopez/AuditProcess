# Phase 8: Integration Analysis

## Objective
Comprehensive analysis of all integrations including patterns, volumes, credentials, and architecture recommendations.

---

## Prerequisites
- Phase 1 completed (metadata extracted)
- Access to org with integration visibility
- Named Credentials and Connected Apps retrieved

---

## Step 1: Integration Inventory

### Query Named Credentials
```bash
# Named Credentials
sf data query --query "SELECT Id, DeveloperName, MasterLabel, Endpoint, PrincipalType, Protocol, AuthProvider.DeveloperName FROM NamedCredential ORDER BY DeveloperName" --target-org audit-org --json > docs/data/named-credentials-detail.json

# Count
echo "Named Credentials: $(cat docs/data/named-credentials-detail.json | jq '.result.records | length')"
```

### Query External Credentials (newer)
```bash
sf data query --query "SELECT Id, DeveloperName, MasterLabel, AuthenticationProtocol FROM ExternalCredential" --target-org audit-org --json > docs/data/external-credentials.json 2>/dev/null || echo "External Credentials not available"
```

### Query Connected Apps
```bash
# Connected Apps
sf data query --query "SELECT Id, Name, Description, ContactEmail, StartUrl, MobileStartUrl, RefreshTokenValidityPeriod, OptionsAllowAdminApprovedUsersOnly FROM ConnectedApplication ORDER BY Name" --target-org audit-org --json > docs/data/connected-apps-detail.json

# Connected App OAuth settings (requires metadata)
sf project retrieve start --metadata ConnectedApp --target-org audit-org --output-dir force-app
```

### Query Remote Site Settings
```bash
# Remote Sites
sf project retrieve start --metadata RemoteSiteSetting --target-org audit-org --output-dir force-app

# List remote sites
find force-app -name "*.remoteSite-meta.xml" -exec basename {} .remoteSite-meta.xml \; > docs/data/remote-sites-list.txt

# Parse endpoints from remote sites
for file in force-app/main/default/remoteSiteSettings/*.remoteSite-meta.xml; do
    name=$(basename "$file" .remoteSite-meta.xml)
    url=$(grep -oP '(?<=<url>)[^<]+' "$file")
    echo "$name: $url"
done > docs/data/remote-site-endpoints.txt
```

---

## Step 2: Analyze Integration Patterns

### Find Callout Code
```bash
# Search for HTTP callouts in Apex
grep -rn "Http\|HttpRequest\|HttpResponse\|HttpCallout" force-app/main/default/classes --include="*.cls" > docs/data/http-callout-code.txt

# Search for REST callouts
grep -rn "RestRequest\|RestResponse\|RestContext" force-app/main/default/classes --include="*.cls" > docs/data/rest-service-code.txt

# Search for SOAP callouts
grep -rn "WebServiceCallout\|WebServiceMock" force-app/main/default/classes --include="*.cls" > docs/data/soap-callout-code.txt

# Count integration classes
echo "Classes with HTTP callouts: $(grep -l "Http" force-app/main/default/classes/*.cls 2>/dev/null | wc -l)"
echo "Classes with REST services: $(grep -l "RestResource" force-app/main/default/classes/*.cls 2>/dev/null | wc -l)"
```

### Identify Hardcoded Endpoints (Anti-pattern)
```bash
# Find hardcoded URLs (should use Named Credentials)
grep -rn "https://\|http://" force-app/main/default/classes --include="*.cls" | \
    grep -v "//.*http" | \
    grep -v "Test\|test" > docs/data/hardcoded-endpoints.txt

# Count
echo "Potential hardcoded endpoints: $(wc -l < docs/data/hardcoded-endpoints.txt)"
```

### Check for Credentials in Code (Critical)
```bash
# Search for potential hardcoded credentials
grep -rni "password\|apikey\|api_key\|secret\|token\|credential" force-app/main/default/classes --include="*.cls" | \
    grep -v "NamedCredential\|//\|Test\|test\|@\|Label\|CustomLabel" > docs/data/potential-hardcoded-creds.txt
```

---

## Step 3: Analyze API Usage & Volumes

### Query API Usage Limits
```apex
// Execute as Anonymous Apex
Map<String, System.OrgLimit> limits = OrgLimits.getMap();

System.debug('=== API USAGE ===');
System.debug('DailyApiRequests: ' + limits.get('DailyApiRequests').getValue() + '/' + limits.get('DailyApiRequests').getLimit());
System.debug('DailyBulkApiRequests: ' + limits.get('DailyBulkApiRequests').getValue() + '/' + limits.get('DailyBulkApiRequests').getLimit());
System.debug('DailyBulkV2QueryJobs: ' + limits.get('DailyBulkV2QueryJobs').getValue() + '/' + limits.get('DailyBulkV2QueryJobs').getLimit());
System.debug('DailyAsyncApexExecutions: ' + limits.get('DailyAsyncApexExecutions').getValue() + '/' + limits.get('DailyAsyncApexExecutions').getLimit());
System.debug('DailyStreamingApiEvents: ' + limits.get('DailyStreamingApiEvents').getValue() + '/' + limits.get('DailyStreamingApiEvents').getLimit());
System.debug('DailyStandardVolumePlatformEvents: ' + limits.get('DailyStandardVolumePlatformEvents').getValue() + '/' + limits.get('DailyStandardVolumePlatformEvents').getLimit());
```

```bash
sf apex run --file scripts/apex/api-usage.apex --target-org audit-org > docs/data/api-usage.txt
```

### Check Async Patterns
```bash
# Find Future methods
grep -rn "@future" force-app/main/default/classes --include="*.cls" > docs/data/future-methods.txt

# Find Queueable implementations
grep -rn "implements Queueable" force-app/main/default/classes --include="*.cls" > docs/data/queueable-classes.txt

# Find Batch implementations
grep -rn "implements Database.Batchable" force-app/main/default/classes --include="*.cls" > docs/data/batch-classes.txt

# Find Schedulable implementations
grep -rn "implements Schedulable" force-app/main/default/classes --include="*.cls" > docs/data/schedulable-classes.txt
```

---

## Step 4: Platform Events Analysis

### Query Platform Events
```bash
# Platform Event definitions
sf data query --query "SELECT Id, DeveloperName, MasterLabel, Description FROM PlatformEventChannelMember" --target-org audit-org --json > docs/data/platform-events.json 2>/dev/null || echo "Query via Tooling API"

# Find Platform Event usage in code
grep -rn "EventBus.publish\|__e" force-app/main/default/classes --include="*.cls" > docs/data/platform-event-usage.txt

# Find Platform Event triggers
find force-app -name "*__e.trigger" > docs/data/platform-event-triggers.txt
```

### Check Change Data Capture
```bash
# CDC entities
sf data query --query "SELECT Id, EntityDefinition.QualifiedApiName FROM ChangeDataCaptureEntityDefinition" --target-org audit-org --json > docs/data/cdc-entities.json 2>/dev/null || echo "CDC not enabled or no access"

# Find CDC subscribers
grep -rn "ChangeEvent" force-app/main/default --include="*.cls" --include="*.trigger" > docs/data/cdc-subscribers.txt
```

---

## Step 5: Analyze Integration Error Handling

### Check Error Handling Patterns
```bash
# Callouts with try-catch
grep -B5 -A10 "Http\s*h\s*=\s*new\s*Http" force-app/main/default/classes --include="*.cls" | \
    grep -l "try\|catch" > docs/data/callouts-with-try-catch.txt

# Callouts without proper error handling
grep -B5 -A10 "Http\s*h\s*=\s*new\s*Http" force-app/main/default/classes --include="*.cls" | \
    grep -L "try" > docs/data/callouts-without-error-handling.txt
```

### Check Timeout Handling
```bash
# Search for timeout settings
grep -rn "setTimeout\|Timeout" force-app/main/default/classes --include="*.cls" > docs/data/timeout-settings.txt
```

### Check Retry Logic
```bash
# Search for retry patterns
grep -rn "retry\|Retry\|attempt\|maxRetries" force-app/main/default/classes --include="*.cls" > docs/data/retry-logic.txt
```

---

## Step 6: External Services Analysis

### Query External Service Registrations
```bash
# External Services (OpenAPI based)
sf project retrieve start --metadata ExternalServiceRegistration --target-org audit-org --output-dir force-app

# List external services
find force-app -name "*.externalServiceRegistration-meta.xml" -exec basename {} .externalServiceRegistration-meta.xml \; > docs/data/external-services-list.txt
```

---

## Step 7: Integration Architecture Assessment

### Create Integration Assessment Script
Create file `scripts/analyze-integrations.js`:
```javascript
const fs = require('fs');

const assessment = {
    namedCredentials: { count: 0, list: [] },
    hardcodedEndpoints: { count: 0, issues: [] },
    connectedApps: { count: 0, list: [] },
    remoteSites: { count: 0, list: [] },
    calloutClasses: { count: 0, list: [] },
    asyncPatterns: {
        future: 0,
        queueable: 0,
        batch: 0,
        platformEvents: 0
    },
    recommendations: [],
    findings: []
};

let findingId = 1;

// Load Named Credentials
try {
    const nc = JSON.parse(fs.readFileSync('docs/data/named-credentials-detail.json', 'utf8'));
    assessment.namedCredentials.count = nc.result.records.length;
    assessment.namedCredentials.list = nc.result.records.map(r => ({
        name: r.DeveloperName,
        endpoint: r.Endpoint,
        authType: r.PrincipalType
    }));
} catch(e) {}

// Load Hardcoded Endpoints
try {
    const lines = fs.readFileSync('docs/data/hardcoded-endpoints.txt', 'utf8').split('\n').filter(l => l);
    assessment.hardcodedEndpoints.count = lines.length;

    lines.forEach(line => {
        const match = line.match(/^([^:]+):(\d+):/);
        if (match) {
            assessment.hardcodedEndpoints.issues.push({
                file: match[1].replace('force-app/main/default/classes/', ''),
                line: parseInt(match[2])
            });

            assessment.findings.push({
                id: `INT-${String(findingId++).padStart(3, '0')}`,
                category: 'Integration',
                severity: 'High',
                title: 'Hardcoded endpoint URL',
                description: 'Integration endpoint is hardcoded instead of using Named Credential',
                location: `${match[1].replace('force-app/main/default/classes/', '')}:${match[2]}`,
                impact: 'Deployment issues between environments, credential exposure risk',
                recommendation: 'Migrate to Named Credentials for endpoint and authentication management',
                effort: 'Medium',
                tool: 'Code Search'
            });
        }
    });
} catch(e) {}

// Load Async Patterns
try {
    assessment.asyncPatterns.future = fs.readFileSync('docs/data/future-methods.txt', 'utf8').split('\n').filter(l => l).length;
    assessment.asyncPatterns.queueable = fs.readFileSync('docs/data/queueable-classes.txt', 'utf8').split('\n').filter(l => l).length;
    assessment.asyncPatterns.batch = fs.readFileSync('docs/data/batch-classes.txt', 'utf8').split('\n').filter(l => l).length;
} catch(e) {}

// Generate Recommendations
if (assessment.hardcodedEndpoints.count > 0) {
    assessment.recommendations.push({
        priority: 'High',
        area: 'Credential Management',
        recommendation: 'Migrate all hardcoded endpoints to Named Credentials',
        benefit: 'Secure credential storage, easier environment management'
    });
}

if (assessment.asyncPatterns.future > 5) {
    assessment.recommendations.push({
        priority: 'Medium',
        area: 'Async Patterns',
        recommendation: 'Consider migrating @future methods to Queueable for better control and chaining',
        benefit: 'Better error handling, job monitoring, and ability to chain jobs'
    });
}

if (assessment.namedCredentials.count === 0 && assessment.hardcodedEndpoints.count > 0) {
    assessment.recommendations.push({
        priority: 'Critical',
        area: 'Security',
        recommendation: 'Implement Named Credentials for all external integrations',
        benefit: 'Centralized credential management, automatic token refresh, security compliance'
    });
}

// Output
console.log('=== Integration Architecture Assessment ===\n');
console.log(`Named Credentials: ${assessment.namedCredentials.count}`);
console.log(`Hardcoded Endpoints: ${assessment.hardcodedEndpoints.count}`);
console.log(`Connected Apps: ${assessment.connectedApps.count}`);
console.log(`\nAsync Patterns:`);
console.log(`  @future methods: ${assessment.asyncPatterns.future}`);
console.log(`  Queueable classes: ${assessment.asyncPatterns.queueable}`);
console.log(`  Batch classes: ${assessment.asyncPatterns.batch}`);

console.log('\nRecommendations:');
assessment.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. [${rec.priority}] ${rec.area}: ${rec.recommendation}`);
});

fs.writeFileSync('docs/data/integration-assessment.json', JSON.stringify(assessment, null, 2));
fs.writeFileSync('docs/data/integration-findings.json', JSON.stringify(assessment.findings, null, 2));

console.log(`\nGenerated ${assessment.findings.length} integration findings`);
```

### Execute
```bash
node scripts/analyze-integrations.js > docs/data/integration-assessment.txt
```

---

## Step 8: Integration Questionnaire for Architects

### Key Questions to Ask

```markdown
## Integration Discovery Questions

### Q1. Integration Inventory
1. How many external systems integrate with Salesforce?
2. List all integration points (inbound and outbound):
   | System | Direction | Method | Frequency | Volume |
   |--------|-----------|--------|-----------|--------|
   |        |           |        |           |        |

### Q2. Integration Patterns
3. What integration patterns are used?
   - [ ] Real-time API calls
   - [ ] Batch/Bulk processing
   - [ ] Platform Events (event-driven)
   - [ ] Change Data Capture
   - [ ] Outbound Messages
   - [ ] Scheduled sync
   - [ ] Middleware (MuleSoft, Boomi, etc.)

4. For high-volume integrations (>10,000 records/day):
   - [ ] Using Bulk API 2.0
   - [ ] Using Composite API
   - [ ] Using Platform Events
   - [ ] Custom batch processing

### Q3. Volume & Performance
5. What are the daily API call volumes?
   - Current usage: _____ calls/day
   - Peak usage: _____ calls/day
   - API limit: _____ calls/day

6. Are there any integrations hitting governor limits?
   - [ ] Yes - describe: __________
   - [ ] No

### Q4. Security
7. How are credentials managed?
   - [ ] Named Credentials
   - [ ] External Credentials
   - [ ] Custom Settings (encrypted)
   - [ ] Hardcoded (ISSUE)

8. Is certificate-based authentication used?
   - [ ] Yes - for which integrations? __________
   - [ ] No

### Q5. Error Handling & Monitoring
9. How are integration failures detected?
   - [ ] Real-time alerts
   - [ ] Daily reports
   - [ ] Manual review
   - [ ] Not monitored (ISSUE)

10. Is there retry logic for failed integrations?
    - [ ] Yes - automatic
    - [ ] Yes - manual
    - [ ] No

### Q6. Architecture Decisions
11. Why was current integration pattern chosen over alternatives?

12. Are there integrations that should be:
    - Moved to event-driven (Platform Events)?
    - Moved to Bulk API for better performance?
    - Consolidated through middleware?

### Q7. Documentation
13. Is there an integration architecture diagram?
    - [ ] Yes - current
    - [ ] Yes - outdated
    - [ ] No

14. Is there runbook documentation for each integration?
    - [ ] Yes - comprehensive
    - [ ] Yes - partial
    - [ ] No
```

---

## Step 9: Integration Best Practices Check

### Assessment Criteria

| Criterion | Best Practice | Anti-Pattern |
|-----------|---------------|--------------|
| **Credentials** | Named Credentials | Hardcoded in code |
| **High Volume** | Bulk API 2.0, Platform Events | Individual API calls in loops |
| **Error Handling** | Try-catch, retry logic, monitoring | Silent failures |
| **Real-time needs** | Platform Events, CDC | Polling |
| **Authentication** | OAuth 2.0, JWT | Basic Auth with exposed credentials |
| **Endpoint management** | Named Credentials | Remote Site + hardcoded URL |
| **Large data sync** | Batch Apex + Bulk API | Synchronous processing |
| **Monitoring** | Custom logging object, Platform Events | No monitoring |

### Generate Integration Scorecard
```javascript
// Add to scripts/analyze-integrations.js

const scorecard = {
    credentialManagement: 0,  // 0-10
    errorHandling: 0,         // 0-10
    asyncPatterns: 0,         // 0-10
    monitoring: 0,            // 0-10
    documentation: 0,         // 0-10
    total: 0
};

// Score calculations
scorecard.credentialManagement = assessment.namedCredentials.count > 0 &&
                                  assessment.hardcodedEndpoints.count === 0 ? 10 :
                                  assessment.namedCredentials.count > 0 ? 5 : 0;

scorecard.asyncPatterns = assessment.asyncPatterns.queueable > assessment.asyncPatterns.future ? 10 :
                          assessment.asyncPatterns.queueable > 0 ? 7 : 5;

scorecard.total = Object.values(scorecard).reduce((a, b) => a + b, 0) / 5;

console.log(`\nIntegration Health Score: ${scorecard.total}/10`);
```

---

## Output Checklist

After completing Phase 8, verify you have:

- [ ] Named Credentials inventory
- [ ] Connected Apps inventory
- [ ] Remote Site Settings list
- [ ] Hardcoded endpoints identified
- [ ] Callout code analyzed
- [ ] API usage documented
- [ ] Async patterns documented
- [ ] Platform Events analyzed
- [ ] Error handling assessed
- [ ] Integration findings generated
- [ ] Architecture recommendations provided

### Expected Files
```
docs/data/named-credentials-detail.json
docs/data/external-credentials.json
docs/data/connected-apps-detail.json
docs/data/remote-site-endpoints.txt
docs/data/hardcoded-endpoints.txt
docs/data/http-callout-code.txt
docs/data/api-usage.txt
docs/data/future-methods.txt
docs/data/queueable-classes.txt
docs/data/batch-classes.txt
docs/data/platform-event-usage.txt
docs/data/integration-assessment.json
docs/data/integration-findings.json
```

---

## Next Phase
Proceed to [09-governance-review.md](09-governance-review.md)
