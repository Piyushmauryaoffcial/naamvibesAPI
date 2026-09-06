import dotenv from 'dotenv';

dotenv.config();

const configuredGuestAiLimit = Number.parseInt(process.env.GUEST_AI_SUGGESTION_LIMIT, 10);

// Keep the anonymous AI response size in one place so it can be tuned without
// changing route/controller behavior.
export const GUEST_AI_SUGGESTION_LIMIT = Number.isInteger(configuredGuestAiLimit) && configuredGuestAiLimit > 0
  ? configuredGuestAiLimit
  : 3;
