# Phase 6: Data Model Analysis

## Objective
Analyze custom objects, fields, relationships, and schema design.

---

## Step 1: Object Inventory

### Query Custom Objects
```bash
# Custom objects with record counts
sf data query --query "SELECT QualifiedApiName, Label, Description, IsCustomizable, KeyPrefix, RecordTypesEnabled FROM EntityDefinition WHERE IsCustomizable = true AND QualifiedApiName LIKE '%__c' ORDER BY QualifiedApiName" --target-org audit-org --json > docs/data/custom-objects-detail.json

# Record counts per object
for obj in Account Contact Opportunity Case Lead; do
    count=$(sf data query --query "SELECT COUNT() FROM $obj" --target-org audit-org --json | jq '.result.totalSize')
    echo "$obj: $count records"
done > docs/data/record-counts-standard.txt
```

### Query Field Counts
```bash
sf data query --query "SELECT EntityDefinition.QualifiedApiName objName, COUNT(Id) fieldCount FROM FieldDefinition WHERE EntityDefinition.IsCustomizable = true GROUP BY EntityDefinition.QualifiedApiName HAVING COUNT(Id) > 50 ORDER BY COUNT(Id) DESC" --target-org audit-org --json > docs/data/objects-with-many-fields.json
```

---

## Step 2: Field Analysis

### Identify Unused Fields (via Field History or Reports)
```bash
# Fields without descriptions
sf data query --query "SELECT QualifiedApiName, EntityDefinition.QualifiedApiName, Description FROM FieldDefinition WHERE EntityDefinition.IsCustomizable = true AND Description = null LIMIT 500" --target-org audit-org --json > docs/data/fields-without-descriptions.json
```

### Field Types Distribution
```bash
sf data query --query "SELECT DataType, COUNT(Id) FROM FieldDefinition WHERE EntityDefinition.IsCustomizable = true GROUP BY DataType ORDER BY COUNT(Id) DESC" --target-org audit-org --json > docs/data/field-types-distribution.json
```

---

## Step 3: Relationship Analysis

### Query Relationships
```bash
# Master-Detail relationships (from metadata)
grep -r "<type>MasterDetail</type>" force-app/main/default/objects --include="*.field-meta.xml" > docs/data/master-detail-fields.txt

# Lookup relationships
grep -r "<type>Lookup</type>" force-app/main/default/objects --include="*.field-meta.xml" > docs/data/lookup-fields.txt

# Count
echo "Master-Detail relationships: $(wc -l < docs/data/master-detail-fields.txt)"
echo "Lookup relationships: $(wc -l < docs/data/lookup-fields.txt)"
```

---

## Step 4: Validation Rules Analysis

### Query Validation Rules
```bash
# Active validation rules
find force-app -name "*.validationRule-meta.xml" | while read file; do
    name=$(basename "$file" .validationRule-meta.xml)
    active=$(grep -oP '(?<=<active>)[^<]+' "$file")
    formula=$(grep -oP '(?<=<errorConditionFormula>)[^<]+' "$file" | head -1)
    echo "$name|$active|${#formula} chars"
done > docs/data/validation-rules-detail.txt
```

### Identify Complex Validation Rules
```bash
# Validation rules with long formulas (complexity indicator)
cat docs/data/validation-rules-detail.txt | awk -F'|' '$3 > 500 {print $1 ": " $3 " characters (complex)"}' > docs/data/complex-validation-rules.txt
```

---

## Step 5: Record Types Analysis

### Query Record Types
```bash
sf data query --query "SELECT SobjectType, Name, DeveloperName, Description, IsActive FROM RecordType ORDER BY SobjectType, Name" --target-org audit-org --json > docs/data/record-types-detail.json

# Count by object
sf data query --query "SELECT SobjectType, COUNT(Id) FROM RecordType WHERE IsActive = true GROUP BY SobjectType ORDER BY COUNT(Id) DESC" --target-org audit-org --json > docs/data/record-types-by-object.json
```

---

## Step 6: Generate Data Model Findings

Create file `scripts/generate-data-model-findings.js`:
```javascript
const fs = require('fs');

const findings = [];
let findingId = 1;

// Check objects with many fields (limit is 800 for custom, 500 for standard additions)
try {
    const manyFields = JSON.parse(fs.readFileSync('docs/data/objects-with-many-fields.json', 'utf8'));
    manyFields.result.records.forEach(obj => {
        if (obj.fieldCount > 200) {
            findings.push({
                id: `DM-${String(findingId++).padStart(3, '0')}`,
                category: 'Data Model',
                severity: obj.fieldCount > 500 ? 'High' : 'Medium',
                title: `Object ${obj.objName} has ${obj.fieldCount} fields`,
                description: `High field count may indicate need for object restructuring`,
                location: `Object: ${obj.objName}`,
                impact: 'Performance issues, approaching field limits, maintenance complexity',
                recommendation: 'Review field usage, archive unused fields, consider related objects',
                effort: 'High',
                tool: 'Data Model Analysis'
            });
        }
    });
} catch(e) {}

// Check fields without descriptions
try {
    const noDesc = JSON.parse(fs.readFileSync('docs/data/fields-without-descriptions.json', 'utf8'));
    if (noDesc.result.records.length > 100) {
        findings.push({
            id: `DM-${String(findingId++).padStart(3, '0')}`,
            category: 'Data Model',
            severity: 'Low',
            title: `${noDesc.result.records.length} fields without descriptions`,
            description: 'Fields lack documentation, impacting maintainability',
            location: 'Multiple objects',
            impact: 'Reduced data quality understanding, onboarding difficulties',
            recommendation: 'Add descriptions to custom fields',
            effort: 'Medium',
            tool: 'Data Model Analysis'
        });
    }
} catch(e) {}

fs.writeFileSync('docs/data/data-model-findings.json', JSON.stringify(findings, null, 2));
console.log(`Generated ${findings.length} Data Model findings`);
```

### Execute
```bash
node scripts/generate-data-model-findings.js
```

---

## Output Files
```
docs/data/custom-objects-detail.json
docs/data/record-counts-standard.txt
docs/data/objects-with-many-fields.json
docs/data/fields-without-descriptions.json
docs/data/field-types-distribution.json
docs/data/master-detail-fields.txt
docs/data/lookup-fields.txt
docs/data/validation-rules-detail.txt
docs/data/record-types-detail.json
docs/data/data-model-findings.json
```

---

## Next Phase
Proceed to [07-storage-limits-analysis.md](07-storage-limits-analysis.md)
