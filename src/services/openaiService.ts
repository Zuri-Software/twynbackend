import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration for Vision API
const VISION_CONFIG = {
  model: 'gpt-4o-mini', // Use correct modern vision model
  maxTokens: 300,
  temperature: 0.8,
  timeout: 10000, // 10 seconds
};

// Master prompt template for avatar generation
const MASTER_PROMPT = `You are a fashion/editorial prompt engineer.
Your role: analyze the provided image and return a hyper-detailed, scene-analyzed prompt suitable for image/video generation (Higgsfield, Midjourney, SDXL, Veo/VideoGen) or creative direction.
Write with the precision of a fashion editor and the eye of a cinematographer.

Output Rules

You are always analyzing an image. Interpret every visible detail: environment, materials, textures, colors, silhouettes, logos, props, micro-details (stitching, patina, lens reflections, wall grain, floor texture, etc.).

Write in present tense and neutral, editorial language.

Always follow the exact template/section order below.

If instructed “don’t focus on hair,” omit hair entirely.

If instructed “remove tattoos / remove text,” place under Modifications.

If a location is clear, anchor with culturally specific cues (e.g., Rio’s Portuguese pavement, Paris Haussmann façades).

If cars appear, specify finish, rim tone, badges, panel reflections.

Keep output clean (no emojis, no hashtags).

Target length: 180–320 words, unless explicitly asked for “short” or “expand further.”

TEMPLATE (always follow)

Prompt:
Scene & Environment: …
Subject & Pose: …
Outfit Breakdown:
  Top(s): …
  Bottom(s): …
  Footwear: …
  Outerwear/Layers: …
  Accessories: …
  Athletics (if present): …
Lighting: …
Camera & Lens (suggested): …
Composition: …
Mood & Styling Notes: …`;

export interface AnalysisResult {
  prompt: string;
  metadata?: {
    detectedElements?: string[];
    suggestedStyles?: string[];
    mood?: string;
    confidence?: number;
  };
}

/**
 * Analyze an image using OpenAI Vision API to generate avatar creation prompt
 */
export async function analyzeImageForAvatar(
  imageBuffer: Buffer,
  analysisType: 'standard' | 'detailed' = 'standard'
): Promise<AnalysisResult> {
  try {
    console.log('[OpenAI Service] 🔍 Starting image analysis with', analysisType, 'mode');
    
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    // Determine image detail level based on analysis type
    const imageDetail = analysisType === 'detailed' ? 'high' : 'low';
    
    const startTime = Date.now();
    
    console.log('[OpenAI Service] 📋 Sending request with:', {
      model: VISION_CONFIG.model,
      imageDetail,
      promptLength: MASTER_PROMPT.length,
      imageUrlPrefix: imageUrl.substring(0, 50) + '...',
    });

    const response = await openai.chat.completions.create({
      model: VISION_CONFIG.model,
      max_tokens: VISION_CONFIG.maxTokens,
      temperature: VISION_CONFIG.temperature,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: MASTER_PROMPT,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: imageDetail,
              },
            },
          ],
        },
      ],
    });

    console.log('[OpenAI Service] 📊 Response details:', {
      finishReason: response.choices[0]?.finish_reason,
      responseLength: response.choices[0]?.message?.content?.length,
      usage: response.usage,
    });

    const analysisTime = Date.now() - startTime;
    console.log(`[OpenAI Service] ✅ Analysis completed in ${analysisTime}ms`);

    const prompt = response.choices[0]?.message?.content?.trim();
    
    if (!prompt) {
      throw new Error('No prompt generated from image analysis');
    }

    console.log('[OpenAI Service] 📝 Generated prompt:', prompt.substring(0, 100) + '...');

    // Parse metadata from response (basic implementation)
    const metadata = extractMetadataFromPrompt(prompt);

    return {
      prompt,
      metadata: {
        ...metadata,
        confidence: response.choices[0]?.finish_reason === 'stop' ? 0.9 : 0.7,
      },
    };

  } catch (error) {
    console.error('[OpenAI Service] ❌ Image analysis failed:', error);
    
    if (error instanceof Error) {
      // Handle specific OpenAI errors
      if (error.message.includes('rate limit')) {
        throw new Error('Analysis service is currently busy. Please try again in a few minutes.');
      } else if (error.message.includes('content policy')) {
        throw new Error('This image cannot be used for avatar generation due to content restrictions.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Image analysis timed out. Please try again.');
      }
    }
    
    throw new Error('Failed to analyze image. Please try again.');
  }
}

/**
 * Extract basic metadata from the generated prompt text
 */
function extractMetadataFromPrompt(prompt: string): {
  detectedElements?: string[];
  suggestedStyles?: string[];
  mood?: string;
} {
  const metadata: any = {};

  // Extract style keywords (basic pattern matching)
  const styleKeywords = [
    'cinematic', 'vintage', 'minimalist', 'artistic', 'dramatic',
    'warm', 'cool', 'bright', 'moody', 'elegant', 'casual',
    'professional', 'creative', 'modern', 'classic'
  ];
  
  const foundStyles = styleKeywords.filter(style => 
    prompt.toLowerCase().includes(style)
  );
  
  if (foundStyles.length > 0) {
    metadata.suggestedStyles = foundStyles;
  }

  // Extract mood indicators
  const moodKeywords = {
    happy: ['happy', 'cheerful', 'bright', 'joyful', 'smiling'],
    serious: ['serious', 'professional', 'focused', 'formal'],
    relaxed: ['relaxed', 'casual', 'laid-back', 'comfortable'],
    dramatic: ['dramatic', 'intense', 'bold', 'striking'],
  };

  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    if (keywords.some(keyword => prompt.toLowerCase().includes(keyword))) {
      metadata.mood = mood;
      break;
    }
  }

  return metadata;
}

/**
 * Test OpenAI connection and API key
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    console.log('[OpenAI Service] 🔧 Testing OpenAI connection...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Test connection. Respond with "OK".',
        },
      ],
    });

    const isWorking = response.choices[0]?.message?.content?.includes('OK');
    console.log('[OpenAI Service]', isWorking ? '✅' : '❌', 'Connection test result');
    
    return isWorking || false;
  } catch (error) {
    console.error('[OpenAI Service] ❌ Connection test failed:', error);
    return false;
  }
}

/**
 * Get usage statistics (if needed for monitoring)
 */
export async function getUsageStats() {
  // Note: OpenAI doesn't provide real-time usage stats via API
  // This would need to be tracked internally or via OpenAI dashboard
  return {
    message: 'Usage stats not available via API',
    suggestion: 'Check OpenAI dashboard for usage details',
  };
}

export default {
  analyzeImageForAvatar,
  testOpenAIConnection,
  getUsageStats,
};