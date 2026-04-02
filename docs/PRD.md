# QualiSIS - Product Requirements Document (PRD)

## 1. Project Overview
**QualiSIS** (Traceable AI Workstation) is a web-based platform tailored for researchers conducting qualitative data analysis. It leverages AI assistance while enforcing strict traceability, transparency, and human-in-the-loop review to preserve the integrity of academic research.

## 2. Target Audience & Roles
*   **Researcher:** The primary user conducting qualitative analysis. They upload transcripts, assign codes, group them into themes, and draft reports.
*   **Reviewer / Auditor:** A secondary user tasked with exploring the project data to ensure the methodology and assigned codes/themes logically trace back to the raw transcripts.
*   **Administrator (Admin):** Manages user accounts and global infrastructure configurations.

## 3. Core Capabilities & Workspaces

### 3.1. Authentication & Security
*   **Authentication:** Users authenticate securely via NextAuth credentials. Features include login, registration, and sign out routines.
*   **Session Management:** Token-based JWT strategy ensuring that unverified users cannot access sensitive project workspaces.

### 3.2. Project & Dataset Management (Projects Dashboard)
*   **Projects:** Users can create, edit, delete, and view multiple projects.
*   **Datasets & Transcripts:** Within projects, users can manage transcripts. Transcripts can be uploaded, parsed, and assigned to specific datasets.

### 3.3. Transcripts & Data Workspace
*   **Viewing:** Users can view the full unedited content of uploaded transcripts.
*   **AI Integration:** Researchers can receive inline AI suggestions alongside the transcript which they can actively trace, review, and formally approve/discard. 

### 3.4. Codebook Workspace
*   **Code Maturation:** Approved raw codes undergo maturation. Researchers group related approved transcript snippets into a canonical Codebook definitions list.
*   **Data Integrity:** Changes inside the codebook strictly reference the raw text so conclusions are never hallucinated.

### 3.5. Themes Workspace
*   **Theme Generation:** Codes get clustered into overarching qualitative Themes.
*   **Network Graph:** Provides a dynamic node relation visualization. With the multi-dimensional Knowledge Graph configuration, relationships can be modeled between both Themes and Participants to enable advanced demographic filtering and comparative cross-case analysis.

### 3.6. Report Drafting Workspace
*   **Constrained AI Drafting:** An embedded AI assistant acts as a co-pilot to draft sections of a research report. Crucially, it is completely constrained to generate text *only* based on the verified findings, codes, and themes built by the human researcher.

### 3.7. Audit Trail
*   **Global Logging:** Every human review decision and AI invocation must be immutably recorded.
*   **Traceability View:** An interface showcasing the full journey from (A) *Original Transcript Text* to (B) *AI Suggestion* to (C) *Human Code Assignment* to (D) *Report Content*.

### 3.8. Cross-Case Analysis & Visual Framework
*   **Participant Differentiation:** Each uploaded transcript/participant is assigned a unique visual color identifier and avatar tag to ensure distinction across the platform.
*   **Saturation Assessment:** Excerpts and quotes inside the Codebook display their participant's color tag, allowing researchers to instantly visually gauge whether a theme is widespread across all demographics or isolated to a specific individual.
*   **Graph Filtering:** The Thematic Network Graph acts as a multidimensional knowledge base where both Themes and Participants are interconnected nodes, supporting visually filtering out overlapping or diverging qualitative patterns.

## 4. Technical Stack
*   **Framework:** Next.js 14 App Router
*   **Language:** React & TypeScript
*   **Database ORM:** Prisma connected to a PostgreSQL database
*   **Styling:** Tailwind CSS & shadcn/ui
*   **Authentication:** NextAuth.js
