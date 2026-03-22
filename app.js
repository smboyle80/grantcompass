var saved = [];
try { saved = JSON.parse(localStorage.getItem('gc_saved') || '[]'); } catch(e) {}

var grantStore = {};
var scanSecs = 0;
var scanTimer = null;

function switchTab(tab) {
  var radio = document.getElementById('t-' + tab);
  if (radio) radio.checked = true;
  if (tab === 'saved') renderSaved();
}

document.addEventListener('DOMContentLoaded', function() {
  var savedRadio = document.getElementById('t-saved');
  if (savedRadio) savedRadio.addEventListener('change', function() { if (this.checked) renderSaved(); });
});

function callClaude(prompt) {
  return fetch('/api/claude', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2000,messages:[{role:'user',content:prompt}]})
  }).then(function(r) {
    if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || 'Claude error'); });
    return r.json();
  }).then(function(d) {
    return d.content.map(function(b) { return b.text || ''; }).join('');
  });
}

function pj(text) {
  var clean = text.replace(/```json|```/gi,'').trim();
  var fb = clean.indexOf('{'), fbk = clean.indexOf('[');
  var start = fb === -1 ? fbk : fbk === -1 ? fb : Math.min(fb,fbk);
  if (start === -1) throw new Error('No JSON in response');
  var isArr = fbk !== -1 && (fb === -1 || fbk < fb);
  var end = isArr ? clean.lastIndexOf(']') : clean.lastIndexOf('}');
  if (end === -1) throw new Error('Incomplete JSON');
  return JSON.parse(clean.slice(start, end+1));
}

function errMsg(d) {
  if (!d) return 'Unknown error';
  if (typeof d.error === 'string') return d.error;
  if (typeof d.error === 'object') return JSON.stringify(d.error);
  return JSON.stringify(d);
}

function startRun(endpoint, body) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (!d.runId) throw new Error('Failed to start: ' + errMsg(d));
    return d.runId;
  });
}

function pollUntilDone(runId, max) {
  var attempts = 0;
  function poll() {
    if (attempts >= max) return Promise.resolve(null);
    attempts++;
    return new Promise(function(res) { setTimeout(res, 5000); }).then(function() {
      return fetch('/api/scan-status?runId=' + encodeURIComponent(runId)).then(function(r) { return r.json(); });
    }).then(function(d) {
      if (d.error) throw new Error(errMsg(d));
      if (d.status === 'complete') return d.result;
      if (d.status === 'failed') throw new Error('Run failed. Please try again.');
      return poll();
    });
  }
  return poll();
}

function updateBadge() {
  var b = document.getElementById('sbadge');
  b.style.display = saved.length ? 'inline' : 'none';
  b.textContent = saved.length;
}

function savegrant(g) {
  if (saved.find(function(s) { return s.name === (g.grant_name || g.name); })) return false;
  var item = {
    name: g.grant_name || g.name || '',
    funder: g.funder || '',
    amount: g.amount || '',
    deadline: g.deadline || g.deadline_date || '',
    url: g.url || '',
    savedAt: new Date().toLocaleDateString()
  };
  saved.push(item);
  try { localStorage.setItem('gc_saved', JSON.stringify(saved)); } catch(e) {}
  updateBadge();
  return true;
}

function handleSave(uid) {
  var g = grantStore[uid];
  var btn = document.getElementById('sb-'+uid);
  if (!g || !btn) return;
  var ok = savegrant(g);
  btn.outerHTML = ok ? '<span class="saved-ok">Saved</span>' : '<span class="saved-ok">Already saved</span>';
}

function renderSaved() {
  var el = document.getElementById('saved-list');
  if (!saved.length) {
    el.innerHTML = '<div class="empty">No saved grants yet.</div>';
    return;
  }
  var html = '<div class="card">';
  saved.forEach(function(g, i) {
    var sq = encodeURIComponent('"' + (g.funder||'') + '" "' + (g.name||'') + '" grant');
    var link = g.url
      ? '<a href="' + g.url + '" target="_blank" class="btn bg" style="font-size:12px;padding:5px 10px;text-decoration:none">View</a>'
      : '<a href="https://www.google.com/search?q=' + sq + '" target="_blank" class="btn bg" style="font-size:12px;padding:5px 10px;text-decoration:none">Search</a>';
    html += '<div class="svr"><div class="svi"><div class="svn">' + (g.name||'') + '</div><div class="svm">' + (g.funder||'') + ' &middot; ' + (g.amount||'') + ' &middot; Due: ' + (g.deadline||'Check funder') + ' &middot; Saved ' + (g.savedAt||'') + '</div></div><div style="display:flex;gap:6px;flex-shrink:0">' + link + '<button class="btn bd" style="font-size:12px;padding:5px 10px" onclick="removeSaved(' + i + ')">Remove</button></div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function removeSaved(i) {
  saved.splice(i,1);
  try { localStorage.setItem('gc_saved', JSON.stringify(saved)); } catch(e) {}
  updateBadge();
  renderSaved();
}

function clearAllSaved() {
  if (!saved.length) return;
  if (!confirm('Remove all saved grants?')) return;
  saved = [];
  try { localStorage.removeItem('gc_saved'); } catch(e) {}
  updateBadge();
  renderSaved();
}

function gwCard(g) {
  var uid = 'g' + Math.random().toString(36).slice(2,8);
  grantStore[uid] = g;
  var hi = (g.match||'').toLowerCase().indexOf('strong') !== -1;
  var name = g.grant_name || g.name || 'Unnamed';
  var funder = g.funder || g.funder_organization || '';
  var amount = g.amount || g.award_amount || 'See listing';
  var deadline = g.deadline || g.deadline_date || 'See listing';
  var desc = g.description || '';
  var why = g.why || '';
  var url = g.url || '';
  var sq = encodeURIComponent('"' + funder + '" "' + name + '" grant application');
  var link = url
    ? '<a href="' + url + '" target="_blank" class="btn bg" style="font-size:12px;padding:5px 12px;text-decoration:none;color:var(--inf)">View on GrantWatch</a>'
    : '<a href="https://www.google.com/search?q=' + sq + '" target="_blank" class="btn bg" style="font-size:12px;padding:5px 12px;text-decoration:none">Find application</a>';
  var whyHtml = why ? '<div style="font-size:12px;color:var(--s);margin-bottom:10px;padding:6px 10px;background:var(--bgs);border-radius:var(--r)">Why this matches: ' + why + '</div>' : '';
  return '<div class="card"><div class="rh"><div class="gn">' + name + '</div><span class="badge ' + (hi ? 'bhi' : 'bme') + '">' + (g.match||'Good match') + '</span></div><div class="meta"><span>' + funder + '</span><span>&middot;</span><span>' + amount + '</span><span>&middot;</span><span style="color:var(--d);font-weight:500">Due: ' + deadline + '</span></div><div class="desc">' + desc + '</div>' + whyHtml + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn bg" id="sb-' + uid + '" style="font-size:12px;padding:5px 12px" onclick="handleSave(\'' + uid + '\')">Save grant</button>' + link + '</div></div>';
}

function setStep(n, state) {
  var el = document.getElementById('si'+n);
  if (!el) return;
  el.className = 'si s' + state.charAt(0);
  el.textContent = state === 'done' ? '✓' : state === 'active' ? '●' : String(n);
}

function clearDiscover() {
  ['org-name','geo','mission'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('focus-area').value = '';
  document.getElementById('budget').value = '';
  document.getElementById('mc').textContent = '(0/400)';
  document.getElementById('disc-res').innerHTML = '';
}

function clearReview() {
  ['grant-target','proposal'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('wc').textContent = '(0 words)';
  document.getElementById('rev-res').innerHTML = '';
  document.getElementById('dlabel').textContent = 'Upload PDF or TXT proposal -- or drag and drop';
  document.getElementById('fdrop').className = 'fdrop';
}

function clearChecklist() {
  document.getElementById('cl-grant').value = '';
  document.getElementById('cl-desc').value = '';
  document.getElementById('cl-res').innerHTML = '';
}

function updateWC(el) {
  var w = el.value.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('wc').textContent = '(' + w + ' words)';
}

function findGrants() {
  var org = document.getElementById('org-name').value.trim();
  var focus = document.getElementById('focus-area').value;
  var budget = document.getElementById('budget').value;
  var geo = document.getElementById('geo').value.trim();
  var mission = document.getElementById('mission').value.trim();
  if (!focus && !mission) { document.getElementById('disc-res').innerHTML = '<div class="empty">Please select a focus area or enter your mission.</div>'; return; }
  var btn = document.getElementById('disc-btn'); btn.disabled = true;
  document.getElementById('disc-res').innerHTML = '<div class="loading"><span class="dot">Searching GrantWatch for current opportunities</span></div>';
  var orgProfile = (org ? 'Organization: ' + org + '\n' : '') + (focus ? 'Focus: ' + focus + '\n' : '') + (budget ? 'Budget: ' + budget + '\n' : '') + (geo ? 'State: ' + geo + '\n' : '') + (mission ? 'Mission: ' + mission : '');
  startRun('/api/search-grants', {category: focus || mission, state: geo, orgProfile: orgProfile}).then(function(runId) {
    return pollUntilDone(runId, 96);
  }).then(function(result) {
    if (!result) throw new Error('Search timed out. Please try again.');
    var raw = typeof result === 'string' ? result : JSON.stringify(result);
    var grants = pj(raw);
    if (!Array.isArray(grants)) grants = grants.grants || grants.data || Object.values(grants);
    var today = new Date().toISOString().split('T')[0];
    return callClaude('Today is ' + today + '. Nonprofit: ' + orgProfile + '\n\nReal grants from GrantWatch:\n' + JSON.stringify(grants,null,2).slice(0,3000) + '\n\nAdd "match" ("Strong match" or "Good match") and "why" (1 sentence why this org qualifies) to each grant object. Return same JSON array with these two fields added. Keep all original fields. Return ONLY raw JSON array starting with [.').then(function(text) {
      var ranked = pj(text);
      var html = '<div class="sh"><span class="st">Current grants from GrantWatch</span><span class="cc">' + ranked.length + ' found</span></div><p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Live results with verified deadlines.</p>';
      ranked.forEach(function(g) { html += gwCard(g); });
      document.getElementById('disc-res').innerHTML = html;
    });
  }).catch(function(e) {
    document.getElementById('disc-res').innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }).finally(function() { btn.disabled = false; });
}

function scanWebsite() {
  var url = document.getElementById('scan-url').value.trim();
  if (!url) { document.getElementById('scan-res').innerHTML = '<div class="empty">Please enter your organization website URL.</div>'; return; }
  var btn = document.getElementById('scan-btn'); btn.disabled = true;
  document.getElementById('scan-res').innerHTML = '';
  [1,2,3,4].forEach(function(n) { setStep(n,'pending'); });
  document.getElementById('scan-prog').className = 'prog on';
  scanSecs = 0; document.getElementById('scan-timer').textContent = '0s';
  clearInterval(scanTimer);
  scanTimer = setInterval(function() { scanSecs++; document.getElementById('scan-timer').textContent = scanSecs + 's'; }, 1000);

  setStep(1,'active');
  var scanRunId, searchRunId, orgProfile;

  fetch('/api/scan-and-search', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({phase:'start', url:url})
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.error) throw new Error(errMsg(d));
    scanRunId = d.scanRunId;
    searchRunId = d.searchRunId;
    setStep(1,'done'); setStep(2,'active');

    var scanDone = false, searchDone = false;
    var scanResult = null, searchResult = null;

    function pollBoth() {
      var ps = [];
      if (!scanDone) ps.push(
        fetch('/api/scan-status?runId=' + encodeURIComponent(scanRunId)).then(function(r){return r.json();}).then(function(d) {
          if (d.status === 'complete') { scanResult = d.result; scanDone = true; setStep(2,'done'); setStep(3,'active'); }
          else if (d.status === 'failed') scanDone = true;
        }).catch(function(){scanDone=true;})
      );
      if (!searchDone) ps.push(
        fetch('/api/scan-status?runId=' + encodeURIComponent(searchRunId)).then(function(r){return r.json();}).then(function(d) {
          if (d.status === 'complete') { searchResult = d.result; searchDone = true; }
          else if (d.status === 'failed') searchDone = true;
        }).catch(function(){searchDone=true;})
      );
      return Promise.all(ps).then(function() {
        if (scanDone && searchDone) return;
        return new Promise(function(res){setTimeout(res,5000);}).then(pollBoth);
      });
    }

    var timeoutId;
    var timeoutP = new Promise(function(_,reject) {
      timeoutId = setTimeout(function() { reject(new Error('Scan timed out. Please try again.')); }, 480000);
    });
    return Promise.race([pollBoth().then(function(){clearTimeout(timeoutId);}), timeoutP]);

  }).then(function() {
    if (scanResult) {
      var orgData = scanResult;
      try { if (typeof scanResult === 'string') orgData = pj(scanResult); } catch(e) {}
      orgProfile = typeof orgData === 'string' ? orgData : JSON.stringify(orgData,null,2);
      document.getElementById('scan-res').innerHTML = '<div class="card" style="margin-bottom:12px"><div class="st" style="margin-bottom:6px">Organization identified</div><pre style="font-size:12px;color:var(--tx2);white-space:pre-wrap;line-height:1.5">' + orgProfile.slice(0,500) + (orgProfile.length > 500 ? '...' : '') + '</pre></div><div class="loading"><span class="dot">Matching grants to your organization</span></div>';
    }
    var orgText = (orgProfile || '').toLowerCase();
    var stateMatch = orgText.match(/(arizona|california|texas|florida|new york|colorado|washington|oregon|illinois|georgia|ohio|pennsylvania|michigan)/);
    var detectedState = stateMatch ? stateMatch[1] : '';
    var km = [['disability','disability'],['intellectual','disability'],['developmental','disability'],['food','food'],['hunger','food'],['housing','housing'],['homeless','housing'],['youth','youth'],['children','youth'],['education','education'],['health','health'],['mental health','mental health'],['environment','environment'],['veteran','veterans'],['refugee','refugee'],['arts','arts'],['workforce','workforce'],['animal','animal welfare']];
    var kw = 'nonprofit';
    for (var i = 0; i < km.length; i++) { if (orgText.indexOf(km[i][0]) !== -1) { kw = km[i][1]; break; } }

    if (searchResult) { setStep(3,'done'); return {result:searchResult}; }

    setStep(3,'active');
    return fetch('/api/scan-and-search', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({phase:'search', keyword:kw, state:detectedState})
    }).then(function(r){return r.json();}).then(function(d) {
      if (d.error) throw new Error(errMsg(d));
      return pollUntilDone(d.runId, 96);
    }).then(function(result) { return {result:result}; });

  }).then(function(obj) {
    if (!obj || !obj.result) throw new Error('Could not retrieve grants. Please try again.');
    setStep(3,'done'); setStep(4,'active');
    var raw = typeof obj.result === 'string' ? obj.result : JSON.stringify(obj.result);
    var grants = pj(raw);
    if (!Array.isArray(grants)) grants = grants.grants || grants.data || Object.values(grants);
    var today = new Date().toISOString().split('T')[0];
    var ctx = orgProfile ? orgProfile.slice(0,800) : 'Organization from: ' + url;
    return callClaude('Today is ' + today + '. Nonprofit: ' + ctx + '

Real grants from GrantWatch:
' + JSON.stringify(grants,null,2).slice(0,3000) + '

Add "match" ("Strong match" or "Good match") and "why" (1 sentence) to each grant. Return same JSON array. Return ONLY raw JSON array starting with [.').then(function(text) {
      var ranked = pj(text);
      setStep(4,'done'); clearInterval(scanTimer);
      var html = '<div class="sh"><span class="st">Current grants from GrantWatch</span><span class="cc">' + ranked.length + ' found</span></div><p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Live results matched to your organization.</p>';
      ranked.forEach(function(g) { html += gwCard(g); });
      document.getElementById('scan-res').innerHTML = html;
    });
  }).catch(function(e) {
    clearInterval(scanTimer);
    [1,2,3,4].forEach(function(n) { setStep(n,'pending'); });
    document.getElementById('scan-res').innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }).finally(function() {
    document.getElementById('scan-prog').className = 'prog';
    btn.disabled = false;
  });
}

function reviewWriting() {
  var proposal = document.getElementById('proposal').value.trim();
  var target = document.getElementById('grant-target').value.trim();
  if (!proposal || proposal.split(/\s+/).length < 15) { document.getElementById('rev-res').innerHTML = '<div class="empty">Please paste your grant proposal (at least 15 words).</div>'; return; }
  var btn = document.getElementById('rev-btn'); btn.disabled = true;
  document.getElementById('rev-res').innerHTML = '<div class="loading"><span class="dot">Analyzing your proposal</span></div>';
  callClaude('Expert nonprofit grant writer. Review this proposal' + (target ? ' for ' + target : '') + '.\n\nPROPOSAL:\n' + proposal + '\n\nReturn JSON: { overallScore (0-100), clarity (0-100), impact (0-100), specificity (0-100), feedback: array of 6 (type:"strength"|"improvement"|"missing", title:5-7 words, detail:2-3 sentences), suggestedRevision: one sentence rewritten }. Return ONLY raw JSON starting with {.').then(function(text) {
    var r = pj(text);
    var score = Math.round(r.overallScore)||0;
    var cl = Math.round(r.clarity)||0, imp = Math.round(r.impact)||0, sp = Math.round(r.specificity)||0;
    var sc = score>=75?'var(--s)':score>=50?'var(--w)':'var(--d)';
    var html = '<div class="rs"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><span class="st">Overall score</span><span style="font-size:26px;font-weight:500;color:'+sc+'">'+score+'<span style="font-size:13px;color:var(--tx2)">/100</span></span></div>';
    html += '<div class="sb"><div class="sbl"><span>Clarity</span><span>'+cl+'%</span></div><div class="sbt"><div class="sbf" style="width:'+cl+'%"></div></div></div>';
    html += '<div class="sb"><div class="sbl"><span>Impact</span><span>'+imp+'%</span></div><div class="sbt"><div class="sbf" style="width:'+imp+'%;background:var(--inf)"></div></div></div>';
    html += '<div class="sb"><div class="sbl"><span>Specificity</span><span>'+sp+'%</span></div><div class="sbt"><div class="sbf" style="width:'+sp+'%;background:var(--w)"></div></div></div></div>';
    if (r.suggestedRevision) html += '<div class="rs" style="border-left:2px solid var(--bs);border-radius:0 var(--rl) var(--rl) 0"><div class="st" style="margin-bottom:6px">Suggested revision</div><p style="font-size:13px;line-height:1.65;color:var(--tx2)">'+r.suggestedRevision+'</p></div>';
    var tc = {strength:'ts',improvement:'ti',missing:'tm'};
    var tl = {strength:'Strength',improvement:'Needs improvement',missing:'Missing element'};
    (r.feedback||[]).forEach(function(f) {
      html += '<div class="rs"><span class="rtag '+(tc[f.type]||'ti')+'">'+(tl[f.type]||f.type)+'</span><div class="rtitle">'+f.title+'</div><div class="rbody">'+f.detail+'</div></div>';
    });
    document.getElementById('rev-res').innerHTML = html;
  }).catch(function(e) {
    document.getElementById('rev-res').innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }).finally(function() { btn.disabled = false; });
}

function buildChecklist() {
  var grant = document.getElementById('cl-grant').value.trim();
  var desc = document.getElementById('cl-desc').value.trim();
  if (!grant && !desc) { document.getElementById('cl-res').innerHTML = '<div class="empty">Please enter a grant name or project description.</div>'; return; }
  var btn = document.getElementById('cl-btn'); btn.disabled = true;
  document.getElementById('cl-res').innerHTML = '<div class="loading"><span class="dot">Building your checklist</span></div>';
  callClaude('Nonprofit grants manager. Build a pre-submission checklist.\n\nGrant: '+(grant||'General foundation grant')+'\nProject: '+(desc||'Not specified')+'\n\nReturn JSON: { categories: [ { category, items: [ { task, detail (15-20 words), priority:"high"|"medium"|"low" } ] } ] }. 4-5 categories, 3-5 items each. Return ONLY raw JSON starting with {.').then(function(text) {
    var result = pj(text);
    var html = '';
    (result.categories||[]).forEach(function(cat) {
      html += '<div class="card" style="margin-bottom:10px"><div class="st" style="margin-bottom:8px">'+cat.category+'</div>';
      (cat.items||[]).forEach(function(item) {
        var pid = 'ck'+Math.random().toString(36).slice(2,8);
        html += '<div class="cl-item"><input type="checkbox" id="'+pid+'" style="width:16px;height:16px;cursor:pointer;flex-shrink:0;margin-top:3px" onchange="document.getElementById(\'lbl-'+pid+'\').style.textDecoration=this.checked?\'line-through\':\'none\'"/><div class="cl-tx"><div class="cl-t" id="lbl-'+pid+'">'+item.task+'</div><div class="cl-s">'+item.detail+'</div></div><span class="pb '+(item.priority==='high'?'ph':item.priority==='medium'?'pm':'pl')+'">'+item.priority+'</span></div>';
      });
      html += '</div>';
    });
    document.getElementById('cl-res').innerHTML = html;
  }).catch(function(e) {
    document.getElementById('cl-res').innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }).finally(function() { btn.disabled = false; });
}

function handlePdfFile(input) {
  var file = input.files[0];
  if (!file) return;
  var drop = document.getElementById('fdrop');
  var label = document.getElementById('dlabel');
  label.textContent = 'Reading ' + file.name + '...';
  if (file.name.endsWith('.txt')) {
    file.text().then(function(text) {
      document.getElementById('proposal').value = text.slice(0,8000);
      updateWC(document.getElementById('proposal'));
      label.textContent = file.name + ' loaded';
      drop.className = 'fdrop loaded';
    });
    return;
  }
  if (typeof pdfjsLib === 'undefined') { label.textContent = 'PDF library not loaded -- paste text manually.'; return; }
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  file.arrayBuffer().then(function(ab) { return pdfjsLib.getDocument({data:ab}).promise; }).then(function(pdf) {
    var pages = [];
    for (var i = 1; i <= Math.min(pdf.numPages,10); i++) pages.push(i);
    return Promise.all(pages.map(function(n) { return pdf.getPage(n).then(function(p) { return p.getTextContent(); }).then(function(c) { return c.items.map(function(x){return x.str;}).join(' '); }); })).then(function(texts) {
      document.getElementById('proposal').value = texts.join('\n').slice(0,8000);
      updateWC(document.getElementById('proposal'));
      label.textContent = file.name + ' loaded (' + pdf.numPages + ' pages)';
      drop.className = 'fdrop loaded';
    });
  }).catch(function() { label.textContent = 'Could not read PDF -- please paste text manually.'; });
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('fdrop').style.background = '';
  var file = e.dataTransfer.files[0];
  if (file) { var dt = new DataTransfer(); dt.items.add(file); document.getElementById('finput').files = dt.files; handlePdfFile(document.getElementById('finput')); }
}

updateBadge();