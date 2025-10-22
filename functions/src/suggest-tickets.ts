/**
 * Suggest Tickets Cloud Function
 * Analyzes feedback and generates ticket suggestions using Gemini AI
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeneratedSuggestion {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  impact_score?: number;
  is_trending?: boolean;
  reasoning?: string;
}

const db = admin.firestore();

// Initialize Gemini
let genAI: GoogleGenerativeAI;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = functions.config().gemini?.api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    genAI = new GoogleGenerativeAI(apiKey);
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

    // Prepare feedback for AI analysis
    const feedbackText = feedbackItems
      .map((item, idx) => `[${idx + 1}] ${item.content.substring(0, 500)}`)
      .join('\n\n');

    // Call Gemini to analyze and generate suggestions
    const gemini = getGeminiClient();
    const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a product manager analyzing user feedback to create actionable tickets.

Analyze this user feedback and generate 3-5 ticket suggestions:

${feedbackText}

For each ticket suggestion, provide:
1. title: Clear, concise title (50 chars max)
2. description: Detailed description with context
3. priority: low, medium, or high
4. impact_score: 0-100 (based on user impact and frequency)
5. is_trending: true if multiple users mention this
6. reasoning: Why this ticket matters

Return ONLY valid JSON array, no markdown:
[
  {
    "title": "...",
    "description": "...",
    "priority": "high",
    "impact_score": 85,
    "is_trending": true,
    "reasoning": "..."
  }
]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

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
        priority: suggestion.priority || 'medium',
        impact_score: suggestion.impact_score || 50,
        is_trending: suggestion.is_trending || false,
        reasoning: suggestion.reasoning || '',
        status: 'pending',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        user_id: context.auth.uid,
        metadata: {
          feedback_count: feedbackItems.length,
          generated_by: 'gemini-ai'
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
