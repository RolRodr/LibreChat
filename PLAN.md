# Plan: Starter Prompt Cards via Model Specs & Agent Builder

## Overview

Add user-configurable starter prompt cards that appear as clickable tiles beneath the chat input box on new conversations (landing page). Cards are configured via **model specs** (librechat.yaml) and the **agent builder** UI, and disappear after the first message is sent.

## Current State

- `ConversationStarters.tsx` already renders starter cards for **assistants** (OpenAI Assistants API).
- The **agent database schema** already has `conversation_starters?: string[]` and backend validation supports it.
- The **agent builder UI** is missing the form field for `conversation_starters` (unlike the assistant builder which has `AssistantConversationStarters.tsx`).
- **Model specs** (`TModelSpec`) have no `conversation_starters` field at all.
- `ConversationStarters.tsx` only reads starters from the selected assistant/agent entity — not from the active model spec.

---

## Work Items

### 1. Model Spec Type & Schema (`packages/data-provider`)

**File:** `packages/data-provider/src/models.ts`

Add the optional field to `TModelSpec`:

```typescript
conversation_starters?: string[];
```

---

### 2. Model Spec Processing (`packages/data-schemas`)

**File:** `packages/data-schemas/src/app/specs.ts`

Pass `conversation_starters` through in `processModelSpecs()` — no special transformation needed; just ensure it is not stripped when building the processed spec object.

---

### 3. Model Spec API Response (`packages/api` or `/api`)

**File:** `packages/api/src/endpoints/models.ts` (or wherever model specs are served)

Verify that `conversation_starters` is included in the API response for `/api/models` or `/api/model-specs` so the frontend can consume it.

---

### 4. Agent Builder UI (`client`)

**File:** `client/src/components/SidePanel/Agents/AgentPanel.tsx`

a. Add `conversation_starters: []` to `defaultAgentFormValues`.

b. Render the existing `AssistantConversationStarters` component (already in `client/src/components/SidePanel/Builder/`) inside the agent form via a `<Controller>` block — same pattern used in `AssistantPanel.tsx`.

**File:** `client/src/components/SidePanel/Agents/AgentConfig.tsx` (if starters belong in capabilities section)

Import and render `AssistantConversationStarters` in the appropriate section.

---

### 5. `ConversationStarters` Component — Model Spec Support (`client`)

**File:** `client/src/components/Chat/Input/ConversationStarters.tsx`

Current logic reads from `entity.conversation_starters` (agent/assistant). Extend to also read from the **active model spec** when no agent/assistant entity is selected:

```
Priority order:
  1. Agent conversation_starters  (entity is an agent)
  2. Assistant conversation_starters  (entity is an assistant)
  3. Active model spec conversation_starters  (plain endpoint / model spec selected)
```

The active model spec is already available via the `useGetStartupConfig` hook and conversation endpoint state.

---

### 6. Localization Keys (`client`)

**File:** `client/src/locales/en/translation.json`

Add any new user-facing labels needed for the agent builder conversation starters section (label, placeholder, tooltip). The assistant builder already has keys for this — reuse where possible.

---

### 7. Tests

- **Agent builder**: Update/add tests in `client/src/__tests__/` (or alongside `AgentPanel`) to assert that `conversation_starters` renders and submits correctly.
- **ConversationStarters**: Add a test case for model-spec-sourced starters.
- **Backend**: Confirm existing agent validation tests cover `conversation_starters`; add a model-spec processing test if the field needs explicit handling.

---

## File Change Summary

| File | Change |
|---|---|
| `packages/data-provider/src/models.ts` | Add `conversation_starters?: string[]` to `TModelSpec` |
| `packages/data-schemas/src/app/specs.ts` | Pass-through `conversation_starters` in `processModelSpecs()` |
| `client/src/components/SidePanel/Agents/AgentPanel.tsx` | Add `conversation_starters: []` to defaults; wire `<Controller>` |
| `client/src/components/SidePanel/Agents/AgentConfig.tsx` | Import & render `AssistantConversationStarters` |
| `client/src/components/Chat/Input/ConversationStarters.tsx` | Extend starter resolution to include active model spec |
| `client/src/locales/en/translation.json` | Add any new localization keys (likely none — reuse existing) |

---

## Out of Scope

- Persisting starter cards per-conversation (they always reflect the current agent/model spec config).
- Custom card icons or rich-text card bodies.
- Per-user override of starters.
- Changes to the assistant builder (already fully implemented).
