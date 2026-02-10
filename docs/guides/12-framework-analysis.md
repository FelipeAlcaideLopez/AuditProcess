# Phase 12: Framework & Architecture Pattern Analysis

## Objective
Identify existing frameworks, design patterns, and architectural decisions in the codebase to understand code maturity and provide targeted recommendations.

## What We Detect

### 1. Trigger Frameworks
| Framework | Indicators |
|-----------|------------|
| FFLib (Apex Enterprise Patterns) | `fflib_SObjectDomain`, `fflib_SObjectSelector`, `fflib_Application` |
| Kevin O'Hara Pattern | `TriggerHandler`, `run()`, `beforeInsert()`, `afterInsert()` |
| Nebula Logger | `NebulaLogger`, `Logger.`, `LogEntryEventBuilder` |
| Custom Framework | `TriggerFactory`, `ITriggerHandler`, `TriggerDispatcher` |

### 2. Integration Patterns
- **HTTP Callouts**: `HttpRequest`, `HttpResponse`, `Http.send()`
- **Async Processing**: `Queueable`, `Database.Batchable`, `Schedulable`
- **Future Methods**: `@future(callout=true)`

### 3. Design Patterns (Separation of Concerns)
| Pattern | Detection |
|---------|-----------|
| Selector | Classes named `*Selector`, `fflib_SObjectSelector` |
| Service | Classes named `*Service` |
| Domain | Classes named `*Domain`, `fflib_SObjectDomain` |
| Factory | Classes named `*Factory` |
| Singleton | `getInstance()` pattern |
| Builder | Fluent interface with `return this;` |

### 4. Test Patterns
- **Test Data Factory**: `TestDataFactory`, `TestFactory`, `TestUtil` classes
- **TestSetup**: `@TestSetup` annotation usage
- **Mocking**: `Mock`, `Stub`, `HttpCalloutMock` implementations

## Execution

```bash
# Run framework analysis
node scripts/analyze-frameworks.js
```

## Output Files
- `docs/data/framework-analysis.json` - Complete analysis
- `docs/data/framework-findings.json` - Generated findings

## Analysis Results Interpretation

### Good Signs (Mature Codebase)
- ✓ Consistent trigger framework usage
- ✓ Separation of concerns (Selector/Service/Domain)
- ✓ Test data factory pattern
- ✓ Async patterns for integrations (Queueable)

### Warning Signs (Technical Debt)
- ✗ No trigger framework
- ✗ Business logic in triggers
- ✗ No separation of concerns
- ✗ No test data factory
- ✗ Synchronous callouts without async handling

## Common Recommendations

### No Trigger Framework
```
Recommendation: Implement a trigger framework
Options:
1. FFLib (Enterprise Patterns) - Full framework with Selector/Service/Domain
2. Kevin O'Hara Pattern - Lightweight, trigger-focused
3. Custom Implementation - Based on ITriggerHandler interface
```

### Missing Separation of Concerns
```
Recommendation: Implement layer separation
- Selectors: Centralize all SOQL queries
- Services: Business logic layer
- Domains: Object-specific validation and behavior
```

### No Test Data Factory
```
Recommendation: Create TestDataFactory class
- Centralize test record creation
- Use @TestSetup for efficiency
- Implement mock classes for callouts
```

## Integration with Audit

The framework findings are consolidated with other findings:

```bash
# After running framework analysis
node scripts/consolidate-findings.js
node scripts/generate-executive-summary.js
```

## Framework-Specific Queries

### Check for FFLib Usage
```bash
grep -r "fflib_" force-app/main/default/classes/ --include="*.cls" | head -20
```

### Find Trigger Handlers
```bash
grep -r "TriggerHandler\|ITriggerHandler" force-app/main/default/classes/ --include="*.cls"
```

### Find Service Classes
```bash
ls force-app/main/default/classes/ | grep -i "service"
```

## Scoring Impact

| Finding | Severity | Score Impact |
|---------|----------|--------------|
| No Trigger Framework | Medium | -2 |
| Business Logic in Triggers | Medium | -2 |
| No Separation of Concerns | Low | -1 |
| No Test Data Factory | Low | -1 |
| Callouts without Async | Info | 0 |
