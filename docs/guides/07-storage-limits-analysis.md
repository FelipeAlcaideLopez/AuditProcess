# Phase 7: Storage & Limits Analysis

## Objective
Analyze data storage, file storage, and org limits consumption.

---

## Step 1: Query Org Limits

### Get All Limits via Apex
Create file `scripts/apex/get-all-limits.apex`:
```apex
Map<String, System.OrgLimit> limitsMap = OrgLimits.getMap();
List<Map<String, Object>> results = new List<Map<String, Object>>();

for(String limitName : limitsMap.keySet()) {
    System.OrgLimit ol = limitsMap.get(limitName);
    Decimal pct = ol.getLimit() > 0 ?
        ((Decimal)ol.getValue() / ol.getLimit() * 100).setScale(2) : 0;

    results.add(new Map<String, Object>{
        'name' => limitName,
        'used' => ol.getValue(),
        'max' => ol.getLimit(),
        'percentage' => pct,
        'status' => pct > 80 ? 'CRITICAL' : (pct > 50 ? 'WARNING' : 'OK')
    });
}

// Sort by percentage descending
results.sort();
System.debug(JSON.serializePretty(results));
```

### Execute
```bash
sf apex run --file scripts/apex/get-all-limits.apex --target-org audit-org > docs/data/org-limits-full.txt
```

### Via REST API
```bash
# Get access token
TOKEN=$(sf org display --target-org audit-org --json | jq -r '.result.accessToken')
INSTANCE=$(sf org display --target-org audit-org --json | jq -r '.result.instanceUrl')

# Query limits
curl -s -H "Authorization: Bearer $TOKEN" "$INSTANCE/services/data/v59.0/limits/" | jq '.' > docs/data/org-limits-api.json
```

---

## Step 2: Data Storage Analysis

### Query Storage by Object (Top consumers)
```bash
# Standard objects
for obj in Account Contact Opportunity Case Lead Task Event EmailMessage Attachment ContentVersion; do
    count=$(sf data query --query "SELECT COUNT() FROM $obj" --target-org audit-org --json 2>/dev/null | jq -r '.result.totalSize // 0')
    echo "$obj: $count records"
done > docs/data/record-counts-top-objects.txt

# Sort by count
sort -t: -k2 -rn docs/data/record-counts-top-objects.txt > docs/data/record-counts-sorted.txt
```

### Estimate Storage Per Object
```apex
// Anonymous Apex - Get approximate storage
List<String> objects = new List<String>{
    'Account', 'Contact', 'Opportunity', 'Case', 'Lead',
    'Task', 'Event', 'EmailMessage'
};

for(String objName : objects) {
    try {
        Integer cnt = Database.countQuery('SELECT COUNT() FROM ' + objName);
        // Approximate: 2KB per record average
        Decimal storageMB = (cnt * 2.0) / 1024;
        System.debug(objName + ': ' + cnt + ' records (~' + storageMB.setScale(2) + ' MB)');
    } catch(Exception e) {
        System.debug(objName + ': Error - ' + e.getMessage());
    }
}
```

---

## Step 3: File Storage Analysis

### Query File Storage
```bash
# ContentVersion (Files) analysis
sf data query --query "SELECT FileType, COUNT(Id) cnt, SUM(ContentSize) totalSize FROM ContentVersion WHERE IsLatest = true GROUP BY FileType ORDER BY SUM(ContentSize) DESC LIMIT 20" --target-org audit-org --json > docs/data/file-storage-by-type.json

# Largest files
sf data query --query "SELECT Title, FileType, ContentSize, CreatedDate, Owner.Name FROM ContentVersion WHERE IsLatest = true ORDER BY ContentSize DESC LIMIT 50" --target-org audit-org --json > docs/data/largest-files.json

# Legacy Attachments
sf data query --query "SELECT Parent.Type, COUNT(Id) cnt, SUM(BodyLength) totalSize FROM Attachment GROUP BY Parent.Type ORDER BY SUM(BodyLength) DESC LIMIT 20" --target-org audit-org --json > docs/data/attachments-by-parent.json
```

### Check for Migration Opportunities
```bash
# Count legacy Attachments vs Files
ATTACHMENTS=$(sf data query --query "SELECT COUNT() FROM Attachment" --target-org audit-org --json | jq '.result.totalSize')
FILES=$(sf data query --query "SELECT COUNT() FROM ContentDocument" --target-org audit-org --json | jq '.result.totalSize')

echo "Legacy Attachments: $ATTACHMENTS"
echo "Content Documents (Files): $FILES"

if [ "$ATTACHMENTS" -gt 1000 ]; then
    echo "RECOMMENDATION: Consider migrating Attachments to Files"
fi
```

---

## Step 4: Analyze Critical Limits

### Create Limits Analysis Script
Create file `scripts/analyze-limits.js`:
```javascript
const fs = require('fs');

// Parse limits from API response
let limits;
try {
    limits = JSON.parse(fs.readFileSync('docs/data/org-limits-api.json', 'utf8'));
} catch(e) {
    console.error('Error reading limits file');
    process.exit(1);
}

const criticalLimits = [
    'DailyApiRequests',
    'DataStorageMB',
    'FileStorageMB',
    'DailyAsyncApexExecutions',
    'DailyBulkApiRequests',
    'DailyBulkV2QueryJobs',
    'DailyWorkflowEmails',
    'DailySingleEmailSent',
    'DailyStreamingApiEvents',
    'DailyStandardVolumePlatformEvents',
    'ConcurrentAsyncGetReportInstances',
    'HourlyPublishedPlatformEvents'
];

const analysis = {
    timestamp: new Date().toISOString(),
    summary: { critical: 0, warning: 0, ok: 0 },
    limits: [],
    findings: []
};

let findingId = 1;

criticalLimits.forEach(limitName => {
    if (limits[limitName]) {
        const limit = limits[limitName];
        const percentage = limit.Max > 0 ?
            ((limit.Remaining !== undefined ?
                (limit.Max - limit.Remaining) : 0) / limit.Max * 100).toFixed(2) : 0;

        const used = limit.Remaining !== undefined ?
            limit.Max - limit.Remaining : 0;

        const status = percentage > 80 ? 'CRITICAL' :
                      percentage > 50 ? 'WARNING' : 'OK';

        analysis.limits.push({
            name: limitName,
            used: used,
            max: limit.Max,
            percentage: parseFloat(percentage),
            status: status
        });

        if (status === 'CRITICAL') analysis.summary.critical++;
        else if (status === 'WARNING') analysis.summary.warning++;
        else analysis.summary.ok++;

        // Generate finding for critical limits
        if (status === 'CRITICAL') {
            analysis.findings.push({
                id: `LIM-${String(findingId++).padStart(3, '0')}`,
                category: 'Performance',
                severity: 'Critical',
                title: `Limit ${limitName} at ${percentage}%`,
                description: `${limitName} is at ${percentage}% capacity (${used}/${limit.Max})`,
                location: 'Org Limits',
                impact: 'Operations may fail when limit is reached',
                recommendation: getLimitRecommendation(limitName),
                effort: 'High',
                tool: 'Org Limits API'
            });
        }
    }
});

function getLimitRecommendation(limitName) {
    const recommendations = {
        'DataStorageMB': 'Archive old records, implement data retention policy',
        'FileStorageMB': 'Archive old files, move to external storage',
        'DailyApiRequests': 'Optimize integrations, use Bulk API, implement caching',
        'DailyAsyncApexExecutions': 'Review scheduled jobs, optimize batch sizes',
        'DailyBulkApiRequests': 'Consolidate bulk operations, review integration patterns'
    };
    return recommendations[limitName] || 'Review usage and optimize';
}

// Output
console.log('=== Org Limits Analysis ===\n');
console.log(`Critical: ${analysis.summary.critical}`);
console.log(`Warning: ${analysis.summary.warning}`);
console.log(`OK: ${analysis.summary.ok}\n`);

console.log('Detailed Status:');
analysis.limits
    .sort((a, b) => b.percentage - a.percentage)
    .forEach(l => {
        const bar = '█'.repeat(Math.floor(l.percentage / 5)) +
                   '░'.repeat(20 - Math.floor(l.percentage / 5));
        console.log(`${l.name.padEnd(35)} [${bar}] ${l.percentage}% (${l.status})`);
    });

fs.writeFileSync('docs/data/limits-analysis.json', JSON.stringify(analysis, null, 2));
fs.writeFileSync('docs/data/limits-findings.json', JSON.stringify(analysis.findings, null, 2));

console.log(`\nGenerated ${analysis.findings.length} limits findings`);
```

### Execute
```bash
node scripts/analyze-limits.js > docs/data/limits-analysis.txt
```

---

## Step 5: Generate Storage Dashboard Data

### Create Dashboard Data
```javascript
// Add to scripts/analyze-limits.js or create new script

const dashboardData = {
    storage: {
        data: {
            used: 0, // From DataStorageMB
            limit: 0,
            percentage: 0
        },
        files: {
            used: 0, // From FileStorageMB
            limit: 0,
            percentage: 0
        }
    },
    api: {
        daily: {
            used: 0,
            limit: 0,
            percentage: 0
        }
    },
    topObjects: [],
    topFileTypes: []
};

// For Mermaid pie chart
console.log('\n```mermaid');
console.log('pie title Storage Usage');
console.log(`    "Data Used" : ${dashboardData.storage.data.used}`);
console.log(`    "Data Available" : ${dashboardData.storage.data.limit - dashboardData.storage.data.used}`);
console.log('```');
```

---

## Output Files
```
docs/data/org-limits-full.txt
docs/data/org-limits-api.json
docs/data/record-counts-top-objects.txt
docs/data/record-counts-sorted.txt
docs/data/file-storage-by-type.json
docs/data/largest-files.json
docs/data/attachments-by-parent.json
docs/data/limits-analysis.json
docs/data/limits-analysis.txt
docs/data/limits-findings.json
```

---

## Next Phase
Proceed to [08-integration-analysis.md](08-integration-analysis.md)
