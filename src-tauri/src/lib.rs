//! Claude Viewer desktop app: tauri shell around `cv_core::Engine`.

pub mod commands;
pub mod events;
pub mod settings;
pub mod state;
pub mod watcher;
pub mod worker;

use std::path::Path;

use cv_core::{Engine, EngineConfig, paths};
use tauri::Manager;
use tauri_specta::{Builder, ErrorHandlingMode, collect_commands, collect_events};

use crate::events::{IndexStatusEvent, LiveChangedEvent, SessionsChangedEvent};
use crate::state::AppState;

/// The single source of commands and events, shared by the app and the bindings export.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            commands::get_app_info,
            commands::set_data_root,
            commands::get_index_status,
            commands::rebuild_index,
            commands::list_projects,
            commands::list_sessions,
            commands::get_session,
            commands::get_transcript,
            commands::get_tool_detail,
            commands::get_image,
            commands::search,
            commands::search_tool_output,
            commands::cancel_search,
            commands::resolve_jump,
            commands::find_in_session,
            commands::reveal_session_file,
            commands::get_stats,
            commands::get_diagnostics,
        ])
        .events(collect_events![
            IndexStatusEvent,
            SessionsChangedEvent,
            LiveChangedEvent
        ])
        .error_handling(ErrorHandlingMode::Throw)
}

fn open_engine() -> Result<Engine, cv_core::CoreError> {
    let settings = settings::load();
    let root = paths::resolve_data_root(settings.data_root.as_deref().map(Path::new));
    Engine::open(EngineConfig {
        data_root: root.path,
        data_root_source: root.source,
        cache_dir: paths::default_cache_dir(),
    })
}

pub fn run() {
    let builder = specta_builder();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            app.manage(AppState::new(open_engine()?));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Claude Viewer");
}

/// Writes `src/ipc/bindings.ts`. Run with `pnpm bindings`.
#[cfg(test)]
#[test]
fn export_bindings() {
    specta_builder()
        .export(
            specta_typescript::Typescript::default(),
            concat!(env!("CARGO_MANIFEST_DIR"), "/../src/ipc/bindings.ts"),
        )
        .expect("failed to export typescript bindings");
}
