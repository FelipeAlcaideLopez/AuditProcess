# Salesforce Audit Rules by Metadata Type

This document catalogs all rules and best practices used in the Salesforce Org Audit Framework, organized by metadata dimension. Rules are sourced from PMD, Lightning Flow Scanner, and industry best practices (Hubbl, Quality Clouds patterns).

## Table of Contents

1. [Apex Classes & Triggers](#apex-classes--triggers)
2. [Flows & Process Automation](#flows--process-automation)
3. [Visualforce Pages](#visualforce-pages)
4. [Lightning Web Components](#lightning-web-components)
5. [Objects & Fields](#objects--fields)
6. [Security & Permissions](#security--permissions)
7. [Documentation & Descriptions](#documentation--descriptions)

---

## Apex Classes & Triggers

### Security Rules (10 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **ApexCRUDViolation** | Critical | Missing CRUD/FLS checks before DML | Users access/modify unauthorized data |
| **ApexSOQLInjection** | Critical | Untrusted variables in SOQL | Data exposure, unauthorized access |
| **ApexSharingViolations** | High | Classes without explicit sharing mode | Bypass record-level security |
| **ApexBadCrypto** | High | Hardcoded crypto keys/IVs | Compromised encryption |
| **ApexInsecureEndpoint** | High | HTTP instead of HTTPS | Data interception |
| **ApexOpenRedirect** | High | User-controlled redirects | Phishing attacks |
| **ApexXSSFromEscapeFalse** | High | Disabled escaping in addError | XSS vulnerability |
| **ApexXSSFromURLParam** | High | Unescaped URL parameters | XSS vulnerability |
| **ApexSuggestUsingNamedCred** | Medium | Hardcoded credentials | Credential exposure |
| **ApexDangerousMethods** | Medium | Usage of risky methods | Security bypass |

### Performance Rules (5 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **OperationWithLimitsInLoop** | Critical | SOQL/DML inside loops | Governor limit exceptions |
| **OperationWithHighCostInLoop** | High | Expensive operations in loops | Performance degradation |
| **AvoidDebugStatements** | Medium | System.debug statements | CPU consumption |
| **EagerlyLoadedDescribeSObjectResult** | Medium | Inefficient describe calls | Performance impact |
| **AvoidNonRestrictiveQueries** | Medium | Unfiltered SOQL queries | Large data volumes |

### Best Practices (11 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **AvoidLogicInTrigger** | High | Business logic in triggers | Hard to test/maintain |
| **ApexUnitTestShouldNotUseSeeAllDataTrue** | High | SeeAllData=true in tests | Unreliable tests, data exposure |
| **ApexUnitTestClassShouldHaveAsserts** | High | Tests without assertions | False positive tests |
| **AvoidGlobalModifier** | Medium | Unnecessary global classes | Namespace pollution |
| **ApexUnitTestClassShouldHaveRunAs** | Medium | Missing runAs in tests | Missing permission testing |
| **ApexUnitTestMethodShouldHaveIsTestAnnotation** | Low | Using testMethod keyword | Deprecated syntax |
| **AvoidFutureAnnotation** | Low | @Future usage | Legacy async pattern |
| **UnusedLocalVariable** | Low | Declared but unused variables | Code clutter |
| **QueueableWithoutFinalizer** | Low | Queueable without Finalizer | Missing error handling |
| **DebugsShouldUseLoggingLevel** | Info | Debug without log level | Log pollution |
| **ApexAssertionsShouldIncludeMessage** | Info | Assertions without messages | Harder debugging |

### Design Rules (14 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **CyclomaticComplexity** | High | High method complexity (>10) | Hard to maintain/test |
| **CognitiveComplexity** | High | Complex code patterns | Difficult to understand |
| **ExcessiveParameterList** | Medium | Methods with many parameters | Poor design |
| **ExcessivePublicCount** | Medium | Too many public members | Testing burden |
| **TooManyFields** | Medium | Classes with many fields | Poor design |
| **AvoidDeeplyNestedIfStmts** | Medium | Deep nesting (>4 levels) | Error prone |
| **NcssCount** | Medium | Excessive lines of code | Maintainability |
| **UnusedMethod** | Low | Methods never called | Dead code |
| **AvoidBooleanMethodParameters** | Info | Boolean params in methods | Unclear APIs |

### Error Prone Rules (16 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **AvoidHardcodingId** | High | Hardcoded Salesforce IDs | Environment issues |
| **EmptyCatchBlock** | High | Empty catch blocks | Silent failures |
| **ApexCSRF** | Medium | DML in constructors | Side effects |
| **AvoidDirectAccessTriggerMap** | Medium | Direct Trigger.old/new access | Bugs |
| **EmptyIfStmt** | Low | Empty if statements | Dead code |
| **EmptyStatementBlock** | Low | Empty code blocks | Code smell |
| **MethodWithSameNameAsEnclosingClass** | Low | Misleading method names | Confusion |
| **OverrideBothEqualsAndHashcode** | Low | Incomplete override | Bugs in collections |

### Documentation Rules (1 rule)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **ApexDoc** | Medium | Missing ApexDoc comments | Poor documentation |

---

## Flows & Process Automation

### Performance Rules (3 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **DMLStatementInLoop** | Critical | DML inside loop elements | Governor limits |
| **SOQLQueryInLoop** | Critical | Get Records in loops | Governor limits |
| **ActionCallsInLoop** | High | Apex actions in loops | Governor limits |

### Security Rules (4 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **UnsafeRunningContext** | Critical | System Mode without Sharing | Data exposure |
| **HardcodedId** | High | Hardcoded record IDs | Environment issues |
| **HardcodedUrl** | Medium | Hardcoded URLs | Environment issues |
| **GetRecordAllFields** | Medium | Retrieving all fields | Over-fetching data |

### Error Handling Rules (2 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **MissingFaultPath** | High | No fault connector on DML | Silent failures |
| **MissingNullHandler** | High | No null check after lookup | Runtime errors |

### Design Rules (4 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **CyclomaticComplexity** | High | Complex flow (>20 elements) | Maintenance difficulty |
| **SameRecordFieldUpdates** | Medium | After-save updating trigger record | Extra DML |
| **RecursiveAfterUpdate** | Medium | After-update modifying same record | Recursion risk |
| **DuplicateDMLOperation** | Medium | DML with backward navigation | Data integrity |

### Naming & Documentation Rules (4 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **FlowDescription** | Medium | Missing flow description | Poor documentation |
| **MissingMetadataDescription** | Medium | Elements without descriptions | AI tools can't understand |
| **FlowName** | Low | Non-standard naming | Hard to find |
| **CopyAPIName** | Low | Copy_X_Of names | Poor readability |

### Maintenance Rules (5 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **ProcessBuilder** | High | Using Process Builder | Deprecated technology |
| **APIVersion** | Medium | Outdated API version | Compatibility issues |
| **InactiveFlow** | Medium | Inactive flows in org | Clutter |
| **UnconnectedElement** | Low | Orphan elements | Dead code |
| **UnusedVariable** | Low | Variables not referenced | Clutter |

### Configuration Rules (2 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **TriggerOrder** | Medium | No trigger order specified | Unpredictable execution |
| **AutoLayout** | Info | Not using auto-layout | Layout inconsistency |

---

## Visualforce Pages

### Security Rules (3 rules)

| Rule | Severity | Description | Impact |
|------|----------|-------------|--------|
| **VfCsrf** | Critical | Action on page load | CSRF vulnerability |
| **VfUnescapeEl** | Critical | Unescaped user content | XSS vulnerability |
| **VfHtmlStyleTagXss** | High | Improper encoding in style tags | XSS vulnerability |

---

## Lightning Web Components

### Best Practices (Custom Rules)

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **No @api properties without JSDoc** | Medium | Missing API documentation | Poor developer experience |
| **Wire services without error handling** | High | No error handling on wire | Silent failures |
| **Imperative Apex without try-catch** | High | Missing error handling | Uncaught errors |
| **Console.log statements** | Low | Debug statements in production | Log pollution |
| **Hardcoded strings** | Medium | Non-externalized text | i18n issues |
| **Missing accessibility attributes** | Medium | No aria-labels | Accessibility violations |

---

## Objects & Fields

### Limits Analysis

| Check | Severity | Threshold | Impact |
|-------|----------|-----------|--------|
| **Field count approaching limit** | Critical | >80% of 500 | Cannot add fields |
| **Rollup summary approaching limit** | High | >80% of 25 | Cannot add rollups |
| **Lookup relationships limit** | High | >80% of 40 | Cannot add lookups |

### Data Model Best Practices

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **Missing field descriptions** | Medium | No help text | Poor usability |
| **Unused custom fields** | Low | Fields never populated | Schema bloat |
| **Excessive picklist values** | Medium | >200 values | Performance |
| **Complex validation rules** | Medium | High formula complexity | Performance |

---

## Security & Permissions

### Profile & Permission Analysis

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **Modify All Data permission** | Critical | Profile has MAD | Full data access |
| **View All Data permission** | High | Profile has VAD | Read all data |
| **Author Apex permission** | Critical | Non-admin with permission | Code injection risk |
| **Customize Application** | High | Non-admin with permission | Config changes |
| **View Setup** | Medium | Broad setup access | Information disclosure |

### Named Credentials

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **HTTP endpoints** | High | Non-HTTPS endpoints | Data interception |
| **Legacy authentication** | Medium | Basic/password auth | Credential exposure |

### Connected Apps

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **OAuth scope analysis** | High | Broad scopes | Over-permissioned |
| **Refresh token policy** | Medium | Long-lived tokens | Token theft risk |

---

## Documentation & Descriptions

### AI Readiness Checks

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **Apex class without header comment** | Medium | No class description | AI can't understand purpose |
| **Field without description** | Medium | No field help text | AI can't determine usage |
| **Flow without description** | Medium | No flow description | AI can't understand logic |
| **LWC without JSDoc** | Medium | No component docs | AI can't assist |

---

## Rule Priority Matrix

| Priority | Action Required | Examples |
|----------|-----------------|----------|
| **1 - Critical** | Immediate fix | Security vulnerabilities, governor limit risks |
| **2 - High** | Fix this sprint | Performance issues, major best practice violations |
| **3 - Medium** | Plan remediation | Design issues, documentation gaps |
| **4 - Low** | Address when possible | Code style, minor improvements |
| **5 - Info** | Optional | Suggestions, observations |

---

## Tools Reference

| Metadata Type | Primary Tool | Secondary Tools |
|---------------|--------------|-----------------|
| Apex Classes | PMD | CodeScan, SonarQube |
| Apex Triggers | PMD | CodeScan |
| Flows | Lightning Flow Scanner | Salesforce Optimizer |
| Visualforce | PMD | CodeScan |
| LWC | ESLint | CodeScan |
| Objects/Fields | Custom SOQL Analysis | Salesforce Optimizer |
| Security | SOQL + Custom Scripts | Salesforce Health Check |

---

---

## Advanced Rules (analyze-advanced-rules.js)

These additional rules are implemented in `scripts/analyze-advanced-rules.js` based on patterns from Hubbl, Quality Clouds, and CodeScan:

### Apex Advanced Checks

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **Missing Inherited Sharing** | Medium | Classes without explicit sharing declaration | Security bypass in some contexts |
| **Legacy @future** | Low | @future instead of Queueable | Limited chaining, no job ID |
| **Hardcoded Endpoints** | High | URLs not using Named Credentials | Credential exposure, env issues |
| **Dynamic SOQL without CRUD** | Critical | Database.query without security | FLS bypass, data exposure |
| **Triggers with Logic** | High | Triggers >20 lines with business logic | Hard to test/maintain |
| **Multiple Triggers per Object** | High | >1 trigger on same object | Unpredictable execution |
| **HTTP Callouts in Loops** | Critical | HttpRequest inside for/while | Callout limit exceptions |
| **Missing Test Data Factory** | Medium | No TestDataFactory class found | Duplicated test data setup |

### LWC Advanced Checks

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **Console statements** | Low | console.log in production code | Log pollution |
| **Wire without error handling** | High | @wire with no error handling | Silent failures |
| **Imperative Apex no try-catch** | High | Apex calls without error handling | Uncaught errors |
| **Hardcoded strings** | Medium | >5 long hardcoded strings | i18n issues |
| **Missing @api JSDoc** | Medium | @api properties without docs | Poor developer experience |
| **Buttons without aria-labels** | Medium | Accessibility issues | WCAG violations |
| **Inline styles** | Low | style= attributes | Maintainability |
| **Missing component description** | Medium | No description in meta file | AI tools can't understand |
| **Old API version** | Medium | API version <55 | Missing features |

### Deprecated Technology Detection

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **Aura Components** | Medium | >10 Aura components | Legacy tech, migrate to LWC |
| **Workflow Rules** | High | Active workflow rules | Deprecated, migrate to Flow |
| **Process Builders** | High | Process Builder flows | Deprecated, migrate to Flow |

### Security Deep Dive

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **API Enabled Profiles** | Info | Profiles with apiEnabled=true | API access tracking |
| **Critical Permission Sets** | High | PermSets with AuthorApex, ModifyAllData, etc. | Privilege escalation risk |
| **Dangerous Methods** | Medium | sendEmail, getSessionId, etc. | Security review needed |

### Field Deep Analysis

| Check | Severity | Description | Impact |
|-------|----------|-------------|--------|
| **Large Picklists** | Medium | Picklists with >50 values | Consider Custom Metadata |
| **Fields without Description** | Medium | Missing field descriptions | Documentation gap |
| **Formula without Comments** | Low | Complex formulas undocumented | Maintainability |

---

## References

- [PMD Apex Rules](https://docs.pmd-code.org/latest/pmd_rules_apex.html)
- [Lightning Flow Scanner](https://github.com/Lightning-Flow-Scanner/lightning-flow-scanner-core)
- [Salesforce Security Guide](https://developer.salesforce.com/docs/atlas.en-us.securityImplGuide.meta/securityImplGuide/)
- [Apex Best Practices](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dev_guide.htm)
- [Hubbl Diagnostics](https://hubbl.com/features) - Org health analysis
- [Quality Clouds](https://qualityclouds.com) - Technical debt management
- [CodeScan](https://www.codescan.io) - Static code analysis
