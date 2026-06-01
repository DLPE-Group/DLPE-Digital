import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';

// Null when no API key is configured — callers must fall back to scripted output.
export const anthropic: Anthropic | null = env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  : null;

export const MODEL = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
