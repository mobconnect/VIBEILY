import { GoogleGenAI } from "@google/genai";

export async function checkHasApiKey(): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    return await (window as any).aistudio.hasSelectedApiKey();
  }
  return !!process.env.API_KEY;
}

export async function requestApiKey(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    await (window as any).aistudio.openSelectKey();
    // Proceed as if successful per skill instructions
  }
}

export async function generateAIVideo(prompt: string, onProgress?: (status: string) => void) {
  const apiKey = process.env.API_KEY || (process as any).env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('API key is required for video generation. Please select a paid API key.');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  onProgress?.('Initializing generation...');
  
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-lite-generate-preview',
    prompt,
    config: {
      numberOfVideos: 1,
      resolution: '1080p',
      aspectRatio: '16:9'
    }
  });

  onProgress?.('Generating video (this may take a few minutes)...');

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
    onProgress?.('Still working on your vibe...');
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error('Failed to generate video: No download link returned.');
  }

  onProgress?.('Finalizing and downloading...');

  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  const blob = await response.blob();
  return blob;
}

export async function generateAIImage(prompt: string, onProgress?: (status: string) => void) {
  const apiKey = (process as any).env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API key is required for image generation.');
  }

  const ai = new GoogleGenAI({ apiKey });
  onProgress?.('Dreaming up your image...');

  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-001',
    prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '1:1',
    },
  });

  const base64Data = response.generatedImages[0].image.imageBytes;
  if (!base64Data) {
    throw new Error('Failed to generate image: No image data returned.');
  }

  return `data:image/jpeg;base64,${base64Data}`;
}

export async function suggestEmotion(content: string): Promise<string> {
  const apiKey = (process as any).env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return 'vibey';
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Given the content: "${content}", suggest a single-word emotion or vibe hashtag (without the #). Only return the word.`,
    });
    return response.text?.trim().toLowerCase().replace(/[^a-z]/g, '') || 'vibey';
  } catch (error) {
    console.error('Emotion suggestion failed:', error);
    return 'vibey';
  }
}
