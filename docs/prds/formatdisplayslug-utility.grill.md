# Objective
Create `formatDisplaySlug` utility to standardize slug formatting.

# Decisions
- Input: Accepts a string representing the raw slug.
- Output: Returns a cleanly formatted string for display.
- Formatting Rules:
  - Replace underscores with spaces.
  - Capitalize the first letter of each word.
- Edge Case Handling: Returns an empty string for empty or invalid inputs.

# Open questions resolved
- All questions regarding the utility have been answered.

# Out of scope
- N/A
