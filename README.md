# Traceable AI Qualitative Analysis Platform (QualiSIS)

A production-ready web platform for researchers to conduct AI-assisted qualitative analysis with strict traceability, transparency, and human-in-the-loop review.

## Core Features
1. **Dataset Workspace**: View transcripts with inline traceable AI suggestions.
2. **Codebook Workspace**: Transition raw human-reviewed codes into a clean codebook definition structure.
3. **Themes Workspace**: Structure codes into themes and visualize them using a network graph relation view.
4. **Report Workspace**: Draft structured reports utilizing an AI assistant constrained specifically to generating content *only* from verified, human-approved findings.
5. **Audit Trail**: Immutable logging of every human and AI action protecting the integrity of the research workflow.

## Technology Stack
- Next.js 14 App Router
- React & TypeScript
- Tailwind CSS & shadcn/ui
- Prisma ORM & PostgreSQL
- NextAuth.js configured for Roles (Admin, Researcher, Reviewer)

## Local Setup

### 1. Prerequisites
Ensure you have Node.js 18+ and Docker installed.

### 2. Install Dependencies
```bash
npm install
```
*(If UI libraries or Next/React dependencies throw warnings, use `npm install --legacy-peer-deps`)*

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update the `DATABASE_URL` or `NEXTAUTH_SECRET` if needed.

### 4. Start the Database
Spin up the local PostgreSQL instance via Docker Compose:
```bash
docker-compose up -d
```

### 5. Setup Database & Seed Data
Push the Prisma schema to the database and seed it with the realistic mock demo data:
```bash
npx prisma db push
npm run db:seed
```

### 6. Run the Application
Start the Next.js development server:
```bash
npm run dev
```

Navigate to `http://localhost:3000` to interact with the platform. You will be redirected instantly to the "Round 1 Interviews" dataset to experience the prototype.

## Development & AI Mock
Due to constraints, this project employs a **deterministic mock AI engine** natively embedded in the component layer to ensure the full end-to-end qualitative analysis prototype works perfectly out of the box without requiring expensive API keys immediately.

To adopt a real LLM (like GPT-4), replace the mock variables inside `src/app/(dashboard)/projects/...` with database fetches interacting through `src/app/api/...` route handlers.
