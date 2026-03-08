# ⌨️ Prompt Library

Prompt Library is one of Ophel's core features, helping you efficiently manage and use frequently-used prompts.

## Overview

<div class="tip custom-block">

**Use Cases**

- 📝 Save and reuse common prompts
- 🔄 Create dynamic prompts with variable templates
- 📂 Organize prompts by category
- ⚡ Quick access to recent prompts

</div>

## Advanced Features

### Variable Support

Use <code v-pre>{{variable}}</code> syntax to define dynamic variables that prompt for input:

**Example: Writing Assistant**

```markdown
Rewrite the following in clear professional English:

{{content_to_rewrite}}

Requirements:

- Preserve meaning
- Improve clarity
- Keep terminology accurate
```

**When using:**

1. Click to use this prompt
2. Dialog prompts for variables:
   - Content to rewrite: `Hello, world!`
3. Auto-generates final prompt and inserts into input

**Advanced Variable Usage:**

| Syntax                                           | Description        | Example                                               |
| ------------------------------------------------ | ------------------ | ----------------------------------------------------- |
| <code v-pre>{{variable}}</code>                  | Basic variable     | <code v-pre>{{topic}}</code>                          |
| <code v-pre>{{variable:default}}</code>          | With default value | <code v-pre>{{tone:Professional}}</code>              |
| <code v-pre>{{variable:option1\|option2}}</code> | Dropdown selection | <code v-pre>{{style:formal\|casual\|humorous}}</code> |

### Markdown Preview

Real-time preview when editing prompts:

- 📝 Code block syntax highlighting
- 📋 Proper list indentation
- 🔗 Clickable links
- 💡 Variable highlighting

### Category Management

Create categories for prompts with auto-assigned colors:

```
📁 Productivity
├── ✍️ Copy Editing
├── 📊 Data Analysis
└── 📧 Email Writing

📁 Programming
├── 🐛 Debug Assistant
├── 📖 Code Explanation
└── ⚡ Code Optimization

📁 Learning
├── 📚 Concept Explanation
├── 🎯 Practice Problems
└── 📝 Note Taking
```

**Category Features:**

- ➕ Create custom categories
- 🎨 Auto-assign category colors
- 📂 Drag prompts into categories
- 🔍 Filter by category

## Data Management

### Quick Access

#### Pin Favorites

Pin most-used prompts to the top:

- ⭐ Click star icon to pin/unpin
- 📌 Pinned prompts appear first
- 🔢 Support multiple pinned prompts

#### Recent Usage

Auto-track usage history for quick access:

- 🕐 Sorted by recent use
- 📊 Show usage count
- 🔄 One-click clear history

### Import/Export

Prompt data managed independently:

#### Export

```json
{
  "version": "1.0",
  "exportTime": "2024-01-15T10:00:00Z",
  "prompts": [
    {
      "id": "xxx",
      "title": "Writing Assistant",
      "content": "Rewrite the following in clear professional English...",
      "category": "Productivity",
      "pinned": true,
      "useCount": 42
    }
  ],
  "categories": ["Productivity", "Programming", "Learning"]
}
```

#### Import

- 📥 Import Ophel format JSON files
- 🔀 Smart merge: Choose to overwrite or skip duplicates
- 📂 Auto-create missing categories

## Usage Flow

### Create Prompts

1. Open prompt panel
2. Click "New Prompt"
3. Enter title and content
4. Select or create category
5. Save

### Use Prompts

1. Open prompt panel
2. Click target prompt
3. Fill in variables (if any)
4. Auto-inserts into input

## Built-in Prompts

Ophel includes several useful prompt templates:

| Name                     | Purpose                    |
| ------------------------ | -------------------------- |
| ✍️ Writing Assistant    | Rewrite and polish text    |
| ⚡ Code Optimizer        | Improve code quality       |
| 📝 Copy Editor           | Polish text expression     |
| 🤔 Deep Analysis         | Comprehensive analysis     |

::: tip
You can modify built-in prompts or use them as templates for new ones.
:::

## Settings

| Option           | Description                      | Default |
| ---------------- | -------------------------------- | :-----: |
| Show Usage Count | Display usage statistics in list |   On    |
| Auto Close Panel | Close panel after using prompt   |   On    |

## Shortcuts

| Shortcut  | Function           |
| --------- | ------------------ |
| `Alt + P` | Open prompt panel  |
| `Esc`     | Close prompt panel |
