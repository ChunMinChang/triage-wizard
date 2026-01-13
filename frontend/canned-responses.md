# Default Canned Responses

These are the default canned responses for bug triage. They can be customized or replaced.

---

## need-str
ID: need-str
Title: Ask for Steps to Reproduce
Categories: need-info, str
Description: Ask the reporter to provide clear steps to reproduce the issue.

Hi, and thanks for filing this bug!

To investigate this issue, we need clear **Steps to Reproduce**. Please provide:

1. The exact steps to trigger this behavior
2. What you expected to happen
3. What actually happened

Thanks!

## need-testcase
ID: need-testcase
Title: Ask for Test Case
Categories: need-info, testcase
Description: Request a minimal test case to reproduce the issue.

Thanks for filing this bug!

To help us investigate, could you provide a **minimal test case** that demonstrates the issue? This could be:

- A reduced HTML/CSS/JS file
- A link to a simplified example
- Steps to reproduce with specific input

A minimal reproducible example helps us quickly identify and fix the problem.

## duplicate
ID: duplicate
Title: Mark as Duplicate
Categories: resolution, duplicate
Description: Standard response for marking a bug as duplicate.

This bug appears to be a duplicate of bug {{BUG_ID}}.

I'm marking this as a duplicate. Please follow the linked bug for updates.

## wontfix
ID: wontfix
Title: Won't Fix Explanation
Categories: resolution, wontfix
Description: Explain why a bug won't be fixed.

Thank you for filing this bug.

After investigation, we've determined that we won't be fixing this issue because:

{{REASON}}

If you believe this decision should be reconsidered, please comment with additional context.

## need-profile
ID: need-profile
Title: Ask for Performance Profile
Categories: need-info, performance
Description: Request a performance profile for perf-related bugs.

Thanks for reporting this performance issue!

To help investigate, could you please provide a performance profile?

1. Open Firefox and navigate to `about:profiling`
2. Configure the profiler settings (or use defaults)
3. Click "Start Recording"
4. Reproduce the slow behavior
5. Click "Capture Profile" and share the link

This will help us identify what's causing the slowdown.

## fuzzing-thanks
ID: fuzzing-thanks
Title: Fuzzing Thanks
Categories: acknowledgement, fuzzing
Description: Thank a fuzzer for finding an issue.

Thanks for finding this issue through fuzzing!

We appreciate the detailed crash information and test case. This helps us fix security and stability issues quickly.

## more-info-needed
ID: more-info-needed
Title: General Request for More Information
Categories: need-info
Description: General request when more details are needed.

Thanks for your bug report!

Could you please provide more information to help us investigate?

- Firefox version (from `about:support`)
- Operating system and version
- Any browser extensions installed
- When did this start happening?

## confirmed
ID: confirmed
Title: Bug Confirmed
Categories: status, confirmed
Description: Confirm the bug has been reproduced.

I was able to reproduce this issue:

**Environment:**
- Firefox: {{VERSION}}
- OS: {{OS}}

**Steps taken:**
{{STEPS}}

Confirming this bug. Thanks for the report!
