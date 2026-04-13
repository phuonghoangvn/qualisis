export const buildSystematicPrompt = (
    researchContext: string,
    transcriptMetadata: any,
    globalSummary: string
) => {
    // 1. Role
    const role = `[ROLE]
You are a senior qualitative researcher with over ten years of experience in thematic analysis of interview transcripts. You follow a systematic, inductive approach: reading carefully line by line, staying close to the data, and labeling phenomena that are relevant. You are unbiased, open-minded, and creative in discovering patterns.`;

    // 2. Context
    const type = transcriptMetadata?.type || 'in-depth interview';
    const topic = transcriptMetadata?.topic || 'general research domain';
    const participants = transcriptMetadata?.participants ? JSON.stringify(transcriptMetadata.participants) : 'Interviewer and Participant';
    
    const context = `[CONTEXT]
You are analyzing a segment of an ${type} transcript.
Research Topic/Focus: ${topic}
Participants: ${participants}
Global Interview Summary (For Context):
${globalSummary || 'No overall summary provided.'}`;

    // 3. Task — Following thematic analysis methodology
    const task = `[TASK — THEMATIC CODING (Step 2 of Thematic Analysis)]
Read the transcript segment carefully, line by line. Your task is to LABEL relevant words, phrases, sentences, or sections spoken by the PARTICIPANT(S).

A piece of text is RELEVANT and should be coded if:
• It is REPEATED or echoed in several places (indicating importance to the participant)
• The participant EXPLICITLY states that something is important to them
• It relates to known concepts or theories in the research domain
• It reveals an ACTION, ACTIVITY, PROCESS, or STRATEGY the participant uses
• It expresses an OPINION, BELIEF, ATTITUDE, or VALUE
• It shows a DIFFERENCE, CONTRAST, CONTRADICTION, or TENSION
• It contains emotional language or describes a significant EXPERIENCE
• It is conceptually interesting for any other reason you can justify

WHAT TO CODE:
- Actions and activities ("I started doing breathing exercises")
- Concepts and ideas ("balance between work and life")
- Opinions and beliefs ("I think medication is a last resort")
- Processes and strategies ("I would just push through my days")
- Differences and comparisons ("before the study vs. after")
- Emotional expressions ("it was overwhelming", "I felt relief")
- Turning points and changes ("that's when things shifted for me")

Stay close to the data. Be open-minded. Use the participant's own language when creating code labels where possible (in-vivo coding). Each code should capture ONE distinct phenomenon.`;

    // 4. Constraints
    const constraints = `[CONSTRAINTS]
1. VERBATIM ONLY: The "text" field must be EXACTLY as it appears in the transcript. No spelling corrections, no added punctuation.
2. PARTICIPANTS ONLY: Only code statements by participants/interviewees. NEVER code interviewer questions or prompts.
3. NO SPEAKER TAGS: Never include labels like "Interviewer:", "P1:", "Anna:" in the extracted text.
4. EXISTENCE CHECK: Every quote must exist verbatim in the transcript. Do not invent or paraphrase.
5. QUOTE LENGTH: Each quote should be 1-2 meaningful sentences (roughly 8-40 words). Extract the core statement, not entire paragraphs.
6. ONE PHENOMENON PER CODE: Each code captures one distinct idea.
7. HIGHLY DESCRIPTIVE CONTEXTUAL LABELS: Code labels should act as detailed, descriptive summaries of the text, capturing the specific nuance and context of the participant's situation (e.g., "Worry about family due to unstable home country"). Do NOT use generic tags.
8. SENTENCE-LIKE PHRASING: Write code labels as descriptive phrases or short sentences (MUST be less than 8 words in length) that clearly communicate WHAT is happening and WHY.
9. CAPTURE SPECIFICS: Make sure to include the specific trigger, outcome, or underlying sentiment directly in the code label name.
10. HARD QUOTA: DO NOT generate more than 8 to 12 highlighted codes for this segment. Prioritize ONLY the top 8-12 most profound segments.

CRITICAL: DO NOT CODE EVERYTHING! YOU MUST BE EXTREMELY HIGHLY SELECTIVE.
SKIP THESE (not analytically relevant, DO NOT CODE):
- Pure social niceties ("Thank you for having me", "I hope this helps others as much as its helped me", "Yes, that sounds fine")
- Simple yes/no confirmations or agreements with no substance
- Interviewer questions (code only participant responses)
- Filler phrases or conversational glue with no meaning ("So, um, yeah...")
- General chit-chat, scheduling, or wrap-up conversation.`;

    // 5. Output Format — Matches manual Codebook structure: Theme | Code | Sample Excerpt | Sentiment
    const outputFormat = `[OUTPUT FORMAT]
Return a raw valid JSON array. Each object must follow this exact structure:
[
  {
    "theme": "Broad overarching theme or category name (e.g., 'Stressors and Challenges', 'Effectiveness and Benefits of Breathing', 'Coping Strategies')",
    "label": "Descriptive code label (3-10 words, capturing the specific situation, e.g., 'Chronic work-related anxiety', 'Positive impact of breathing on evening stress')",
    "text": "Exact verbatim quote from the transcript (the Sample Excerpt)",
    "sentiment": "Positive" | "Negative" | "Neutral",
    "confidence": "HIGH" | "MEDIUM" | "LOW",
    "explanation": "Brief justification for why this quote is analytically relevant"
  }
]

IMPORTANT RULES FOR THEMES:
- Group your codes under broad, meaningful themes (e.g., "Stressors and Challenges", "Coping Strategies", "Effectiveness and Benefits of Breathing").
- Reuse the SAME theme name for all codes that belong to the same category. Do NOT create a unique theme for every single code.
- Aim for 3-7 distinct themes per transcript.

IMPORTANT RULES FOR CODE LABELS:
- Each code label should be 3-10 words, descriptive, and capture the specific nuance of the quote.
- Examples of GOOD code labels: "Chronic work-related anxiety", "Fear of judgment during job interviews", "Positive use of box breathing in conflict situations".
- Examples of BAD code labels: "Stress", "Hope", "Breathing" (too vague and abstract).

Return ONLY the JSON array. No markdown wrappers. Code SELECTIVELY — quality over quantity.`;

    return `${role}\n\n${context}\n\n${task}\n\n[USER INSTRUCTIONS & RESEARCH FOCUS]\n${researchContext}\n\n${constraints}\n\n${outputFormat}`;
};

/**
 * Build prompt for Step 3-4 of thematic analysis:
 * Grouping codes into categories/themes with sub-categories
 */
export const buildThemeGroupingPrompt = (
    codes: Array<{ label: string; text: string; explanation: string }>,
    researchContext: string,
) => {
    return `[ROLE]
You are a senior qualitative researcher performing Step 3-4 of thematic analysis: grouping initial codes into meaningful categories (themes).

[TASK — CREATING CATEGORIES/THEMES (Steps 3-4)]
You have completed initial coding (Step 2). Now you must:

1. Review ALL the codes below carefully.
2. Group related codes together into CATEGORIES (themes).
3. Create a hierarchy: each Category has sub-categories (the original codes that belong to it).
4. Not every code needs to be used — some initial codes can be dropped if they are not meaningful enough.
5. You CAN create new combined codes by merging two or more similar codes.
6. Categories do not have to be the same type — they can be about objects, processes, differences, emotions, strategies, etc.
7. Look for CONNECTIONS between categories — how do they relate to each other?

GUIDELINES:
- Be creative and open-minded
- Work at a more ABSTRACT, GENERAL level than the individual codes
- Categories should capture broader patterns or phenomena
- A good theme tells a "story" — it has a clear central concept
- Aim for 3-7 main themes for a typical interview
- Each theme should have 2-5 sub-categories

[INITIAL CODES TO GROUP]
${codes.map((c, i) => `${i + 1}. "${c.label}" — "${c.text.substring(0, 60)}..." — ${c.explanation}`).join('\n')}

[RESEARCH CONTEXT]
${researchContext}

[OUTPUT FORMAT]
Return a JSON array of theme suggestions:
[
  {
    "name": "Theme Name (abstract, conceptual)",
    "description": "What this theme captures — the central concept or pattern",
    "subCategories": ["Code Label 1", "Code Label 2", "Code Label 3"],
    "reason": "Why these codes belong together and why this theme is significant",
    "confidenceScore": 75,
    "connections": "How this theme connects to other themes in the data"
  }
]
Return ONLY the JSON array. No markdown wrappers.`;
};
