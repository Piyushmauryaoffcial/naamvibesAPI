import { GUEST_AI_SUGGESTION_LIMIT } from '../config/access.js';

export const limitGuestAiSuggestions = (req, res, next) => {
  if (!req.body || req.body.count === undefined) return next();

  const requestedCount = Number.parseInt(req.body.count, 10);
  if (Number.isInteger(requestedCount) && requestedCount > GUEST_AI_SUGGESTION_LIMIT) {
    req.body.count = GUEST_AI_SUGGESTION_LIMIT;
  }
  next();
};
