//! Claude Code CLI integration
//!
//! Spawns the `claude` CLI command to process AI requests.
//! This is the preferred mode for Mozilla developers who have Claude Code installed.
//!
//! NOTE: All prompts and schemas are centralized in frontend/src/prompts.js.
//! The backend requires the frontend to provide these values in requests.

use axum::Json;
use serde::Deserialize;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{debug, error, info};

use crate::{ClassifyResponse, ErrorResponse, GenerateResponse, RefineResponse, SuggestedAction, SuggestResponse, TestPageResponse, TriageAction};

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

/// Classify a bug using Claude CLI.
/// Prompts and schemas are now centralized in the frontend and must be provided.
pub async fn classify_bug(
    _bug: &serde_json::Value,
    model: &str,
    frontend_prompt: Option<&str>,
    frontend_schema: Option<&str>,
) -> Result<Json<ClassifyResponse>, ErrorResponse> {
    // Require frontend to provide prompt and schema (centralized prompts)
    let prompt = frontend_prompt.ok_or_else(|| ErrorResponse {
        error: "Missing prompt from frontend".to_string(),
        details: Some("Prompts are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let schema = frontend_schema.ok_or_else(|| ErrorResponse {
        error: "Missing schema from frontend".to_string(),
        details: Some("Schemas are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let result = run_claude_cli(&prompt, schema, model).await?;

    // Parse suggested_actions array
    let suggested_actions = result
        .get("suggested_actions")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let action = item.get("action").and_then(|a| a.as_str())?;
                    let reason = item.get("reason").and_then(|r| r.as_str()).unwrap_or("");
                    Some(TriageAction {
                        action: action.to_string(),
                        reason: reason.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

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
        suggested_severity: result
            .get("suggested_severity")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        suggested_priority: result
            .get("suggested_priority")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        suggested_actions,
        triage_reasoning: result
            .get("triage_reasoning")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        suggested_canned_id: result
            .get("suggested_canned_id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string()),
        draft_response: result
            .get("draft_response")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string()),
        notes: None,
    };

    Ok(Json(response))
}

/// Suggest a response from canned responses using Claude CLI.
/// Prompts and schemas are now centralized in the frontend and must be provided.
pub async fn suggest_response(
    _bug: &serde_json::Value,
    _canned_responses: &[serde_json::Value],
    model: &str,
    frontend_prompt: Option<&str>,
    frontend_schema: Option<&str>,
) -> Result<Json<SuggestResponse>, ErrorResponse> {
    // Require frontend to provide prompt and schema (centralized prompts)
    let prompt = frontend_prompt.ok_or_else(|| ErrorResponse {
        error: "Missing prompt from frontend".to_string(),
        details: Some("Prompts are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let schema = frontend_schema.ok_or_else(|| ErrorResponse {
        error: "Missing schema from frontend".to_string(),
        details: Some("Schemas are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let result = run_claude_cli(&prompt, schema, model).await?;

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

/// Generate a triage response or action suggestions using Claude CLI.
/// Prompts and schemas are now centralized in the frontend and must be provided.
pub async fn generate_response(
    _bug: &serde_json::Value,
    _options: &serde_json::Value,
    model: &str,
    frontend_prompt: Option<&str>,
    frontend_schema: Option<&str>,
) -> Result<Json<GenerateResponse>, ErrorResponse> {
    // Require frontend to provide prompt and schema (centralized prompts)
    let prompt = frontend_prompt.ok_or_else(|| ErrorResponse {
        error: "Missing prompt from frontend".to_string(),
        details: Some("Prompts are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let schema = frontend_schema.ok_or_else(|| ErrorResponse {
        error: "Missing schema from frontend".to_string(),
        details: Some("Schemas are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let result = run_claude_cli(&prompt, schema, model).await?;

    // Parse suggested_actions array
    let suggested_actions = result
        .get("suggested_actions")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let action = item.get("action").and_then(|a| a.as_str())?;
                    Some(SuggestedAction {
                        action: action.to_string(),
                        reason: item.get("reason").and_then(|r| r.as_str()).map(|s| s.to_string()),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    // Parse used_canned_ids array
    let used_canned_ids = result
        .get("used_canned_ids")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let response = GenerateResponse {
        response_text: result
            .get("response_text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        suggested_actions,
        used_canned_ids,
        reasoning: result
            .get("reasoning")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
    };

    Ok(Json(response))
}

/// Refine a response based on user instructions via Claude CLI.
/// Prompts and schemas are now centralized in the frontend and must be provided.
pub async fn refine_response(
    _bug: &serde_json::Value,
    current_response: &str,
    _user_instruction: &str,
    _context: &serde_json::Value,
    model: &str,
    frontend_prompt: Option<&str>,
    frontend_schema: Option<&str>,
) -> Result<Json<RefineResponse>, ErrorResponse> {
    // Require frontend to provide prompt and schema (centralized prompts)
    let prompt = frontend_prompt.ok_or_else(|| ErrorResponse {
        error: "Missing prompt from frontend".to_string(),
        details: Some("Prompts are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let schema = frontend_schema.ok_or_else(|| ErrorResponse {
        error: "Missing schema from frontend".to_string(),
        details: Some("Schemas are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let result = run_claude_cli(&prompt, schema, model).await?;

    // Parse changes_made array
    let changes_made = result
        .get("changes_made")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let response = RefineResponse {
        refined_response: result
            .get("refined_response")
            .and_then(|v| v.as_str())
            .unwrap_or(current_response)
            .to_string(),
        changes_made,
    };

    Ok(Json(response))
}

/// Generate a test page from a bug report using Claude CLI.
/// Prompts and schemas are now centralized in the frontend and must be provided.
pub async fn generate_testpage(
    _bug: &serde_json::Value,
    model: &str,
    frontend_prompt: Option<&str>,
    frontend_schema: Option<&str>,
) -> Result<Json<TestPageResponse>, ErrorResponse> {
    // Require frontend to provide prompt and schema (centralized prompts)
    let prompt = frontend_prompt.ok_or_else(|| ErrorResponse {
        error: "Missing prompt from frontend".to_string(),
        details: Some("Prompts are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let schema = frontend_schema.ok_or_else(|| ErrorResponse {
        error: "Missing schema from frontend".to_string(),
        details: Some("Schemas are centralized in frontend/src/prompts.js".to_string()),
    })?;
    let result = run_claude_cli(&prompt, schema, model).await?;

    let response = TestPageResponse {
        can_generate: result
            .get("can_generate")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        html_content: result
            .get("html_content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        reason: result
            .get("reason")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
    };

    Ok(Json(response))
}
