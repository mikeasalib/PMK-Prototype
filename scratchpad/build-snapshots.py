#!/usr/bin/env python3
"""
Rebuild src/lib/snapshots/{va,ventura}.json from raw Linear MCP responses.

The raw responses (issues + milestones for each program) live in
scratchpad/*.raw.json and are captured from an MCP call earlier in the session.
This transformer is deterministic — running it twice with the same inputs
produces the same output.
"""

import json
import pathlib
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).parent.parent
SNAP = ROOT / "src" / "lib" / "snapshots"
SCRATCH = ROOT / "scratchpad"

SYNCED_AT = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def issue_to_row(issue):
    identifier = issue["id"]
    return {
        "source_id": identifier,
        "identifier": identifier,
        "title": issue["title"],
        "state_name": issue.get("status"),
        "state_type": issue.get("statusType"),
        "priority": issue["priority"]["value"] if isinstance(issue.get("priority"), dict) else issue.get("priority"),
        "assignee": issue.get("assignee"),
        # Workstream stays null at snapshot time. The read-time classifier
        # (parseSourceWorkstream + classifyWorkstream) is authoritative; storing
        # a guess here would freeze inference into what the rest of the app
        # treats as a fact.
        "workstream": None,
        "labels": issue.get("labels") or [],
        "url": issue.get("url"),
        "due_date": issue.get("dueDate"),
        "source_created_at": issue.get("createdAt"),
        "source_updated_at": issue.get("updatedAt"),
        "synced_at": SYNCED_AT,
    }

def milestone_to_row(ms, project_url):
    return {
        "source_id": ms["id"],
        "name": ms["name"].strip().replace(" 🇺🇸", ""),  # match old capture's naming
        "target_date": ms.get("targetDate"),
        "progress": ms.get("progress"),
        "url": project_url,
        "synced_at": SYNCED_AT,
    }

def build(program_id, source_label, project_url, issues_raw, milestones_raw):
    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "programId": program_id,
        "fetchedAt": now_iso,
        "source": source_label,
        "linear_issues": [issue_to_row(i) for i in issues_raw],
        "linear_milestones": [milestone_to_row(m, project_url) for m in milestones_raw],
    }

def load(name):
    with open(SCRATCH / name) as f:
        return json.load(f)

def dump(path, snap):
    with open(path, "w") as f:
        # Match existing snapshot indentation (single space, per head -c above).
        json.dump(snap, f, indent=1)
        f.write("\n")

def main():
    va_issues = load("va-issues.raw.json")["issues"]
    va_ms = load("va-milestones.raw.json")["milestones"]
    ven_issues = load("ventura-issues.raw.json")["issues"]
    ven_ms = load("ventura-milestones.raw.json")["milestones"]

    va = build(
        "va",
        "Linear project 3e9eebbb-e77c-473f-8509-4f8f3d0df140 (Department of Veterans Affairs, DEP)",
        "https://linear.app/kaizenlabs/project/department-of-veterans-affairs-7425ef80bb55",
        va_issues,
        va_ms,
    )
    ven = build(
        "ventura",
        "Linear project b7d98661-7d8a-47d7-addf-096bc73a7752 (Ventura County Parks recreation deployment)",
        "https://linear.app/kaizenlabs/project/ventura-county-parks-recreation-deployment",
        ven_issues,
        ven_ms,
    )

    dump(SNAP / "va.json", va)
    dump(SNAP / "ventura.json", ven)
    print(f"wrote va.json: {len(va['linear_issues'])} issues, {len(va['linear_milestones'])} milestones")
    print(f"wrote ventura.json: {len(ven['linear_issues'])} issues, {len(ven['linear_milestones'])} milestones")

if __name__ == "__main__":
    main()
