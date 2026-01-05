/**
 * Frontend configuration constants
 *
 * Review these values periodically to ensure they remain accurate.
 */

// Cost estimate displayed before query submission
// Based on typical OpenRouter pricing as of January 2026
// Review quarterly or when model pricing changes significantly
export const COST_ESTIMATE = {
  min: 0.10,
  max: 0.25,
  avgCents: 20, // Used for inquiry count calculations (~$0.20 avg)
  text: "Estimated cost: ~$0.10–$0.25",
  subtext: "AI provider costs + 5% service fee",
  lastReviewed: "2026-01-04",
};

// Demo data version - update when demos.json content changes
export const DEMO_VERSION = {
  version: "2.3.0",
  lastUpdated: "2026-01-05",
  description: "Demos: Specialist vs Generalist (career), India Test XI (sports), EV Buy vs Lease (consumer), Serene Places (travel)",
};
