# Salesforce Org Audit Process

## Overview
Comprehensive audit framework for Salesforce organizations. All outputs in English.

## Role
Senior Salesforce Consultant specialized in technical audits using:
- **PMD** for Apex static analysis
- **ESLint** for LWC analysis
- **Flow Scanner** for Flow analysis
- **SOQL queries** for security/permissions review

## Audit Execution Flow

```
1. Retrieve Metadata → 2. Run Analysis Tools → 3. Generate Findings → 4. Create Reports
```

### Critical First Step: Retrieve ALL Metadata
Before any analysis, retrieve metadata to `force-app/main/default/`:

```bash
# Connect to org
sf org login web --alias audit-org

# Retrieve key metadata (run these first)
sf project retrieve start --metadata ApexClass,ApexTrigger,Flow,LightningComponentBundle --target-org audit-org

# Additional metadata as needed
sf project retrieve start --metadata Profile,PermissionSet,CustomObject --target-org audit-org
```

## Audit Phases

| Phase | Guide | Tools |
|-------|-------|-------|
| 0 | `docs/guides/00-discovery-setup.md` | SF CLI, PMD setup |
| 1 | `docs/guides/01-metadata-extraction.md` | sf retrieve |
| 2 | `docs/guides/02-apex-analysis.md` | PMD |
| 3 | `docs/guides/03-lwc-analysis.md` | ESLint |
| 4 | `docs/guides/04-flow-analysis.md` | Flow Scanner |
| 5 | `docs/guides/05-security-analysis.md` | SOQL queries |
| 6 | `docs/guides/06-data-model-analysis.md` | SOQL queries |
| 7 | `docs/guides/07-storage-limits-analysis.md` | Limits API |
| 8 | `docs/guides/08-integration-analysis.md` | Code grep, SOQL |
| 9 | `docs/guides/09-governance-review.md` | Questionnaire |
| 10 | `docs/guides/10-report-generation.md` | Node scripts |
| 11 | `docs/guides/11-optimizer-analysis.md` | SF Optimizer |
| 12 | `docs/guides/12-framework-analysis.md` | Pattern Detection |
| 13 | `docs/guides/13-package-analysis.md` | Installed Packages |

## Key Commands

```bash
# PMD Analysis (after retrieving Apex)
pmd check --dir force-app/main/default/classes --rulesets config/apex-ruleset.xml --format json --report-file reports/pmd/pmd-report.json

# Flow Analysis
node scripts/analyze-flows.js

# Framework/Pattern Analysis
node scripts/analyze-frameworks.js

# Package Analysis
node scripts/analyze-packages.js

# Org Limits
curl -H "Authorization: Bearer $TOKEN" "$INSTANCE/services/data/v59.0/limits/"

# Consolidate Findings
node scripts/consolidate-findings.js
node scripts/generate-executive-summary.js
```

## Finding Format

```json
{
  "id": "AUDIT-001",
  "category": "Security|Code Quality|Performance|Flow|Governance",
  "severity": "Critical|High|Medium|Low|Info",
  "title": "Brief description",
  "description": "Detailed explanation",
  "location": "File:line or Component name",
  "impact": "Business/technical impact",
  "recommendation": "How to fix",
  "effort": "Quick Win|Medium|High",
  "tool": "PMD|ESLint|Flow Scanner|SOQL|Manual"
}
```

## Severity Definitions

| Severity | Criteria |
|----------|----------|
| **Critical** | Security breach risk, data loss, compliance violation |
| **High** | Governor limits risk, significant performance impact |
| **Medium** | Best practice violations, maintainability issues |
| **Low** | Code style, minor improvements |
| **Info** | Observations, no action required |

## Key Security Queries

```sql
-- High privilege profiles
SELECT Name, PermissionsModifyAllData, PermissionsViewAllData
FROM Profile WHERE PermissionsModifyAllData = true

-- Permission Set usage
SELECT Assignee.Name, PermissionSet.Name
FROM PermissionSetAssignment WHERE Assignee.IsActive = true

-- Named Credentials
SELECT DeveloperName, Endpoint FROM NamedCredential
```

## Output Structure

```
docs/
├── guides/           # Execution guides (00-12) - tracked in git
├── data/             # JSON analysis data - NOT tracked (org-specific)
│   ├── all-findings.json
│   ├── framework-analysis.json
│   └── ...
└── analysis/
    └── executive-summary.md

reports/
├── pmd/              # PMD JSON reports
├── eslint/           # ESLint reports
└── flow-scanner/     # Flow analysis

scripts/
├── analyze-pmd-results.js
├── analyze-flows.js
├── analyze-frameworks.js
├── analyze-packages.js
├── analyze-security.js
├── consolidate-findings.js
└── generate-executive-summary.js

config/
└── apex-ruleset.xml  # PMD configuration
```

## Health Score

```
Score = 100 - (DebtScore / MaxScore × 100)

DebtScore = Σ(SeverityWeight × Count)
  Critical: 10, High: 5, Medium: 2, Low: 1

Interpretation:
  90-100: Excellent  |  75-89: Good
  60-74: Needs Work  |  <60: Critical
```

## Working Instructions

1. **Always retrieve metadata first** before running any analysis
2. Use `force-app/main/default/` as the source path for all tools
3. Generate JSON findings, then consolidate into reports
4. Reference specific file:line locations for each finding
5. For governance topics, use questionnaire from Phase 9 guide
6. Check individual guide files for detailed commands and scripts

## Quick Reference - PMD Rules

| Category | Key Rules |
|----------|-----------|
| Security | ApexCRUDViolation, ApexSOQLInjection, ApexSharingViolations |
| Performance | OperationWithLimitsInLoop, AvoidDebugStatements |
| Best Practices | AvoidLogicInTrigger, ApexUnitTestClassShouldHaveAsserts |
| Design | CyclomaticComplexity, ExcessiveParameterList |

## Quick Reference - Flow Issues

| Issue | Impact |
|-------|--------|
| DML in loop | Governor limits |
| No fault path | Silent failures |
| Hardcoded IDs | Deployment issues |
| High complexity (>20 elements) | Maintenance difficulty |

## Quick Reference - Framework Detection

| Framework/Pattern | What to Look For |
|-------------------|------------------|
| FFLib | `fflib_SObjectDomain`, `fflib_SObjectSelector`, `Application.cls` |
| Trigger Handler | `TriggerHandler`, `ITriggerHandler`, handler classes |
| Nebula Logger | `Logger.`, `NebulaLogger` |
| Selector Pattern | Classes named `*Selector` |
| Service Layer | Classes named `*Service` |
| Test Factory | `TestDataFactory`, `TestUtil` |
