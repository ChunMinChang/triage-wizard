//! Triage Wizard Backend
//!
//! A proxy server for AI calls and Bugzilla operations when browser CORS blocks direct access.
//! Prioritizes Claude Code CLI integration for Mozilla developers.

use axum::{
    extract::State,
    http::{header, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tracing::info;

mod claude_cli;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    /// Claude backend mode: "cli" or "api"
    pub claude_mode: String,
    /// Anthropic API key (for api mode)
    pub anthropic_api_key: Option<String>,
    /// Gemini API key
    pub gemini_api_key: Option<String>,
    /// OpenAI API key
    pub openai_api_key: Option<String>,
    /// Claude model to use
    pub claude_model: String,
}

/// Classification request from frontend
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassifyRequest {
    pub provider: String,
    pub model: Option<String>,
    pub bug: serde_json::Value,
    /// Optional pre-built prompt from frontend (for centralized prompts)
    pub prompt: Option<String>,
    /// Optional JSON schema for structured output
    pub schema: Option<String>,
}

/// Triage action recommendation
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TriageAction {
    pub action: String,
    pub reason: String,
}

/// Classification response to frontend
#[derive(Debug, Serialize)]
pub struct ClassifyResponse {
    pub ai_detected_str: bool,
    pub ai_detected_test_attached: bool,
    pub crashstack_present: bool,
    pub fuzzing_testcase: bool,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_severity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_priority: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub suggested_actions: Vec<TriageAction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub triage_reasoning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_canned_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub draft_response: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<serde_json::Value>,
}

/// Suggest response request
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestRequest {
    pub provider: String,
    pub model: Option<String>,
    pub bug: serde_json::Value,
    pub canned_responses: Vec<serde_json::Value>,
    /// Optional pre-built prompt from frontend (for centralized prompts)
    pub prompt: Option<String>,
    /// Optional JSON schema for structured output
    pub schema: Option<String>,
}

/// Suggest response result
#[derive(Debug, Serialize)]
pub struct SuggestResponse {
    pub suggested_response_id: String,
    pub draft_response: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
}

/// Generate response request (for triage actions/comment generation)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateRequest {
    pub provider: String,
    pub model: Option<String>,
    pub bug: serde_json::Value,
    /// Generation options (mode, cannedResponses, etc.)
    #[serde(default)]
    pub options: serde_json::Value,
    /// Optional pre-built prompt from frontend (for centralized prompts)
    pub prompt: Option<String>,
    /// Optional JSON schema for structured output
    pub schema: Option<String>,
}

/// Suggested action from generate response
#[derive(Debug, Serialize, Deserialize)]
pub struct SuggestedAction {
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Generate response result
#[derive(Debug, Serialize)]
pub struct GenerateResponse {
    pub response_text: String,
    pub suggested_actions: Vec<SuggestedAction>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub used_canned_ids: Vec<String>,
    pub reasoning: String,
}

/// Refine response request
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefineRequest {
    pub provider: String,
    pub model: Option<String>,
    pub bug: serde_json::Value,
    pub current_response: String,
    pub user_instruction: String,
    /// Optional context (e.g., selected canned response)
    #[serde(default)]
    pub context: serde_json::Value,
    /// Optional pre-built prompt from frontend (for centralized prompts)
    pub prompt: Option<String>,
    /// Optional JSON schema for structured output
    pub schema: Option<String>,
}

/// Refine response result
#[derive(Debug, Serialize)]
pub struct RefineResponse {
    pub refined_response: String,
    pub changes_made: Vec<String>,
}

/// Test page generation request
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestPageRequest {
    pub provider: String,
    pub model: Option<String>,
    pub bug: serde_json::Value,
    /// Optional pre-built prompt from frontend (for centralized prompts)
    pub prompt: Option<String>,
    /// Optional JSON schema for structured output
    pub schema: Option<String>,
}

/// Test page generation result
#[derive(Debug, Serialize)]
pub struct TestPageResponse {
    pub can_generate: bool,
    pub html_content: String,
    pub reason: String,
}

/// Error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub details: Option<String>,
}

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> axum::response::Response {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(self)).into_response()
    }
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,triage_wizard_backend=debug".into()),
        )
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Get configuration from environment
    let claude_mode = std::env::var("CLAUDE_BACKEND_MODE").unwrap_or_else(|_| "cli".to_string());
    let anthropic_api_key = std::env::var("ANTHROPIC_API_KEY").ok();
    let gemini_api_key = std::env::var("GEMINI_API_KEY").ok();
    let openai_api_key = std::env::var("OPENAI_API_KEY").ok();
    let claude_model =
        std::env::var("CLAUDE_MODEL").unwrap_or_else(|_| "claude-sonnet-4-5-20250929".to_string());

    info!("Claude backend mode: {}", claude_mode);
    if claude_mode == "cli" {
        info!("Using Claude Code CLI - ensure 'claude' is installed and authenticated");
    }

    let state = Arc::new(AppState {
        claude_mode,
        anthropic_api_key,
        gemini_api_key,
        openai_api_key,
        claude_model,
    });

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    // Determine frontend directory path
    // Try relative path from backend-rust directory, or use FRONTEND_DIR env var
    let frontend_dir = std::env::var("FRONTEND_DIR")
        .unwrap_or_else(|_| "../frontend".to_string());

    info!("Serving frontend from: {}", frontend_dir);

    // Static file service with no-cache headers to ensure fresh files during development
    let static_service = ServeDir::new(&frontend_dir).precompressed_gzip();
    let static_with_cache_control = tower::ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::overriding(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-cache, no-store, must-revalidate"),
        ))
        .service(static_service);

    // Build router - API routes first, then fallback to static files
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/status", get(status_page))
        .route("/api/ai/classify", post(classify_bug))
        .route("/api/ai/suggest-response", post(suggest_response))
        .route("/api/ai/generate", post(generate_response))
        .route("/api/ai/refine", post(refine_response))
        .route("/api/ai/testpage", post(generate_testpage))
        .fallback_service(static_with_cache_control)
        .layer(cors)
        .with_state(state);

    // Start server
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let url = format!("http://localhost:{}", port);
    info!("Starting server on {}", url);

    // Check if we should auto-open browser (default: yes)
    let no_open = std::env::var("NO_OPEN").is_ok();

    if !no_open {
        let open_url = url.clone();
        // Spawn a task to open browser after a short delay
        tokio::spawn(async move {
            // Small delay to ensure server is ready
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            info!("Opening browser at {}", open_url);
            if let Err(e) = open::that(&open_url) {
                tracing::warn!("Failed to open browser: {}. Open {} manually.", e, open_url);
            }
        });
    }

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Health check endpoint - also reports available AI providers for frontend auto-configuration
async fn health_check() -> impl IntoResponse {
    // Check which AI providers are available
    let mut available_providers: Vec<&str> = Vec::new();

    // Check Claude Code CLI
    let claude_available = tokio::process::Command::new("claude")
        .arg("--version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false);

    if claude_available {
        available_providers.push("claude");
    }

    // Future: Check Gemini Code CLI
    // let gemini_available = tokio::process::Command::new("gemini")
    //     .arg("--version")
    //     .output()
    //     .await
    //     .map(|o| o.status.success())
    //     .unwrap_or(false);
    // if gemini_available {
    //     available_providers.push("gemini");
    // }

    // Determine recommended provider (first available, or none)
    let recommended_provider = available_providers.first().copied();

    Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "availableProviders": available_providers,
        "recommendedProvider": recommended_provider
    }))
}

/// Status page - shows backend configuration and checks
async fn status_page(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // Check if Claude CLI is available
    let claude_check = tokio::process::Command::new("claude")
        .arg("--version")
        .output()
        .await;

    let (claude_available, claude_version) = match claude_check {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, version)
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            (false, format!("Error: {}", stderr))
        }
        Err(e) => (false, format!("Not found: {}", e)),
    };

    let claude_status = if claude_available { "✅" } else { "❌" };
    let mode_info = if state.claude_mode == "cli" {
        "Claude Code CLI (recommended)"
    } else {
        "HTTP API"
    };

    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <title>Triage Wizard - Backend Status</title>
    <style>
        body {{ font-family: system-ui, sans-serif; max-width: 700px; margin: 50px auto; padding: 20px; }}
        h1 {{ color: #333; }}
        .status-card {{ background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }}
        .status-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }}
        .status-row:last-child {{ border-bottom: none; }}
        .label {{ font-weight: 500; color: #555; }}
        .value {{ font-family: monospace; }}
        .ok {{ color: #28a745; }}
        .error {{ color: #dc3545; }}
        code {{ background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }}
        a {{ color: #007bff; }}
        .nav {{ margin-bottom: 20px; }}
    </style>
</head>
<body>
    <div class="nav">
        <a href="/">← Back to App</a>
    </div>
    <h1>Backend Status</h1>

    <div class="status-card">
        <h3>Server</h3>
        <div class="status-row">
            <span class="label">Status</span>
            <span class="value ok">✅ Running</span>
        </div>
        <div class="status-row">
            <span class="label">Version</span>
            <span class="value">{version}</span>
        </div>
        <div class="status-row">
            <span class="label">Mode</span>
            <span class="value">{mode_info}</span>
        </div>
    </div>

    <div class="status-card">
        <h3>Claude Code CLI</h3>
        <div class="status-row">
            <span class="label">Available</span>
            <span class="value">{claude_status} {claude_available_text}</span>
        </div>
        <div class="status-row">
            <span class="label">Version</span>
            <span class="value">{claude_version}</span>
        </div>
    </div>

    <div class="status-card">
        <h3>API Endpoints</h3>
        <div class="status-row">
            <span class="label">Health</span>
            <span class="value"><code>GET /health</code></span>
        </div>
        <div class="status-row">
            <span class="label">Classify</span>
            <span class="value"><code>POST /api/ai/classify</code></span>
        </div>
        <div class="status-row">
            <span class="label">Suggest</span>
            <span class="value"><code>POST /api/ai/suggest-response</code></span>
        </div>
        <div class="status-row">
            <span class="label">Generate</span>
            <span class="value"><code>POST /api/ai/generate</code></span>
        </div>
        <div class="status-row">
            <span class="label">Refine</span>
            <span class="value"><code>POST /api/ai/refine</code></span>
        </div>
    </div>

    <p><small>Refresh this page to re-check status.</small></p>
</body>
</html>"#,
        version = env!("CARGO_PKG_VERSION"),
        mode_info = mode_info,
        claude_status = claude_status,
        claude_available_text = if claude_available { "Yes" } else { "No" },
        claude_version = claude_version,
    );

    axum::response::Html(html)
}

/// Classify a bug using AI
async fn classify_bug(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ClassifyRequest>,
) -> Result<Json<ClassifyResponse>, ErrorResponse> {
    info!("Classify request for provider: {}", request.provider);

    let model = request
        .model
        .unwrap_or_else(|| state.claude_model.clone());

    // Route to appropriate provider
    match request.provider.as_str() {
        "claude" => {
            if state.claude_mode == "cli" {
                claude_cli::classify_bug(
                    &request.bug,
                    &model,
                    request.prompt.as_deref(),
                    request.schema.as_deref(),
                ).await
            } else {
                // HTTP API mode - requires API key
                let api_key = state.anthropic_api_key.as_ref().ok_or_else(|| ErrorResponse {
                    error: "ANTHROPIC_API_KEY not configured".to_string(),
                    details: None,
                })?;
                claude_api_classify(&request.bug, &model, api_key).await
            }
        }
        "gemini" => {
            let api_key = state.gemini_api_key.as_ref().ok_or_else(|| ErrorResponse {
                error: "GEMINI_API_KEY not configured".to_string(),
                details: None,
            })?;
            gemini_classify(&request.bug, &model, api_key).await
        }
        "openai" => {
            let api_key = state.openai_api_key.as_ref().ok_or_else(|| ErrorResponse {
                error: "OPENAI_API_KEY not configured".to_string(),
                details: None,
            })?;
            openai_classify(&request.bug, &model, api_key).await
        }
        _ => Err(ErrorResponse {
            error: format!("Unknown provider: {}", request.provider),
            details: None,
        }),
    }
}

/// Suggest a response from canned responses using AI
async fn suggest_response(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SuggestRequest>,
) -> Result<Json<SuggestResponse>, ErrorResponse> {
    info!("Suggest request for provider: {}", request.provider);

    let model = request
        .model
        .unwrap_or_else(|| state.claude_model.clone());

    match request.provider.as_str() {
        "claude" => {
            if state.claude_mode == "cli" {
                claude_cli::suggest_response(
                    &request.bug,
                    &request.canned_responses,
                    &model,
                    request.prompt.as_deref(),
                    request.schema.as_deref(),
                ).await
            } else {
                let api_key = state.anthropic_api_key.as_ref().ok_or_else(|| ErrorResponse {
                    error: "ANTHROPIC_API_KEY not configured".to_string(),
                    details: None,
                })?;
                claude_api_suggest(&request.bug, &request.canned_responses, &model, api_key).await
            }
        }
        _ => Err(ErrorResponse {
            error: "Only Claude provider supported for suggest".to_string(),
            details: None,
        }),
    }
}

/// Generate response endpoint - creates triage comment or action suggestions
async fn generate_response(
    State(state): State<Arc<AppState>>,
    Json(request): Json<GenerateRequest>,
) -> Result<Json<GenerateResponse>, ErrorResponse> {
    info!("Generate request for provider: {}", request.provider);

    let model = request
        .model
        .unwrap_or_else(|| state.claude_model.clone());

    match request.provider.as_str() {
        "claude" => {
            if state.claude_mode == "cli" {
                claude_cli::generate_response(
                    &request.bug,
                    &request.options,
                    &model,
                    request.prompt.as_deref(),
                    request.schema.as_deref(),
                )
                .await
            } else if let Some(ref api_key) = state.anthropic_api_key {
                claude_api_generate(&request.bug, &request.options, &model, api_key).await
            } else {
                Err(ErrorResponse {
                    error: "Anthropic API key not configured".to_string(),
                    details: Some("Set ANTHROPIC_API_KEY or use CLI mode".to_string()),
                })
            }
        }
        _ => Err(ErrorResponse {
            error: "Only Claude provider supported for generate".to_string(),
            details: None,
        }),
    }
}

/// Refine response handler
async fn refine_response(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RefineRequest>,
) -> Result<Json<RefineResponse>, ErrorResponse> {
    info!("Refine request for provider: {}", request.provider);

    let model = request
        .model
        .unwrap_or_else(|| state.claude_model.clone());

    match request.provider.as_str() {
        "claude" => {
            if state.claude_mode == "cli" {
                claude_cli::refine_response(
                    &request.bug,
                    &request.current_response,
                    &request.user_instruction,
                    &request.context,
                    &model,
                    request.prompt.as_deref(),
                    request.schema.as_deref(),
                )
                .await
            } else if let Some(ref api_key) = state.anthropic_api_key {
                claude_api_refine(
                    &request.bug,
                    &request.current_response,
                    &request.user_instruction,
                    &request.context,
                    &model,
                    api_key,
                )
                .await
            } else {
                Err(ErrorResponse {
                    error: "Anthropic API key not configured".to_string(),
                    details: Some("Set ANTHROPIC_API_KEY or use CLI mode".to_string()),
                })
            }
        }
        _ => Err(ErrorResponse {
            error: "Only Claude provider supported for refine".to_string(),
            details: None,
        }),
    }
}

/// Generate test page handler
async fn generate_testpage(
    State(state): State<Arc<AppState>>,
    Json(request): Json<TestPageRequest>,
) -> Result<Json<TestPageResponse>, ErrorResponse> {
    info!("Test page generation request for provider: {}", request.provider);

    let model = request
        .model
        .unwrap_or_else(|| state.claude_model.clone());

    match request.provider.as_str() {
        "claude" => {
            if state.claude_mode == "cli" {
                claude_cli::generate_testpage(
                    &request.bug,
                    &model,
                    request.prompt.as_deref(),
                    request.schema.as_deref(),
                )
                .await
            } else if let Some(ref api_key) = state.anthropic_api_key {
                claude_api_testpage(&request.bug, &model, api_key).await
            } else {
                Err(ErrorResponse {
                    error: "Anthropic API key not configured".to_string(),
                    details: Some("Set ANTHROPIC_API_KEY or use CLI mode".to_string()),
                })
            }
        }
        _ => Err(ErrorResponse {
            error: "Only Claude provider supported for test page generation".to_string(),
            details: None,
        }),
    }
}

// Placeholder implementations for HTTP API calls
// These can be expanded later if needed

async fn claude_api_classify(
    _bug: &serde_json::Value,
    _model: &str,
    _api_key: &str,
) -> Result<Json<ClassifyResponse>, ErrorResponse> {
    Err(ErrorResponse {
        error: "Claude HTTP API mode not yet implemented - use CLI mode".to_string(),
        details: Some("Set CLAUDE_BACKEND_MODE=cli".to_string()),
    })
}

async fn claude_api_suggest(
    _bug: &serde_json::Value,
    _canned: &[serde_json::Value],
    _model: &str,
    _api_key: &str,
) -> Result<Json<SuggestResponse>, ErrorResponse> {
    Err(ErrorResponse {
        error: "Claude HTTP API mode not yet implemented - use CLI mode".to_string(),
        details: Some("Set CLAUDE_BACKEND_MODE=cli".to_string()),
    })
}

async fn claude_api_generate(
    _bug: &serde_json::Value,
    _options: &serde_json::Value,
    _model: &str,
    _api_key: &str,
) -> Result<Json<GenerateResponse>, ErrorResponse> {
    Err(ErrorResponse {
        error: "Claude HTTP API mode not yet implemented - use CLI mode".to_string(),
        details: Some("Set CLAUDE_BACKEND_MODE=cli".to_string()),
    })
}

async fn claude_api_refine(
    _bug: &serde_json::Value,
    _current_response: &str,
    _user_instruction: &str,
    _context: &serde_json::Value,
    _model: &str,
    _api_key: &str,
) -> Result<Json<RefineResponse>, ErrorResponse> {
    Err(ErrorResponse {
        error: "Claude HTTP API mode not yet implemented - use CLI mode".to_string(),
        details: Some("Set CLAUDE_BACKEND_MODE=cli".to_string()),
    })
}

async fn claude_api_testpage(
    _bug: &serde_json::Value,
    _model: &str,
    _api_key: &str,
) -> Result<Json<TestPageResponse>, ErrorResponse> {
    Err(ErrorResponse {
        error: "Claude HTTP API mode not yet implemented - use CLI mode".to_string(),
        details: Some("Set CLAUDE_BACKEND_MODE=cli".to_string()),
    })
}

async fn gemini_classify(
    _bug: &serde_json::Value,
    _model: &str,
    _api_key: &str,
) -> Result<Json<ClassifyResponse>, ErrorResponse> {
    Err(ErrorResponse {
        error: "Gemini backend proxy not yet implemented - use browser mode".to_string(),
        details: None,
    })
}

async fn openai_classify(
    _bug: &serde_json::Value,
    _model: &str,
    _api_key: &str,
) -> Result<Json<ClassifyResponse>, ErrorResponse> {
    Err(ErrorResponse {
        error: "OpenAI backend proxy not yet implemented".to_string(),
        details: None,
    })
}
