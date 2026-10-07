//! Typed events (tauri-specta). Payload types live in `cv_core::model::events`.

use cv_core::model::{IndexStatus, LiveChanged, SessionsChanged};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;

/// Index progress; throttled to at most 5/s.
#[derive(Serialize, Deserialize, Type, Event, Clone, Debug)]
pub struct IndexStatusEvent(pub IndexStatus);

/// After each debounced filesystem batch.
#[derive(Serialize, Deserialize, Type, Event, Clone, Debug)]
pub struct SessionsChangedEvent(pub SessionsChanged);

/// Only when the Live Session set or a status changes.
#[derive(Serialize, Deserialize, Type, Event, Clone, Debug)]
pub struct LiveChangedEvent(pub LiveChanged);
