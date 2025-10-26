/**
 * Suggest Tickets Cloud Function
 * Analyzes feedback and generates ticket suggestions using Gemini AI
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';

interface GeneratedSuggestion {
  title: string;
  description: string;
  theme?: string;
  priority?: 'low' | 'medium' | 'high';
  impact_score?: number;
  is_trending?: boolean;
  source_refs?: string[];
  reasoning?: string;
}

const db = admin.firestore();

// Initialize Gemini
let genAI: GoogleGenAI;
const GEMINI_MODEL = functions.config().gemini?.model
  || process.env.GEMINI_MODEL
  || 'gemini-2.5-flash';

function getGeminiClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export const suggestTickets = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be logged in to generate ticket suggestions'
    );
  }

  try {
    // Get recent feedback (last 50 items)
    const feedbackSnapshot = await db
      .collection('feedback_sources')
      .where('user_id', '==', context.auth.uid)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    if (feedbackSnapshot.empty) {
      return {
        suggestions: [],
        message: 'No feedback found. Add some feedback sources first!'
      };
    }

    const feedbackItems = feedbackSnapshot.docs.map(doc => ({
      id: doc.id,
      content: doc.data().content,
      author: doc.data().author,
      engagement: doc.data().engagement || 0,
      source: doc.data().source,
      channel: doc.data().channel
    }));

    console.log(`Analyzing ${feedbackItems.length} feedback items for ticket suggestions`);

    // Prepare feedback for AI analysis with IDs for tracking
    const feedbackText = feedbackItems
      .map((item, idx) => `[FEEDBACK_ID: ${item.id}]
[Index: ${idx + 1}]
Author: u/${item.author} | Channel: r/${item.channel} | Engagement: ${item.engagement} upvotes
Content: ${item.content.substring(0, 500)}`)
      .join('\n\n---\n\n');

    // Call Gemini to analyze and generate suggestions
    const gemini = getGeminiClient();
    console.log('[gemini] suggestTickets model', GEMINI_MODEL);

    const prompt = `You are an expert product manager analyzing user feedback from Reddit to create actionable product tickets.

**YOUR TASK:**
1. Identify recurring themes, pain points, and feature requests across ALL feedback
2. Group similar feedback items together into coherent ticket suggestions
3. Prioritize based on:
   - Frequency (how many users mention it)
   - Engagement (upvotes/comments)
   - Impact (severity of the problem or value of feature)
4. Generate 3-7 high-quality ticket suggestions that capture the most important insights

**FEEDBACK DATA:**
${feedbackText}

**ANALYSIS GUIDELINES:**
- Look for patterns across multiple feedback items (not just individual posts)
- Combine related issues into comprehensive tickets
- Focus on actionable, specific problems or feature requests
- Consider both explicit requests and implicit pain points
- Higher engagement scores indicate more community interest

**OUTPUT REQUIREMENTS:**
For each ticket suggestion, provide:
1. **title**: Clear, action-oriented title (max 60 chars)
   - Use format: "Fix [problem]" or "Add [feature]" or "Improve [area]"
2. **description**: Detailed description including:
   - What the issue/request is
   - Why it matters to users
   - Evidence from feedback (reference specific user quotes if relevant)
3. **theme**: Single category (e.g., "Performance", "UX", "Feature Request", "Bug", "Integration", "Mobile")
4. **priority**: Set based on impact and urgency:
   - "high": Critical issues affecting many users or blocking workflows
   - "medium": Important improvements with clear user demand
   - "low": Nice-to-haves or edge cases
5. **impact_score**: 0-100 calculated from:
   - Frequency: How many feedback items mention this (0-40 points)
   - Engagement: Average upvotes of related feedback (0-30 points)
   - Severity: How much this affects user experience (0-30 points)
6. **is_trending**: true if 3+ feedback items discuss this topic
7. **source_refs**: Array of FEEDBACK_ID values that contributed to this ticket
   - Include ALL feedback IDs that relate to this suggestion
   - This is CRITICAL for linking feedback to tickets
8. **reasoning**: 2-3 sentences explaining:
   - Why this ticket is important
   - How many users are affected
   - What evidence supports this

**IMPORTANT:** Every ticket MUST include source_refs array with actual FEEDBACK_ID values from the feedback data above.

Return ONLY valid JSON array, no markdown formatting or code blocks:
[
  {
    "title": "Fix slow dashboard loading times",
    "description": "Users are reporting 5-10 second load times on the main dashboard, particularly when loading large datasets. This is affecting daily workflows and causing frustration. Multiple users mention this is blocking their adoption.",
    "theme": "Performance",
    "priority": "high",
    "impact_score": 85,
    "is_trending": true,
    "source_refs": ["feedback_id_1", "feedback_id_3", "feedback_id_7"],
    "reasoning": "Dashboard performance is mentioned by 6 users with high engagement (avg 45 upvotes). This is a critical blocker affecting the core user experience and preventing new user adoption."
  }
]`;

    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const responseText = response.text || '';

    // Parse response
    const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanText) as unknown;
    const suggestions: GeneratedSuggestion[] = Array.isArray(parsed)
      ? (parsed as GeneratedSuggestion[])
      : [parsed as GeneratedSuggestion];

    // Store suggestions in Firestore
    const batch = db.batch();
    let createdCount = 0;

    for (const suggestion of suggestions) {
      const ref = db.collection('ticket_suggestions').doc();
      batch.set(ref, {
        title: suggestion.title,
        description: suggestion.description,
        theme: suggestion.theme || 'General',
        priority: suggestion.priority || 'medium',
        impact_score: suggestion.impact_score || 50,
        is_trending: suggestion.is_trending || false,
        source_refs: suggestion.source_refs || [],
        reasoning: suggestion.reasoning || '',
        status: 'pending',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        user_id: context.auth.uid,
        metadata: {
          feedback_count: feedbackItems.length,
          generated_by: 'gemini-ai',
          linked_feedback_count: (suggestion.source_refs || []).length
        }
      });
      createdCount++;
    }

    await batch.commit();

    console.log(`✅ Created ${createdCount} ticket suggestions`);

    return {
      suggestions: suggestions.map((s) => ({
        title: s.title,
        priority: s.priority,
        impact_score: s.impact_score
      })),
      count: createdCount,
      message: `Generated ${createdCount} ticket suggestions from ${feedbackItems.length} feedback items`
    };

  } catch (error: unknown) {
    console.error('Error generating ticket suggestions:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to generate suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
