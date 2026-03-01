# SpecKit MCP — Autonomous Software Factory

An MCP server + GitHub Copilot custom agent that autonomously builds entire applications from a project roadmap. Perplexity AI acts as the lead architect, GitHub Copilot acts as the autonomous builder.

```
You + Perplexity  →  Roadmap + Constitution  →  Copilot Agent Mode  →  Working Software
   (planning)          (architecture)            (autonomous build)       (ready to test)
```

## How It Works

1. **You + Perplexity** plan the application together — features, UI, tech stack, user stories
2. **Perplexity** generates a complete project blueprint: roadmap, constitution, and architecture
3. **You** scaffold a project with one command: `./scripts/scaffold.sh my-app Lucas-Frazao`
4. **You** open VS Code, select the `speckit-builder` agent, type: **"Execute the roadmap"**
5. **Copilot** autonomously builds every feature using Spec-Driven Development — no human input needed
6. **You** run and test the finished software

## What's Inside

```
speckit-mcp/
├── src/                    # MCP server source (TypeScript)
│   ├── tools/              # 15 MCP tools for spec management + autonomous execution
│   ├── resources/          # MCP resources (spec files, templates)
│   ├── prompts/            # MCP prompts (slash commands)
│   └── lib/                # Filesystem, git, copilot bridge, utilities
├── blueprint/              # Project blueprint (copied into every new project)
│   ├── .github/
│   │   ├── agents/
│   │   │   └── speckit-builder.agent.md   ← The autonomous builder agent
│   │   └── copilot-instructions.md
│   ├── .specify/
│   │   ├── memory/         ← Constitution goes here
│   │   └── specs/          ← Feature specs generated here
│   └── AGENTS.md           ← Master agent instructions
├── templates/              # Templates for roadmaps, specs, plans, tasks
├── scripts/
│   └── scaffold.sh         # One-command project creation
├── package.json
└── tsconfig.json
```

## One-Time Setup

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [VS Code](https://code.visualstudio.com/) with [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
- GitHub Copilot Pro, Pro+, Business, or Enterprise subscription
- [GitHub CLI](https://cli.github.com/) (optional, for auto-creating repos)

### Install SpecKit MCP

```bash
git clone https://github.com/Lucas-Frazao/speckit-mcp.git
cd speckit-mcp
npm install
npm run build
```

That's it. The MCP server is ready.

## Building a Project (The Workflow)

### Step 1: Plan with Perplexity

Open [Perplexity](https://perplexity.ai) and describe what you want to build. Perplexity will ask clarifying questions about:
- Features and user flows
- Tech stack preferences
- UI/UX requirements
- Data models and API design
- Performance and scale requirements

When planning is complete, Perplexity generates three files:
1. **roadmap.md** — Ordered feature list with descriptions, user stories, and dependencies
2. **constitution.md** — Project governing principles (coding standards, testing requirements, architecture rules)
3. This README will tell you exactly where to put them

### Step 2: Scaffold the Project

```bash
# From the speckit-mcp directory:
./scripts/scaffold.sh my-app Lucas-Frazao /path/to/roadmap.md
```

This creates:
- `~/projects/my-app/` with the full blueprint structure
- `.vscode/mcp.json` configured to connect to SpecKit MCP
- `.vscode/settings.json` with Copilot agent settings
- Initial git commit
- GitHub repository (if `gh` CLI is installed)

### Step 3: Add the Constitution

Place the constitution Perplexity generated at:
```
~/projects/my-app/.specify/memory/constitution.md
```

### Step 4: Execute

1. Open VS Code: `code ~/projects/my-app`
2. Open Copilot Chat (Ctrl+Shift+I / Cmd+Shift+I)
3. Select the **speckit-builder** agent from the agent dropdown
4. Type: **Execute the roadmap**
5. Walk away. Copilot will:
   - Read the roadmap
   - For each feature: specify → plan → tasks → analyze → implement
   - Write all the code
   - Commit after each task
   - Move to the next feature
6. Come back to working software

## MCP Tools (15 total)

### Core Spec Management
| Tool | Description |
|------|-------------|
| `speckit_init` | Initialize `.specify/` directory |
| `speckit_constitution` | Create/update governing principles |
| `speckit_specify` | Create feature spec + git branch |
| `speckit_clarify` | Resolve spec ambiguities |
| `speckit_plan` | Create implementation plan |
| `speckit_tasks` | Generate phased task breakdown |
| `speckit_implement` | Get next task + context brief |
| `speckit_complete_task` | Mark task done, git commit |
| `speckit_validate` | Quality-check spec completeness |
| `speckit_status` | Show feature/project status |

### Autonomous Execution
| Tool | Description |
|------|-------------|
| `speckit_load_roadmap` | Read/write project roadmap |
| `speckit_analyze` | Quality gate — checks all artifacts for issues |
| `speckit_execute_feature` | State machine — returns next action for a feature |
| `speckit_update_roadmap` | Update feature status in roadmap |
| `speckit_next_feature` | Find next feature to work on (respects dependencies) |

## Example: Sample Roadmap

See `templates/roadmap-template.md` for the format. Here's a minimal example:

```markdown
# Project Roadmap: TaskFlow

## Project Overview
A minimal task management web app with drag-and-drop kanban boards.

## Tech Stack
- **Language**: TypeScript 5.x
- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite via Drizzle ORM
- **Testing**: vitest
- **Platform**: Web
- **Project Type**: web-app
- **Package Manager**: pnpm
- **Build Tool**: next build

## Features (in execution order)

### Feature 1: Project Setup and Base Layout
- **Priority**: P1 (MVP)
- **Description**: Initialize Next.js project, configure Tailwind CSS, create base layout with sidebar navigation and main content area
- **User Stories**:
  - US1: As a user, I want a clean dashboard layout so I can navigate between boards
- **Dependencies**: none
- **Status**: not-started

### Feature 2: Board CRUD
- **Priority**: P1 (MVP)
- **Description**: Create, read, update, delete kanban boards with title and description
- **User Stories**:
  - US1: As a user, I want to create a new board so I can organize my tasks
  - US2: As a user, I want to rename or delete a board
- **Key Entities**: Board (id, title, description, createdAt)
- **Dependencies**: Feature 1
- **Status**: not-started

### Feature 3: Task Cards with Drag-and-Drop
- **Priority**: P1 (MVP)
- **Description**: Add task cards to board columns, drag between columns to update status
- **User Stories**:
  - US1: As a user, I want to add tasks to a board column
  - US2: As a user, I want to drag tasks between columns to change status
- **Key Entities**: Task (id, title, description, status, boardId, position)
- **API Endpoints**: PATCH /api/tasks/:id/move
- **Dependencies**: Feature 2
- **Status**: not-started
```

## Configuration

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `SPECKIT_PROJECT_ROOT` | Absolute path to the target project | `process.cwd()` |

### VS Code MCP Configuration
The `scaffold.sh` script auto-generates `.vscode/mcp.json`:
```json
{
  "servers": {
    "speckit-mcp": {
      "command": "node",
      "args": ["/path/to/speckit-mcp/dist/index.js"],
      "env": {
        "SPECKIT_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

## Development

```bash
npm run dev        # Watch mode
npm run build      # Compile TypeScript
npm run inspect    # MCP Inspector (interactive testing)
```

## License

MIT
