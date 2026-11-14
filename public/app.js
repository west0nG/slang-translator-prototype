"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (iconPaths[name] || "") + "</svg>";
const mark = '<span class="brand-mark">' + icon("pop") + "</span>";
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

function iconButton(action, label, name, extraClass = "") {
  return `<button class="icon-button ${extraClass}" data-action="${action}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
}

const dictionary = {
  cooked: {phrase:"I’m cooked", en:"I’m in serious trouble.", emoji:"🍳", example:"The exam starts in an hour and I just opened the slides. I’m cooked.", pattern:/\bI[’']m cooked\b/gi},
  lockin: {phrase:"lock in", en:"Focus and give it your full attention.", emoji:"🔒", example:"Phone on silent. Time to lock in.", pattern:/\block in\b/gi},
  nocap: {phrase:"no cap", en:"I’m being completely honest.", emoji:"🧢", example:"Those practice questions saved me, no cap.", pattern:/\bno cap\b/gi},
  goated: {phrase:"goated", en:"So good it ranks among the best.", emoji:"🐐", example:"Whoever made that study guide is goated.", pattern:/\bgoated\b/gi},
  clutch: {phrase:"came in clutch", en:"Helped right when it mattered most.", emoji:"🤝", example:"That extra day came in clutch.", pattern:/\bcame in clutch\b/gi},
  bet: {phrase:"bet", en:"Sounds good. I’m in.", emoji:"✅", example:"Coffee after the exam? Bet.", pattern:/\bbet\b/gi}
};
const replies = [
  {id:"alex", name:"Alex Park", handle:"alexafterhours", time:"14m", avatar:"alex", text:"the exam is tomorrow and i just opened the slides. I’m cooked 😭", counts:[8,14,246]},
  {id:"jules", name:"Jules", handle:"julestudies", time:"12m", avatar:"jules", text:"phone is going in a drawer. time to lock in", counts:[3,7,128]},
  {id:"sam", name:"Sam Rivera", handle:"samscribbles", time:"10m", avatar:"sam", text:"those practice questions saved me last semester, no cap", counts:[2,5,94]},
  {id:"nia", name:"Nia Brooks", handle:"notesbynia", time:"8m", avatar:"nia", text:"whoever put the study guide in the group chat is goated 🫶", counts:[4,8,117]},
  {id:"maya", name:"Maya Chen", handle:"mayacreates", time:"5m", avatar:"maya", text:"update: the professor moved the deadline. that extra day came in clutch", counts:[6,12,182]},
  {id:"sam2", name:"Sam Rivera", handle:"samscribbles", time:"3m", avatar:"sam", text:"coffee after we all survive this?", counts:[1,0,26]},
  {id:"jules2", name:"Jules", handle:"julestudies", time:"2m", avatar:"jules", text:"bet. same spot as last week ☕", counts:[0,1,18]}
];
const originalTweet = "finals week setup. 4 assignments, 2 exams, and one very questionable sleep schedule 🫠";
const storageKey = "slangpop.language-book.v1";
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional in a prototype session. */ }
}

function readBook() {
  const source = readStorage(storageKey, {});
  return Object.fromEntries(Object.entries(source || {}).filter(([key, entry]) => Object.hasOwn(dictionary, key) && entry && typeof entry === "object"));
}
let book = readBook();
let enabled = readStorage("slangpop.detection.v1", true) !== false;
let view = "twitter";
let threadMode = "thread";
let deviceChoice = "desktop";
let activeTerm = "";
let selectedAnchor = null;
let islandExpanded = true;
let userReplies = [];
let userTweets = [];
let seen = new Set();
let observer = null;
let detectionTimer;
let toastTimer;
let searchTerm = "";
let filter = "all";
let practice = null;
let modalWord = "";
let replyTarget = "";
const socialState = new Map();
const smallScreen = window.matchMedia("(max-width: 700px)");
const isMobile = () => smallScreen.matches || deviceChoice === "mobile";

function renderIcons(root = document) {
  $$("[data-icon]", root).forEach(node => { node.innerHTML = icon(node.dataset.icon); });
}
function notify(message) {
  const toast = $("#toast");
  toast.innerHTML = icon("check") + "<span>" + escapeHTML(message) + "</span>";
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1550);
}
function highlightText(text) {
  const matches = [];
  for (const [id, word] of Object.entries(dictionary)) {
    for (const match of text.matchAll(word.pattern)) matches.push({id, start:match.index, text:match[0]});
  }
  matches.sort((a, b) => a.start - b.start);
  let cursor = 0;
  let output = "";
  for (const match of matches) {
    if (match.start < cursor) continue;
    output += escapeHTML(text.slice(cursor, match.start));
    output += `<button class="slang" data-term="${match.id}" aria-label="Translate ${escapeHTML(match.text)}">${escapeHTML(match.text)}</button>`;
    cursor = match.start + match.text.length;
  }
  return output + escapeHTML(text.slice(cursor));
}
function picture(name, size = "") {
  return `<img class="avatar ${size}" src="assets/${name}.jpg" alt="">`;
}
function badge() { return '<span class="verified" aria-label="Verified">' + icon("verified") + "</span>"; }
function socialButton(post, action, label, glyph, count) {
  const selected = socialState.get(post + ":" + action) || false;
  const stateClass = selected ? ({like:"liked",repost:"reposted",bookmark:"saved-tweet"}[action] || "") : "";
  const total = typeof count === "number" ? count + (selected ? 1 : 0) : null;
  const number = total === null ? "" : total >= 1000 ? (total/1000).toFixed(1) + "K" : total;
  const toggle = ["like","repost","bookmark"].includes(action) ? ` aria-pressed="${selected}"` : "";
  return `<button class="social-action ${stateClass}" data-post="${post}" data-social="${action}" aria-label="${label}" title="${label}"${toggle}>${icon(glyph)}<span>${number}</span></button>`;
}
function socialBar(post, counts, isMain = false) {
  return '<div class="tweet-actions">' + socialButton(post,"reply","Reply","reply",counts[0]) + socialButton(post,"repost","Retweet","repost",counts[1]) + socialButton(post,"like","Like","heart",counts[2]) + (isMain ? socialButton(post,"bookmark","Bookmark tweet","bookmark") : "") + socialButton(post,"share","Share tweet","share") + "</div>";
}
function replyHtml(post) {
  return `<article class="reply" id="post-${post.id}">${picture(post.avatar)}<div class="reply-body"><div class="reply-heading"><strong>${escapeHTML(post.name)}</strong>${post.id==="maya"?badge():""}<span class="handle">@${escapeHTML(post.handle)}</span><span class="handle">· ${post.time}</span><button class="icon-button more-button" data-menu="${post.id}" aria-label="Tweet options">${icon("more")}</button></div><p class="reply-copy">${highlightText(post.text)}</p>${socialBar(post.id, post.counts)}</div></article>`;
}
function primaryTweet(preview = false) {
  const heading = `<div class="tweet-author">${picture("maya")}<div class="author-names"><strong>Maya Chen ${badge()}</strong><span>@mayacreates</span></div><button class="icon-button more-button" data-menu="main" aria-label="Tweet options">${icon("more")}</button></div>`;
  return `<article class="tweet ${preview?"feed-preview":""}" id="post-main">${heading}<p class="tweet-copy">${originalTweet}</p><img class="tweet-media" src="assets/study-desk.webp" alt="A laptop, handwritten notes and coffee on a student's desk at night" tabindex="0" role="button" aria-label="Enlarge study desk photo"><div class="tweet-meta">10:42 PM <span>·</span> May 5, 2026 <span>·</span> <b>24.8K</b> Views</div>${preview?'<button class="feed-open" data-action="thread">Show this thread</button>':socialBar("main",[38+userReplies.length,126,1800],true)}</article>`;
}
function composer() {
  return `<form class="reply-compose" id="reply-form">${picture("weston")}<input id="reply-input" aria-label="Write a reply" placeholder="Tweet your reply" maxlength="280" autocomplete="off"><button class="reply-send" id="reply-send" disabled>Reply</button></form>`;
}
function renderThread(mode = "thread", query = "") {
  threadMode = mode;
  clearDetection();
  const timeline = $("#timeline");
  $("#thread-title").textContent = mode === "thread" ? "Thread" : mode === "feed" ? "Home" : mode === "bookmarks" ? "Bookmarks" : "Search";
  $("#replay-button").hidden = mode !== "thread";
  if (mode === "thread") {
    timeline.innerHTML = primaryTweet() + '<div class="replies-list">' + [...userReplies, ...replies].map(replyHtml).join("") + '</div>' + composer();
  } else if (mode === "bookmarks") {
    timeline.innerHTML = socialState.get("main:bookmark") ? primaryTweet(true) : '<div class="empty-search">' + icon("bookmark") + '<span>No bookmarked tweets yet</span></div>';
  } else if (mode === "feed") {
    timeline.innerHTML = '<div class="feed-heading">For you</div>' + userTweets.map(replyHtml).join("") + primaryTweet(true);
  } else {
    const q = query.trim().toLowerCase();
    const rootMatch = [originalTweet, "maya chen mayacreates study twitter coffee finals"].join(" ").toLowerCase().includes(q);
    const rows = [...userTweets, ...userReplies, ...replies].filter(row => (row.text + " " + row.handle + " " + row.name).toLowerCase().includes(q));
    timeline.innerHTML = '<div class="feed-heading">' + (query ? "“" + escapeHTML(query) + "”" : "Explore") + "</div>" + (rootMatch ? primaryTweet(true) : "") + rows.map(replyHtml).join("") + (!rows.length && !rootMatch ? '<div class="empty-search"><h2>No results</h2></div>' : "");
  }
  $("#thread-scroller").scrollTop = 0;
  scheduleDetection();
}
function clearDetection() {
  if (observer) observer.disconnect();
  clearTimeout(detectionTimer);
  seen = new Set();
  activeTerm = "";
  selectedAnchor = null;
  $$(".slang").forEach(node => node.classList.remove("selected-slang","detected"));
  renderTranslation();
}
function scheduleDetection() {
  clearTimeout(detectionTimer);
  if (!enabled || view !== "twitter") return;
  detectionTimer = setTimeout(observeWords, 550);
}
function observeWords() {
  if (observer) observer.disconnect();
  if (!enabled || view !== "twitter") return;
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add("detected");
    });
    if ($("#modal").open) return;
    const bounds = $("#thread-scroller").getBoundingClientRect();
    const inView = node => {
      const rect = node.getBoundingClientRect();
      return rect.top >= bounds.top + 48 && rect.bottom <= bounds.bottom + 1;
    };
    if (selectedAnchor && activeTerm && inView(selectedAnchor)) return;
    const target = $$(".slang.detected", $("#timeline")).find(node => !seen.has(node) && inView(node));
    if (target) showTranslation(target);
  }, {root:$("#thread-scroller"),threshold:.86,rootMargin:"-50px 0px 0px 0px"});
  $$(".slang", $("#timeline")).forEach(node => observer.observe(node));
}
function showTranslation(anchor) {
  seen.add(anchor);
  activeTerm = anchor.dataset.term;
  selectedAnchor = anchor;
  islandExpanded = true;
  $$(".slang.selected-slang").forEach(node => node.classList.remove("selected-slang"));
  anchor.classList.add("detected","selected-slang");
  renderTranslation();
}
function setPopupPosition() {
  const popup = $("#translator");
  if (popup.hidden || !selectedAnchor || isMobile()) return;
  if (window.innerWidth < 1001) {
    popup.style.removeProperty("top");
    return;
  }
  const bounds = $("#device").getBoundingClientRect();
  const anchor = selectedAnchor.getBoundingClientRect();
  const preferred = anchor.top - bounds.top - 85;
  popup.style.top = Math.max(16, Math.min(preferred, bounds.height - popup.offsetHeight - 22)) + "px";
}
function renderTranslation() {
  const popup = $("#translator"), island = $("#island");
  const word = dictionary[activeTerm];
  popup.hidden = true;
  island.className = "dynamic-island";
  island.innerHTML = "";
  if (!word || view !== "twitter") return;
  const saved = Object.hasOwn(book, activeTerm);
  const saveLabel = saved ? "Remove from language book" : "Save to language book";
  const saveGlyph = saved ? "bookmarkCheck" : "bookmark";
  if (isMobile()) {
    island.classList.add("active");
    if (!islandExpanded) {
      island.innerHTML = `<button class="island-peek" data-action="expand" aria-label="Expand translation">${mark}<strong>${word.phrase}</strong>${icon("chevron")}</button>`;
      return;
    }
    island.classList.add("expanded");
    island.innerHTML = `<div class="island-top">${mark}${iconButton("collapse","Collapse translation","chevron")}</div><div class="island-main"><div><p class="island-phrase">${word.phrase}</p><p class="island-en">${word.en}</p></div>${iconButton("save",saveLabel,saveGlyph,"island-save" + (saved?" saved":""))}</div><div class="island-actions">${iconButton("book","Open language book","book","book-link")}</div>`;
  } else {
    popup.innerHTML = `<div class="translator-top">${mark}${iconButton("close-popup","Close translation","x")}</div><div class="translation-content"><h2 class="translation-phrase">${word.phrase}</h2><p class="translation-en">${word.en}</p></div><div class="translation-actions">${iconButton("save",saveLabel,saveGlyph,"save-slang" + (saved?" saved":""))}${iconButton("book","Open language book","book","book-link")}</div>`;
    popup.hidden = false;
    setPopupPosition();
  }
}
function updateBookDot() { $(".book-dot").hidden = !Object.keys(book).length; }
function toggleSaved(id) {
  if (!Object.hasOwn(dictionary,id)) return;
  const saved = Object.hasOwn(book, id);
  if (saved) delete book[id];
  else book[id] = {savedAt:Date.now(), learned:false};
  writeStorage(storageKey, book);
  updateBookDot();
  renderTranslation();
  if (view === "book") renderBook();
  notify(saved ? "Removed from language book" : "Saved to language book");
}
function applyDevice() {
  $("#stage").classList.toggle("mobile-mode",isMobile());
  $$("[data-device]").forEach(button => {
    const selected = button.dataset.device === (isMobile() ? "mobile" : "desktop");
    button.classList.toggle("selected",selected);
    button.setAttribute("aria-pressed",String(selected));
  });
  renderTranslation();
  if (view === "twitter") scheduleDetection();
}
function applyPower() {
  const button = $("#power-button");
  button.setAttribute("aria-pressed",String(enabled));
  button.setAttribute("aria-label",enabled ? "Pause automatic detection" : "Resume automatic detection");
  button.title = button.getAttribute("aria-label");
}
function switchView(next, updateHash = true) {
  view = next;
  $("#twitter-view").hidden = next !== "twitter";
  $("#book-view").hidden = next !== "book";
  $("#twitter-button").classList.toggle("selected",next === "twitter");
  $("#book-button").classList.toggle("selected",next === "book");
  $("#twitter-button").setAttribute("aria-pressed",String(next === "twitter"));
  $("#book-button").setAttribute("aria-pressed",String(next === "book"));
  if (updateHash && location.hash !== "#" + next) location.hash = next;
  if (next === "book") {
    observer?.disconnect();
    clearTimeout(detectionTimer);
    renderBook();
  } else {
    practice = null;
    scheduleDetection();
  }
  renderTranslation();
}
function bookEntries() {
  return Object.keys(book).sort((a,b) => book[b].savedAt - book[a].savedAt);
}
function renderBook() {
  if (practice) { renderPractice(); return; }
  const count = Object.keys(book).length;
  $("#book-view").innerHTML = `<div class="book-inner"><div class="book-heading"><h1>Language book <span class="word-count">${count}</span></h1><button class="practice-button" data-action="practice" aria-label="Practice flashcards" title="Practice flashcards" ${count?"":"disabled"}>${icon("cards")}</button></div>${count?`<div class="book-controls"><label class="book-search">${icon("search")}<input id="book-search" placeholder="Search" aria-label="Search saved slang" value="${escapeHTML(searchTerm)}"></label><div class="book-filters"><button class="book-filter ${filter==="all"?"active":""}" data-filter="all">All</button><button class="book-filter ${filter==="learning"?"active":""}" data-filter="learning">Learning</button><button class="book-filter ${filter==="learned"?"active":""}" data-filter="learned">Learned</button></div></div>`:""}<div id="book-grid" class="book-grid"></div></div>`;
  renderWordCards();
}
function renderWordCards() {
  const grid = $("#book-grid");
  const entries = bookEntries().filter(id => {
    const word = dictionary[id];
    const matchesFilter = filter === "all" || (filter === "learned") === Boolean(book[id].learned);
    return matchesFilter && (word.phrase + word.en).toLowerCase().includes(searchTerm.toLowerCase());
  });
  if (!entries.length) {
    grid.innerHTML = Object.keys(book).length ? '<div class="empty-book">' + icon("search") + '<span>No matches</span></div>' : '<div class="empty-book">' + icon("book") + '<span>No saved slang yet</span>' + iconButton("thread","Find slang in thread","arrowRight") + '</div>';
    return;
  }
  grid.innerHTML = entries.map(id => {
    const word = dictionary[id], learned = book[id].learned;
    return `<article class="word-card"><button class="word-card-main" data-word="${id}" aria-label="Review ${word.phrase}"><span class="word-emoji">${word.emoji}</span><h2>${word.phrase}</h2><p class="word-translation">${word.en}</p></button><div class="word-card-footer"><button class="icon-button ${learned?"learned-mark":""}" data-learned="${id}" aria-label="${learned?"Mark as learning":"Mark as learned"}" aria-pressed="${Boolean(learned)}" title="${learned?"Mark as learning":"Mark as learned"}">${icon(learned?"checkCircle":"check")}</button></div></article>`;
  }).join("");
}
function startPractice() {
  const ids = bookEntries().filter(id => filter==="all" || (filter==="learned")===Boolean(book[id].learned));
  if (!ids.length) { notify("No cards in this set"); return; }
  practice = {ids, index:0, flipped:false};
  renderPractice();
}
function renderPractice() {
  const {ids,index,flipped} = practice;
  const header = `<div class="practice-heading">${iconButton("end-practice","Back to language book","arrowLeft")}<div class="practice-progress"><div style="width:${Math.round(index/ids.length*100)}%"></div></div><span class="practice-count">${Math.min(index+1,ids.length)} / ${ids.length}</span></div>`;
  if (index >= ids.length) {
    $("#book-view").innerHTML = `<div class="practice-area">${header}<div class="practice-done"><div class="done-icon">${icon("check")}</div><h2>Practice complete</h2><div class="done-actions">${iconButton("end-practice","Back to language book","book")}${iconButton("practice","Practice again","rotate")}</div></div></div>`;
    return;
  }
  const word = dictionary[ids[index]];
  $("#book-view").innerHTML = `<div class="practice-area">${header}<button class="flashcard" data-action="flip" aria-label="Flip flashcard" aria-pressed="${flipped}"><span class="word-emoji">${word.emoji}</span><h2>${word.phrase}</h2>${flipped?`<p class="flashcard-en">${word.en}</p>`:'<span class="flip-cue">' + icon("flip") + '</span>'}</button><div class="practice-actions">${flipped?iconButton("again","Keep learning","rotate","again-button") + iconButton("known","Mark as learned","check","known-button"):iconButton("flip","Reveal meaning","eye")}</div></div>`;
}
function gradeCard(learned) {
  if (!practice || !practice.flipped || practice.index >= practice.ids.length) return;
  const id = practice.ids[practice.index];
  if (book[id]) book[id].learned = learned;
  writeStorage(storageKey, book);
  practice.index++;
  practice.flipped = false;
  renderPractice();
}
function showModal(title, body, variant = "") {
  const dialog = $("#modal");
  dialog.className = "app-modal " + variant;
  $("#modal-content").innerHTML = iconButton("close-modal","Close","x","modal-close") + (title ? `<h2 class="modal-title">${escapeHTML(title)}</h2>` : "") + body;
  dialog.setAttribute("aria-label",title || "Study desk photo");
  if (!dialog.open) dialog.showModal();
}
function wordDetail(id) {
  modalWord = id;
  const word = dictionary[id];
  showModal(word.phrase,`<div class="detail-emoji">${word.emoji}</div><p class="word-detail-en">${word.en}</p><blockquote class="word-example">${word.example}</blockquote><div class="word-detail-actions">${iconButton("delete-word","Remove from language book","trash","delete-word")}</div>`);
}
function openCompose(target = "") {
  replyTarget = target;
  const reply = replies.find(post => post.id === target) || userReplies.find(post => post.id === target);
  const to = target && target !== "main" && reply ? "@" + reply.handle + " " : "";
  showModal(target?"Reply":"New Tweet",`<form id="compose-form"><textarea class="modal-tweet-input" id="compose-text" aria-label="Tweet text" maxlength="280" placeholder="${target?"Tweet your reply":"What’s happening?"}">${escapeHTML(to)}</textarea><div class="modal-bottom"><button class="reply-send" ${to?"":"disabled"}>${target?"Reply":"Tweet"}</button></div></form>`);
  $("#compose-text").focus();
  $("#compose-text").setSelectionRange(to.length,to.length);
}
function addPost(text, reply) {
  const row = {id:"local-" + Date.now().toString(36),name:"Weston",handle:"weston",avatar:"weston",time:"now",text,counts:[0,0,0]};
  if (reply) userReplies.unshift(row); else userTweets.unshift(row);
  renderThread(reply?"thread":"feed");
  $("#post-" + row.id)?.scrollIntoView({block:"nearest"});
}
function runSearch(query) {
  $("#modal").close();
  switchView("twitter");
  $("#twitter-search").value = query;
  renderThread("search",query);
}
function twitterNav(name) {
  if (name === "home") { switchView("twitter"); renderThread("feed"); }
  if (name === "bookmarks") { switchView("twitter"); renderThread("bookmarks"); }
  if (name === "explore") {
    showModal("Explore",`<form id="search-form"><label class="twitter-search">${icon("search")}<input id="explore-search" aria-label="Search Twitter" placeholder="Search Twitter" autofocus></label></form><div class="modal-list"><button class="trend" data-search="finals"><strong>#FinalsWeek</strong></button><button class="trend" data-search="coffee"><strong>Coffee</strong></button></div>`);
  }
  if (name === "notifications") showModal("Notifications",`<div class="modal-list-row">${picture("maya")}<p><b>Maya Chen</b> posted a thread.</p>${iconButton("thread","Open thread","arrowRight")}</div>`);
  if (name === "messages") showModal("Messages",'<div class="empty-search">' + icon("mail") + '<span>No messages yet</span></div>');
  if (name === "profile") showModal("Profile",`<div class="profile-hero"></div>${picture("weston","profile-avatar")}<div class="profile-info"><h2>Weston</h2><p>@weston</p><div class="profile-stats"><span><b>${userTweets.length}</b> Tweets</span><span><b>${userReplies.length}</b> Replies</span></div></div>`);
  if (name === "more") showModal("More",`<div class="modal-list"><button class="modal-list-row" data-action="book">${icon("book")} Language book</button><button class="modal-list-row" data-action="replay">${icon("rotate")} Replay detection</button></div>`);
}
function replay() {
  $("#modal").close();
  switchView("twitter");
  renderThread("thread");
  if (!enabled) { enabled=true; writeStorage("slangpop.detection.v1",true); applyPower(); }
  const anchor = $('.slang[data-term="cooked"]');
  if (anchor) {
    const scroller = $("#thread-scroller");
    const bottom = scroller.getBoundingClientRect().bottom;
    const rect = anchor.getBoundingClientRect();
    if (rect.bottom > bottom - 35) scroller.scrollTop += rect.bottom - bottom + 80;
  }
  scheduleDetection();
}
function closeTranslation() {
  if (isMobile()) { islandExpanded = false; }
  else { activeTerm = ""; selectedAnchor?.classList.remove("selected-slang"); selectedAnchor = null; }
  renderTranslation();
}
function handleAction(name) {
  switch(name) {
    case "close-modal": $("#modal").close(); break;
    case "thread": $("#modal").close(); switchView("twitter"); renderThread("thread"); break;
    case "replay": replay(); break;
    case "close-popup": case "collapse": closeTranslation(); break;
    case "expand": islandExpanded = true; renderTranslation(); break;
    case "save": toggleSaved(activeTerm); break;
    case "book": $("#modal").close(); switchView("book"); break;
    case "practice": startPractice(); break;
    case "end-practice": practice = null; renderBook(); break;
    case "flip": if (practice) { practice.flipped = !practice.flipped; renderPractice(); } break;
    case "again": gradeCard(false); break;
    case "known": gradeCard(true); break;
    case "delete-word": if (book[modalWord]) { toggleSaved(modalWord); $("#modal").close(); } break;
  }
}
function toggleTweetAction(button) {
  const {post,social} = button.dataset;
  if (social === "reply") {openCompose(post);return;}
  if (social === "share") {
    showModal("Share tweet",`<div class="word-example">${escapeHTML(post === "main" ? originalTweet : ([...replies,...userReplies,...userTweets].find(p=>p.id===post)?.text || ""))}</div><button class="modal-list-row" data-copy="${post}">${icon("link")} Copy link</button>`);
    return;
  }
  const key = post + ":" + social;
  socialState.set(key,!socialState.get(key));
  const data = [...replies,...userReplies,...userTweets].find(p => p.id === post);
  const counts = post === "main" ? [38+userReplies.length,126,1800] : data?.counts || [0,0,0];
  button.closest(".tweet-actions").outerHTML = socialBar(post,counts,post === "main");
  if (social === "bookmark") notify(socialState.get(key)?"Tweet bookmarked":"Bookmark removed");
}

document.addEventListener("click", async event => {
  const button = event.target.closest("button, a, .tweet-media");
  if (!button) return;
  const d = button.dataset;
  if (button.classList.contains("tweet-media")) {showModal("",'<img src="assets/study-desk.webp" alt="Study desk at night">',"photo-modal");return;}
  if (button.matches('a[href="#twitter"]')) { event.preventDefault();switchView("twitter");renderThread("thread");return; }
  if (d.device) {deviceChoice = d.device;applyDevice();return;}
  if (d.view) {switchView(d.view);return;}
  if (d.term) {showTranslation(button);return;}
  if (d.action) {handleAction(d.action);return;}
  if (d.twitterNav) {twitterNav(d.twitterNav);return;}
  if (d.social) {toggleTweetAction(button);return;}
  if (d.search) {runSearch(d.search);return;}
  if (d.follow) {
    const following = button.classList.toggle("following");
    button.textContent = following?"Following":"Follow";
    button.setAttribute("aria-pressed",String(following));
    return;
  }
  if (d.menu) {
    showModal("Tweet options",`<div class="modal-list"><button class="modal-list-row" data-copy="${d.menu}">${icon("link")} Copy link</button><button class="modal-list-row" data-menu-reply="${d.menu}">${icon("reply")} Reply</button></div>`);
    return;
  }
  if (d.menuReply) {openCompose(d.menuReply);return;}
  if (d.copy) {
    const url = new URL(location.href);
    url.hash = "post-" + d.copy;
    try {await navigator.clipboard.writeText(url.href);$("#modal").close();notify("Link copied");}
    catch {showModal("Tweet link",`<input style="width:100%" readonly aria-label="Tweet link" value="${escapeHTML(url.href)}">`);$("#modal input").select();}
    return;
  }
  if (d.filter) {filter=d.filter;renderBook();return;}
  if (d.word) {wordDetail(d.word);return;}
  if (d.learned && book[d.learned]) {
    book[d.learned].learned=!book[d.learned].learned;
    writeStorage(storageKey,book);renderBook();return;
  }
  if (button.id==="power-button") {
    enabled=!enabled;writeStorage("slangpop.detection.v1",enabled);applyPower();clearDetection();scheduleDetection();return;
  }
  if (button.id==="compose-button") {openCompose();return;}
  if (button.id==="replay-button") {replay();return;}
  if (button.id==="thread-back") {renderThread(threadMode==="thread"?"feed":"thread");}
});
document.addEventListener("input",event=>{
  if(event.target.id==="reply-input") $("#reply-send").disabled=!event.target.value.trim();
  if(event.target.id==="compose-text") $("#compose-form .reply-send").disabled=!event.target.value.trim();
  if(event.target.id==="book-search"){searchTerm=event.target.value;renderWordCards();}
});
document.addEventListener("submit",event=>{
  if(!["reply-form","compose-form","search-form"].includes(event.target.id)) return;
  event.preventDefault();
  if(event.target.id==="search-form"){runSearch($("#explore-search").value.trim());return;}
  const inModal=event.target.id==="compose-form";
  const text=(inModal?$("#compose-text"):$("#reply-input")).value.trim();
  if(!text)return;
  if(inModal)$("#modal").close();
  addPost(text,inModal?Boolean(replyTarget):true);
});
document.addEventListener("keydown",event=>{
  if(event.key==="Enter" && event.target.id==="twitter-search") runSearch(event.target.value.trim());
  if((event.key==="Enter" || event.key===" ") && event.target.classList.contains("tweet-media")){event.preventDefault();event.target.click();}
  if(event.key==="Escape" && !$("#modal").open && activeTerm) closeTranslation();
});
$("#modal").addEventListener("click",event=>{if(event.target===$("#modal")){const r=$("#modal").getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$("#modal").close();}});
$("#modal").addEventListener("close",()=>{modalWord="";});
$("#thread-scroller").addEventListener("scroll",setPopupPosition,{passive:true});
window.addEventListener("resize",setPopupPosition);
smallScreen.addEventListener("change",applyDevice);
window.addEventListener("storage",event=>{if(event.key===storageKey){book=readBook();updateBookDot();if(view==="book"){practice=null;renderBook();}renderTranslation();}});
function readRoute() {
  const hash=location.hash.slice(1);
  if(hash==="book"){if(view!=="book")switchView("book",false);return;}
  if(view!=="twitter")switchView("twitter",false);
  if(hash.startsWith("post-")){
    renderThread("thread");
    const post=document.getElementById(hash);
    if(post)post.scrollIntoView({block:"center"});
  }
}
window.addEventListener("hashchange",readRoute);
renderIcons();
$$(".icon-button[aria-label], .power-button, .nav-item, .practice-button").forEach(node=>{if(!node.title)node.title=node.getAttribute("aria-label");});
applyDevice();applyPower();updateBookDot();renderThread();readRoute();
