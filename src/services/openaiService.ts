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
  model: 'gpt-4o-mini', // Cost-effective vision model
  maxTokens: 300,
  temperature: 0.8,
  timeout: 10000, // 10 seconds
};

// Master prompt template for avatar generation
const MASTER_PROMPT = `
You are an AI avatar prompt specialist. Analyze the provided photo and create a prompt for avatar generation.

ANALYSIS FRAMEWORK:
1. Subject: Identify pose, expression, positioning of the person
2. Environment: Note setting, background, lighting conditions
3. Mood: Capture emotional tone and atmosphere
4. Visual Style: Identify colors, composition, artistic elements
5. Artistic Direction: Suggest rendering style that would work well for avatars

OUTPUT REQUIREMENTS:
- Length: 50-150 words
- Focus: Portrait/avatar suitable for AI generation
- Style: Include 2-3 artistic style keywords (e.g., "cinematic", "vintage", "minimalist")
- Creativity: Balance accuracy with artistic interpretation
- Person-focused: Center the description around creating an avatar of the person

FORBIDDEN:
- Real person names or identifiable information
- Inappropriate or NSFW content suggestions
- Overly complex or technical descriptions
- References to specific brands or copyrighted material

Generate a creative prompt that would create an engaging avatar inspired by this photo's mood, setting, and style.
`;

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