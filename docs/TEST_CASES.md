# QualiSIS - Test Cases

## 1. Authentication & Profiling

### TC-AUTH-01: User Login
*   **Pre-condition:** User has a registered account.
*   **Steps:** Navigate to `/login`. Enter valid email and password. Click 'Sign In'.
*   **Expected Result:** User is redirected to `/projects`. Session cookie is correctly created.

### TC-AUTH-02: User Sign Out
*   **Pre-condition:** User is logged in.
*   **Steps:** Click the 'Sign Out' button from the Sidebar or Profile page.
*   **Expected Result:** Session is destroyed, client cache is bypassed (via window.location), and the user is hard-redirected to `/login`.

### TC-AUTH-03: Protected Routes Access
*   **Pre-condition:** User is not logged in.
*   **Steps:** Attemp to access `/projects` or `/profile` directly via URL.
*   **Expected Result:** Platform automatically redirects the user back to `/login`.

## 2. Project Management

### TC-PROJ-01: Create New Project
*   **Pre-condition:** Logged in.
*   **Steps:** Go to `/projects`. Click 'Create New Project'. Fill in name and description. Submit.
*   **Expected Result:** Project is created in the database and immediately appears on the Projects Dashboard.

### TC-PROJ-02: Delete Project
*   **Pre-condition:** User has an existing project.
*   **Steps:** Click the delete icon on a Project card. Confirm deletion in the prompt.
*   **Expected Result:** Project and all its associated datasets/transcripts are removed from UI and Database.

## 3. Data & Transcripts

### TC-DATA-01: Upload Transcript
*   **Pre-condition:** In a valid project space.
*   **Steps:** Use the file uploader feature to upload a `.txt` or `.docx` transcript.
*   **Expected Result:** Transcript is parsed and assigned to the active Dataset. Total count increments.

### TC-DATA-02: Transcript Rendering & AI Suggestion
*   **Pre-condition:** Transcript exists.
*   **Steps:** Open a specific transcript. 
*   **Expected Result:** Text is split appropriately. AI overlay buttons operate and fetch relevant qualitative markers for the researcher to review.

## 4. Codebook & Themes

### TC-CODE-01: Code Assignment
*   **Steps:** In transcript view, select text and assign a 'Code'.
*   **Expected Result:** Code is bound to the exact character offset. Audit log is updated.

### TC-THEM-01: Theme Network Graph
*   **Pre-condition:** Several codes exist.
*   **Steps:** Navigate to Themes Workspace.
*   **Expected Result:** Network graph dynamically renders nodes representing themes and codes. Relationships properly map.

## 5. Reporting & Traceability

### TC-REP-01: Drafting with Constrained Context
*   **Pre-condition:** Valid themes and codes have been assigned.
*   **Steps:** Navigate to Reports space. Ask the AI agent to summarize a theme.
*   **Expected Result:** The drafted snippet contains *only* information found in the assigned texts, and UI offers a citation linking back to the raw source.

### TC-AUDIT-01: Traceability Log Verification
*   **Steps:** Open the trace view for a given report paragraph.
*   **Expected Result:** The system lists down the chronological log: AI parsing -> User approving -> User defining code -> Reporter generation.
