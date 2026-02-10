# Phase 13: Installed Packages Analysis

## Objective
Analyze installed managed and unmanaged packages to understand ISV dependencies, product ecosystem, and upgrade planning.

## Why This Matters

- **Technical Dependencies**: Packages contain code you can't modify
- **Version Compatibility**: Packages must be compatible with each other
- **Support Contracts**: ISV relationships and support requirements
- **Upgrade Planning**: Understanding release cycles and dependencies
- **Cost Analysis**: License costs for ISV products

## Execution

```bash
# Run package analysis (uses Tooling API)
node scripts/analyze-packages.js
```

## Output Files
- `docs/data/installed-packages.json` - Raw package data from Tooling API
- `docs/data/package-analysis.json` - Analysis with categorization
- `docs/data/package-findings.json` - Generated findings

## What We Detect

### Package Categories
| Category | Description | Common Vendors |
|----------|-------------|----------------|
| Core Banking | Main banking platform | nCino |
| Documents | Document generation/management | Conga, S-Docs, nCino |
| E-Signature | Electronic signatures | DocuSign |
| Integration | External system connections | MuleSoft, nFUSE |
| Analytics | Reporting and BI | Tableau, nCino |
| CPQ | Configure-Price-Quote | Salesforce CPQ |

### Known Package Namespaces
| Namespace | Vendor | Product |
|-----------|--------|---------|
| `nCino` | nCino | Bank Operating System |
| `LLC_BI` | nCino | Platform |
| `nFORCE` | nCino | Force.com Framework |
| `NDOC` | nCino | Document Manager |
| `nFUSE` | nCino | Integration Platform |
| `DOCU` | nCino/DocuSign | DocuSign Integration |
| `APXTConga4` | Conga | Composer |
| `dsfs` | DocuSign | DocuSign for Salesforce |
| `SDOCS` | S-Docs | Document Generation |

## Analysis Results

### Good Signs
- All packages in Released state
- Compatible version matrix
- Active support contracts
- Documented upgrade schedule

### Warning Signs
- Packages in Beta/Pilot state
- Very old package versions
- Unmanaged packages (no namespace)
- Conflicting namespaces

## Findings Generated

| Finding Type | Severity | Criteria |
|--------------|----------|----------|
| Beta Packages | Medium | Packages not in Released state |
| Version Outdated | Low | Package >2 major versions behind |
| Multi-Vendor Complexity | Info | >5 different vendors |
| Deprecated Package | High | Package flagged as deprecated |

## Manual Checks

### Check Package Versions Against Current
```sql
-- Via Tooling API (REST)
GET /services/data/v59.0/tooling/query/?q=
SELECT+SubscriberPackage.Name,SubscriberPackageVersion.MajorVersion,
SubscriberPackageVersion.MinorVersion,SubscriberPackageVersion.ReleaseState
+FROM+InstalledSubscriberPackage
```

### Check for Package Limits Usage
```sql
-- Custom objects from packages
SELECT NamespacePrefix, COUNT(Id)
FROM CustomObject
WHERE NamespacePrefix != null
GROUP BY NamespacePrefix

-- Apex classes from packages
SELECT NamespacePrefix, COUNT(Id)
FROM ApexClass
WHERE NamespacePrefix != null
GROUP BY NamespacePrefix
```

## nCino Ecosystem Specifics

If nCino packages are detected:

### Version Compatibility
nCino packages must be upgraded together. Check:
- `nCino` (BOS) and `LLC_BI` (Platform) versions match
- `nFORCE` framework version is compatible
- Feature packages (NDOC, nCRED, etc.) are aligned

### Release Cadence
- nCino releases quarterly (Feb, May, Aug, Nov)
- Major version updates require testing
- Check Customer Success portal for release notes

### Key Namespaces
```
nCino:     Core Bank Operating System
LLC_BI:    Platform (loans, products)
nFORCE:    Framework (UI, utilities)
nCRED:     Credit Analysis
NDOC:      Document Manager
nFUSE:     Integration Platform
nFORMS:    Forms Engine
DOCU:      DocuSign Integration
```

## Recommendations by Scenario

### Multiple ISV Vendors
```
If vendors > 3:
1. Document all vendor relationships
2. Maintain support contact list
3. Create upgrade coordination calendar
4. Test integrations between packages
```

### Beta/Pilot Packages
```
If beta packages found:
1. Check GA release timeline
2. Document beta limitations
3. Plan upgrade path
4. Avoid production dependencies on beta features
```

### Old Package Versions
```
If packages > 2 versions behind:
1. Review release notes for security patches
2. Plan upgrade sprint
3. Test in sandbox first
4. Coordinate with ISV support
```

## Integration with Audit

Package findings are consolidated with other findings:

```bash
# After running package analysis
node scripts/consolidate-findings.js
node scripts/generate-executive-summary.js
```

The executive summary will include:
- Total packages installed
- Packages by vendor breakdown
- Package-related findings
