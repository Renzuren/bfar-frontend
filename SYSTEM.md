# BFAR Assessment & Monitoring System — Architecture Document

> Bureau of Fisheries and Aquatic Resources — Pre/Post Impact Evaluation Platform

---

## 1. System Overview

A full-stack web application for designing questionnaires, collecting field survey responses, analyzing before/after intervention data, and generating narrative comparison reports with PDF export.

### Core Workflow

```
Register/Login
    → Create Project (with title/description)
        → Create Before Questionnaire (form builder)
        → Collect Before Responses (public form link)
        → Create After Questionnaire (form builder)
        → Collect After Responses (public form link)
            → View Analytics (charts, tables)
            → Generate Narrative Report (before vs after comparison)
                → Download PDF / Save Report
            → Upload XLSX for ML-based impact analysis (optional)
```

### Tech Stack

| Layer | Technology | Port |
|-------|-----------|------|
| Frontend | React 19 + Tailwind CSS + shadcn/ui | 5173 |
| API Backend | Node.js + Express | 5000 |
| ML Backend (mock) | Node.js + Express (standalone) | 8000 |
| Database | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth (JWT verification) | — |
| Email | Nodemailer via Gmail SMTP | — |

---

## 2. Project Structure

### Frontend (`bfar-frontend/`)

```
src/
├── App.js                          # Router + context providers
├── pages/                          # 19 page components
│   ├── LandingPage.js              # Marketing / home
│   ├── Login.js                    # Login form
│   ├── Signup.js                   # Registration form
│   ├── VerifyAccount.js            # Email verification handler
│   ├── ForgotPassword.js           # Request password reset
│   ├── VerifyResetCode.js          # Enter reset code
│   ├── ResetPassword.js            # Set new password
│   ├── Dashboard.js                # Project-centric dashboard
│   ├── ProjectDashboard.js         # Sidebar shell + Outlet for nested routes
│   ├── BeforeTab.js                # Before questionnaire management
│   ├── AfterTab.js                 # After questionnaire management
│   ├── QuestionnaireBuilder.js     # Drag-and-drop form builder
│   ├── FormBuilder.js              # Legacy standalone form builder
│   ├── FormFill.js                 # Public survey-taking interface
│   ├── FormResponses.js            # Response table + CSV export
│   ├── FormAnalytics.js            # Per-form bar/pie charts
│   ├── NarrativeReport.js          # Before vs After comparison + PDF
│   ├── ReportsList.js              # Saved reports listing
│   └── MLUpload.js                 # XLSX upload for impact analysis
├── context/
│   ├── AuthContext.js               # User auth state + token management
│   └── ProjectContext.js            # Projects CRUD + current project
├── lib/
│   ├── apiMiddleware.js            # Axios client with auth + preprocessing interceptors
│   ├── preprocessing.js            # Form preprocessing, system fields, ML pipeline, CSV export
│   ├── authStorage.js              # localStorage / sessionStorage abstraction
│   ├── respondentAnalytics.js      # Pure functions for respondent statistics + charts
│   ├── geoData.js                  # Philippine municipality coordinates for maps
│   └── utils.js                    # cn() — Tailwind class merge utility
├── components/
│   ├── RespondentAnalytics.jsx     # Full analytics dashboard (860 lines)
│   ├── FeatureImportanceSection.jsx# Feature importance bar chart
│   └── ui/                         # 46 shadcn/ui components (new-york style)
└── hooks/
    ├── use-toast.js                # Toast notification system
    ├── useDragAutoScroll.js        # Auto-scroll during drag reordering
    └── usePreprocessedInput.js     # Real-time field preprocessing + form validation
```

### Backend (`bfar-back/`)

```
server.js                           # Entry point — starts API (5000) + ML (8000)
src/
├── config/
│   └── supabase.js                 # Supabase admin client init → creates db client
├── middleware/
│   └── auth_middleware.js          # Verifies Supabase Auth JWTs → req.user
├── routes/
│   ├── auth_routes.js              # /api/auth/*
│   ├── forms_routes.js             # /api/forms/*
│   ├── project_routes.js           # /api/projects/*
│   └── report_routes.js            # /api/reports/*
├── controllers/
│   ├── auth/                       # register, login, verify_account, forgot_password,
│   │                               # verify_reset_code, reset_password, delete_account
│   ├── forms/                      # create, get, get_single, update, delete,
│   │                               # submit_response, get_responses, get_public_form,
│   │                               # get_public_responses
│   ├── projects/                   # create, get, get_single, update, delete
│   ├── reports/                    # create, get, delete
│   └── analytics/
│       └── get_analytics.js        # Per-question option counts + rating values
├── utils/
│   ├── question_utils.js           # System field normalization (server-side mirror)
│   └── mailer_util.js              # Nodemailer SMTP transporter
└── ml/
    └── ml_server.js                # Standalone mock PSM server on port 8000
```

---

## 3. Data Model (Supabase / PostgreSQL)

### Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────┐
│                       users                          │
│  (row ID = Supabase Auth UID)                         │
│                                                      │
│  user_id, first_name, middle_name, last_name, email  │
│  status: "verifying" | "active"                      │
│  verification_link, reset_password_token             │
│  created_at, updated_at                              │
└──────────┬──────────────────────┬────────────────────┘
           │ user_id              │ user_id
           ▼                      ▼
┌─────────────────────┐   ┌────────────────────────────┐
│       projects      │   │          reports            │
│                     │   │                            │
│  title, description │   │  project_id ─────────────┐ │
│  user_id            │   │  title                    │ │
│  before_form ──┐    │   │  user_id                  │ │
│  after_form  ──┤    │   │  generated_at             │ │
│  reports_count │    │   │  created_at               │ │
│  created_at    │    │   └────────────────────────────┘ │
│  updated_at    │    │         ▲                        │
└────────────────┼────┘         │ project_id             │
                 │              │                        │
                 │    ┌─────────┘                        │
                 │    │                                  │
                 ▼    ▼                                  │
┌──────────────────────────────┐                        │
│           forms              │                        │
│                              │                        │
│  title, description          │                        │
│  user_id                     │                        │
│  project_id ─────────────────┼── links to projects    │
│  questionnaire_type          │                        │
│  questions: [                │                        │
│    { id, type, title, code,  │                        │
│      description, required,  │                        │
│      options, section,       │                        │
│      system, locked }        │                        │
│  ]                           │                        │
│  sections: [                 │                        │
│    { title, questions:[] }   │                        │
│  ]                           │                        │
│  response_count              │                        │
│  status: "draft"|"closed"|—  │                        │
│  created_at                  │                        │
│                              │                        │
│  ┌─── child tables ───┐    │                        │
│  │   responses          │    │                        │
│  │   (doc ID = UUID)    │    │                        │
│  │                      │    │                        │
│  │   respondent_id      │    │                        │
│  │   beneficiary_status │    │                        │
│  │   full_name, email   │    │                        │
│  │   municipality,      │    │                        │
│  │   barangay, province │    │                        │
│  │   answers: [         │    │                        │
│  │     { question_id,   │    │                        │
│  │       answer }       │    │                        │
│  │   ]                  │    │                        │
│  │   submitted_at       │    │                        │
│  └──────────────────────┘    │                        │
│                              │                        │
│  ┌─── child tables ───┐    │                        │
│  │ respondentCounters   │    │                        │
│  │ "B" → {last_number}  │    │                        │
│  │ "NB"→ {last_number}  │    │                        │
│  └──────────────────────┘    │                        │
└──────────────────────────────┘
```

### Project ↔ Forms Relationship

A **project** contains exactly two forms:

```
project.before_form ──► forms/{formId}   (Before assessment)
project.after_form  ──► forms/{formId}   (After assessment)
```

Both forms share the same `project_id` field. A project can have multiple **reports** linked by `reports.project_id`.

### System Fields (auto-prepended to every form)

| Code | Title | Type | Required | Purpose |
|------|-------|------|----------|---------|
| RESP-01 | Respondent ID | `respondent_id` | No | Auto-generated: B-0001 or NB-0001 |
| RESP-02 | Respondent Name | `respondent_name` | Yes | Free text |
| A1 | Municipality | `location_text` | Yes | Philippine municipality |
| A2 | Barangay | `location_text` | Yes | Philippine barangay |
| A3 | Province | `location_text` | Yes | Philippine province |

### Question Types

| Type | Data Shape | Description |
|------|-----------|-------------|
| `multiple_choice` | `string` | Single selection from options |
| `checkboxes` | `string[]` | Multiple selections |
| `dropdown` | `string` | Single selection from dropdown |
| `rating` | `number` (1-5) | Star rating |
| `date` | `string` (YYYY-MM-DD) | Date picker |
| `short_text` / `long_text` | `string` | Free text |

---

## 4. API Endpoints

### Authentication (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/register` | No | Create account → sends verification email |
| `POST` | `/login` | No | Login → returns Supabase session token |
| `GET` | `/verify_account?token=` | No | Email verification link |
| `POST` | `/forgot_password` | No | Sends 6-digit reset code via email |
| `POST` | `/verify_reset_code` | No | Validates reset code |
| `POST` | `/reset_password` | No | Sets new password |
| `DELETE` | `/delete_account` | Yes | Deletes user + all owned data |
| `GET` | `/me` | Yes | Returns current user info |

### Forms (`/api/forms`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Yes | List all forms for authenticated user |
| `POST` | `/` | Yes | Create form (accepts `project_id`, `questionnaire_type`) |
| `GET` | `/:id` | Yes | Get single form (ownership check) |
| `PUT` | `/:id` | Yes | Update form fields (ownership check) |
| `DELETE` | `/:id` | Yes | Delete form + responses + counters (cascade) |
| `GET` | `/:id/responses` | Yes | Get all responses for a form |
| `GET` | `/:id/analytics` | Yes | Per-question analytics (option counts, ratings, text) |
| `GET` | `/public/:id` | No | Public form data (hides draft/closed forms) |
| `POST` | `/public/:id/responses` | No | Submit a survey response |
| `GET` | `/public/:id/responses` | No | Redacted public response summary |

### Projects (`/api/projects`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Yes | List all projects for authenticated user |
| `POST` | `/` | Yes | Create project (`title`, `description`) |
| `GET` | `/:id` | Yes | Get single project |
| `PUT` | `/:id` | Yes | Update project (title, description, before_form, after_form) |
| `DELETE` | `/:id` | Yes | Delete project + cascade (forms, responses, reports) |

### Reports (`/api/reports`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Yes | List reports (optional `?project_id=` filter) |
| `POST` | `/` | Yes | Save report metadata (increments project's reports_count) |
| `DELETE` | `/:id` | Yes | Delete report (decrements project's reports_count) |

### ML Server (port 8000 — separate Express instance)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/train` | No | CSV upload → mock PSM analysis (simulated results) |

---

## 5. Authentication Flow

```
                    ┌──────────────┐
                    │  Registration │
                    └──────┬───────┘
                           │ POST /api/auth/register
                           ▼
              Creates Supabase Auth user
              Creates users row (id = Supabase Auth UID)
              status: "verifying"
              Generates verification_link (hex token)
              Sends verification email via SMTP
                           │
                           ▼
                    User clicks email link
                           │
                           ▼
              GET /api/auth/verify_account?token=...
              Sets status → "active"
                           │
                           ▼
                    ┌──────────────┐
                    │    Login     │
                    └──────┬───────┘
                           │ POST /api/auth/login
                           ▼
              Supabase Auth signInWithPassword
              Checks users.status == "active"
              Returns { idToken, refreshToken, user }
                           │
                           ▼
              Token stored in localStorage (remember me)
              or sessionStorage (session only)
                           │
                           ▼
              All protected requests include:
              Authorization: Bearer <idToken>
                           │
                           ▼
              auth_middleware.js verifies token
              Attaches decoded token → req.user
              Contains { uid, email, ... }
```

### CORS Origins

`localhost:5173`, `127.0.0.1:5173`, `localhost:3000`, `127.0.0.1:3000`

---

## 6. Frontend Routing

| Path | Component | Context | Description |
|------|-----------|---------|-------------|
| `/` | LandingPage | — | Marketing page |
| `/login` | Login | — | Login form |
| `/signup` | Signup | — | Registration form |
| `/forgot-password` | ForgotPassword | — | Request reset code |
| `/verify-reset-code` | VerifyResetCode | — | Enter code |
| `/reset-password?token=` | ResetPassword | — | Set new password |
| `/verify-account?token=` | VerifyAccount | — | Email verification |
| `/dashboard` | Dashboard | AuthProvider, ProjectProvider | Project listing |
| `/projects/:id` | ProjectDashboard | Outlet context | Sidebar shell |
| ↳ `create-questionnaire` | QuestionnaireBuilder | useSearchParams `?type=before\|after` | Form builder |
| ↳ `before` | BeforeTab | Outlet context | Before questionnaire mgmt |
| ↳ `after` | AfterTab | Outlet context | After questionnaire mgmt |
| ↳ `narrative-report` | NarrativeReport | Outlet context | Before vs After comparison |
| ↳ `reports` | ReportsList | Outlet context | Saved reports listing |
| `/forms/:id/edit` | FormBuilder | — | Legacy form editor |
| `/forms/:id/responses` | FormResponses | location.state | Response table + CSV |
| `/forms/:id/analytics` | FormAnalytics | location.state | Charts + CSV download |
| `/f/:id` | FormFill | — | Public survey form |
| `/ml-upload` | MLUpload | — | XLSX impact analysis |

### Navigation Between Pages

```
Dashboard ──(project card click)──► ProjectDashboard
                                        │
                                        ├── BeforeTab ──(Create)──► QuestionnaireBuilder?type=before
                                        │         │
                                        │         ├──(Edit)──► QuestionnaireBuilder?type=before (with form data)
                                        │         ├──(View)──► FormResponses (via location.state)
                                        │         ├──(Analytics)──► FormAnalytics (via location.state)
                                        │         ├──(Copy Link)──► /f/:id (public form, new tab)
                                        │         └──(Delete)──► Confirmation dialog → DELETE /api/forms/:id
                                        │
                                        ├── AfterTab ──(same pattern as BeforeTab, type=after)
                                        │
                                        ├── NarrativeReport ──(Save Report)──► POST /api/reports
                                        │         └──(Download PDF)──► html2canvas → jsPDF
                                        │
                                        └── ReportsList ──(Delete)──► DELETE /api/reports/:id
```

### Back Navigation Pattern

Both `FormResponses` and `FormAnalytics` accept `location.state` with `{ project_id, questionnaire_type }` passed from `BeforeTab`/`AfterTab`. The "Back" button returns to the project's before/after tab. If no state is present, it falls back to `/dashboard`.

---

## 7. Preprocessing Pipeline

### Input-Level Preprocessing

Every user input passes through the preprocessing layer:

```
User types input
    │
    ├── usePreprocessedInput hook (real-time in form fields)
    │       │
    │       ├── text → preprocessText(): trim, collapse whitespace, strip control chars, limit 10K
    │       ├── date → preprocessDate(): validate YYYY-MM-DD, reject far-future
    │       └── rating → preprocessRating(): parseInt, validate 1-5
    │
    └── apiMiddleware.js interceptor (on API send)
            │
            ├── /forms/* → preprocessFormData(): cleans titles, descriptions, question options
            └── /auth/*  → lowercases email, sanitizeHtml() for name fields
```

### System Field Management

System fields (RESP-01, RESP-02, A1, A2, A3) are managed at both frontend and backend:

```
Form Creation:
    frontend: ensureSystemFields() → prepends missing system fields
    backend:  normalizeFormQuestions() → same logic server-side

Form Fetch:
    frontend: canonicalizeSystemFields() → forces correct type/title
    backend:  sanitizeFormQuestions() → strips duplicate respondent fields

Analytics:
    frontend: isReservedField() → filters out system fields from charts
    backend:  getSurveyQuestions() → returns only survey questions
```

### Server-Side Question Normalization (`question_utils.js`)

```
normalizeFormQuestions(formData):
  1. Remove duplicate respondent fields (isRespondentField check)
  2. Normalize question codes (strip non-alphanumeric, uppercase)
  3. Canonicalize system fields (force correct type/title/required)
  4. Ensure system fields exist in first section (prepend if missing)
  5. Assign default location codes (A1/A2/A3) by keyword matching
```

---

## 8. Analytics System

### Per-Form Analytics (Survey Responses)

**Two-path architecture with client-side fallback:**

```
FormAnalytics page loads
    │
    ├── Fetch form data: GET /api/forms/:id
    ├── Fetch responses: GET /api/forms/:id/responses
    │
    ├── Try server analytics: GET /api/forms/:id/analytics
    │       │
    │       ├── Success → preprocessAnalyticsData()
    │       │       Normalizes types, computes totalAnswered/totalNoAnswer,
    │       │       builds rating distributions
    │       │
    │       └── Failure → computeFallbackAnalytics()
    │               Client-side computation from raw responses
    │               Same logic as server, executed in browser
    │
    └── Render charts (Recharts):
            ├── Multiple choice/dropdown/checkboxes → Bar chart or Pie chart
            ├── Rating → Bar/Pie distribution with average
            └── Text → List of responses
```

**Server-side analytics (`get_analytics.js`):**
- Fetches form + all responses from the database
- Filters system fields via `getSurveyQuestions()`
- Counts option frequencies, collects rating values, gathers text responses
- Returns `{ total_responses, questions: [{ type, title, responses, ... }] }`

### Narrative Report (Before vs After Comparison)

```
NarrativeReport loads with project context
    │
    ├── Fetch before form + responses (if before_form exists)
    ├── Fetch after form + responses (if after_form exists)
    │
    ├── Compute beforeQuestions / afterQuestions
    │       normalizeLocationCodes() → filter isReservedField()
    │
    ├── Match questions by code or title:
    │       beforeQuestions.forEach(bq => {
    │           afterQuestions.find(aq => aq.code === bq.code || aq.title === bq.title)
    │       })
    │
    ├── For matched questions, compute comparison:
    │       ├── Multiple choice → percentage comparison (before% vs after%)
    │       └── Rating → average comparison (beforeAvg vs afterAvg)
    │
    └── Render:
            ├── Summary cards (before/after response counts, questions compared)
            ├── Bar charts with Before/After overlay
            ├── Pie charts (side-by-side)
            ├── Data tables with change indicators (↑↓→)
            ├── Download PDF (html2canvas → jsPDF)
            └── Save Report (POST /api/reports)
```

### ML Upload Analytics (Impact Assessment)

**Entirely client-side — no server requests during analysis:**

```
MLUpload page (4-step wizard)
    │
    Step 1 — Upload:
    │   Drag-and-drop CSV/XLSX → parseCSVRows() or xlsx library
    │
    Step 2 — Configure:
    │   Auto-detect treatment/outcome columns (keyword matching)
    │   Feature filter (default: B3:AGE, B5:SEX, B6:M-STATUS, B7:EDUCATION)
    │   Data preview with group badges
    │
    Step 3 — Analyze (buildAnalysisResults()):
    │   ├── Column detection (fuzzy keyword matching)
    │   ├── Beneficiary classification (normalizeGroupStatus: 1/B/beneficiary → B, 0/NB/control → NB)
    │   ├── Data parsing (numeric, education decoding, marital decoding, HH size bucketing)
    │   ├── Outcome classification (SES delta → Improved/Declined/No Change)
    │   ├── ATT computation:
    │   │     Difference-in-differences:
    │   │     (mean_SES_B_beneficiary - mean_SES_A_beneficiary)
    │   │     - (mean_SES_B_nonBeneficiary - mean_SES_A_nonBeneficiary)
    │   ├── Feature importance:
    │   │     Standardized group difference: (mean_B - mean_NB) / std_dev
    │   │     Clamped to [-1, 1], top 15 features
    │   ├── Propensity scores:
    │   │     Standardize features → sum → sigmoid → bin into 8 buckets
    │   ├── SMD (Standardized Mean Difference) before/after matching
    │   ├── SES trend (10 quantile buckets)
    │   └── Radar chart data (6 normalized dimensions)
    │
    Step 4 — Save/Export:
        ├── Download JSON
        ├── Save to localStorage
        └── Create Form from CSV
```

**Rendered via `RespondentAnalytics` component (860 lines):**
- Summary cards (totals, medians, beneficiary counts)
- Demographic charts (age, sex, marital, education distributions)
- Geographic bubble map (Leaflet + Philippine coordinates)
- SES before/after comparison
- Feature importance visualization
- CSV export

---

## 9. Preprocessing.js — ML Text Analysis Pipeline

> **Note:** The following functions are fully implemented but **currently unused** by any component. They are available as a library for future integration.

```
preprocessTextForML(text)
    │
    ├── cleanTextForML(text)
    │       lowercase, replace URLs→[URL], emails→[EMAIL], phones→[PHONE]
    │       strip non-ASCII punctuation, normalize whitespace
    │
    ├── tokenizeText(text)
    │       split on whitespace, split punctuation as separate tokens
    │
    ├── normalizeTokens(tokens)
    │       basic stemming: -ies→-y, -es, -s, -ing, -ed, -er, -est, -ly
    │
    ├── removeStopwords(tokens)
    │       ~50 English stopwords + pure numbers
    │
    └── extractMLFeatures(tokens, cleaned, original)
            wordCount, charCount, avgWordLength, uniqueWords, lexicalDiversity
            sentimentScore (15 positive - 15 negative words)
            isQuestion, hasNumbers, hasEmails, hasUrls
            readabilityScore, longWords, shortWords, capitalWords

performMLAnalysis(responses, questions)
    ├── Filter to text-type questions only
    ├── preprocessResponsesForML() for each response
    ├── Build text corpus from all text answers
    ├── generateTFIDF(corpus) → vocabulary + TF-IDF matrix
    ├── analyzeSentiment() → average, distribution
    ├── extractKeywords(topN=10) → frequency-ranked keywords
    └── Return { hasTextQuestions, analysis: { sentiment, keywords, tfidf, ... } }
```

---

## 10. Respondent ID Generation

When a form has a "beneficiary" question (code `BENE` or title containing "beneficiary"):

```
Response submitted
    │
    ├── Detect beneficiary_status from answers
    │       "Yes" / "beneficiary" → prefix "B"
    │       "No"  / "non-beneficiary" → prefix "NB"
    │
    ├── Transactional counter in respondent_counters table:
    │       Database transaction reads "B" or "NB" counter
    │       Increments last_number atomically
    │       Returns new number
    │
    └── Assign respondent_id: "B-0001" or "NB-0003"
```

---

## 11. Cascade Deletion

### Delete Project
```
DELETE /api/projects/:id
    ├── Find all forms where project_id matches → delete each form (see below)
    ├── Find all reports where project_id matches → delete each report
    ├── Delete project row
    └── Done
```

### Delete Form
```
DELETE /api/forms/:id
    ├── Delete all rows in responses where form_id matches (batched)
    ├── Delete all rows in respondent_counters where form_id matches (batched)
    ├── Delete form row
    └── Done
```

### Delete Report
```
DELETE /api/reports/:id
    ├── Find associated project
    ├── Decrement project.reports_count (atomic increment -1)
    ├── Delete report row
    └── Done
```

---

## 12. CSV Export

### Form Responses CSV

`FormResponses.js` generates a standardized assessment-format CSV:

```
1. generateAssessmentHeaders(questions)
       Format: [SECTION][##]_[##][SUFFIX]_[DESCRIPTION]
       Example: B01_01, B01_02, C03_01_01 (checkbox one-hot)
       Prepend: RESPONDENT_ID, A01:CONSENT

2. mapResponseToAssessmentColumns(response, questions, headers, index)
       Maps each response answer to the correct column
       Checkboxes: one-hot encoded (1/0 per option)
       Arrays: semicolon-joined
       Missing: empty string
```

### Analytics CSV

`FormAnalytics.js` generates a question-by-question summary CSV:
- Form title + total submissions header
- Per question: label, total answered, not answered
- Choice questions: option + count
- Rating questions: star distribution + average
- Text questions: individual responses

---

## 13. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Single before/after form per project** | Simplifies the comparison model — each project represents one impact evaluation |
| **Supabase Auth + service-role client** | Server-side JWT verification ensures security; the service-role client has elevated database access |
| **Public form submission without auth** | Field workers collect data without needing app accounts |
| **Client-side fallback analytics** | Resilient — works even if server analytics endpoint fails |
| **Client-side ML analysis** | No Python backend needed; all PSM/computation runs in the browser |
| **Mock ML server (port 8000)** | Placeholder for future Python ML backend; returns structurally realistic responses |
| **Related response tables** | Natural scoping per form; efficient queries; batch deletion support |
| **System fields always prepended** | Guarantees consistent respondent metadata across all forms |
| **html2canvas → jsPDF for PDF** | Client-side PDF generation avoids server-side rendering dependencies |
| **Denormalized counters** | `response_count` and `reports_count` avoid count queries |

---

## 14. Environment Variables

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (used by REST API calls) |
| `EMAIL_USER` | Gmail address for Nodemailer SMTP |
| `EMAIL_PASS` | Gmail app password for Nodemailer |

Supabase admin access uses the project URL + service-role key (or bundled credentials) in the project root.

---

## 15. Current Limitations & Future Notes

1. **No real ML backend.** The ML server on port 8000 returns simulated data. The text analysis pipeline in `preprocessing.js` is implemented but unused.
2. **No report content storage.** Reports only store metadata (title, timestamps). The actual comparison data is computed fresh each time from form responses.
3. **No report update endpoint.** Reports are create-only (POST) with delete (DELETE). No PUT.
4. **Email uniqueness per form.** Duplicate email submissions to the same form are rejected.
5. **No WebSocket/real-time updates.** Dashboard data is fetched on mount/navigation.
6. **No pagination for responses.** All responses for a form are fetched at once.
7. **No role-based access.** All authenticated users have the same permissions on their own data.
