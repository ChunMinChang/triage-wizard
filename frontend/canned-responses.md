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
Title: Ask for Firefox Profile with Logs
Categories: need-info, profile, logs
Description: Request a Firefox profile with logging to diagnose issues.

Thanks for reporting this issue!

To help us investigate, could you please capture a **Firefox profile with logs**? Here's how:

1. Install the Firefox Profiler add-on: https://profiler.firefox.com/
2. Go to `about:logging` in your Firefox address bar
3. Select the **Logging preset** that matches your issue:
   - **Media playback** – for audio/video playing issues
   - **WebRTC** – for Web Conferencing issues (e.g., Google Meet)
   - **Graphics** – for screen display issues (e.g., wrong color, black screen)
   - **Networking** – for connection issues (internet, socket errors)
   - **Custom** – for other issues (let us know and we'll provide the log modules needed)
4. Click **Set Log Modules**, then click **Start Logging**
5. Open a **new tab** and reproduce the steps that cause the issue
6. Once reproduced, **close that tab**, go back to `about:logging`, and click **Stop Logging**
7. The Firefox Profiler should launch automatically – please **share the profile link** here

This will help us identify what's causing the problem. Thanks!

## need-crash-report
ID: need-crash-report
Title: Ask for Crash Report
Categories: need-info, crash
Description: Request crash report IDs from about:crashes when Firefox crashed.

Thanks for reporting this crash!

To help us investigate, could you please share your **crash report IDs**? Here's how:

1. Open a new tab and go to `about:crashes`
2. Look for crash reports around the time you experienced the crash
3. If reports show "not submitted", click **Submit** to send them to Mozilla
4. Copy the **Report ID** (starts with `bp-`) and paste it here

Alternatively, you can share the **full crash report URL**, e.g., `https://crash-stats.mozilla.org/report/index/bp-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

The crash report contains stack traces and system information that help us identify the root cause. Thanks!

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

If this is a **regression** (something that used to work but now doesn't), it would be very helpful if you could use **mozregression** to identify when the bug started:

1. Install mozregression: https://mozilla.github.io/mozregression/
2. Run it and follow the prompts to bisect between a known good and bad version
3. Share the regression range or the changeset that introduced the issue

This helps us pinpoint the exact change that caused the problem.

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
