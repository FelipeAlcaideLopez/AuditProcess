# Salesforce Org Audit Framework

Comprehensive audit framework for Salesforce organizations. Analyzes code quality, security, technical debt, and best practices across Apex, Flows, Objects, and more.

**Created by:** nCino Customer Success EMEA

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [macOS Installation](#macos-installation)
  - [Windows Installation](#windows-installation)
- [Quick Start](#quick-start)
- [Running the Audit](#running-the-audit)
- [Dashboard](#dashboard)
- [Analysis Modules](#analysis-modules)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Features

- **PMD Static Analysis** - Apex code quality and security violations
- **Flow Analysis** - Best practices, DML in loops, fault handling, hardcoded IDs
- **Object & Field Analysis** - Salesforce limits monitoring, field governance
- **Apex Classes & Coverage** - Test coverage, API versions, sharing model
- **Architecture Patterns** - Framework detection (FFLib, Trigger Handler, etc.)
- **Security Review** - High privilege profiles, permission sets, named credentials
- **Documentation Analysis** - Missing descriptions (AI readiness)
- **Package Analysis** - Installed managed packages review
- **Interactive Dashboard** - Visual representation of all findings

---

## Prerequisites

### Required Software

| Software | Version | Download |
|----------|---------|----------|
| **Node.js** | 18.x or higher | [nodejs.org](https://nodejs.org/) |
| **Salesforce CLI** | Latest | [developer.salesforce.com](https://developer.salesforce.com/tools/salesforcecli) |
| **PMD** | 7.x | [pmd.github.io](https://pmd.github.io/) |
| **Python** | 3.x | [python.org](https://python.org/) (for dashboard server) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

---

## Installation

### macOS Installation

#### 1. Install Homebrew (if not installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 2. Install Node.js
```bash
brew install node
```

#### 3. Install Salesforce CLI
```bash
brew install sf
```

#### 4. Install PMD
```bash
brew install pmd
```

#### 5. Verify Python 3 (usually pre-installed on macOS)
```bash
python3 --version
```

#### 6. Clone and Setup Project
```bash
# Clone the repository
git clone <repository-url>
cd AuditProcess

# Install npm dependencies
npm install
```

---

### Windows Installation

#### 1. Install Node.js
1. Download from [nodejs.org](https://nodejs.org/)
2. Run the installer (.msi file)
3. Follow the installation wizard
4. Verify installation:
```powershell
node --version
npm --version
```

#### 2. Install Salesforce CLI
1. Download from [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli)
2. Run the Windows installer (.exe file)
3. Verify installation:
```powershell
sf --version
```

#### 3. Install PMD
1. Download from [PMD Releases](https://github.com/pmd/pmd/releases)
2. Extract the ZIP file to `C:\pmd`
3. Add to PATH:
   - Open System Properties > Environment Variables
   - Edit PATH variable
   - Add `C:\pmd\bin`
4. Verify installation:
```powershell
pmd --version
```

#### 4. Install Python
1. Download from [python.org](https://python.org/)
2. **Important:** Check "Add Python to PATH" during installation
3. Verify installation:
```powershell
python --version
```

#### 5. Install Git
1. Download from [git-scm.com](https://git-scm.com/download/win)
2. Run installer with default options
3. Verify:
```powershell
git --version
```

#### 6. Clone and Setup Project
```powershell
# Clone the repository
git clone <repository-url>
cd AuditProcess

# Install npm dependencies
npm install
```

---

## Quick Start

### 1. Connect to Salesforce Org
```bash
# Login to your Salesforce org
sf org login web --alias audit-org

# Verify connection
sf org display --target-org audit-org
```

### 2. Retrieve Metadata
```bash
# Retrieve main metadata types
sf project retrieve start --metadata ApexClass,ApexTrigger,Flow,LightningComponentBundle --target-org audit-org

# Retrieve additional metadata
sf project retrieve start --metadata CustomObject,Profile,PermissionSet --target-org audit-org
```

### 3. Run PMD Analysis
```bash
# macOS/Linux
pmd check --dir force-app/main/default/classes --rulesets config/apex-ruleset.xml --format json --report-file reports/pmd/pmd-report.json

# Windows
pmd check --dir force-app\main\default\classes --rulesets config\apex-ruleset.xml --format json --report-file reports\pmd\pmd-report.json
```

### 4. Run All Analysis Scripts
```bash
npm run audit:all
```

### 5. Start Dashboard
```bash
# macOS/Linux
npm run dashboard

# Windows
npm run dashboard:win
```

Then open your browser to: **http://localhost:8080/dashboard/**

---

## Running the Audit

### Individual Analysis Scripts

| Command | Description |
|---------|-------------|
| `npm run audit:pmd` | Analyze PMD results |
| `npm run audit:flows` | Analyze Flow best practices |
| `npm run audit:objects` | Analyze objects, fields, and limits |
| `npm run audit:apex` | Analyze Apex classes and coverage |
| `npm run audit:layouts` | Analyze page layouts and FlexiPages |
| `npm run audit:packages` | Analyze installed packages |
| `npm run audit:frameworks` | Detect architectural patterns |
| `npm run audit:security` | Security analysis |
| `npm run audit:descriptions` | Check metadata descriptions (AI readiness) |
| `npm run audit:advanced` | Advanced rules (Hubbl, Quality Clouds, CodeScan patterns) |
| `npm run audit:consolidate` | Consolidate all findings |
| `npm run audit:summary` | Generate executive summary |

### Run Complete Audit
```bash
npm run audit:all
```

### Manual Script Execution
```bash
node scripts/analyze-flows.js
node scripts/analyze-objects.js
node scripts/consolidate-findings.js
```

---

## Dashboard

The interactive dashboard provides visual representation of all audit findings.

### Starting the Dashboard

**macOS/Linux:**
```bash
npm run dashboard
# or manually:
cd docs && python3 -m http.server 8080
```

**Windows:**
```bash
npm run dashboard:win
# or manually:
cd docs
python -m http.server 8080
```

**Access URL:** http://localhost:8080/dashboard/

### Dashboard Sections

| Section | Description |
|---------|-------------|
| **Overview** | Health score, key metrics, severity distribution |
| **Findings** | All findings with filtering and search |
| **PMD Analysis** | Apex code violations by category and rule |
| **Apex Classes** | Test coverage, API versions, sharing model |
| **Flow Analysis** | Flow issues, complexity, best practices |
| **Objects & Fields** | Custom objects, fields, Salesforce limits |
| **Layouts & Pages** | FlexiPages, page layouts, component usage |
| **Packages** | Installed managed packages |
| **Security** | Profiles, permissions, named credentials |
| **Architecture** | Detected patterns and frameworks |
| **Documentation** | Missing descriptions, AI readiness |
| **Advanced Rules** | Industry best practices (Hubbl, Quality Clouds, CodeScan) |
| **Recommendations** | Prioritized action items |

---

## Analysis Modules

### 1. PMD Analysis
Analyzes Apex code for:
- Security vulnerabilities (SOQL injection, CRUD violations)
- Performance issues (DML/SOQL in loops)
- Best practices (debug statements, naming conventions)
- Code complexity

### 2. Flow Analysis
Detects flow issues:
- DML operations in loops (Critical)
- Missing fault handling (High)
- Hardcoded IDs (High)
- Missing descriptions (Medium)
- Unused variables (Medium)
- Complex branching (Medium)
- Missing null checks (Medium)

### 3. Object & Field Analysis
Monitors Salesforce limits:
- Custom fields per object (limit: 500)
- Rollup summary fields (limit: 25)
- Lookup relationships (limit: 40)
- Validation rule complexity

### 4. Documentation Analysis
Checks for missing descriptions in:
- Custom Fields
- Apex Classes
- Flows
- LWC Components
- Permission Sets
- Custom Labels

**AI Readiness:** Components without descriptions cannot be properly analyzed by AI tools (Copilot, Claude, Agentforce).

### 5. Advanced Rules Analysis
Implements patterns from industry tools (Hubbl, Quality Clouds, CodeScan):

**Apex Advanced:**
- Missing sharing declarations
- Legacy @future usage (should use Queueable)
- Hardcoded endpoints (should use Named Credentials)
- Dynamic SOQL without CRUD checks
- Triggers with business logic
- HTTP callouts in loops

**LWC Advanced:**
- Console statements in production
- Wire services without error handling
- Missing accessibility attributes
- Missing component descriptions

**Deprecated Technology:**
- Aura components (recommend LWC migration)
- Workflow Rules (recommend Flow migration)
- Process Builders (recommend Flow migration)

**Security Deep Dive:**
- Permission Sets with critical permissions
- Classes using dangerous methods

---

## Project Structure

```
AuditProcess/
├── config/
│   └── apex-ruleset.xml          # PMD configuration
├── docs/
│   ├── dashboard/                # Interactive dashboard
│   │   ├── index.html
│   │   ├── app.js
│   │   └── styles.css
│   ├── data/                     # Analysis JSON output (gitignored)
│   │   ├── all-findings.json
│   │   ├── pmd-analysis.json
│   │   ├── flow-analysis.json
│   │   └── ...
│   └── guides/                   # Execution guides
│       ├── 00-discovery-setup.md
│       └── ...
├── force-app/
│   └── main/default/             # Retrieved Salesforce metadata
├── reports/
│   └── pmd/                      # PMD JSON reports
├── scripts/
│   ├── analyze-pmd-results.js
│   ├── analyze-flows.js
│   ├── analyze-objects.js
│   ├── analyze-apex-classes.js
│   ├── analyze-layouts.js
│   ├── analyze-packages.js
│   ├── analyze-frameworks.js
│   ├── analyze-security.js
│   ├── analyze-metadata-descriptions.js
│   ├── analyze-advanced-rules.js      # Hubbl/Quality Clouds/CodeScan patterns
│   ├── consolidate-findings.js
│   └── generate-executive-summary.js
├── package.json
├── CLAUDE.md                     # AI assistant instructions
└── README.md
```

---

## Troubleshooting

### Dashboard shows no data

1. Ensure analysis scripts have been run:
```bash
npm run audit:all
```

2. Verify JSON files exist in `docs/data/`:
```bash
ls docs/data/
```

3. Check server is running from correct directory:
```bash
# Must run from docs/ folder
cd docs && python3 -m http.server 8080
```

4. Access via correct URL: `http://localhost:8080/dashboard/`

### PMD not found

**macOS:**
```bash
brew install pmd
```

**Windows:**
- Ensure PMD is extracted to `C:\pmd`
- Add `C:\pmd\bin` to system PATH
- Restart terminal

### Salesforce CLI authentication issues

```bash
# Re-authenticate
sf org login web --alias audit-org

# List connected orgs
sf org list

# Check current org
sf org display
```

### Node.js version issues

Ensure Node.js 18 or higher:
```bash
node --version
```

If version is lower, update via:
- **macOS:** `brew upgrade node`
- **Windows:** Download latest from nodejs.org

### Python not found (Windows)

1. Reinstall Python from python.org
2. **Check "Add Python to PATH"** during installation
3. Restart terminal/PowerShell

### Port 8080 already in use

```bash
# Find process using port 8080
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows

# Use different port
python3 -m http.server 8081
```

---

## Severity Definitions

| Severity | Criteria | Action Required |
|----------|----------|-----------------|
| **Critical** | Security breach risk, data loss, compliance violation | Immediate |
| **High** | Governor limits risk, significant performance impact | This sprint |
| **Medium** | Best practice violations, maintainability issues | Next sprint |
| **Low** | Code style, minor improvements | Backlog |
| **Info** | Observations, no action required | Optional |

---

## Health Score Calculation

```
Score = 100 - (DebtScore / MaxScore × 100)

DebtScore = Σ(SeverityWeight × Count)
  Critical: 10 points
  High: 5 points
  Medium: 2 points
  Low: 1 point

Interpretation:
  90-100: Excellent
  75-89:  Good
  60-74:  Needs Improvement
  <60:    Critical
```

---

## Support

For issues and questions, contact:
- **Author:** felipe.lopez@ncino.com
- **Team:** nCino Customer Success EMEA

---

## License

Proprietary - nCino Internal Use
