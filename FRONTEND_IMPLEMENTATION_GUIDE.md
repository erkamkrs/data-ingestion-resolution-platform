# Frontend Issue Resolution UI Implementation Guide

## Overview
The frontend needs to handle three types of issue resolution based on the issue type.

## Issue Types and UI

### 1. DUPLICATE_EMAIL
**Current:** Already working
**UI:** Dropdown or list showing candidate rows, user selects one

**Backend Call:**
```typescript
const resolution = {
  action: "choose",
  chosen_row_id: selectedRowId
};
```

---

### 2. MISSING_FIRST_NAME, MISSING_LAST_NAME, MISSING_COMPANY
**New:** Text input field
**UI:** Show the row data with empty field, user types the missing value

**Example:**
```
Issue: Missing First Name
Row Data: {email: "john@example.com", first_name: null, last_name: "Doe"}

Show Form:
[John        ] ← User types first name
[Doe         ] ← Last name (pre-filled)
[john@e...]  ← Email (pre-filled, read-only)
```

**Backend Call:**
```typescript
const resolution = {
  action: "edit",
  row_id: issuePayload.row_id,
  updated_data: {
    first_name: userInput
  }
};
```

---

### 3. MISSING_EMAIL
**New:** Text input field  
**UI:** Show the row data with email field empty, user types email

**Example:**
```
Issue: Missing Email (critical field)
Row Data: {first_name: "John", last_name: "Doe", company: "TechCorp"}

Show Form:
[john@example.com] ← User types email
[John            ] ← First name (pre-filled)
[Doe             ] ← Last name (pre-filled)
```

**Backend Call:**
```typescript
const resolution = {
  action: "edit",
  row_id: issuePayload.row_id,
  updated_data: {
    email: userInput
  }
};
```

---

### 4. INVALID_EMAIL_FORMAT
**New:** Text input field  
**UI:** Show the invalid email, user corrects it

**Example:**
```
Issue: Invalid Email Format
Current: "notanemail" or "john@invalid" or "john @example.com"

Show Form:
[john@example.com] ← User corrects format
[John            ] ← First name (read-only)
[Doe             ] ← Last name (read-only)
```

**Backend Call:**
```typescript
const resolution = {
  action: "edit",
  row_id: issuePayload.row_id,
  updated_data: {
    email: userInput
  }
};
```

---

## Frontend Logic Template

### Determine Resolution UI Based on Issue Type

```typescript
function getResolutionComponent(issue: Issue): React.ReactNode {
  if (issue.type === "DUPLICATE_EMAIL") {
    return <DuplicateEmailResolver issue={issue} />;
  } else if (issue.type === "MISSING_FIRST_NAME") {
    return <EditFieldResolver issue={issue} fieldName="first_name" placeholder="Enter first name" />;
  } else if (issue.type === "MISSING_LAST_NAME") {
    return <EditFieldResolver issue={issue} fieldName="last_name" placeholder="Enter last name" />;
  } else if (issue.type === "MISSING_COMPANY") {
    return <EditFieldResolver issue={issue} fieldName="company" placeholder="Enter company" />;
  } else if (issue.type === "MISSING_EMAIL") {
    return <EditFieldResolver issue={issue} fieldName="email" placeholder="Enter email address" />;
  } else if (issue.type === "INVALID_EMAIL_FORMAT") {
    return <EditFieldResolver issue={issue} fieldName="email" placeholder="Correct email format" />;
  } else {
    return <SkipResolver issue={issue} />;
  }
}
```

---

### Components

#### DuplicateEmailResolver (Already implemented)
Shows candidate rows, user selects one.

#### EditFieldResolver (New)
```typescript
interface EditFieldResolverProps {
  issue: Issue;
  fieldName: string;
  placeholder: string;
}

export function EditFieldResolver({ issue, fieldName, placeholder }: EditFieldResolverProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const payload = issue.payload as any;
      await api.resolveIssue(issue.id, {
        action: "edit",
        row_id: payload.row_id,
        updated_data: {
          [fieldName]: value
        }
      });
      // Issue resolved, refresh list
      onIssueResolved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>{issue.type}</h3>
      <p>{issue.payload.reason}</p>
      
      <div>
        <label>{fieldName}:</label>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
        />
      </div>

      <button onClick={handleSubmit} disabled={loading || !value.trim()}>
        {loading ? "Saving..." : "Resolve"}
      </button>
    </div>
  );
}
```

#### SkipResolver (New)
```typescript
export function SkipResolver({ issue }: { issue: Issue }) {
  const [loading, setLoading] = useState(false);

  async function handleSkip() {
    setLoading(true);
    try {
      const payload = issue.payload as any;
      await api.resolveIssue(issue.id, {
        action: "skip",
        row_id: payload.row_id
      });
      onIssueResolved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>{issue.type}</h3>
      <p>{issue.payload.reason}</p>
      <p style={{ color: "#999", fontSize: "14px" }}>
        This row will be excluded from final contacts.
      </p>
      
      <button onClick={handleSkip} disabled={loading} variant="danger">
        {loading ? "Skipping..." : "Skip This Row"}
      </button>
    </div>
  );
}
```

---

## API Client Update

Update `frontend/src/api/client.ts`:

```typescript
resolveIssue(issueId: number, resolution: {
  action: string;
  chosen_row_id?: number;
  row_id?: number;
  updated_data?: Record<string, any>;
}) {
  return request(`/issues/${issueId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resolution),
  });
}
```

---

## Integration Steps

1. **Update API Client** - Support new resolution payload format
2. **Create EditFieldResolver component** - Handle field editing
3. **Create SkipResolver component** - Handle skipping rows
4. **Update issue list/detail view** - Render appropriate component for each issue type
5. **Show pre-filled data** - For edit resolver, show current row data
6. **Validation** - For email fields, show format hint
7. **Success feedback** - Refresh issues list after resolution

---

## Example: Full Issue Detail View

```typescript
export function IssueDetail({ issue }: { issue: Issue }) {
  const rowData = issue.payload.data || issue.payload;

  return (
    <div style={{ border: "1px solid #ddd", padding: "16px", marginBottom: "16px" }}>
      <div style={{ marginBottom: "12px" }}>
        <strong>Issue Type:</strong> {issue.type}
        <br />
        <strong>Status:</strong> {issue.status}
        {issue.payload.reason && (
          <>
            <br />
            <strong>Reason:</strong> {issue.payload.reason}
          </>
        )}
      </div>

      {/* Show row data */}
      <div style={{ backgroundColor: "#f5f5f5", padding: "12px", marginBottom: "16px", borderRadius: "4px" }}>
        <strong>Row Data:</strong>
        <div style={{ fontSize: "12px", marginTop: "8px", fontFamily: "monospace" }}>
          <div>Email: {rowData.email || "(empty)"}</div>
          <div>First Name: {rowData.first_name || "(empty)"}</div>
          <div>Last Name: {rowData.last_name || "(empty)"}</div>
          <div>Company: {rowData.company || "(empty)"}</div>
        </div>
      </div>

      {/* Resolution Component */}
      {getResolutionComponent(issue)}
    </div>
  );
}
```

---

## Testing Checklist

- [ ] Upload CSV with missing email
- [ ] See MISSING_EMAIL issue
- [ ] See edit form for email field
- [ ] Edit email, submit
- [ ] Issue marked RESOLVED
- [ ] Row updated in database

- [ ] Upload CSV with invalid email format (e.g., "notanemail")
- [ ] See INVALID_EMAIL_FORMAT issue
- [ ] See edit form for email
- [ ] Correct email, submit
- [ ] Issue marked RESOLVED

- [ ] Upload CSV with missing first name
- [ ] See MISSING_FIRST_NAME issue
- [ ] See edit form for first name
- [ ] Type first name, submit
- [ ] Issue marked RESOLVED

- [ ] See skip option for any issue
- [ ] Click skip
- [ ] Row marked invalid
- [ ] Row excluded from final contacts

---

## Summary

The backend is now ready to handle three resolution strategies:
1. **choose** - Select from duplicates (DUPLICATE_EMAIL)
2. **edit** - Correct field values (MISSING_*, INVALID_EMAIL_FORMAT)
3. **skip** - Exclude row (any issue type)

The frontend needs to:
1. Detect issue type
2. Show appropriate UI component
3. Gather user input
4. Submit resolution request
5. Update UI based on response

This enables a complete human-in-the-loop workflow where users can fix data quality issues directly in the application.
