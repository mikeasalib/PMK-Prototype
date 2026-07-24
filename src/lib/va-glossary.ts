// Sourced from Notion: "VA Acronym Glossary" (July 15, 2026).
// Items flagged unconfirmed appear repeatedly in program notes without a
// spelled-out definition and should be verified with GovCIO / VA before use.

export type GlossaryCategory =
  | "Contract & Program"
  | "Workstream Ownership"
  | "VA Products & Systems"
  | "VA Organizations"
  | "Security, ATO & Compliance"
  | "Technical & Architecture"
  | "Process & Testing";

export type GlossaryEntry = {
  term: string;
  meaning: string;
  category: GlossaryCategory;
  lead?: string; // only for Workstream Ownership
  unconfirmed?: boolean;
};

export const GLOSSARY_SOURCE = {
  title: "VA Acronym Glossary",
  url: "https://www.notion.so/thekaizenlabs/VA-Acronym-Glossary-39e68467f30f814eb8b7f43ac33dc9d9",
  updated: "Jul 15, 2026",
};

const U = (m: string) => m.includes("(unconfirmed)");

export const GLOSSARY: GlossaryEntry[] = [
  // Contract & Program
  { category: "Contract & Program", term: "VA", meaning: "Department of Veterans Affairs" },
  { category: "Contract & Program", term: "FFP", meaning: "Firm Fixed Price (contract type)" },
  { category: "Contract & Program", term: "CLIN", meaning: "Contract Line Item Number" },
  { category: "Contract & Program", term: "SOW", meaning: "Statement of Work" },
  { category: "Contract & Program", term: "COR", meaning: "Contracting Officer's Representative" },
  { category: "Contract & Program", term: "PM", meaning: "Program Manager" },
  { category: "Contract & Program", term: "DS", meaning: "Deployment Strategist (Kaizen role, non-VA context)" },
  { category: "Contract & Program", term: "WS1–WS5", meaning: "Workstream 1 through 5" },
  { category: "Contract & Program", term: "ESC", meaning: "Executive Steering Committee" },
  { category: "Contract & Program", term: "GovCIO", meaning: "Government CIO (prime contractor company)" },
  { category: "Contract & Program", term: "KPI", meaning: "Key Performance Indicator" },
  { category: "Contract & Program", term: "FY", meaning: "Fiscal Year" },

  // Workstream Ownership
  { category: "Workstream Ownership", term: "WS1", meaning: "Document Submission + Tracking", lead: "Brad (apothesource)" },
  { category: "Workstream Ownership", term: "WS2", meaning: "Identity + Authentication", lead: "Mariam (CLEAR/GovCIO)" },
  { category: "Workstream Ownership", term: "WS3", meaning: "Design + Intelligent Search", lead: "Kaizen + Media Rain" },
  { category: "Workstream Ownership", term: "WS4", meaning: "Cross-Site Integration + Document Status", lead: "John Larkin (GovCIO)" },
  { category: "Workstream Ownership", term: "WS5", meaning: "Health Chat + PEP", lead: "OCC / VHA (nested under WS3 but separate application)" },

  // VA Products & Systems
  { category: "VA Products & Systems", term: "MyVA", meaning: "My VA (authenticated homepage product)" },
  { category: "VA Products & Systems", term: "ARP", meaning: "Accredited Rep Portal" },
  { category: "VA Products & Systems", term: "MHV", meaning: "MyHealtheVet" },
  { category: "VA Products & Systems", term: "PEP", meaning: "Patient health portal launch replacement (VHA side) — exact expansion (unconfirmed)" },
  { category: "VA Products & Systems", term: "VR&E", meaning: "Veteran Readiness and Employment (benefits.va.gov/vocrehab)" },
  { category: "VA Products & Systems", term: "QS", meaning: "Quick Submit" },
  { category: "VA Products & Systems", term: "MMS", meaning: "Mail Management Services" },
  { category: "VA Products & Systems", term: "VBMS", meaning: "Veterans Benefits Management System" },
  { category: "VA Products & Systems", term: "VLM", meaning: "VA system referenced in Okta/SSO migration context — exact expansion (unconfirmed)" },
  { category: "VA Products & Systems", term: "RES", meaning: "Appian-based backend platform (document tracker)" },
  { category: "VA Products & Systems", term: "eForms", meaning: "Electronic Forms" },
  { category: "VA Products & Systems", term: "EHR", meaning: "Electronic Health Record (Oracle EHR conversion referenced)" },

  // VA Organizations
  { category: "VA Organizations", term: "OPIA", meaning: "Office of Public and Intergovernmental Affairs" },
  { category: "VA Organizations", term: "OCTO", meaning: "Office of the Chief Technology Officer" },
  { category: "VA Organizations", term: "OCC", meaning: "Office of Connected Care" },
  { category: "VA Organizations", term: "VHA", meaning: "Veterans Health Administration" },
  { category: "VA Organizations", term: "VBA", meaning: "Veterans Benefits Administration" },
  { category: "VA Organizations", term: "BMT", meaning: "Benefits Management Tools (team within VBA)" },

  // Security, ATO & Compliance
  { category: "Security, ATO & Compliance", term: "ATO", meaning: "Authority to Operate" },
  { category: "Security, ATO & Compliance", term: "PIA", meaning: "Privacy Impact Assessment" },
  { category: "Security, ATO & Compliance", term: "PTA", meaning: "Privacy Threshold Analysis" },
  { category: "Security, ATO & Compliance", term: "POAM", meaning: "Plan of Action and Milestones" },
  { category: "Security, ATO & Compliance", term: "BIA", meaning: "Business Impact Assessment" },
  { category: "Security, ATO & Compliance", term: "AO", meaning: "Authorizing Official" },
  { category: "Security, ATO & Compliance", term: "ICAM", meaning: "Identity, Credential, and Access Management" },
  { category: "Security, ATO & Compliance", term: "PIV", meaning: "Personal Identity Verification" },
  { category: "Security, ATO & Compliance", term: "IL1", meaning: "Impact Level 1 (federal cloud security classification)" },
  { category: "Security, ATO & Compliance", term: "508", meaning: "Section 508 (federal accessibility compliance requirement)" },
  { category: "Security, ATO & Compliance", term: "WASA", meaning: "Referenced alongside PIA/PTA in ATO documentation — exact expansion (unconfirmed)" },
  { category: "Security, ATO & Compliance", term: "SARA", meaning: "VA form referenced for reporting API ATO submission — exact expansion (unconfirmed)" },
  { category: "Security, ATO & Compliance", term: "PSAC", meaning: "Referenced as recipient of interim ATO approval paragraph — exact expansion (unconfirmed)" },

  // Technical & Architecture
  { category: "Technical & Architecture", term: "API", meaning: "Application Programming Interface" },
  { category: "Technical & Architecture", term: "SSO", meaning: "Single Sign-On" },
  { category: "Technical & Architecture", term: "SNS", meaning: "Simple Notification Service (AWS)" },
  { category: "Technical & Architecture", term: "ADR", meaning: "Architecture Decision Record" },
  { category: "Technical & Architecture", term: "USWDS", meaning: "U.S. Web Design System" },
  { category: "Technical & Architecture", term: "IA", meaning: "Information Architecture" },
  { category: "Technical & Architecture", term: "UI/UX", meaning: "User Interface / User Experience" },
  { category: "Technical & Architecture", term: "AI", meaning: "Artificial Intelligence" },
  { category: "Technical & Architecture", term: "LLM", meaning: "Large Language Model" },
  { category: "Technical & Architecture", term: "VST", meaning: "Veterans Submission (Workflow) Services" },
  { category: "Technical & Architecture", term: "CNP", meaning: "Compensation & Pension (VA benefits line)" },
  { category: "Technical & Architecture", term: "NPI", meaning: "Non-Production Instance / stage environment — exact expansion (unconfirmed), distinct from the healthcare \"National Provider Identifier\" usage elsewhere" },
  { category: "Technical & Architecture", term: "MPI", meaning: "Master Patient Index" },
  { category: "Technical & Architecture", term: "OCI/OBI", meaning: "Referenced re: data quality checks — likely Oracle Cloud Infrastructure / Oracle Business Intelligence (unconfirmed)" },
  { category: "Technical & Architecture", term: "SNOW", meaning: "ServiceNow" },
  { category: "Technical & Architecture", term: "CAM", meaning: "Change and Asset Management (ServiceNow module context) (unconfirmed)" },
  { category: "Technical & Architecture", term: "NEO", meaning: "Edge routing / subdomain queue system referenced by GovCIO — exact expansion (unconfirmed)" },
  { category: "Technical & Architecture", term: "OCDO", meaning: "Office of the Chief Data Officer (unconfirmed)" },

  // Process & Testing
  { category: "Process & Testing", term: "UAT", meaning: "User Acceptance Testing" },
  { category: "Process & Testing", term: "MVP", meaning: "Minimum Viable Product" },
  { category: "Process & Testing", term: "RACI", meaning: "Responsible, Accountable, Consulted, Informed" },
  { category: "Process & Testing", term: "SME", meaning: "Subject Matter Expert" },
  { category: "Process & Testing", term: "IO1", meaning: "Referenced re: CLEAR pilot decision — exact expansion (unconfirmed)" },
  { category: "Process & Testing", term: "GR (tickets)", meaning: "Referenced re: dependency tickets — likely a Jira project/ticket prefix (unconfirmed)" },
  { category: "Process & Testing", term: "DTC", meaning: "Referenced re: VA Slack workspace (\"VA DTC workspace\") — exact expansion (unconfirmed)" },
].map((e) => ({ ...e, unconfirmed: U(e.meaning) })) as GlossaryEntry[];

export const GLOSSARY_CATEGORIES: {
  key: GlossaryCategory;
  color: string;
  blurb: string;
}[] = [
  { key: "Workstream Ownership", color: "#4a3fb5", blurb: "Who owns each WS." },
  { key: "VA Organizations", color: "#1a6fa8", blurb: "VA-side offices & administrations." },
  { key: "VA Products & Systems", color: "#2e8540", blurb: "Products & platforms in scope." },
  { key: "Contract & Program", color: "#7a4a00", blurb: "Contracting & program vocabulary." },
  { key: "Security, ATO & Compliance", color: "#b3261e", blurb: "ATO, privacy, accessibility." },
  { key: "Technical & Architecture", color: "#2b5f8a", blurb: "APIs, identity, infra terms." },
  { key: "Process & Testing", color: "#6b4a8a", blurb: "Delivery, testing, roles." },
];
