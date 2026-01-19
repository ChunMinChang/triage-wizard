//! Claude Code CLI integration
//!
//! Spawns the `claude` CLI command to process AI requests.
//! This is the preferred mode for Mozilla developers who have Claude Code installed.

use axum::Json;
use serde::Deserialize;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{debug, error, info};

use crate::{ClassifyResponse, CustomizeResponse, ErrorResponse, SuggestResponse};

/// JSON schema for classification output
const CLASSIFY_SCHEMA: &str = r#"{
  "type": "object",
  "properties": {
    "ai_detected_str": {
      "type": "boolean",
      "description": "True if clear steps to reproduce are found in the bug text"
    },
    "ai_detected_test_attached": {
      "type": "boolean",
      "description": "True if a testcase file or reproduction code is referenced"
    },
    "crashstack_present": {
      "type": "boolean",
      "description": "True if crash stack traces or sanitizer output is present"
    },
    "fuzzing_testcase": {
      "type": "boolean",
      "description": "True if this appears to be from fuzzing (fuzzilli, oss-fuzz, etc.)"
    },
    "summary": {
      "type": "string",
      "description": "Brief 1-3 sentence summary of the bug for triagers"
    }
  },
  "required": ["ai_detected_str", "ai_detected_test_attached", "crashstack_present", "fuzzing_testcase", "summary"]
}"#;

/// JSON schema for customize response output
const CUSTOMIZE_SCHEMA: &str = r#"{
  "type": "object",
  "properties": {
    "final_response": {
      "type": "string",
      "description": "The customized response text ready to post"
    },
    "used_canned_id": {
      "type": "string",
      "description": "The ID of the canned response that was customized"
    }
  },
  "required": ["final_response", "used_canned_id"]
}"#;

/// JSON schema for suggest response output
const SUGGEST_SCHEMA: &str = r#"{
  "type": "object",
  "properties": {
    "suggested_response_id": {
      "type": "string",
      "description": "The ID of the most appropriate canned response"
    },
    "draft_response": {
      "type": "string",
      "description": "A draft response customized for this bug"
    },
    "reasoning": {
      "type": "string",
      "description": "Brief explanation of why this response was chosen"
    }
  },
  "required": ["suggested_response_id", "draft_response"]
}"#;

/// Claude CLI output structure
#[derive(Debug, Deserialize)]
struct ClaudeCliOutput {
    #[serde(rename = "type")]
    output_type: Option<String>,
    #[allow(dead_code)]
    subtype: Option<String>,
    result: Option<ClaudeResult>,
}

#[derive(Debug, Deserialize)]
struct ClaudeResult {
    #[serde(rename = "type")]
    #[allow(dead_code)]
    result_type: Option<String>,
    structured_output: Option<serde_json::Value>,
}

/// Run the claude CLI with the given prompt and schema
async fn run_claude_cli(
    prompt: &str,
    schema: &str,
    model: &str,
) -> Result<serde_json::Value, ErrorResponse> {
    info!("Running Claude CLI with model: {}", model);
    debug!("Prompt length: {} chars", prompt.len());

    // Build the command
    let mut cmd = Command::new("claude");
    cmd.arg("-p")
        .arg("--output-format")
        .arg("json")
        .arg("--model")
        .arg(model)
        .arg("--json-schema")
        .arg(schema)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Spawn the process
    let mut child = cmd.spawn().map_err(|e| {
        error!("Failed to spawn claude CLI: {}", e);
        ErrorResponse {
            error: "Failed to spawn claude CLI".to_string(),
            details: Some(format!(
                "Ensure 'claude' is installed and in PATH. Error: {}",
                e
            )),
        }
    })?;

    // Write prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        stdin.write_all(prompt.as_bytes()).await.map_err(|e| {
            error!("Failed to write to claude stdin: {}", e);
            ErrorResponse {
                error: "Failed to write to claude CLI".to_string(),
                details: Some(e.to_string()),
            }
        })?;
    }

    // Wait for the process to complete
    let output = child.wait_with_output().await.map_err(|e| {
        error!("Failed to get claude CLI output: {}", e);
        ErrorResponse {
            error: "Failed to get claude CLI output".to_string(),
            details: Some(e.to_string()),
        }
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("Claude CLI failed: {}", stderr);
        return Err(ErrorResponse {
            error: "Claude CLI execution failed".to_string(),
            details: Some(stderr.to_string()),
        });
    }

    // Parse the JSON output
    let stdout = String::from_utf8_lossy(&output.stdout);
    debug!("Claude CLI output: {}", stdout);

    // Claude CLI outputs multiple JSON objects, we need the last result one
    // Look for the structured_output in the response
    for line in stdout.lines() {
        if line.trim().is_empty() {
            continue;
        }

        if let Ok(parsed) = serde_json::from_str::<ClaudeCliOutput>(line) {
            if parsed.output_type.as_deref() == Some("result") {
                if let Some(result) = parsed.result {
                    if let Some(structured) = result.structured_output {
                        info!("Successfully extracted structured output from Claude CLI");
                        return Ok(structured);
                    }
                }
            }
        }
    }

    // If we couldn't find structured output, try parsing the whole output
    // In case the format changed or it's a simple JSON response
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(obj) = json.as_object() {
            if obj.contains_key("structured_output") {
                if let Some(structured) = obj.get("structured_output") {
                    return Ok(structured.clone());
                }
            }
            // Maybe it's directly the result
            if obj.contains_key("ai_detected_str") || obj.contains_key("final_response") || obj.contains_key("suggested_response_id") {
                return Ok(json);
            }
        }
    }

    Err(ErrorResponse {
        error: "Failed to parse Claude CLI output".to_string(),
        details: Some(format!("Output: {}", stdout)),
    })
}

/// Build the classification prompt
fn build_classify_prompt(bug: &serde_json::Value) -> String {
    let bug_id = bug.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
    let summary = bug
        .get("summary")
        .and_then(|v| v.as_str())
        .unwrap_or("No summary");
    let description = bug
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Get comments if available
    let comments_text = if let Some(comments) = bug.get("comments").and_then(|v| v.as_array()) {
        comments
            .iter()
            .filter_map(|c| c.get("text").and_then(|t| t.as_str()))
            .take(5) // Limit to first 5 comments
            .collect::<Vec<_>>()
            .join("\n---\n")
    } else {
        String::new()
    };

    format!(
        r#"You are a Mozilla Firefox bug triager assistant. Analyze this bug and classify it.

Bug ID: {}
Summary: {}

Description:
{}

Comments:
{}

Analyze this bug and determine:
1. ai_detected_str: Are there clear steps to reproduce (STR) in the text?
2. ai_detected_test_attached: Is there a testcase file, reproduction HTML/JS, or test code referenced?
3. crashstack_present: Is there a crash stack trace, AddressSanitizer/ASan output, or similar?
4. fuzzing_testcase: Does this appear to be from fuzzing (mentions fuzzilli, oss-fuzz, grizzly, etc.)?
5. summary: Write a brief 1-3 sentence summary of what this bug is about for triagers.

Be conservative - only mark true if you have clear evidence."#,
        bug_id, summary, description, comments_text
    )
}

/// Classify a bug using Claude CLI
pub async fn classify_bug(
    bug: &serde_json::Value,
    model: &str,
) -> Result<Json<ClassifyResponse>, ErrorResponse> {
    let prompt = build_classify_prompt(bug);
    let result = run_claude_cli(&prompt, CLASSIFY_SCHEMA, model).await?;

    // Parse the result into our response type
    let response = ClassifyResponse {
        ai_detected_str: result
            .get("ai_detected_str")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        ai_detected_test_attached: result
            .get("ai_detected_test_attached")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        crashstack_present: result
            .get("crashstack_present")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        fuzzing_testcase: result
            .get("fuzzing_testcase")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        summary: result
            .get("summary")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        notes: None,
    };

    Ok(Json(response))
}

/// Customize a canned response using Claude CLI
pub async fn customize_response(
    bug: &serde_json::Value,
    canned_response: &serde_json::Value,
    model: &str,
) -> Result<Json<CustomizeResponse>, ErrorResponse> {
    let bug_id = bug.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
    let summary = bug
        .get("summary")
        .and_then(|v| v.as_str())
        .unwrap_or("No summary");

    let canned_id = canned_response
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let canned_title = canned_response
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let canned_body = canned_response
        .get("bodyTemplate")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let prompt = format!(
        r#"You are a Mozilla Firefox bug triager. Customize this canned response for the specific bug.

Bug ID: {}
Bug Summary: {}

Canned Response Template:
ID: {}
Title: {}
Body:
{}

Customize this response for the specific bug. Replace any placeholders (like {{BUG_ID}}, {{VERSION}}, etc.) with appropriate content based on the bug details. Keep the tone professional and helpful.

Return the customized response text."#,
        bug_id, summary, canned_id, canned_title, canned_body
    );

    let result = run_claude_cli(&prompt, CUSTOMIZE_SCHEMA, model).await?;

    let response = CustomizeResponse {
        final_response: result
            .get("final_response")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        used_canned_id: result
            .get("used_canned_id")
            .and_then(|v| v.as_str())
            .unwrap_or(canned_id)
            .to_string(),
        notes: None,
    };

    Ok(Json(response))
}

/// Suggest a response from canned responses using Claude CLI
pub async fn suggest_response(
    bug: &serde_json::Value,
    canned_responses: &[serde_json::Value],
    model: &str,
) -> Result<Json<SuggestResponse>, ErrorResponse> {
    let bug_id = bug.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
    let summary = bug
        .get("summary")
        .and_then(|v| v.as_str())
        .unwrap_or("No summary");
    let description = bug
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Format canned responses
    let responses_text: String = canned_responses
        .iter()
        .filter_map(|r| {
            let id = r.get("id").and_then(|v| v.as_str())?;
            let title = r.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let desc = r.get("description").and_then(|v| v.as_str()).unwrap_or("");
            let body = r.get("bodyTemplate").and_then(|v| v.as_str()).unwrap_or("");
            Some(format!(
                "---\nID: {}\nTitle: {}\nDescription: {}\nBody Preview: {}\n",
                id,
                title,
                desc,
                &body[..body.len().min(200)]
            ))
        })
        .collect();

    let prompt = format!(
        r#"You are a Mozilla Firefox bug triager. Suggest the best canned response for this bug and draft a customized version.

Bug ID: {}
Bug Summary: {}
Description:
{}

Available Canned Responses:
{}

Analyze the bug and:
1. Choose the most appropriate canned response ID
2. Draft a customized response for this specific bug
3. Briefly explain why you chose this response

Be helpful and professional. If no response fits well, choose the closest match and explain."#,
        bug_id, summary, description, responses_text
    );

    let result = run_claude_cli(&prompt, SUGGEST_SCHEMA, model).await?;

    let response = SuggestResponse {
        suggested_response_id: result
            .get("suggested_response_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        draft_response: result
            .get("draft_response")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        reasoning: result
            .get("reasoning")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };

    Ok(Json(response))
}
