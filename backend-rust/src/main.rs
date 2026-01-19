//! Triage Wizard Backend
//!
//! A proxy server for AI calls and Bugzilla operations when browser CORS blocks direct access.
//! Prioritizes Claude Code CLI integration for Mozilla developers.

use axum::{
    extract::State,
    http::{header, Method, StatusCode},
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
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
pub struct ClassifyRequest {
    pub provider: String,
    pub model: Option<String>,
    pub bug: serde_json::Value,
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
    pub notes: Option<serde_json::Value>,
}

/// Customize response request
#[derive(Debug, Deserialize)]
pub struct CustomizeRequest {
    pub provider: String,
    pub model: Option<String>,
    pub bug: serde_json::Value,
    pub canned_response: serde_json::Value,
}

/// Customize response result
#[derive(Debug, Serialize)]
pub struct CustomizeResponse {
    pub final_response: String,
    pub used_canned_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<serde_json::Value>,
}

/// Suggest response request
#[derive(Debug, Deserialize)]
pub struct SuggestRequest {
    pub provider: String,
    pub model: Option<String>,
    pub bug: serde_json::Value,
    pub canned_responses: Vec<serde_json::Value>,
}

/// Suggest response result
#[derive(Debug, Serialize)]
pub struct SuggestResponse {
    pub suggested_response_id: String,
    pub draft_response: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
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

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/ai/classify", post(classify_bug))
        .route("/api/ai/customize-response", post(customize_response))
        .route("/api/ai/suggest-response", post(suggest_response))
        .layer(cors)
        .with_state(state);

    // Start server
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);
    info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Health check endpoint
async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
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
                claude_cli::classify_bug(&request.bug, &model).await
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

/// Customize a canned response using AI
async fn customize_response(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CustomizeRequest>,
) -> Result<Json<CustomizeResponse>, ErrorResponse> {
    info!("Customize request for provider: {}", request.provider);

    let model = request
        .model
        .unwrap_or_else(|| state.claude_model.clone());

    match request.provider.as_str() {
        "claude" => {
            if state.claude_mode == "cli" {
                claude_cli::customize_response(&request.bug, &request.canned_response, &model).await
            } else {
                let api_key = state.anthropic_api_key.as_ref().ok_or_else(|| ErrorResponse {
                    error: "ANTHROPIC_API_KEY not configured".to_string(),
                    details: None,
                })?;
                claude_api_customize(&request.bug, &request.canned_response, &model, api_key).await
            }
        }
        _ => Err(ErrorResponse {
            error: "Only Claude provider supported for customize".to_string(),
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
                claude_cli::suggest_response(&request.bug, &request.canned_responses, &model).await
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

async fn claude_api_customize(
    _bug: &serde_json::Value,
    _canned: &serde_json::Value,
    _model: &str,
    _api_key: &str,
) -> Result<Json<CustomizeResponse>, ErrorResponse> {
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
