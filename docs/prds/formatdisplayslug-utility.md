# Objective
Create `formatDisplaySlug` utility to standardize slug formatting.

# Background
Standardizing slugs improves the user experience and ensures consistency across the platform.

# Requirements
- Accept a string as input, representing a raw slug.
- Return a formatted string suitable for display.
- Formatting rules:
  - Replace underscores with spaces.
  - Capitalize the first letter of each word.
- Handle edge cases by returning an empty string for empty or invalid inputs.

# Acceptance Criteria
- Input: "example_slug" should return "Example slug".
- Input: "another_example_slug" should return "Another example slug".
- Input: "" should return "".

# Technical Notes
- Utilize string manipulation methods to achieve the desired formatting.

# Out of Scope
- Non-string input handling beyond returning an empty string.

# Verification Commands
- Run unit tests to verify the correct output for various input cases.

## Test Plan

## Test Plan
The `formatDisplaySlug` utility must be verified for the following behaviors:
- Correct formatting of slugs.
- Proper handling of edge cases like empty or invalid input.

### Test Cases
1. Input: "example_slug"; Expected Output: "Example slug".
2. Input: "another_example_slug"; Expected Output: "Another example slug".
3. Input: ""; Expected Output: "".

