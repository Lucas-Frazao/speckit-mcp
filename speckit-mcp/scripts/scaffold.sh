#!/usr/bin/env bash
set -e

# SpecKit Project Scaffolder
# Usage: ./scaffold.sh <project-name> <github-username> [roadmap-file]

PROJECT_NAME="${1:?Usage: scaffold.sh <project-name> <github-username> [roadmap-file]}"
GITHUB_USER="${2:?Usage: scaffold.sh <project-name> <github-username> [roadmap-file]}"
ROADMAP_FILE="${3:-}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SPECKIT_DIR="$(dirname "$SCRIPT_DIR")"
BLUEPRINT_DIR="$SPECKIT_DIR/blueprint"

PROJECT_DIR="$HOME/projects/$PROJECT_NAME"

echo "🏗️  SpecKit Autonomous Software Factory"
echo "========================================"
echo "Project:    $PROJECT_NAME"
echo "GitHub:     $GITHUB_USER/$PROJECT_NAME"
echo "Directory:  $PROJECT_DIR"
echo ""

# Create project directory
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Initialize git
git init
git checkout -b main

# Copy blueprint files
echo "📋 Copying blueprint structure..."
cp -r "$BLUEPRINT_DIR/.github" "$PROJECT_DIR/"
cp -r "$BLUEPRINT_DIR/.specify" "$PROJECT_DIR/"
cp "$BLUEPRINT_DIR/AGENTS.md" "$PROJECT_DIR/"

# Copy roadmap if provided
if [ -n "$ROADMAP_FILE" ] && [ -f "$ROADMAP_FILE" ]; then
    echo "📊 Loading roadmap..."
    cp "$ROADMAP_FILE" "$PROJECT_DIR/.specify/roadmap.md"
fi

# Create VS Code workspace settings for MCP
mkdir -p "$PROJECT_DIR/.vscode"
cat > "$PROJECT_DIR/.vscode/settings.json" << EOF
{
  "chat.mcp.enabled": true,
  "chat.mcp.discovery.enabled": true,
  "github.copilot.chat.agent.autoApprove": true
}
EOF

# Create MCP configuration for VS Code
cat > "$PROJECT_DIR/.vscode/mcp.json" << EOF
{
  "servers": {
    "speckit-mcp": {
      "command": "node",
      "args": ["$SPECKIT_DIR/dist/index.js"],
      "env": {
        "SPECKIT_PROJECT_ROOT": "$PROJECT_DIR"
      }
    }
  }
}
EOF

# Initial commit
git add -A
git commit -m "init: scaffold project with SpecKit SDD blueprint"

# Create GitHub repo and push
echo "🌐 Creating GitHub repository..."
if command -v gh &> /dev/null; then
    gh repo create "$PROJECT_NAME" --public --source=. --remote=origin --push 2>/dev/null || {
        echo "⚠️  Could not auto-create repo. Create it manually at:"
        echo "   https://github.com/new"
        echo "   Then run: git remote add origin https://github.com/$GITHUB_USER/$PROJECT_NAME.git && git push -u origin main"
    }
else
    echo "⚠️  GitHub CLI (gh) not installed. Create repo manually at:"
    echo "   https://github.com/new"
    echo "   Then run: git remote add origin https://github.com/$GITHUB_USER/$PROJECT_NAME.git && git push -u origin main"
    echo ""
    echo "   Install gh: https://cli.github.com/"
fi

echo ""
echo "✅ Project scaffolded!"
echo ""
echo "Next steps:"
echo "  1. Open in VS Code:  code $PROJECT_DIR"
echo "  2. If roadmap not yet added, place it at: $PROJECT_DIR/.specify/roadmap.md"
echo "  3. Place your constitution at: $PROJECT_DIR/.specify/memory/constitution.md"
echo "  4. In VS Code Copilot Chat, select the 'speckit-builder' agent"
echo "  5. Type: Execute the roadmap"
echo ""
echo "The builder will autonomously implement every feature. ☕ Grab a coffee."
