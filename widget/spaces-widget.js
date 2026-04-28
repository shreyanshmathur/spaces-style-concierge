/**
 * SPACES Style Concierge Widget
 * Drop-in AI shopping assistant for spaces.in
 * Version: 0.2.0-poc - photo + text mode
 *
 * Usage: <script src="spaces-widget.js" data-api-url=""></script>
 */
(function () {
  "use strict";

  const scriptTag = document.currentScript || document.querySelector('script[data-api-url]');
  const API_BASE = (scriptTag && scriptTag.getAttribute("data-api-url")) || "";

  // ── Design tokens ────────────────────────────────────────────────────────
  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Inter:wght@300;400;500;600&display=swap');

    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Launcher ── */
    #spaces-launcher {
      position: fixed; bottom: 28px; right: 28px;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #C9784A 0%, #A85C32 100%);
      box-shadow: 0 4px 24px rgba(169,92,50,.45);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; outline: none;
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease;
    }
    #spaces-launcher:hover { transform: scale(1.1); box-shadow: 0 6px 32px rgba(169,92,50,.6); }
    #spaces-launcher svg { width: 26px; height: 26px; }
    #spaces-badge {
      position: absolute; top: -4px; right: -4px;
      background: #E8654A; color: #fff;
      font-family: Inter, sans-serif; font-size: 10px; font-weight: 600;
      width: 18px; height: 18px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff; animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }

    /* ── Panel ── */
    #spaces-panel {
      position: fixed; bottom: 100px; right: 28px;
      width: 380px; max-width: calc(100vw - 32px);
      height: 600px; max-height: calc(100vh - 120px);
      background: #FDFAF7; border-radius: 20px;
      box-shadow: 0 20px 80px rgba(0,0,0,.18), 0 2px 12px rgba(0,0,0,.08);
      display: flex; flex-direction: column; overflow: hidden;
      z-index: 9998; font-family: Inter, sans-serif;
      opacity: 0; transform: translateY(20px) scale(.97);
      pointer-events: none;
      transition: opacity .3s ease, transform .3s cubic-bezier(.34,1.2,.64,1);
    }
    #spaces-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }

    /* ── Header ── */
    .sp-header {
      background: linear-gradient(135deg, #C9784A 0%, #9B4F28 100%);
      padding: 16px 20px 14px;
      display: flex; align-items: center; gap: 12px; flex-shrink: 0;
    }
    .sp-avatar {
      width: 40px; height: 40px; background: rgba(255,255,255,.2);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    .sp-header-text { flex: 1; }
    .sp-header-name { font-family:'Cormorant Garamond',serif; font-size:17px; font-weight:600; color:#fff; letter-spacing:.02em; }
    .sp-header-sub  { font-size:11px; color:rgba(255,255,255,.75); margin-top:1px; font-weight:400; }
    .sp-header-actions { display: flex; align-items: center; gap: 4px; }
    .sp-action-btn {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.8); display: flex; align-items: center;
      padding: 4px; border-radius: 6px; transition: color .2s, background .2s;
    }
    .sp-action-btn:hover { color:#fff; background:rgba(255,255,255,.15); }

    /* ── Progress ── */
    .sp-progress { height: 2px; background: rgba(255,255,255,.25); flex-shrink: 0; }
    .sp-progress-fill { height: 100%; background: rgba(255,255,255,.85); transition: width .4s ease; }

    /* ── Messages ── */
    .sp-messages {
      flex: 1; overflow-y: auto; padding: 16px 16px 8px;
      display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth;
    }
    .sp-messages::-webkit-scrollbar { width: 4px; }
    .sp-messages::-webkit-scrollbar-track { background: transparent; }
    .sp-messages::-webkit-scrollbar-thumb { background: #DDD0C8; border-radius: 4px; }

    /* ── Bubbles ── */
    .sp-bubble {
      max-width: 88%; padding: 10px 14px; border-radius: 14px;
      font-size: 13.5px; line-height: 1.55;
      animation: fadeUp .25s ease both;
    }
    @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .sp-bubble.bot {
      background:#fff; color:#2D2520;
      border-radius:4px 14px 14px 14px;
      box-shadow:0 1px 4px rgba(0,0,0,.07);
      align-self:flex-start;
    }
    .sp-bubble.user {
      background:linear-gradient(135deg,#C9784A,#A85C32);
      color:#fff; border-radius:14px 14px 4px 14px; align-self:flex-end;
    }

    /* ── Image preview in bubble ── */
    .sp-bubble-img {
      max-width: 200px; max-height: 160px; border-radius: 10px;
      object-fit: cover; display: block;
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }
    .sp-bubble.user .sp-bubble-img { margin-bottom: 6px; }
    .sp-bubble.bot  .sp-bubble-img { margin-bottom: 6px; border: 1px solid #F0E8E0; }

    /* ── Typing ── */
    .sp-typing {
      display:flex; align-items:center; gap:5px; padding:10px 14px;
      background:#fff; border-radius:4px 14px 14px 14px;
      box-shadow:0 1px 4px rgba(0,0,0,.07);
      align-self:flex-start; animation:fadeUp .25s ease both;
    }
    .sp-typing span {
      width:7px; height:7px; background:#C9784A; border-radius:50%; opacity:.4;
      animation:blink 1.2s infinite;
    }
    .sp-typing span:nth-child(2){animation-delay:.2s}
    .sp-typing span:nth-child(3){animation-delay:.4s}
    @keyframes blink{0%,80%,100%{opacity:.4;transform:scale(1)}40%{opacity:1;transform:scale(1.2)}}

    /* ── Chips ── */
    .sp-chips { display:flex; flex-wrap:wrap; gap:8px; padding:2px 16px 12px; flex-shrink:0; }
    .sp-chip {
      background:#fff; border:1.5px solid #C9784A; color:#C9784A;
      font-family:Inter,sans-serif; font-size:12.5px; font-weight:500;
      padding:7px 14px; border-radius:999px; cursor:pointer;
      transition:all .2s ease; white-space:nowrap; letter-spacing:.01em;
    }
    .sp-chip:hover { background:#C9784A; color:#fff; transform:translateY(-1px); box-shadow:0 3px 12px rgba(201,120,74,.35); }

    /* ── Choice screen ── */
    .sp-choice-area {
      display: flex; flex-direction: column; gap: 10px;
      padding: 8px 16px 16px; flex-shrink: 0;
    }
    .sp-choice-btn {
      display: flex; align-items: center; gap: 12px;
      background: #fff; border: 1.5px solid #E5D9D0; border-radius: 14px;
      padding: 14px 16px; cursor: pointer; text-align: left;
      transition: all .2s ease; width: 100%;
      font-family: Inter, sans-serif;
    }
    .sp-choice-btn:hover { border-color: #C9784A; box-shadow: 0 4px 16px rgba(201,120,74,.15); transform: translateY(-1px); }
    .sp-choice-btn.primary { background: linear-gradient(135deg,#C9784A,#A85C32); border-color: transparent; }
    .sp-choice-btn.primary .sp-choice-icon,
    .sp-choice-btn.primary .sp-choice-title,
    .sp-choice-btn.primary .sp-choice-sub { color: #fff; }
    .sp-choice-icon { font-size: 22px; flex-shrink: 0; }
    .sp-choice-title { font-size: 13.5px; font-weight: 600; color: #2D2520; }
    .sp-choice-sub   { font-size: 11.5px; color: #7A6560; margin-top: 2px; }

    /* ── Upload area ── */
    .sp-upload-area {
      border: 2px dashed #C9784A; border-radius: 14px; padding: 28px 20px;
      text-align: center; cursor: pointer; margin: 0 16px 12px;
      background: rgba(201,120,74,.04); transition: all .2s ease;
      flex-shrink: 0;
    }
    .sp-upload-area:hover, .sp-upload-area.drag-over {
      background: rgba(201,120,74,.1); border-color: #A85C32;
    }
    .sp-upload-icon { font-size: 32px; margin-bottom: 8px; }
    .sp-upload-title { font-size: 13.5px; font-weight: 600; color: #2D2520; margin-bottom: 4px; }
    .sp-upload-sub   { font-size: 11.5px; color: #7A6560; }

    /* ── Image preview in upload area ── */
    .sp-upload-preview {
      width: 100%; border-radius: 10px; max-height: 160px;
      object-fit: cover; display: block; margin-bottom: 8px;
    }
    .sp-upload-change {
      background: none; border: 1px solid #C9784A; color: #C9784A;
      font-family: Inter, sans-serif; font-size: 11px; font-weight: 600;
      padding: 4px 12px; border-radius: 999px; cursor: pointer;
      transition: all .2s;
    }
    .sp-upload-change:hover { background: #C9784A; color: #fff; }

    /* ── Product cards ── */
    .sp-cards { display:flex; flex-direction:column; gap:10px; width:100%; }
    .sp-card {
      background:#fff; border-radius:12px; overflow:hidden;
      box-shadow:0 2px 10px rgba(0,0,0,.08);
      display:flex; transition:transform .2s ease, box-shadow .2s ease;
      animation:fadeUp .3s ease both; border:1px solid #F0E8E0;
    }
    .sp-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,.12); }
    .sp-card-img { width:90px; height:90px; object-fit:cover; flex-shrink:0; }
    .sp-card-body { padding:10px 12px; flex:1; display:flex; flex-direction:column; justify-content:space-between; min-width:0; }
    .sp-card-name { font-size:12.5px; font-weight:600; color:#2D2520; line-height:1.35; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .sp-card-reason { font-size:11px; color:#7A6560; margin-top:3px; line-height:1.4; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .sp-card-footer { display:flex; align-items:center; justify-content:space-between; margin-top:6px; }
    .sp-card-price  { font-size:13px; font-weight:700; color:#2D2520; }
    .sp-card-orig   { font-size:11px; color:#9E8E86; text-decoration:line-through; margin-left:4px; font-weight:400; }
    .sp-card-cta {
      background:linear-gradient(135deg,#C9784A,#A85C32); color:#fff; border:none;
      font-family:Inter,sans-serif; font-size:11px; font-weight:600;
      padding:5px 11px; border-radius:999px; cursor:pointer;
      text-decoration:none; transition:opacity .2s, transform .2s; white-space:nowrap;
    }
    .sp-card-cta:hover { opacity:.88; transform:scale(1.04); }
    .sp-card-actions { display:flex; align-items:center; gap:6px; }
    .sp-card-add {
      background:#fff; color:#C9784A; border:1px solid #C9784A;
      font-family:Inter,sans-serif; font-size:11px; font-weight:700;
      padding:4px 9px; border-radius:999px; cursor:pointer;
      transition:background .2s, color .2s;
    }
    .sp-card-add:hover { background:#C9784A; color:#fff; }
    .sp-badge-sale { display:inline-block; background:#E8654A; color:#fff; font-size:9.5px; font-weight:700; padding:2px 6px; border-radius:4px; margin-left:4px; vertical-align:middle; letter-spacing:.04em; }

    /* ── Input row ── */
    .sp-input-row {
      display:flex; align-items:center; gap:6px;
      padding:10px 12px 14px; border-top:1px solid #F0E8E0;
      flex-shrink:0; background:#FDFAF7;
    }
    .sp-input {
      flex:1; border:1.5px solid #E5D9D0; border-radius:999px;
      padding:10px 14px; font-family:Inter,sans-serif; font-size:13px;
      color:#2D2520; background:#fff; outline:none; transition:border-color .2s;
    }
    .sp-input:focus { border-color:#C9784A; }
    .sp-input::placeholder { color:#B8A89E; }

    /* ── Attach button ── */
    .sp-attach {
      width: 36px; height: 36px; border-radius: 50%;
      background: #fff; border: 1.5px solid #E5D9D0;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: all .2s; color: #7A6560;
    }
    .sp-attach:hover { border-color: #C9784A; color: #C9784A; background: rgba(201,120,74,.05); }
    .sp-attach.has-image { border-color: #C9784A; background: rgba(201,120,74,.1); color: #C9784A; }
    .sp-attach svg { width: 15px; height: 15px; }

    /* ── Pending image indicator ── */
    .sp-pending-img {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px 0; flex-shrink: 0;
    }
    .sp-pending-thumb {
      width: 36px; height: 36px; border-radius: 6px;
      object-fit: cover; border: 1.5px solid #C9784A;
    }
    .sp-pending-label { font-size: 11.5px; color: #7A6560; flex: 1; }
    .sp-pending-remove {
      background: none; border: none; cursor: pointer;
      color: #9E8E86; font-size: 14px; padding: 2px; line-height: 1;
    }
    .sp-pending-remove:hover { color: #A83820; }

    .sp-send {
      width:38px; height:38px; border-radius:50%;
      background:linear-gradient(135deg,#C9784A,#A85C32);
      border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;
      flex-shrink:0; transition:opacity .2s, transform .2s;
    }
    .sp-send:hover { opacity:.88; transform:scale(1.08); }
    .sp-send:disabled { opacity:.45; cursor:not-allowed; transform:none; }
    .sp-send svg { width:17px; height:17px; }

    /* ── Error ── */
    .sp-error {
      background:#FFF0EE; border:1px solid #F5C6BD; color:#A83820;
      border-radius:10px; padding:10px 14px; font-size:12.5px;
      align-self:stretch; animation:fadeUp .25s ease both;
    }
  `;

  // ── Questions for text flow ──────────────────────────────────────────────
  const QUESTIONS = [
    { key:"bedSize",   text:"What size is your bed?",
      options:["Single","Double","Queen","King"] },
    { key:"sleepTemp", text:"Do you sleep warm or cool?",
      options:[{label:"Cool & breathable",value:"cool"},{label:"Neutral",value:"neutral"},{label:"Warm & cosy",value:"warm"}] },
    { key:"fabric",    text:"Any fabric preference?",
      options:["Cotton","Linen","Bamboo","No preference"] },
    { key:"styleVibe", text:"What's your style vibe?",
      options:[{label:"Classic whites",value:"classic-whites"},{label:"Earthy tones",value:"earthy-tones"},{label:"Bold & colourful",value:"bold-colorful"},{label:"No preference",value:"No preference"}] },
  ];

  // ── State ────────────────────────────────────────────────────────────────
  let state = {
    stage: "idle",   // idle | choice | photo-size | intake | loading | results | chat
    mode: null,      // "photo" | "text"
    questionIdx: 0,
    preferences: {},
    recommendations: [],
    chatHistory: [],
    isOpen: false,
    // photo mode
    pendingImageBase64: null,
    pendingImageMime: null,
    pendingImageDataURL: null,
    roomImageBase64: null,
    roomImageMime: null,
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────
  let shadowRoot, panel, messagesEl, chipsEl, inputRowEl, inputEl, sendBtn,
      progressFill, choiceAreaEl, attachBtn, pendingImgEl, fileInputEl;

  // ── Mount ────────────────────────────────────────────────────────────────
  function mount() {
    const host = document.createElement("div");
    host.id = "spaces-widget-host";
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode:"open" });

    const style = document.createElement("style");
    style.textContent = STYLES;
    shadowRoot.appendChild(style);

    // Hidden file input
    fileInputEl = document.createElement("input");
    fileInputEl.type = "file";
    fileInputEl.accept = "image/*";
    fileInputEl.style.display = "none";
    fileInputEl.addEventListener("change", handleFileSelect);
    shadowRoot.appendChild(fileInputEl);

    // Launcher
    const launcher = document.createElement("button");
    launcher.id = "spaces-launcher";
    launcher.setAttribute("aria-label", "Open SPACES Style Concierge");
    launcher.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span id="spaces-badge">1</span>`;
    launcher.addEventListener("click", togglePanel);
    shadowRoot.appendChild(launcher);

    // Panel
    panel = document.createElement("div");
    panel.id = "spaces-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "SPACES Style Concierge");
    panel.innerHTML = `
      <div class="sp-header">
        <div class="sp-avatar">🪷</div>
        <div class="sp-header-text">
          <div class="sp-header-name">Style Concierge</div>
          <div class="sp-header-sub">Powered by SPACES &times; AI</div>
        </div>
        <div class="sp-header-actions">
          <button class="sp-action-btn" id="sp-reset-btn" aria-label="New Chat" title="Start New Chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
          <button class="sp-action-btn" id="sp-close-btn" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="sp-progress"><div class="sp-progress-fill" style="width:0%"></div></div>
      <div class="sp-messages" id="sp-messages"></div>
      <div class="sp-chips" id="sp-chips" style="display:none"></div>
      <div class="sp-choice-area" id="sp-choice-area" style="display:none"></div>
      <div id="sp-pending-img" style="display:none" class="sp-pending-img">
        <img id="sp-pending-thumb" class="sp-pending-thumb" src="" alt=""/>
        <span class="sp-pending-label">Photo attached</span>
        <button class="sp-pending-remove" id="sp-pending-remove" title="Remove photo">&times;</button>
      </div>
      <div class="sp-input-row" id="sp-input-row" style="display:none">
        <button class="sp-attach" id="sp-attach" aria-label="Attach photo" title="Attach a room photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <input class="sp-input" id="sp-input" type="text" placeholder="Ask me anything…" maxlength="400" autocomplete="off"/>
        <button class="sp-send" id="sp-send" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>`;
    shadowRoot.appendChild(panel);

    messagesEl   = shadowRoot.getElementById("sp-messages");
    chipsEl      = shadowRoot.getElementById("sp-chips");
    choiceAreaEl = shadowRoot.getElementById("sp-choice-area");
    inputRowEl   = shadowRoot.getElementById("sp-input-row");
    inputEl      = shadowRoot.getElementById("sp-input");
    sendBtn      = shadowRoot.getElementById("sp-send");
    progressFill = panel.querySelector(".sp-progress-fill");
    attachBtn    = shadowRoot.getElementById("sp-attach");
    pendingImgEl = shadowRoot.getElementById("sp-pending-img");

    shadowRoot.getElementById("sp-close-btn").addEventListener("click", togglePanel);
    shadowRoot.getElementById("sp-reset-btn").addEventListener("click", resetChat);
    sendBtn.addEventListener("click", handleSend);
    inputEl.addEventListener("keydown", (e) => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } });
    attachBtn.addEventListener("click", () => fileInputEl.click());
    shadowRoot.getElementById("sp-pending-remove").addEventListener("click", clearPendingImage);
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function resetChat() {
    state = {
      stage: "idle",
      mode: null,
      questionIdx: 0,
      preferences: {},
      recommendations: [],
      chatHistory: [],
      isOpen: state.isOpen,
      pendingImageBase64: null,
      pendingImageMime: null,
      pendingImageDataURL: null,
      roomImageBase64: null,
      roomImageMime: null,
    };
    messagesEl.innerHTML = "";
    clearChips();
    hideChoiceArea();
    inputRowEl.style.display = "none";
    setProgress(0);
    clearPendingImage();
    showChoiceScreen();
  }

  // ── Toggle ───────────────────────────────────────────────────────────────
  function togglePanel() {
    state.isOpen = !state.isOpen;
    panel.classList.toggle("open", state.isOpen);
    const badge = shadowRoot.getElementById("spaces-badge");
    if (badge) badge.remove();
    if (state.isOpen && state.stage === "idle") showChoiceScreen();
  }

  // ── Stage 0: Choice screen ───────────────────────────────────────────────
  function showChoiceScreen() {
    state.stage = "choice";
    addBotMessage("Hi! I'm your personal SPACES Style Concierge. How would you like to get started?");

    choiceAreaEl.innerHTML = `
      <button class="sp-choice-btn primary" id="sp-choice-photo">
        <span class="sp-choice-icon">📷</span>
        <div>
          <div class="sp-choice-title">Scan my room</div>
          <div class="sp-choice-sub">Upload a photo: I'll match bedding to your decor</div>
        </div>
      </button>
      <button class="sp-choice-btn" id="sp-choice-text">
        <span class="sp-choice-icon">💬</span>
        <div>
          <div class="sp-choice-title">Describe my preferences</div>
          <div class="sp-choice-sub">Answer 4 quick questions to find your perfect match</div>
        </div>
      </button>`;
    choiceAreaEl.style.display = "flex";

    shadowRoot.getElementById("sp-choice-photo").addEventListener("click", startPhotoFlow);
    shadowRoot.getElementById("sp-choice-text").addEventListener("click", startTextFlow);
  }

  // ── Photo flow ───────────────────────────────────────────────────────────
  function startPhotoFlow() {
    state.mode = "photo";
    hideChoiceArea();
    showUploadArea();
  }

  function showUploadArea() {
    addBotMessage("Upload a photo of your bedroom and I'll suggest bedding that perfectly complements your space.");

    const uploadWrap = document.createElement("div");
    uploadWrap.id = "sp-upload-wrap";
    uploadWrap.className = "sp-upload-area";
    uploadWrap.innerHTML = `
      <div class="sp-upload-icon">🖼️</div>
      <div class="sp-upload-title">Drop photo here or tap to browse</div>
      <div class="sp-upload-sub">JPG, PNG, WEBP &bull; Max 8 MB</div>`;

    uploadWrap.addEventListener("click", () => fileInputEl.click());
    uploadWrap.addEventListener("dragover", (e) => { e.preventDefault(); uploadWrap.classList.add("drag-over"); });
    uploadWrap.addEventListener("dragleave", () => uploadWrap.classList.remove("drag-over"));
    uploadWrap.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadWrap.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) processImageFile(file);
    });

    // Temporarily repurpose choiceAreaEl to hold upload widget
    choiceAreaEl.innerHTML = "";
    choiceAreaEl.style.display = "flex";
    choiceAreaEl.style.padding = "0 0 12px";
    choiceAreaEl.appendChild(uploadWrap);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processImageFile(file);
    e.target.value = "";
  }

  function processImageFile(file) {
    if (file.size > 8 * 1024 * 1024) { addError("Image too large: please use a file under 8 MB."); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataURL = ev.target.result;
      const b64 = dataURL.split(",")[1];
      const mime = file.type || "image/jpeg";

      state.pendingImageBase64 = b64;
      state.pendingImageMime   = mime;
      state.pendingImageDataURL = dataURL;

      if (state.stage === "choice" || state.stage === "photo-size") {
        // Update upload area to show preview
        updateUploadPreview(dataURL);
        askBedSizeForPhoto();
      } else {
        // In chat mode — show pending image indicator
        showPendingImageIndicator(dataURL);
      }
    };
    reader.readAsDataURL(file);
  }

  function updateUploadPreview(dataURL) {
    const wrap = shadowRoot.getElementById("sp-upload-wrap");
    if (!wrap) return;
    wrap.innerHTML = `
      <img class="sp-upload-preview" src="${dataURL}" alt="Your room"/>
      <button class="sp-upload-change">Change photo</button>`;
    wrap.querySelector(".sp-upload-change").addEventListener("click", (e) => { e.stopPropagation(); fileInputEl.click(); });
  }

  function askBedSizeForPhoto() {
    if (state.stage === "photo-size") return; // already asked
    state.stage = "photo-size";
    addBotMessage("Great photo! Just one quick thing: what size is your bed?");
    renderChips(
      ["Single","Double","Queen","King"].map(v => ({ label:v, value:v })),
      (val) => {
        state.preferences = { bedSize: val, sleepTemp:"No preference", fabric:"No preference", styleVibe:"No preference" };
        addUserMessage(val);
        clearChips();
        hideChoiceArea();
        submitRoomAnalysis();
      }
    );
  }

  async function submitRoomAnalysis() {
    state.stage = "loading";
    addBotMessage("Analysing your room... finding bedding that complements your space...");
    setProgress(60);
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/analyze-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: state.pendingImageBase64,
          image_mime:   state.pendingImageMime,
          bed_size:     state.preferences.bedSize,
        }),
      });

      if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status} - ${t}`); }
      const data = await res.json();

      removeTyping();
      state.recommendations = data.recommendations;
      state.roomImageBase64  = state.pendingImageBase64;
      state.roomImageMime    = state.pendingImageMime;
      state.stage = "results";
      setProgress(100);

      // Show uploaded photo in chat
      addImageBubble("user", state.pendingImageDataURL);

      addBotMessage(data.intro_message);
      if (data.detected_style) addBotMessage(`Room vibe detected: ${data.detected_style}`);

      setTimeout(() => {
        renderProductCards(data.recommendations);
        setTimeout(() => activateChatMode(), 600);
      }, 300);
    } catch (err) {
      removeTyping();
      addError("I couldn't analyze that photo. Please upload a clear bedroom image or try the preference quiz.");
      state.stage = "idle";
    } finally {
      state.pendingImageBase64 = null;
      state.pendingImageMime   = null;
      state.pendingImageDataURL = null;
    }
  }

  // ── Text flow ────────────────────────────────────────────────────────────
  function startTextFlow() {
    state.mode = "text";
    hideChoiceArea();
    state.stage = "intake";
    state.questionIdx = 0;
    state.preferences = {};
    addBotMessage("Let's find your perfect match! I'll ask 4 quick questions.");
    setTimeout(() => askQuestion(0), 400);
  }

  function askQuestion(idx) {
    if (idx >= QUESTIONS.length) { submitRecommendation(); return; }
    const q = QUESTIONS[idx];
    addBotMessage(q.text);
    setProgress(((idx + 1) / (QUESTIONS.length + 1)) * 100);
    const options = q.options.map(o => typeof o === "string" ? { label:o, value:o } : o);
    renderChips(options, (val, label) => {
      state.preferences[q.key] = val;
      addUserMessage(label);
      clearChips();
      setTimeout(() => askQuestion(idx + 1), 300);
    });
  }

  async function submitRecommendation() {
    state.stage = "loading";
    clearChips();
    addBotMessage("Perfect! Finding your ideal picks...");
    setProgress(90);
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: state.preferences }),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status} - ${t}`); }
      const data = await res.json();

      removeTyping();
      state.recommendations = data.recommendations;
      state.stage = "results";
      setProgress(100);
      addBotMessage(data.intro_message);
      setTimeout(() => {
        renderProductCards(data.recommendations);
        setTimeout(() => activateChatMode(), 600);
      }, 300);
    } catch (err) {
      removeTyping();
      addError("I couldn't fetch recommendations right now. Please try again.");
      state.stage = "idle";
    }
  }

  // ── Chat mode ────────────────────────────────────────────────────────────
  function activateChatMode() {
    state.stage = "chat";
    addBotMessage("Feel free to ask me anything: 'Show warmer options', 'What fabric is this?', or upload another photo to compare! 💬");
    inputRowEl.style.display = "flex";
    chipsEl.style.display = "none";
    inputEl.focus();
    inputEl.placeholder = "Ask a question or upload a photo…";
  }

  async function handleSend() {
    const text = inputEl.value.trim();
    const hasImage = !!state.pendingImageBase64;
    if ((!text && !hasImage) || state.stage !== "chat") return;

    const msgText  = text || "What can you tell me about this room?";
    const imgB64   = state.pendingImageBase64;
    const imgMime  = state.pendingImageMime;
    const imgDataURL = state.pendingImageDataURL;

    inputEl.value = "";
    clearPendingImage();
    sendBtn.disabled = true;

    // Show user message (with optional image)
    if (imgDataURL) addImageBubble("user", imgDataURL, text || null);
    else addUserMessage(msgText);

    state.chatHistory.push({ role:"user", content: msgText,
      ...(imgB64 ? { image_base64: imgB64, image_mime: imgMime } : {}) });

    showTyping();

    try {
      const body = {
        preferences:     state.preferences,
        recommendations: state.recommendations,
        history:         state.chatHistory.slice(0, -1),
        message:         msgText,
        ...(imgB64 ? { image_base64: imgB64, image_mime: imgMime } : {}),
      };
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status} - ${t}`); }
      const data = await res.json();

      removeTyping();
      state.chatHistory.push({ role:"assistant", content: data.message });
      addBotMessage(data.message);
      if (data.suggested_products && data.suggested_products.length) renderProductCards(data.suggested_products);
    } catch (err) {
      removeTyping();
      addError("Sorry, something went wrong. Please try again.");
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  // ── Image attachment (in chat) ────────────────────────────────────────────
  function showPendingImageIndicator(dataURL) {
    const thumb = shadowRoot.getElementById("sp-pending-thumb");
    thumb.src = dataURL;
    pendingImgEl.style.display = "flex";
    attachBtn.classList.add("has-image");
    inputEl.placeholder = "Add a message (optional) and send…";
  }

  function clearPendingImage() {
    state.pendingImageBase64  = null;
    state.pendingImageMime    = null;
    state.pendingImageDataURL = null;
    pendingImgEl.style.display = "none";
    attachBtn.classList.remove("has-image");
    inputEl.placeholder = "Ask a question or upload a photo…";
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function addBotMessage(text) {
    const el = document.createElement("div");
    el.className = "sp-bubble bot";
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function addUserMessage(text) {
    const el = document.createElement("div");
    el.className = "sp-bubble user";
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function addImageBubble(role, dataURL, captionText) {
    const el = document.createElement("div");
    el.className = `sp-bubble ${role}`;
    const img = document.createElement("img");
    img.className = "sp-bubble-img";
    img.src = dataURL;
    img.alt = "Uploaded room";
    el.appendChild(img);
    if (captionText) {
      const t = document.createElement("div");
      t.textContent = captionText;
      el.appendChild(t);
    }
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function addError(text) {
    const el = document.createElement("div");
    el.className = "sp-error";
    el.textContent = "⚠️ " + text;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "sp-typing"; el.id = "sp-typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function removeTyping() {
    const el = shadowRoot.getElementById("sp-typing");
    if (el) el.remove();
  }

  function renderChips(options, onSelect) {
    chipsEl.innerHTML = "";
    chipsEl.style.display = "flex";
    options.forEach(({ label, value }) => {
      const btn = document.createElement("button");
      btn.className = "sp-chip";
      btn.textContent = label;
      btn.addEventListener("click", () => onSelect(value, label));
      chipsEl.appendChild(btn);
    });
  }

  function clearChips() {
    chipsEl.innerHTML = "";
    chipsEl.style.display = "none";
  }

  function hideChoiceArea() {
    choiceAreaEl.style.display = "none";
    choiceAreaEl.innerHTML = "";
    choiceAreaEl.style.padding = "";
  }

  async function handleProductSelect(product) {
    window.dispatchEvent(new CustomEvent("spaces-widget-product-selected", { detail: product }));
    window.dispatchEvent(new CustomEvent("spaces:add-to-cart", { detail: { sku: product.sku } }));
    addBotMessage(`Nice pick. I added ${product.name} to the cart. Want to complete the set with a towel, pillow cover, bath mat, or decor add-on?`);

    try {
      const res = await fetch(`${API_BASE}/api/related-products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_sku: product.sku, cart_skus: [product.sku], limit: 3 }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.intro_message) addBotMessage(data.intro_message);
      if (data.recommendations && data.recommendations.length) renderProductCards(data.recommendations);
    } catch (err) {
      addBotMessage("A matching pillow cover or towel is a good next add-on for this pick.");
    }
  }

  function renderProductCards(products) {
    const wrapper = document.createElement("div");
    wrapper.className = "sp-cards";
    products.forEach((p, i) => {
      const hasDiscount = p.discounted_price && p.discounted_price < p.price;
      const displayPrice = hasDiscount ? p.discounted_price : p.price;
      const card = document.createElement("div");
      card.className = "sp-card";
      card.style.animationDelay = `${i * 0.1}s`;
      card.innerHTML = `
        <img class="sp-card-img" src="${p.thumbnail_url}" alt="${p.name}" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=200&q=60'"/>
        <div class="sp-card-body">
          <div class="sp-card-name">${p.name}</div>
          <div class="sp-card-reason">${p.reason}</div>
          <div class="sp-card-footer">
            <div>
              <span class="sp-card-price">&#8377;${displayPrice.toLocaleString("en-IN")}</span>
              ${hasDiscount ? `<span class="sp-card-orig">&#8377;${p.price.toLocaleString("en-IN")}</span><span class="sp-badge-sale">SALE</span>` : ""}
            </div>
            <div class="sp-card-actions">
              <button class="sp-card-add" type="button">Add</button>
              <a class="sp-card-cta" href="${p.product_url}" target="_blank" rel="noopener">View &rarr;</a>
            </div>
          </div>
        </div>`;
      card.querySelector(".sp-card-add").addEventListener("click", () => handleProductSelect(p));
      wrapper.appendChild(card);
    });
    messagesEl.appendChild(wrapper);
    scrollToBottom();
  }

  function setProgress(pct) { if (progressFill) progressFill.style.width = `${pct}%`; }
  function scrollToBottom() { requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }); }

  // ── Init ──────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
