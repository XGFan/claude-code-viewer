//! Background worker: consumes jobs (full scan, FS batches, text backlog, rebuild, root swap)
//! over a channel and emits events.

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use crossbeam_channel::{Receiver, Sender};
use cv_core::model::{IndexStatus, SessionsChanged};
use cv_core::{ChangeSet, CoreError, Engine, paths};
use parking_lot::Mutex;
use tauri::{AppHandle, Manager};
use tauri_specta::Event;

use crate::events::{IndexStatusEvent, LiveChangedEvent, SessionsChangedEvent};
use crate::state::AppState;
use crate::watcher::{self, Watcher};

const LIVE_POLL: Duration = Duration::from_secs(3);
const RESCAN_EVERY_POLLS: u32 = 200; // 10 minutes
const STATUS_INTERVAL: Duration = Duration::from_millis(200); // <= 5 events/s

#[derive(Debug)]
pub enum Job {
    /// Stat walk + metadata parse; followed by `TextBacklog`.
    FullScan,
    /// Debounced filesystem batch (paths under `<root>/projects` or `<root>/sessions`).
    Fs(Vec<PathBuf>),
    /// Full-text backlog; yields to any other queued job between transactions.
    TextBacklog,
    Rebuild,
    /// The Engine was swapped: restart the watcher and rescan.
    SetRoot,
    PollLive,
    /// Periodic stat rescan; also refreshes the watcher (new symlinked projects).
    Rescan,
}

/// Queues jobs; any job except `TextBacklog` also asks a running backlog to yield.
#[derive(Clone)]
pub struct JobSender {
    tx: Sender<Job>,
    backlog_cancel: Arc<AtomicBool>,
}

impl JobSender {
    /// Returns false once the worker is gone.
    pub fn send(&self, job: Job) -> bool {
        if !matches!(job, Job::TextBacklog) {
            self.backlog_cancel.store(true, Ordering::Relaxed);
        }
        self.tx.send(job).is_ok()
    }
}

pub fn channel() -> (JobSender, Receiver<Job>, Arc<AtomicBool>) {
    let (tx, rx) = crossbeam_channel::unbounded();
    let cancel = Arc::new(AtomicBool::new(false));
    (
        JobSender {
            tx,
            backlog_cancel: cancel.clone(),
        },
        rx,
        cancel,
    )
}

/// Spawns the worker and the timer feeding it live polls and periodic rescans.
pub fn spawn(app: AppHandle, rx: Receiver<Job>, jobs: JobSender, backlog_cancel: Arc<AtomicBool>) {
    let timer_jobs = jobs.clone();
    std::thread::Builder::new()
        .name("cv-timer".into())
        .spawn(move || {
            let mut polls = 0u32;
            loop {
                std::thread::sleep(LIVE_POLL);
                polls += 1;
                let job = if polls.is_multiple_of(RESCAN_EVERY_POLLS) {
                    Job::Rescan
                } else {
                    Job::PollLive
                };
                if !timer_jobs.send(job) {
                    break;
                }
            }
        })
        .expect("spawn timer thread");
    std::thread::Builder::new()
        .name("cv-worker".into())
        .spawn(move || {
            Worker {
                app,
                rx,
                jobs,
                backlog_cancel,
                watcher: None,
                last_status: Arc::new(Mutex::new(None)),
            }
            .run()
        })
        .expect("spawn worker thread");
}

struct Worker {
    app: AppHandle,
    rx: Receiver<Job>,
    jobs: JobSender,
    backlog_cancel: Arc<AtomicBool>,
    watcher: Option<Watcher>,
    /// Time of the last emitted progress status (throttle).
    last_status: Arc<Mutex<Option<Instant>>>,
}

fn log_err(op: &str, e: &CoreError) {
    match e {
        CoreError::NotImplemented(_) | CoreError::Cancelled => {
            tracing::debug!("{op}: {e}");
        }
        _ => tracing::warn!("{op} failed: {e}"),
    }
}

impl Worker {
    fn run(mut self) {
        while let Ok(job) = self.rx.recv() {
            let engine = self.app.state::<AppState>().engine();
            match job {
                Job::SetRoot | Job::Rescan => {
                    self.restart_watcher(&engine);
                    self.full_scan(&engine);
                }
                Job::FullScan => self.full_scan(&engine),
                Job::Fs(paths) => self.fs_batch(&engine, &paths),
                Job::TextBacklog => self.text_backlog(&engine),
                Job::Rebuild => {
                    if let Err(e) = engine.rebuild() {
                        log_err("rebuild", &e);
                        self.emit_error(&engine, &e);
                    } else {
                        self.full_scan(&engine);
                    }
                }
                Job::PollLive => self.poll_live(&engine),
            }
        }
    }

    fn restart_watcher(&mut self, engine: &Engine) {
        self.watcher = None;
        let root = PathBuf::from(engine.app_info().data_root);
        self.watcher = watcher::start(&root, self.jobs.clone());
        if let Some(w) = &self.watcher {
            tracing::info!("watching {} dirs under {}", w.watched, root.display());
        }
    }

    fn emit_status(&self, status: IndexStatus) {
        let _ = IndexStatusEvent(status).emit(&self.app);
    }

    fn emit_error(&self, engine: &Engine, e: &CoreError) {
        let mut status = engine.index_status();
        status.error = Some(e.to_string());
        self.emit_status(status);
    }

    fn emit_changes(&self, cs: ChangeSet) {
        if cs.changed.is_empty() && cs.removed.is_empty() && !cs.projects_changed {
            return;
        }
        let _ = SessionsChangedEvent(SessionsChanged {
            changed: cs.changed,
            removed: cs.removed,
            projects_changed: cs.projects_changed,
        })
        .emit(&self.app);
    }

    /// Throttled progress callback for the engine.
    fn progress(&self) -> impl Fn(&IndexStatus) + 'static {
        let app = self.app.clone();
        let last = self.last_status.clone();
        move |status: &IndexStatus| {
            let mut last = last.lock();
            let now = Instant::now();
            if last.is_some_and(|t| now.duration_since(t) < STATUS_INTERVAL) {
                return;
            }
            *last = Some(now);
            let _ = IndexStatusEvent(status.clone()).emit(&app);
        }
    }

    fn full_scan(&self, engine: &Engine) {
        match engine.scan_all(&self.progress()) {
            Ok(cs) => {
                self.emit_changes(cs);
                self.emit_status(engine.index_status());
                self.jobs.send(Job::TextBacklog);
            }
            Err(e) => {
                log_err("scan_all", &e);
                self.emit_error(engine, &e);
            }
        }
    }

    fn fs_batch(&self, engine: &Engine, paths: &[PathBuf]) {
        let sessions_dir = paths::sessions_dir(&PathBuf::from(engine.app_info().data_root));
        let (live, project): (Vec<&PathBuf>, Vec<&PathBuf>) =
            paths.iter().partition(|p| p.starts_with(&sessions_dir));
        if !project.is_empty() {
            let project: Vec<PathBuf> = project.into_iter().cloned().collect();
            match engine.apply_changes(&project) {
                Ok(cs) => {
                    let any = !cs.changed.is_empty() || !cs.removed.is_empty();
                    self.emit_changes(cs);
                    self.emit_status(engine.index_status());
                    if any {
                        self.jobs.send(Job::TextBacklog);
                    }
                }
                Err(e) => log_err("apply_changes", &e),
            }
        }
        if !live.is_empty() {
            self.poll_live(engine);
        }
    }

    fn poll_live(&self, engine: &Engine) {
        match engine.poll_live() {
            Ok(Some(live)) => {
                let _ = LiveChangedEvent(live).emit(&self.app);
            }
            Ok(None) => {}
            Err(e) => log_err("poll_live", &e),
        }
    }

    /// Runs the backlog until done; yields (and requeues itself) when another job arrives.
    fn text_backlog(&self, engine: &Engine) {
        if !self.rx.is_empty() {
            // Other jobs first; they were queued ahead of this one.
            self.jobs.send(Job::TextBacklog);
            return;
        }
        self.backlog_cancel.store(false, Ordering::Relaxed);
        let result = engine.index_text_backlog(&self.progress(), &self.backlog_cancel);
        let yielded = self.backlog_cancel.load(Ordering::Relaxed);
        match result {
            Ok(()) | Err(CoreError::Cancelled) => {
                let status = engine.index_status();
                let done = status.text_ready;
                self.emit_status(status);
                if yielded && !done {
                    self.jobs.send(Job::TextBacklog);
                }
            }
            Err(e) => {
                log_err("index_text_backlog", &e);
                self.emit_error(engine, &e);
            }
        }
    }
}
