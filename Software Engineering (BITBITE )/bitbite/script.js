// ─── STATE ───
var ACCOUNTS = {}; // email -> {password, profile}
var SESSION = null; // current user email
var U = {}; // current user profile
var OB_STEP = 0;
var CHARTS = {};
var FOOD_LOG = [];
var WEIGHT_LOG = [];
var WATER_CUPS = 0;
var STREAK = 7;
async function api(action, data = null) {
  const options = {
    method: data ? "POST" : "GET",
    headers: {}
  };

  if (data) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }

  const res = await fetch("backend.php?action=" + action, options);
  const out = await res.json();

  if (!out.success) {
    throw new Error(out.message || "Something went wrong");
  }

  return out;
}

function applyBackendData(data) {
  if (data.user) {
    SESSION = data.user.email;
    U = data.user;
  }

  FOOD_LOG = data.food_logs || [];
  WEIGHT_LOG = data.weight_logs || [];
  WATER_CUPS = parseFloat(data.water_cups || 0);

  setSession(SESSION);
}

async function loadSession() {
  try {
    const data = await api("me");
    applyBackendData(data);
    goDash();
  } catch (err) {
    show("login");
  }
}

// ─── SCREENS ───
function show(id) {
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('on'));
  var el = document.getElementById('scr-' + id);
  if (el) el.classList.add('on');
}

function navClick() {
  if (SESSION) goDash();
  else show('login');
}

function toggleMenu() {
  document.getElementById('avMenu').classList.toggle('show');
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.av-wrap')) document.getElementById('avMenu').classList.remove('show');
});

// ─── AUTH ───
function setSession(email) {
  SESSION = email;
  U = ACCOUNTS[email].profile;
  document.getElementById('guestBtns').style.display = 'none';
  document.getElementById('uMenu').style.display = 'block';
  document.getElementById('navTabs').style.display = 'flex';
  var av = document.getElementById('avBtn');
  av.textContent = (U.name || 'U').substring(0, 2).toUpperCase();
  document.getElementById('menuName').textContent = U.name + ' · BitBite';
}

function doLogin() {
  var email = document.getElementById('lEmail').value.trim().toLowerCase();
  var pass = document.getElementById('lPass').value;
  var errBox = document.getElementById('loginErr');
  var emailEl = document.getElementById('lEmail');
  var passEl = document.getElementById('lPass');
  errBox.classList.remove('show');
  emailEl.classList.remove('err');
  passEl.classList.remove('err');

  if (!email) { emailEl.classList.add('err'); errBox.textContent = '❌ Please enter your email address.'; errBox.classList.add('show'); return; }
  if (!email.includes('@')) { emailEl.classList.add('err'); errBox.textContent = '❌ Please enter a valid email address.'; errBox.classList.add('show'); return; }
  if (!pass) { passEl.classList.add('err'); errBox.textContent = '❌ Please enter your password.'; errBox.classList.add('show'); return; }

  if (!ACCOUNTS[email]) {
    emailEl.classList.add('err');
    errBox.textContent = '❌ No account found with this email. Please create an account first.';
    errBox.classList.add('show'); return;
  }
  if (ACCOUNTS[email].password !== pass) {
    passEl.classList.add('err');
    errBox.textContent = '❌ Incorrect password. Please try again.';
    errBox.classList.add('show'); return;
  }
  setSession(email);
  goDash();
}

function doSocLogin() {
  var errBox = document.getElementById('loginErr');
  errBox.textContent = '⚠️ Social login requires creating an account first. Please sign up with email.';
  errBox.classList.add('show');
}

function doSocSignup() {
  var errBox = document.getElementById('signupErr');
  errBox.textContent = '⚠️ Social signup is not available in this demo. Please fill the form above to create your account.';
  errBox.classList.add('show');
}

function doSignup() {
  var first = document.getElementById('sFirst').value.trim();
  var last = document.getElementById('sLast').value.trim();
  var email = document.getElementById('sEmail').value.trim().toLowerCase();
  var pass = document.getElementById('sPass').value;
  var errBox = document.getElementById('signupErr');
  errBox.classList.remove('show');
  ['sFirst','sLast','sEmail','sPass'].forEach(id => document.getElementById(id).classList.remove('err'));

  if (!first) { document.getElementById('sFirst').classList.add('err'); errBox.textContent = '❌ First name is required.'; errBox.classList.add('show'); return; }
  if (!email || !email.includes('@')) { document.getElementById('sEmail').classList.add('err'); errBox.textContent = '❌ Please enter a valid email address.'; errBox.classList.add('show'); return; }
  if (pass.length < 8) { document.getElementById('sPass').classList.add('err'); errBox.textContent = '❌ Password must be at least 8 characters.'; errBox.classList.add('show'); return; }
  if (ACCOUNTS[email]) { document.getElementById('sEmail').classList.add('err'); errBox.textContent = '❌ An account with this email already exists. Please log in instead.'; errBox.classList.add('show'); return; }

  // Create account & set SESSION immediately so finishOb can save
  ACCOUNTS[email] = { password: pass, profile: { name: first + (last ? ' ' + last : ''), email: email, goal: 'lose', bodyType: 'average', age: 22, gender: 'male', height: 170, weight: 70, targetWeight: 65, bodyFat: 22, activityLevel: 'moderate', dietPref: [], healthCond: [], budget: 500, wearable: 'none', joinDate: new Date().toLocaleDateString() }};
  SESSION = email;
  U = ACCOUNTS[email].profile;
  OB_STEP = 0;
  show('ob');
  renderOb();
}

function logout() {
  SESSION = null;
  U = {};
  CHARTS = {};
  FOOD_LOG = [];
  document.getElementById('guestBtns').style.display = 'flex';
  document.getElementById('uMenu').style.display = 'none';
  document.getElementById('navTabs').style.display = 'none';
  document.getElementById('avMenu').classList.remove('show');
  // clear inputs
  ['lEmail','lPass','sFirst','sLast','sEmail','sPass'].forEach(id => { var el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('loginErr').classList.remove('show');
  show('login');
}

// ─── ONBOARDING ───
var OB_COUNT = 6;
var OB_TIMES = ['~3 min left', '~2.5 min left', '~2 min left', '~1.5 min left', '~1 min left', 'Almost done!'];

function renderOb() {
  // bars
  var bars = '';
  for (var i = 0; i < OB_COUNT; i++) {
    var cls = i < OB_STEP ? 'done' : i === OB_STEP ? 'cur' : '';
    bars += '<div class="ob-bar ' + cls + '"></div>';
  }
  document.getElementById('obBars').innerHTML = bars;
  document.getElementById('obTxt').textContent = 'Step ' + (OB_STEP+1) + ' of ' + OB_COUNT;
  document.getElementById('obTime').textContent = OB_TIMES[OB_STEP] || '';
  [obS0, obS1, obS2, obS3, obS4, obS5][OB_STEP]();
}

function obNav(isFirst, isLast) {
  return '<div class="ob-nav">'
    + '<button class="btn-back" onclick="' + (isFirst ? 'show(\'signup\')' : 'obPrev()') + '">' + (isFirst ? '← Back' : '← Previous') + '</button>'
    + '<button class="btn-nxt" onclick="' + (isLast ? 'finishOb()' : 'obNext()') + '">' + (isLast ? '🎉 Generate my plan' : 'Continue →') + '</button>'
    + '</div>';
}

function chOp(id, em, lbl, sub, sel) {
  return '<div class="ch' + (sel ? ' sel' : '') + '" onclick="pickCh(\'' + id + '\',this)">'
    + '<div class="ch-chk">✓</div>'
    + (em ? '<span class="ch-em">' + em + '</span>' : '')
    + '<div class="ch-lbl">' + lbl + '</div>'
    + (sub ? '<div class="ch-sub">' + sub + '</div>' : '')
    + '</div>';
}

function obS0() {
  document.getElementById('obBody').innerHTML = '<div class="ob-card">'
    + '<div class="ob-title">Hey ' + U.name.split(' ')[0] + '! What\'s your main goal?</div>'
    + '<div class="ob-sub">This is the foundation of your entire plan. Be completely honest — BitBite will build everything around your answer.</div>'
    + '<div class="ch-grid" id="goalG">'
    + chOp('goal-lose','🔥','Lose weight','Burn fat & get leaner', U.goal==='lose')
    + chOp('goal-gain','💪','Gain weight','Build mass & size', U.goal==='gain')
    + chOp('goal-muscle','🏋️','Build muscle','Strength & definition', U.goal==='muscle')
    + chOp('goal-maintain','⚖️','Stay fit','Maintain & optimize', U.goal==='maintain')
    + '</div>'
    + obNav(true, false) + '</div>';
}

function obS1() {
  document.getElementById('obBody').innerHTML = '<div class="ob-card">'
    + '<div class="ob-title">Tell us about your body</div>'
    + '<div class="ob-sub">Accurate data = accurate plan. Every field is used to compute your exact TDEE and macro split.</div>'
    + '<div class="frow" style="margin-bottom:14px">'
    + '<div class="fg"><label class="fl">Gender</label><select class="fi" onchange="U.gender=this.value"><option value="male"' + (U.gender==='male'?' selected':'') + '>Male</option><option value="female"' + (U.gender==='female'?' selected':'') + '>Female</option><option value="other"' + (U.gender==='other'?' selected':'') + '>Prefer not to say</option></select></div>'
    + '<div class="fg"><label class="fl">Birth year</label><input class="fi" type="number" value="' + (2026-U.age) + '" min="1930" max="2010" placeholder="2002" onchange="U.age=Math.max(1,2026-(+this.value)||22);updBMI()"></div>'
    + '</div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Height</span><span class="sl-val" id="hv">' + U.height + ' cm</span></div>'
    + '<input type="range" min="140" max="220" step="1" value="' + U.height + '" oninput="U.height=+this.value;document.getElementById(\'hv\').textContent=U.height+\' cm\';updBMI()"></div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Current weight</span><span class="sl-val" id="wv">' + U.weight + ' kg</span></div>'
    + '<input type="range" min="35" max="180" step="0.5" value="' + U.weight + '" oninput="U.weight=+this.value;document.getElementById(\'wv\').textContent=U.weight+\' kg\';updBMI()"></div>'
    + '<div id="bmiBox"></div>'
    + '<div class="sl-row" id="twRow"' + (U.goal==='maintain'?' style="display:none"':'') + '><div class="sl-hd"><span>Target weight</span><span class="sl-val" id="tv">' + U.targetWeight + ' kg</span></div>'
    + '<input type="range" min="35" max="180" step="0.5" value="' + U.targetWeight + '" oninput="U.targetWeight=+this.value;document.getElementById(\'tv\').textContent=U.targetWeight+\' kg\'"></div>'
    + obNav(false, false) + '</div>';
  updBMI();
}

function calcBMI() { var h=U.height/100; return Math.round(U.weight/(h*h)*10)/10; }
function bmiCat(b) {
  if (b < 18.5) return {lbl:'Underweight',c:'#1D4ED8',pct:15};
  if (b < 25) return {lbl:'Normal weight',c:'#15803D',pct:45};
  if (b < 30) return {lbl:'Overweight',c:'#D97706',pct:68};
  return {lbl:'Obese',c:'#DC2626',pct:88};
}
function updBMI() {
  var b = calcBMI(); var cat = bmiCat(b);
  var box = document.getElementById('bmiBox');
  if (!box) return;
  box.innerHTML = '<div class="bmi-display">'
    + '<div><div class="bmi-num" style="color:' + cat.c + '">' + b + '</div><div style="font-size:11px;color:var(--mut)">BMI Score</div></div>'
    + '<div style="flex:1">'
    + '<div style="font-size:13px;font-weight:700;color:' + cat.c + '">' + cat.lbl + '</div>'
    + '<div class="bmi-bar-wrap"><div class="bmi-marker" style="left:calc(' + cat.pct + '% - 7px)"></div></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--mut);margin-top:4px"><span>Under</span><span>Normal</span><span>Over</span><span>Obese</span></div>'
    + '</div></div>';
}

function obS2() {
  document.getElementById('obBody').innerHTML = '<div class="ob-card">'
    + '<div class="ob-title">How active are you?</div>'
    + '<div class="ob-sub">This determines your TDEE — Total Daily Energy Expenditure. Be honest for the most accurate results.</div>'
    + '<div class="ch-grid" id="actG" style="grid-template-columns:1fr 1fr">'
    + chOp('act-sedentary','🛋️','Sedentary','Desk job, little to no exercise', U.activityLevel==='sedentary')
    + chOp('act-light','🚶','Lightly active','1–3 workouts per week', U.activityLevel==='light')
    + chOp('act-moderate','🏃','Moderately active','3–5 workouts per week', U.activityLevel==='moderate')
    + chOp('act-very','🏋️','Very active','Hard training 6–7 days/week', U.activityLevel==='very')
    + '</div>'
    + obNav(false, false) + '</div>';
}

function obS3() {
  var diets = ['No restriction','Vegetarian','Vegan','Halal','Gluten-free','Dairy-free','Keto','Low-sodium','Low-carb','High-protein'];
  var tags = diets.map(d => '<span class="tag' + (U.dietPref.includes(d) ? ' sel' : '') + '" onclick="togTag(this,\'' + d + '\',\'dietPref\')">' + d + '</span>').join('');
  document.getElementById('obBody').innerHTML = '<div class="ob-card">'
    + '<div class="ob-title">Diet preferences & budget</div>'
    + '<div class="ob-sub">Select all dietary preferences that apply. Your meal plan will strictly follow these — we never suggest foods you don\'t eat.</div>'
    + '<div class="tag-wrap" id="dietTags">' + tags + '</div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Daily food budget</span><span class="sl-val" id="budv">৳' + U.budget + '</span></div>'
    + '<input type="range" min="100" max="2000" step="50" value="' + U.budget + '" oninput="U.budget=+this.value;document.getElementById(\'budv\').textContent=\'৳\'+U.budget">'
    + '</div>'
    + '<div class="info-box"><div class="info-ic">৳</div><div>৳' + U.budget + '/day budget — ' + (U.budget<300?'tight but doable! We\'ll prioritize high-nutrition, affordable local foods':U.budget<800?'good range — you\'ll get balanced, varied meals':'generous — expect premium quality, diverse meal options') + '.</div></div>'
    + obNav(false, false) + '</div>';
}

function obS4() {
  var conds = ['None','Diabetes (Type 2)','Hypertension','PCOS','Thyroid disorder','High cholesterol','Anemia (Iron deficiency)','Lactose intolerance','Celiac disease','Kidney disease'];
  var tags = conds.map(c => '<span class="tag' + (U.healthCond.includes(c) ? ' sel' : '') + '" onclick="togTag(this,\'' + c + '\',\'healthCond\')">' + c + '</span>').join('');
  document.getElementById('obBody').innerHTML = '<div class="ob-card">'
    + '<div class="ob-title">Any health conditions?</div>'
    + '<div class="ob-sub">Completely confidential. Used only to adjust your nutrition plan — certain conditions require specific macro and micronutrient modifications.</div>'
    + '<div class="info-box"><div class="info-ic">🔒</div><div>Your health data is <strong>encrypted end-to-end</strong> and never shared with third parties or advertisers.</div></div>'
    + '<div class="tag-wrap">' + tags + '</div>'
    + '<div class="fg"><label class="fl">Wearable device (optional)</label>'
    + '<select class="fi" onchange="U.wearable=this.value">'
    + '<option value="none">No wearable device</option>'
    + '<option value="Garmin">Garmin</option>'
    + '<option value="Apple Watch">Apple Watch</option>'
    + '<option value="Fitbit">Fitbit</option>'
    + '<option value="Samsung Galaxy Watch">Samsung Galaxy Watch</option>'
    + '<option value="Mi Band">Mi Band / Xiaomi</option>'
    + '<option value="Whoop">Whoop Band</option>'
    + '</select></div>'
    + obNav(false, false) + '</div>';
}

function obS5() {
  document.getElementById('obBody').innerHTML = '<div class="ob-card">'
    + '<div class="ob-title">Your body composition</div>'
    + '<div class="ob-sub">Helps us fine-tune your macro split for maximum effectiveness. This isn\'t about judgment — it\'s about precision.</div>'
    + '<div class="ch-grid" id="bodyG" style="grid-template-columns:repeat(3,1fr)">'
    + chOp('body-slim','🦴','Slim / Lean','Low body fat, some muscle visible', U.bodyType==='slim')
    + chOp('body-average','🧍','Average','Moderate fat and muscle levels', U.bodyType==='average')
    + chOp('body-stocky','🐻','Stocky / Heavy','Higher body fat percentage', U.bodyType==='stocky')
    + '</div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Estimated body fat %</span><span class="sl-val" id="bfv">' + U.bodyFat + '%</span></div>'
    + '<input type="range" min="5" max="50" step="1" value="' + U.bodyFat + '" oninput="U.bodyFat=+this.value;document.getElementById(\'bfv\').textContent=U.bodyFat+\'%\'">'
    + '</div>'
    + '<div class="info-box"><div class="info-ic">i</div><div>Healthy ranges: <strong>Men 10–20%</strong>, <strong>Women 20–30%</strong>. Athletes may go lower. We refine this over time as you track.</div></div>'
    + obNav(false, true) + '</div>';
}

function pickCh(id, el) {
  var parts = id.split('-'); var key = parts[0]; var val = parts[1];
  var parent = el.closest('.ch-grid');
  if (parent) parent.querySelectorAll('.ch').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  if (key === 'goal') U.goal = val;
  else if (key === 'act') U.activityLevel = val;
  else if (key === 'body') U.bodyType = val;
}
function togTag(el, v, key) {
  el.classList.toggle('sel');
  if (el.classList.contains('sel')) { if (!U[key].includes(v)) U[key].push(v); }
  else { U[key] = U[key].filter(x => x !== v); }
}
function obPrev() { if (OB_STEP > 0) { OB_STEP--; renderOb(); } }
function obNext() { if (OB_STEP < OB_COUNT - 1) { OB_STEP++; renderOb(); } }

function finishOb() {
  // Save completed profile
  ACCOUNTS[SESSION].profile = U;
  // init sample data
  WEIGHT_LOG = [{date: 'Today', w: U.weight, note: 'Starting weight'}];
  FOOD_LOG = [
    {em:'🥣', nm:'Oats with banana', cal:320, time:'8:30 AM', type:'Breakfast'},
    {em:'🍛', nm:'Lentil dal + rice', cal:520, time:'1:00 PM', type:'Lunch'},
    {em:'🥜', nm:'Mixed nuts', cal:180, time:'4:30 PM', type:'Snack'}
  ];
  WATER_CUPS = 5;
  STREAK = 1;
  setSession(SESSION);
  show('result');
  renderResult();
}

// ─── CALC ───
function calcTDEE() {
  var bmr = U.gender === 'female'
    ? 447.6 + (9.25*U.weight) + (3.1*U.height) - (4.3*U.age)
    : 88.36 + (13.4*U.weight) + (4.8*U.height) - (5.7*U.age);
  var m = {sedentary:1.2, light:1.375, moderate:1.55, very:1.725}[U.activityLevel] || 1.55;
  return Math.round(bmr * m);
}
function calcTarget(tdee) {
  if (U.goal === 'lose') return Math.round(tdee * 0.8);
  if (U.goal === 'gain' || U.goal === 'muscle') return Math.round(tdee * 1.15);
  return tdee;
}
function calcMacros(c) {
  var p, f, cb;
  if (U.goal === 'muscle') { p = Math.round(U.weight*2.2); f = Math.round(c*0.25/9); cb = Math.round((c-p*4-f*9)/4); }
  else if (U.goal === 'lose') { p = Math.round(U.weight*2); f = Math.round(c*0.3/9); cb = Math.round((c-p*4-f*9)/4); }
  else if (U.goal === 'gain') { p = Math.round(U.weight*1.8); f = Math.round(c*0.3/9); cb = Math.round((c-p*4-f*9)/4); }
  else { p = Math.round(U.weight*1.6); f = Math.round(c*0.28/9); cb = Math.round((c-p*4-f*9)/4); }
  if (cb < 0) cb = 0;
  return {p, f, c: cb};
}
function goalLbl() { return {lose:'Fat loss & toning',gain:'Weight & mass gain',muscle:'Muscle building',maintain:'Maintain & optimize'}[U.goal] || 'Health'; }

// ─── RESULT ───
function renderResult() {
  var bmi = calcBMI(); var cat = bmiCat(bmi);
  var tdee = calcTDEE(); var tc = calcTarget(tdee); var m = calcMacros(tc);
  var diff = Math.abs(U.weight - (U.targetWeight || U.weight));
  var weeks = U.goal === 'maintain' ? 0 : Math.ceil(diff / 0.5);
  var water = Math.round(U.weight * 0.033 * 10) / 10;

  var meals = {
    lose:[{d:'Mon',m:'Oats + boiled egg + banana'},{d:'Tue',m:'Lentil soup + brown rice + salad'},{d:'Wed',m:'Grilled chicken + steamed veg'},{d:'Thu',m:'Fish curry + wholegrain roti'},{d:'Fri',m:'Egg fried rice (light) + cucumber'}],
    gain:[{d:'Mon',m:'Paratha + 3 eggs + full cream milk'},{d:'Tue',m:'Chicken biryani + raita + lassi'},{d:'Wed',m:'Beef curry + 2 cups rice + dal'},{d:'Thu',m:'PB toast + banana shake + nuts'},{d:'Fri',m:'Mixed nuts + khichuri + yogurt'}],
    muscle:[{d:'Mon',m:'Oat protein bowl + boiled eggs + milk'},{d:'Tue',m:'Grilled chicken + sweet potato + spinach'},{d:'Wed',m:'Lentil + brown rice + tuna salad'},{d:'Thu',m:'Egg bhurji + roti + milk'},{d:'Fri',m:'Chicken dal + rice + cottage cheese'}],
    maintain:[{d:'Mon',m:'Poha + fruit + green tea'},{d:'Tue',m:'Dal khichuri + curd + salad'},{d:'Wed',m:'Veg stir fry + roti + soup'},{d:'Thu',m:'Fish + rice + mustard greens'},{d:'Fri',m:'Semolina upma + boiled eggs + fruit'}]
  }[U.goal] || [];

  var tls = {
    lose:[{w:'Week 1–2',t:'Adjustment phase',d:'Body adapts to calorie deficit. Expect 0.3–0.5 kg loss. Stay consistent through hunger cues.'},{w:'Week 3–6',t:'Active fat loss',d:'Fat burning accelerates. Energy levels stabilize. Target 0.5 kg/week loss.'},{w:'Week 7–12',t:'Visible transformation',d:'Body composition shifts. Clothes fit differently. Maintain high protein intake.'},{w:'Week 12+',t:'Goal achieved',d:'Transition to maintenance calories. Build sustainable habits for life.'}],
    gain:[{w:'Week 1–2',t:'Calorie surplus begins',d:'Body starts absorbing surplus. Expect 0.5–1 kg initial weight gain.'},{w:'Week 3–6',t:'Strength increases',d:'Progressive overload in training is critical here. Lift heavier every session.'},{w:'Week 7–12',t:'Visible mass gain',d:'Muscle fullness and size become noticeable. Track body fat to avoid excess.'},{w:'Week 12+',t:'Reassess & continue',d:'Consider mini cut to reveal gains. Update targets and macros.'}],
    muscle:[{w:'Week 1–2',t:'Neural adaptations',d:'Initial strength gains come from your nervous system — muscle growth comes later.'},{w:'Week 3–8',t:'Hypertrophy phase',d:'Muscle fibers actively grow. ' + m.p + 'g protein daily is critical every single day.'},{w:'Week 9–16',t:'Definition & density',d:'Muscle density increases, body fat percentage drops. Best visual results here.'},{w:'Week 16+',t:'Advanced phase',d:'Maintain muscle with slightly reduced calories. Introduce periodization.'}],
    maintain:[{w:'Week 1',t:'Establish baseline',d:'Track every meal for 1 week. Understand real hunger cues and portion control.'},{w:'Week 2–4',t:'Build consistency',d:'Habit loop solidifies. Energy levels stabilize. Wearable data becomes valuable.'},{w:'Month 2+',t:'Long-term optimization',d:'Fine-tune macros based on sleep quality, mood, and performance data.'}]
  }[U.goal] || [];

  var tips = [];
  if (U.goal === 'lose') tips.push('Maintain 300–500 kcal deficit. Never go below 1,200 kcal (women) or 1,500 kcal (men).', 'Eat protein first at every meal — it signals satiety and preserves lean muscle mass.');
  if (U.goal === 'gain') tips.push('Eat every 3–4 hours. Muscles grow between workouts — never skip a meal.', 'Combine calorie surplus with progressive overload training for lean mass gains.');
  if (U.goal === 'muscle') tips.push('Time protein: ' + Math.round(m.p*0.3) + 'g within 30 min post-workout for optimal muscle protein synthesis.', 'Creatine monohydrate 5g/day is the most evidence-backed legal supplement for muscle building.');
  tips.push('Drink ' + water + 'L of water daily (calculated for your ' + U.weight + 'kg body weight).', 'Sleep 7–9 hours — growth hormone peaks during deep sleep and directly supports your goal.');
  if (U.wearable !== 'none') tips.push('Your ' + U.wearable + ' will auto-adjust your daily calorie target based on real-time activity data.');
  if (U.healthCond.length && !U.healthCond.includes('None')) tips.push('Your conditions (' + U.healthCond.join(', ') + ') are factored in — inflammatory and high-glycemic foods are excluded from your plan.');

  document.getElementById('resContent').innerHTML =
    '<div class="res-hero">'
    + '<div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px">🎉 Your personalized plan is ready</div>'
    + '<h2>Welcome to BitBite, ' + U.name.split(' ')[0] + '!</h2>'
    + '<p>Goal: ' + goalLbl() + ' · Built from your exact biometrics · Updated daily with wearable data</p>'
    + '<div class="res-stats">'
    + '<div class="rst"><div class="rst-n">' + tc + '</div><div class="rst-l">kcal / day</div></div>'
    + '<div class="rst"><div class="rst-n">' + tdee + '</div><div class="rst-l">TDEE</div></div>'
    + (weeks ? '<div class="rst"><div class="rst-n">' + weeks + 'w</div><div class="rst-l">to goal</div></div>' : '')
    + '<div class="rst"><div class="rst-n">৳' + U.budget + '</div><div class="rst-l">daily budget</div></div>'
    + '<div class="rst"><div class="rst-n">' + water + 'L</div><div class="rst-l">water/day</div></div>'
    + '</div></div>'

    + '<div class="stat-g">'
    + '<div class="stat-b"><div class="stat-n">' + U.weight + ' kg</div><div class="stat-l">Current weight</div></div>'
    + '<div class="stat-b"><div class="stat-n" style="color:' + cat.c + '">' + bmi + '</div><div class="stat-l">BMI · ' + cat.lbl + '</div></div>'
    + '<div class="stat-b"><div class="stat-n">' + (U.targetWeight || U.weight) + ' kg</div><div class="stat-l">Target weight</div></div>'
    + '<div class="stat-b"><div class="stat-n">' + U.bodyFat + '%</div><div class="stat-l">Est. body fat</div></div>'
    + '</div>'

    + '<div class="plan-card2"><div class="ct">Daily macro targets <span class="ct-badge">' + goalLbl() + '</span></div>'
    + '<div class="macro-r">'
    + '<div class="mbox" style="background:#EBF7F0"><div class="mbox-n" style="color:#15803D">' + m.p + 'g</div><div class="mbox-l" style="color:#166634">Protein</div><div class="pb" style="margin-top:5px"><div class="pbf" style="width:' + Math.round(m.p*4/tc*100) + '%;background:#15803D"></div></div><div style="font-size:10px;color:#166634;margin-top:3px">' + Math.round(m.p*4/tc*100) + '%</div></div>'
    + '<div class="mbox" style="background:#EFF6FF"><div class="mbox-n" style="color:#1D4ED8">' + m.c + 'g</div><div class="mbox-l" style="color:#1E40AF">Carbs</div><div class="pb" style="margin-top:5px"><div class="pbf" style="width:' + Math.round(m.c*4/tc*100) + '%;background:#1D4ED8"></div></div><div style="font-size:10px;color:#1E40AF;margin-top:3px">' + Math.round(m.c*4/tc*100) + '%</div></div>'
    + '<div class="mbox" style="background:#FFFBEB"><div class="mbox-n" style="color:#D97706">' + m.f + 'g</div><div class="mbox-l" style="color:#92400E">Fat</div><div class="pb" style="margin-top:5px"><div class="pbf" style="width:' + Math.round(m.f*9/tc*100) + '%;background:#D97706"></div></div><div style="font-size:10px;color:#92400E;margin-top:3px">' + Math.round(m.f*9/tc*100) + '%</div></div>'
    + '</div>'
    + '<div class="info-box" style="margin-bottom:0"><div class="info-ic">i</div><div>Protein: ' + Math.round(m.p/U.weight*10)/10 + 'g/kg body weight · Fiber target: 25–35g/day · Water: ' + water + 'L/day</div></div>'
    + '</div>'

    + '<div class="plan-card2"><div class="ct">5-day sample meal plan <span class="ct-badge">৳' + U.budget + '/day</span></div>'
    + meals.map(r => '<div class="wk-row"><span class="wk-d">' + r.d + '</span><span class="wk-m">' + r.m + '</span><span class="wk-c">~' + Math.round(tc/5) + ' kcal</span></div>').join('')
    + '</div>'

    + '<div class="plan-card2"><div class="ct">Your progress roadmap</div>'
    + tls.map((t, i) => '<div class="tl-item"><div class="tl-l"><div class="tl-dot">' + (i+1) + '</div>' + (i < tls.length-1 ? '<div class="tl-line"></div>' : '') + '</div><div class="tl-c"><span class="tl-wk">' + t.w + '</span><div class="tl-t">' + t.t + '</div><div class="tl-d">' + t.d + '</div></div></div>').join('')
    + '</div>'

    + '<div class="tips-card"><div class="ct" style="color:var(--gd)">Personalized tips for you</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:#1A4A2A;line-height:1.65">'
    + tips.map(t => '<div style="display:flex;gap:8px"><span style="color:var(--g);font-weight:800;flex-shrink:0;margin-top:1px">✓</span><span>' + t + '</span></div>').join('')
    + '</div></div>'

    + '<button class="go-dash" onclick="goDash()">🚀 Go to my dashboard →</button>';
}

// ─── NAVIGATION ───
function goDash() { show('dash'); setNavActive(0); renderDash(); }
function goMeals() { show('meals'); setNavActive(1); renderMeals(); }
function goLog() { show('log'); setNavActive(2); renderLog(); }
function goAI() { show('ai'); setNavActive(3); renderAI(); }
function goProgress() { show('progress'); setNavActive(4); renderProgress(); }
function goTools() { show('tools'); setNavActive(5); renderTools(); }
function goProfile() { show('prof'); setNavActive(-1); renderProf(); }
function goNotifs() { show('notifs'); setNavActive(-1); renderNotifs(); document.getElementById('notifDot').style.display='none'; }
function goBMI() { show('bmi'); setNavActive(-1); renderBMITool(); }
function goCalCal() { show('calcal'); setNavActive(-1); renderCalCal(); }
function goSleep() { show('sleep'); setNavActive(-1); renderSleep(); }
function goWater() { show('water'); setNavActive(-1); renderWater(); }

function setNavActive(idx) {
  document.querySelectorAll('.nt').forEach((n, i) => { n.classList.toggle('on', i === idx); });
  document.getElementById('avMenu').classList.remove('show');
}

// ─── MODAL ───
function openModal(html) {
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay')) {
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

// ─── TOOLS HUB ───
function renderTools() {
  document.getElementById('toolsContent').innerHTML =
    '<div class="page-hdr"><div><div class="page-title">🧰 Health Tools</div><div class="page-sub">Science-backed calculators and trackers — all personalized to you</div></div></div>'
    + '<div class="tools-grid">'
    + toolCard('🧮','BMI Calculator','Check your Body Mass Index with visual scale and health category.','goBMI()')
    + toolCard('🔥','Calorie Calculator','Calculate your exact TDEE and ideal calorie target based on your goal.','goCalCal()')
    + toolCard('😴','Sleep Tracker','Log and analyze your sleep quality and see how it affects your nutrition.','goSleep()')
    + toolCard('💧','Water Tracker','Track your daily hydration and hit your personalized water goal.','goWater()')
    + toolCard('📏','Macro Splitter','Calculate your optimal protein, carbs, and fat split for any calorie target.','openMacroModal()')
    + toolCard('🏃','Steps Converter','Convert steps to calories burned based on your weight and pace.','openStepsModal()')
    + toolCard('⚖️','Ideal Weight Finder','Find your healthy weight range using 5 different medical formulas.','openIdealWeightModal()')
    + toolCard('📊','Nutrition Score','Get a detailed breakdown of your weekly nutrition performance.','openNutScoreModal()')
    + '</div>'
    + '<div class="card"><div class="ct">Quick calorie lookup</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">'
    + [['🍚 Rice (1 cup)',206],['🍌 Banana',89],['🥚 Boiled egg',78],['🍗 Chicken 100g',165],['🥛 Milk 250ml',150],['🥜 Almonds 30g',174],['🫘 Dal 1 cup',230],['🐟 Fish 100g',140],['🧁 Roti (1)',100],['🥦 Broccoli 100g',34],['🍅 Tomato',22],['🧀 Paneer 100g',265]]
      .map(f => '<div style="background:var(--bg);border-radius:9px;padding:10px;text-align:center;cursor:pointer;transition:.15s;font-size:12.5px" onmouseover="this.style.background=\'var(--gp)\'" onmouseout="this.style.background=\'var(--bg)\'">'
        + '<div style="font-size:22px;margin-bottom:4px">' + f[0].split(' ')[0] + '</div>'
        + '<div style="font-weight:600">' + f[0].split(' ').slice(1).join(' ') + '</div>'
        + '<div style="color:var(--g);font-weight:700;margin-top:3px">' + f[1] + ' kcal</div>'
        + '</div>').join('')
    + '</div></div>';
}
function toolCard(em, title, desc, onclick) {
  return '<div class="tool-card" onclick="' + onclick + '">'
    + '<span class="tool-card-em">' + em + '</span>'
    + '<div class="tool-card-title">' + title + '</div>'
    + '<div class="tool-card-desc">' + desc + '</div>'
    + '</div>';
}

// ─── BMI TOOL ───
function renderBMITool() {
  var bmi = calcBMI(); var cat = bmiCat(bmi);
  var pct = Math.min(95, Math.max(5, Math.round(((bmi - 15) / 25) * 100)));
  document.getElementById('bmiContent').innerHTML =
    '<div class="page-hdr"><div><div class="page-title">🧮 BMI Calculator</div><div class="page-sub">Body Mass Index — a standard measure of body weight relative to height</div></div>'
    + '<button class="sec-btn" onclick="goTools()">← Back to Tools</button></div>'
    + '<div class="g2" style="align-items:start">'
    + '<div class="card">'
    + '<div class="ct">Enter measurements</div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Height</span><span class="sl-val" id="bmiH">' + U.height + ' cm</span></div><input type="range" min="140" max="220" step="1" value="' + U.height + '" id="bmiHSlider" oninput="document.getElementById(\'bmiH\').textContent=this.value+\' cm\';calcBMILive()"></div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Weight</span><span class="sl-val" id="bmiW">' + U.weight + ' kg</span></div><input type="range" min="35" max="180" step="0.5" value="' + U.weight + '" id="bmiWSlider" oninput="document.getElementById(\'bmiW\').textContent=this.value+\' kg\';calcBMILive()"></div>'
    + '<div class="cal-result-box"><div class="cal-result-num" id="bmiNum">' + bmi + '</div><div class="cal-result-label" id="bmiCatLbl" style="color:' + cat.c + ';font-weight:700;font-size:15px">' + cat.lbl + '</div></div>'
    + '<div style="margin-bottom:6px;font-size:12px;font-weight:600;color:var(--mut)">BMI SCALE</div>'
    + '<div class="bmi-scale"><div class="bmi-pin" id="bmiPin" style="left:calc(' + pct + '% - 12px)">' + bmi + '</div></div>'
    + '<div class="bmi-zones"><span>Underweight<br>&lt;18.5</span><span>Normal<br>18.5–25</span><span>Overweight<br>25–30</span><span>Obese<br>&gt;30</span></div>'
    + '</div>'
    + '<div>'
    + '<div class="card" style="margin-bottom:14px"><div class="ct">What does your BMI mean?</div>'
    + '<div style="display:flex;flex-direction:column;gap:10px">'
    + bmiZone('#74B3FF','Underweight (<18.5)','May indicate malnutrition, eating disorder, or other health issues. Weight gain through healthy diet is recommended.')
    + bmiZone('#4CAF78','Normal weight (18.5–24.9)','Healthy weight range. Associated with lowest risk of weight-related disease. Maintain with balanced diet and exercise.')
    + bmiZone('#F5A623','Overweight (25–29.9)','Increased risk of heart disease, type 2 diabetes, and high blood pressure. Lifestyle changes recommended.')
    + bmiZone('#E8523A','Obese (≥30)','High risk of serious health complications. Medical guidance alongside diet and exercise strongly advised.')
    + '</div></div>'
    + '<div class="card"><div class="ct">Your ideal weight range</div>'
    + '<div style="font-size:13px;color:var(--mut);margin-bottom:10px">For your height of ' + U.height + 'cm, a healthy BMI (18.5–24.9) corresponds to:</div>'
    + '<div style="display:flex;gap:12px">'
    + '<div style="flex:1;background:var(--gp);border-radius:10px;padding:14px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.4rem;font-weight:900;color:var(--g)">' + Math.round(18.5*(U.height/100)*(U.height/100)*10)/10 + ' kg</div><div style="font-size:11px;color:var(--mut)">Minimum</div></div>'
    + '<div style="flex:1;background:var(--gp);border-radius:10px;padding:14px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.4rem;font-weight:900;color:var(--g)">' + Math.round(24.9*(U.height/100)*(U.height/100)*10)/10 + ' kg</div><div style="font-size:11px;color:var(--mut)">Maximum</div></div>'
    + '</div></div>'
    + '</div></div>';
}
function bmiZone(c, title, desc) {
  return '<div style="display:flex;gap:10px;align-items:flex-start"><div style="width:14px;height:14px;border-radius:4px;background:' + c + ';flex-shrink:0;margin-top:2px"></div><div><div style="font-size:13px;font-weight:700;margin-bottom:2px">' + title + '</div><div style="font-size:12px;color:var(--mut);line-height:1.5">' + desc + '</div></div></div>';
}
function calcBMILive() {
  var h = +document.getElementById('bmiHSlider').value / 100;
  var w = +document.getElementById('bmiWSlider').value;
  var b = Math.round(w/(h*h)*10)/10;
  var cat = bmiCat(b);
  var pct = Math.min(95, Math.max(5, Math.round(((b-15)/25)*100)));
  var numEl = document.getElementById('bmiNum'); if(numEl) numEl.textContent = b;
  var catEl = document.getElementById('bmiCatLbl'); if(catEl){catEl.textContent=cat.lbl;catEl.style.color=cat.c;}
  var pin = document.getElementById('bmiPin'); if(pin){pin.style.left='calc('+pct+'% - 12px)';pin.textContent=b;}
}

// ─── CALORIE CALCULATOR ───
function renderCalCal() {
  var tdee = calcTDEE(); var tc = calcTarget(tdee); var m = calcMacros(tc);
  var meals = [
    {em:'🌅', n:'Breakfast', pct:25},
    {em:'☀️', n:'Lunch', pct:35},
    {em:'🌤️', n:'Snack', pct:10},
    {em:'🌙', n:'Dinner', pct:30},
  ];
  document.getElementById('calcalContent').innerHTML =
    '<div class="page-hdr"><div><div class="page-title">🔥 Calorie Calculator</div><div class="page-sub">Your Total Daily Energy Expenditure — calculated from the Mifflin-St Jeor equation</div></div>'
    + '<button class="sec-btn" onclick="goTools()">← Back to Tools</button></div>'
    + '<div class="g2" style="align-items:start">'
    + '<div>'
    + '<div class="card" style="margin-bottom:14px"><div class="ct">Adjust your parameters</div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Age</span><span class="sl-val" id="ccAge">' + U.age + ' yrs</span></div><input type="range" min="15" max="80" step="1" value="' + U.age + '" oninput="U.age=+this.value;document.getElementById(\'ccAge\').textContent=U.age+\' yrs\';updateCalCal()"></div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Weight</span><span class="sl-val" id="ccW">' + U.weight + ' kg</span></div><input type="range" min="35" max="180" step="0.5" value="' + U.weight + '" oninput="U.weight=+this.value;document.getElementById(\'ccW\').textContent=U.weight+\' kg\';updateCalCal()"></div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Height</span><span class="sl-val" id="ccH">' + U.height + ' cm</span></div><input type="range" min="140" max="220" step="1" value="' + U.height + '" oninput="U.height=+this.value;document.getElementById(\'ccH\').textContent=U.height+\' cm\';updateCalCal()"></div>'
    + '<div class="fg"><label class="fl">Activity level</label><select class="fi" onchange="U.activityLevel=this.value;updateCalCal()">'
    + ['sedentary','light','moderate','very'].map(a => '<option value="' + a + '"' + (U.activityLevel===a?' selected':'') + '>' + {sedentary:'Sedentary (desk job)',light:'Lightly active (1-3/wk)',moderate:'Moderately active (3-5/wk)',very:'Very active (6-7/wk)'}[a] + '</option>').join('')
    + '</select></div></div>'
    + '<div class="card"><div class="ct">Calorie targets by goal</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px" id="ccGoals"></div></div>'
    + '</div>'
    + '<div>'
    + '<div class="cal-result-box"><div style="font-size:12px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">YOUR TDEE (MAINTENANCE)</div><div class="cal-result-num" id="ccTDEE">' + tdee + '</div><div class="cal-result-label">calories per day to maintain weight</div></div>'
    + '<div class="card" style="margin-bottom:14px"><div class="ct">Your target: <span class="ct-badge">' + goalLbl() + '</span></div>'
    + '<div class="cal-result-box" style="margin-bottom:10px;padding:1rem"><div class="cal-result-num" id="ccTarget" style="font-size:2rem">' + tc + '</div><div class="cal-result-label">kcal/day recommended</div></div>'
    + '<div style="font-size:12.5px;color:var(--mut);text-align:center" id="ccDiff">' + (tc < tdee ? 'Deficit: ' + (tdee-tc) + ' kcal/day = ~' + Math.round((tdee-tc)*7/7700*10)/10 + ' kg/week loss' : 'Surplus: +' + (tc-tdee) + ' kcal/day = ~' + Math.round((tc-tdee)*7/7700*10)/10 + ' kg/week gain') + '</div></div>'
    + '<div class="card"><div class="ct">Meal-by-meal calorie split</div>'
    + '<div id="ccMealSplit">' + meals.map(ml => '<div class="meal-split-row"><span class="meal-split-em">' + ml.em + '</span><span class="meal-split-name">' + ml.n + '</span><span class="meal-split-cal" id="ms-' + ml.n + '">' + Math.round(tc*ml.pct/100) + ' kcal</span><span class="meal-split-pct">' + ml.pct + '%</span></div>').join('') + '</div>'
    + '</div></div></div>';

  updateCalCal();
}
function updateCalCal() {
  var tdee = calcTDEE(); var tc = calcTarget(tdee);
  var t = document.getElementById('ccTDEE'); if(t) t.textContent = tdee;
  var tg = document.getElementById('ccTarget'); if(tg) tg.textContent = tc;
  var df = document.getElementById('ccDiff');
  if(df) df.textContent = tc < tdee ? 'Deficit: '+(tdee-tc)+' kcal/day = ~'+Math.round((tdee-tc)*7/7700*10)/10+' kg/week loss' : tc > tdee ? 'Surplus: +'+(tc-tdee)+' kcal/day = ~'+Math.round((tc-tdee)*7/7700*10)/10+' kg/week gain' : 'Maintenance — no deficit or surplus';
  var goals = document.getElementById('ccGoals');
  if(goals) goals.innerHTML = [{g:'lose',lbl:'🔥 Fat loss',mult:.8},{g:'maintain',lbl:'⚖️ Maintain',mult:1},{g:'muscle',lbl:'🏋️ Build muscle',mult:1.1},{g:'gain',lbl:'💪 Gain weight',mult:1.15}].map(x => '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-radius:9px;background:'+(x.g===U.goal?'var(--gp)':'var(--bg)')+';border:'+(x.g===U.goal?'1.5px solid var(--g)':'1px solid transparent')+'"><span style="font-size:13px;font-weight:'+(x.g===U.goal?700:500)+'">' + x.lbl + '</span><span style="font-family:\'Playfair Display\',serif;font-size:1.1rem;font-weight:900;color:var(--g)">' + Math.round(tdee*x.mult) + '</span></div>').join('');
  var mealPcts = {Breakfast:25, Lunch:35, Snack:10, Dinner:30};
  Object.entries(mealPcts).forEach(([k,p]) => { var el = document.getElementById('ms-'+k); if(el) el.textContent = Math.round(tc*p/100) + ' kcal'; });
}

// ─── SLEEP TRACKER ───
var SLEEP_LOG = [{date:'Mon',hrs:7.5,quality:'Good'},{date:'Tue',hrs:6.2,quality:'Fair'},{date:'Wed',hrs:8.1,quality:'Excellent'},{date:'Thu',hrs:5.8,quality:'Poor'},{date:'Fri',hrs:6.5,quality:'Fair'}];
function renderSleep() {
  var avg = Math.round(SLEEP_LOG.reduce((s,d)=>s+d.hrs,0)/SLEEP_LOG.length*10)/10;
  var maxH = Math.max(...SLEEP_LOG.map(d=>d.hrs));
  document.getElementById('sleepContent').innerHTML =
    '<div class="page-hdr"><div><div class="page-title">😴 Sleep Tracker</div><div class="page-sub">Sleep quality directly impacts metabolism, hunger hormones, and recovery</div></div>'
    + '<button class="sec-btn" onclick="goTools()">← Back to Tools</button></div>'
    + '<div class="g2" style="margin-bottom:14px">'
    + '<div class="card"><div class="ct">Log tonight\'s sleep</div>'
    + '<div class="sl-row"><div class="sl-hd"><span>Hours slept</span><span class="sl-val" id="slHrs">7.0 hrs</span></div><input type="range" min="2" max="12" step="0.5" value="7" id="slHrsR" oninput="document.getElementById(\'slHrs\').textContent=this.value+\' hrs\'"></div>'
    + '<div class="fg"><label class="fl">Sleep quality</label><select class="fi" id="slQual"><option>Excellent</option><option>Good</option><option selected>Fair</option><option>Poor</option></select></div>'
    + '<div class="fg"><label class="fl">Bedtime</label><input class="fi" type="time" id="slBed" value="23:00"></div>'
    + '<div class="fg"><label class="fl">Wake time</label><input class="fi" type="time" id="slWake" value="06:00"></div>'
    + '<button class="action-btn" style="width:100%;justify-content:center;margin-top:4px" onclick="logSleep()">💤 Log sleep</button>'
    + '</div>'
    + '<div class="card"><div class="ct">This week\'s sleep</div>'
    + '<div class="sleep-timeline">'
    + SLEEP_LOG.map(d => {
        var h = Math.round(d.hrs/maxH*80);
        var col = d.quality==='Excellent'?'#4CAF78':d.quality==='Good'?'#1A6B3C':d.quality==='Fair'?'#F5A623':'#E8523A';
        return '<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px">'
          + '<div class="sleep-bar" style="height:'+h+'px;background:'+col+';width:100%"></div>'
          + '<div style="font-size:10px;color:var(--mut)">' + d.date + '</div>'
          + '<div style="font-size:11px;font-weight:700">' + d.hrs + 'h</div>'
          + '</div>';
      }).join('')
    + '</div>'
    + '<div class="sleep-stage-legend">'
    + [['#4CAF78','Excellent (7.5–9h)'],['#1A6B3C','Good (6.5–7.5h)'],['#F5A623','Fair (5.5–6.5h)'],['#E8523A','Poor (<5.5h)']].map(s => '<div class="ssl"><div class="ssl-dot" style="background:'+s[0]+'"></div>'+s[1]+'</div>').join('')
    + '</div>'
    + '<div style="display:flex;gap:10px;margin-top:12px">'
    + '<div style="flex:1;background:var(--gp);border-radius:9px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.3rem;font-weight:900;color:var(--g)">' + avg + 'h</div><div style="font-size:11px;color:var(--mut)">Weekly avg</div></div>'
    + '<div style="flex:1;background:#FEF9E7;border-radius:9px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.3rem;font-weight:900;color:#D97706">' + SLEEP_LOG.filter(d=>d.quality==='Excellent'||d.quality==='Good').length + '/5</div><div style="font-size:11px;color:var(--mut)">Good nights</div></div>'
    + '</div>'
    + '</div></div>'
    + '<div class="card"><div class="ct">Sleep & nutrition connection</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">'
    + sleepFact('😴','<7 hrs sleep','Increases ghrelin (hunger hormone) by 15%. You eat 300–500 extra kcal the next day.')
    + sleepFact('🧠','Poor sleep + carbs','Cravings for sugary/starchy foods increase by 33% after a bad night.')
    + sleepFact('💪','Sleep & muscle','80% of growth hormone is released during deep sleep — critical for muscle repair.')
    + sleepFact('⚖️','Sleep & weight','People who sleep <6 hrs are 30% more likely to gain weight over 10 years.')
    + '</div></div>';
}
function sleepFact(em, title, desc) {
  return '<div style="background:var(--bg);border-radius:10px;padding:12px">'
    + '<div style="font-size:1.5rem;margin-bottom:6px">' + em + '</div>'
    + '<div style="font-size:13px;font-weight:700;margin-bottom:4px">' + title + '</div>'
    + '<div style="font-size:12px;color:var(--mut);line-height:1.5">' + desc + '</div>'
    + '</div>';
}
function logSleep() {
  var hrs = +document.getElementById('slHrsR').value;
  var q = document.getElementById('slQual').value;
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  SLEEP_LOG.push({date:days[new Date().getDay()], hrs, quality:q});
  if(SLEEP_LOG.length>7) SLEEP_LOG.shift();
  renderSleep();
}

// ─── WATER TRACKER (full page) ───
function renderWater() {
  var target = Math.round(U.weight * 0.033 * 10) / 10;
  var current = Math.round(WATER_CUPS * 0.25 * 10) / 10;
  var pct = Math.min(100, Math.round(current/target*100));
  document.getElementById('waterContent').innerHTML =
    '<div class="page-hdr"><div><div class="page-title">💧 Water Tracker</div><div class="page-sub">Your goal: ' + target + 'L/day — based on your ' + U.weight + 'kg body weight</div></div>'
    + '<button class="sec-btn" onclick="goTools()">← Back to Tools</button></div>'
    + '<div class="g2" style="align-items:start">'
    + '<div class="card">'
    + '<div style="text-align:center;margin:10px 0 20px">'
    + '<div style="font-size:4rem;margin-bottom:8px">💧</div>'
    + '<div style="font-family:\'Playfair Display\',serif;font-size:2.8rem;font-weight:900;color:var(--g)">' + current.toFixed(1) + 'L</div>'
    + '<div style="font-size:14px;color:var(--mut)">of ' + target + 'L goal</div>'
    + '<div style="margin:14px auto;max-width:300px"><div class="pb" style="height:14px;border-radius:14px"><div class="pbf" style="width:' + pct + '%;background:linear-gradient(90deg,#74C0E8,#1D9ED1)"></div></div></div>'
    + '<div style="font-size:13px;color:var(--mut)">' + pct + '% complete · ' + Math.max(0,target-current).toFixed(1) + 'L remaining</div>'
    + '</div>'
    + '<div style="font-size:12px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">TAP TO LOG (each cup = 250ml)</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">'
    + Array.from({length:12},(_,i)=>'<div class="wcup' + (i<WATER_CUPS?' filled':'') + '" style="width:48px;height:58px;border-radius:10px;border:2px solid '+(i<WATER_CUPS?'#74C0E8':'var(--bdr)')+';background:'+(i<WATER_CUPS?'linear-gradient(to top,#74C0E8,#AEE3F5)':'#fff')+';display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;transition:all .2s" onclick="setWaterCup('+i+')" title="'+((i+1)*250)+'ml">' + (i < WATER_CUPS ? '💧' : '○') + '</div>').join('')
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:16px;justify-content:center;flex-wrap:wrap">'
    + ['+ 1 cup (250ml)','+ Half (125ml)','+ 1 bottle (500ml)','Reset'].map((b,i) => '<button onclick="quickWater('+i+')" style="background:'+(i===3?'#FEE2E2':'var(--gp)')+';color:'+(i===3?'#DC2626':'var(--g)')+';border:1px solid '+(i===3?'#FECACA':'rgba(26,107,60,.2)')+';border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:\'Outfit\',sans-serif">'+b+'</button>').join('')
    + '</div>'
    + '</div>'
    + '<div>'
    + '<div class="card" style="margin-bottom:14px"><div class="ct">Hydration timeline today</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + [['6:00 AM','Morning glass on wake',250],['8:30 AM','With breakfast',250],['11:00 AM','Mid-morning',250],['1:00 PM','With lunch',500],['4:00 PM','Afternoon',250]].slice(0, Math.max(1, WATER_CUPS)).map(t => '<div style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--gp);border-radius:8px;font-size:13px"><div style="font-weight:600;width:70px;color:var(--mut);flex-shrink:0">'+t[0]+'</div><div style="flex:1">'+t[1]+'</div><div style="font-weight:700;color:var(--g)">'+t[2]+'ml</div></div>').join('')
    + '</div></div>'
    + '<div class="card"><div class="ct">Why hydration matters</div>'
    + '<div style="display:flex;flex-direction:column;gap:9px;font-size:13px;color:var(--txt);line-height:1.6">'
    + ['💧 Dehydration of just 2% reduces exercise performance by up to 10%.','🧠 Even mild dehydration impairs concentration and mood significantly.','🔥 Drinking 500ml of water increases metabolism by 24–30% for 1.5 hours.','⚖️ People who drink water before meals consume 13% fewer calories.','🌡️ Water regulates body temperature — critical during and after exercise.'].map(t => '<div style="display:flex;gap:8px"><span style="flex-shrink:0">'+t.split(' ')[0]+'</span><span>'+t.split(' ').slice(1).join(' ')+'</span></div>').join('')
    + '</div></div>'
    + '</div></div>';
}
function setWaterCup(i) { WATER_CUPS = (WATER_CUPS === i+1) ? i : i+1; renderWater(); }
function quickWater(i) {
  if(i===0) WATER_CUPS = Math.min(12, WATER_CUPS+1);
  else if(i===1) WATER_CUPS = Math.min(12, WATER_CUPS + 0.5);
  else if(i===2) WATER_CUPS = Math.min(12, WATER_CUPS+2);
  else WATER_CUPS = 0;
  renderWater();
}

// ─── NOTIFICATIONS ───
var NOTIFS = [
  {icon:'🏆',bg:'#D8F3DC',title:'7-day streak achieved!',desc:'You\'ve logged meals for 7 days in a row. Amazing consistency — keep it up!',time:'Just now',read:false},
  {icon:'⚡',bg:'#FEF9E7',title:'Wearable synced',desc:'Your device synced 8,241 steps and 541 kcal burned. Your dinner has been upgraded with extra protein.',time:'3 min ago',read:false},
  {icon:'💧',bg:'#EFF6FF',title:'Hydration reminder',desc:'You\'re 700ml behind your water goal for today. Drink a glass now!',time:'30 min ago',read:false},
  {icon:'🍽️',bg:'#F0FDF4',title:'Dinner time!',desc:'It\'s 7:30 PM — time for your planned grilled chicken khichuri (520 kcal, ৳120).',time:'1 hr ago',read:true},
  {icon:'📊',bg:'#FEF2F2',title:'Weekly report ready',desc:'Your Week 1 nutrition report is ready. You hit 91% of your calorie goal and averaged 7,800 steps/day.',time:'Yesterday',read:true},
  {icon:'🤖',bg:'#F5F3FF',title:'AI insight',desc:'Your sleep score is below target this week. I\'ve adjusted your meal plan to include more magnesium-rich foods.',time:'Yesterday',read:true},
  {icon:'🎯',bg:'#ECFDF5',title:'Goal milestone',desc:'You\'re halfway to your target weight! ' + Math.round(Math.abs((U.weight||70)-(U.targetWeight||65))/2*10)/10 + 'kg down, ' + Math.round(Math.abs((U.weight||70)-(U.targetWeight||65))/2*10)/10 + 'kg to go.',time:'2 days ago',read:true},
];
function renderNotifs() {
  var unread = NOTIFS.filter(n=>!n.read).length;
  document.getElementById('notifsContent').innerHTML =
    '<div class="page-hdr"><div><div class="page-title">🔔 Notifications</div><div class="page-sub">' + (unread>0?unread+' unread notifications':'All caught up!') + '</div></div>'
    + (unread>0?'<button class="sec-btn" onclick="markAllRead()">Mark all as read</button>':'')
    + '</div>'
    + NOTIFS.map((n,i) =>
      '<div class="notif-item' + (n.read?'':' unread') + '" onclick="markRead('+i+')">'
      + '<div class="notif-icon-wrap" style="background:' + n.bg + '">' + n.icon + '</div>'
      + '<div class="notif-content"><div class="notif-title">' + n.title + '</div><div class="notif-desc">' + n.desc + '</div><div class="notif-time">' + n.time + '</div></div>'
      + (!n.read?'<div class="notif-unread-dot"></div>':'')
      + '</div>'
    ).join('');
}
function markRead(i) { NOTIFS[i].read = true; renderNotifs(); }
function markAllRead() { NOTIFS.forEach(n => n.read=true); renderNotifs(); document.getElementById('notifDot').style.display='none'; }

// ─── QUICK MODALS ───
function openMacroModal() {
  var tc = calcTarget(calcTDEE()); var m = calcMacros(tc);
  openModal('<div class="modal-title">📏 Your Macro Split</div><div class="modal-sub">Optimized for ' + goalLbl() + ' at ' + tc + ' kcal/day</div>'
    + '<div class="macro-r" style="display:flex;gap:8px;margin-bottom:14px">'
    + '<div class="mbox" style="background:#EBF7F0;flex:1"><div class="mbox-n" style="color:#15803D">' + m.p + 'g</div><div class="mbox-l" style="color:#166634">Protein</div><div style="font-size:11px;color:#166634;margin-top:4px">' + Math.round(m.p*4/tc*100) + '%</div></div>'
    + '<div class="mbox" style="background:#EFF6FF;flex:1"><div class="mbox-n" style="color:#1D4ED8">' + m.c + 'g</div><div class="mbox-l" style="color:#1E40AF">Carbs</div><div style="font-size:11px;color:#1E40AF;margin-top:4px">' + Math.round(m.c*4/tc*100) + '%</div></div>'
    + '<div class="mbox" style="background:#FFFBEB;flex:1"><div class="mbox-n" style="color:#D97706">' + m.f + 'g</div><div class="mbox-l" style="color:#92400E">Fat</div><div style="font-size:11px;color:#92400E;margin-top:4px">' + Math.round(m.f*9/tc*100) + '%</div></div>'
    + '</div>'
    + '<div class="info-box"><div class="info-ic">i</div><div>Protein: ' + Math.round(m.p/U.weight*10)/10 + 'g per kg bodyweight — sufficient for your goal.</div></div>');
}
function openStepsModal() {
  openModal('<div class="modal-title">🏃 Steps to Calories</div><div class="modal-sub">Based on your weight (' + U.weight + 'kg) and average walking pace</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">'
    + [[2000,60,55],[5000,150,138],[7500,225,207],[10000,300,276],[12000,360,331],[15000,450,414]].map(r =>
      '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;background:var(--bg);font-size:13px">'
      + '<div style="font-weight:700;width:70px">' + r[0].toLocaleString() + '</div>'
      + '<div style="flex:1;color:var(--mut)">steps ≈</div>'
      + '<div style="font-weight:800;color:var(--g)">' + Math.round(r[1]*U.weight/70) + ' kcal</div>'
      + '<div style="font-size:11px;color:var(--mut);width:50px">' + r[2] + ' min</div>'
      + '</div>'
    ).join('')
    + '</div>');
}
function openIdealWeightModal() {
  var h = U.height / 100;
  var formulas = [
    ['Devine (1974)', U.gender==='female'?45.5+2.3*(U.height/2.54-60):50+2.3*(U.height/2.54-60)],
    ['Robinson (1983)', U.gender==='female'?49+1.7*(U.height/2.54-60):52+1.9*(U.height/2.54-60)],
    ['Miller (1983)', U.gender==='female'?53.1+1.36*(U.height/2.54-60):56.2+1.41*(U.height/2.54-60)],
    ['BMI Range Min', Math.round(18.5*h*h*10)/10],
    ['BMI Range Max', Math.round(24.9*h*h*10)/10],
  ];
  openModal('<div class="modal-title">⚖️ Ideal Weight Finder</div><div class="modal-sub">5 medical formulas for height ' + U.height + 'cm</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">'
    + formulas.map(f => '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:9px;background:var(--bg);font-size:13px"><span>' + f[0] + '</span><span style="font-weight:800;color:var(--g)">' + Math.round(f[1]*10)/10 + ' kg</span></div>').join('')
    + '</div><div class="info-box" style="margin-top:12px"><div class="info-ic">i</div><div>Average across formulas: <strong>' + Math.round(formulas.reduce((s,f)=>s+f[1],0)/formulas.length*10)/10 + ' kg</strong>. Your current weight: <strong>' + U.weight + ' kg</strong>.</div></div>');
}
function openNutScoreModal() {
  var tc = calcTarget(calcTDEE()); var eaten = FOOD_LOG.reduce((s,f)=>s+f.cal,0);
  openModal('<div class="modal-title">📊 Your Nutrition Score</div><div class="modal-sub">Weekly performance breakdown</div>'
    + '<div style="text-align:center;padding:16px 0"><div style="font-family:\'Playfair Display\',serif;font-size:3rem;font-weight:900;color:var(--g)">87</div><div style="color:var(--mut);font-size:13px">out of 100</div></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + [['Calorie accuracy',Math.round(eaten/tc*100),'How close you are to your daily calorie target'],['Protein goal',90,'Protein intake vs your '+calcMacros(tc).p+'g target'],['Meal timing',78,'Consistency of eating at regular intervals'],['Vegetable intake',62,'Servings of vegetables vs 5/day target'],['Hydration',Math.round(WATER_CUPS/8*100),'Water intake vs your '+Math.round(U.weight*0.033*10)/10+'L goal'],['Sleep quality',72,'Based on your logged sleep hours and quality']].map(s => '<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="font-weight:500">' + s[0] + '</span><span style="font-weight:800;color:var(--g)">' + s[1] + '%</span></div><div class="pb"><div class="pbf" style="width:'+s[1]+'%;background:' + (s[1]>80?'var(--g)':s[1]>60?'#F5A623':'#E8523A') + '"></div></div><div style="font-size:11px;color:var(--mut);margin-top:2px">' + s[2] + '</div></div>').join('')
    + '</div>');
}

// ─── DASHBOARD ───
function renderDash() {
  var tdee = calcTDEE(); var tc = calcTarget(tdee); var m = calcMacros(tc);
  var eaten = FOOD_LOG.reduce((s, f) => s + f.cal, 0);
  var burned = Math.round(tdee * 0.28);
  var steps = 8241;
  var spent = Math.round(U.budget * 0.71);
  var score = Math.min(100, Math.round((eaten/tc)*40 + (WATER_CUPS/8)*20 + (steps/10000)*25 + 15));

  document.getElementById('dashContent').innerHTML =
    '<div class="dash-greeting">'
    + '<div class="dg-top">'
    + '<div><div class="dg-name">Good morning, ' + U.name.split(' ')[0] + '! 🌿</div><div class="dg-sub">Friday, May 1, 2026 · You\'re doing great — keep the momentum!</div></div>'
    + '<div class="dg-score"><div class="dg-score-n">' + score + '</div><div class="dg-score-l">/100 Health Score</div></div>'
    + '</div>'
    + '<div class="hs-grid">'
    + '<div class="hs"><div class="hs-n">' + eaten + '</div><div class="hs-l">Calories eaten</div><div class="hs-t tup">↑ ' + Math.round(eaten/tc*100) + '% of goal</div></div>'
    + '<div class="hs"><div class="hs-n">' + steps.toLocaleString() + '</div><div class="hs-l">Steps today</div><div class="hs-t tup">↑ 82% of 10k goal</div></div>'
    + '<div class="hs"><div class="hs-n">' + burned + '</div><div class="hs-l">Cals burned</div><div class="hs-t tup">↑ 12% above avg</div></div>'
    + '<div class="hs"><div class="hs-n">৳' + spent + '</div><div class="hs-l">Budget spent</div><div class="hs-t tdn">৳' + (U.budget-spent) + ' remaining</div></div>'
    + '</div></div>'

    + '<div class="notif-bar notif-green"><span>⚡</span><span>Wearable synced 3 min ago · <strong>' + steps.toLocaleString() + ' steps</strong> today · ' + (U.wearable !== 'none' ? U.wearable + ' connected' : 'No wearable — add one in Profile') + '</span></div>'

    + '<div class="g2">'
    + '<div class="card"><div class="ct">Today\'s macros <span class="ct-badge">Live</span></div>'
    + '<div class="ring-wrap"><div class="ring-c"><canvas class="ring-canvas" id="macRing" width="120" height="120"></canvas><div class="ring-mid"><div class="ring-n">' + eaten + '</div><div class="ring-u">kcal eaten</div></div></div>'
    + '<div class="ring-leg"><div class="rl"><span class="rl-dot" style="background:#1A6B3C"></span>Carbs<span class="rl-r">' + Math.round(m.c*0.9) + 'g</span></div><div class="rl"><span class="rl-dot" style="background:#4CAF78"></span>Protein<span class="rl-r">' + Math.round(m.p*0.9) + 'g</span></div><div class="rl"><span class="rl-dot" style="background:#F5A623"></span>Fat<span class="rl-r">' + Math.round(m.f*0.9) + 'g</span></div></div></div>'
    + '<div style="margin-top:14px">'
    + '<div class="pb-row"><div class="pb-hd"><span>Protein</span><span style="font-weight:700">' + Math.round(m.p*0.9) + ' / ' + m.p + 'g</span></div><div class="pb"><div class="pbf" style="width:90%;background:#4CAF78"></div></div></div>'
    + '<div class="pb-row"><div class="pb-hd"><span>Carbohydrates</span><span style="font-weight:700">' + Math.round(m.c*0.9) + ' / ' + m.c + 'g</span></div><div class="pb"><div class="pbf" style="width:90%;background:#1A6B3C"></div></div></div>'
    + '<div class="pb-row"><div class="pb-hd"><span>Fat</span><span style="font-weight:700">' + Math.round(m.f*0.9) + ' / ' + m.f + 'g</span></div><div class="pb"><div class="pbf" style="width:90%;background:#F5A623"></div></div></div>'
    + '<div class="pb-row" style="margin-bottom:0"><div class="pb-hd"><span>💧 Water</span><span style="font-weight:700">' + (WATER_CUPS*250/1000).toFixed(1) + ' / ' + Math.round(U.weight*0.033*10)/10 + 'L</span></div><div class="pb"><div class="pbf" style="width:' + Math.round(WATER_CUPS/8*100) + '%;background:#74C0E8"></div></div></div>'
    + '</div></div>'

    + '<div class="card wear-card"><div class="ct">Wearable · ' + (U.wearable !== 'none' ? U.wearable : 'No device') + '</div>'
    + '<div class="w-dev"><div class="w-ic">⌚</div><div><div class="w-nm">' + (U.wearable !== 'none' ? U.wearable : 'Add a wearable in Profile') + '</div><div class="w-st">' + (U.wearable !== 'none' ? '<span class="pdot"></span>Connected · synced 3m ago' : 'Connect for real-time tracking') + '</div></div></div>'
    + '<div class="vit-g"><div class="vit"><div class="vit-v">72 <span style="font-size:11px;opacity:.6">bpm</span></div><div class="vit-l">❤️ Heart rate</div></div>'
    + '<div class="vit"><div class="vit-v">98 <span style="font-size:11px;opacity:.6">%</span></div><div class="vit-l">🩸 SpO₂</div></div>'
    + '<div class="vit"><div class="vit-v">' + steps.toLocaleString() + '</div><div class="vit-l">👟 Steps</div></div>'
    + '<div class="vit"><div class="vit-v">' + burned + ' <span style="font-size:11px;opacity:.6">kcal</span></div><div class="vit-l">🔥 Burned</div></div>'
    + '<div class="vit"><div class="vit-v">6.2 <span style="font-size:11px;opacity:.6">hr</span></div><div class="vit-l">😴 Sleep</div></div>'
    + '<div class="vit"><div class="vit-v">42 <span style="font-size:11px;opacity:.6">HRV</span></div><div class="vit-l">📊 Recovery</div></div></div></div>'
    + '</div>'

    + '<div class="g2">'
    + '<div class="card"><div class="ct">Weekly calorie trend</div><div style="position:relative;height:185px"><canvas id="weekChart"></canvas></div></div>'
    + '<div class="card"><div class="ct">Health goals</div>'
    + '<div class="goal-item"><div class="gi-ic" style="background:#D8F3DC">🏃</div><div class="gi-inf"><div class="gi-nm">Daily step count</div><div class="pb" style="margin:4px 0"><div class="pbf" style="width:82%;background:var(--g)"></div></div><div class="gi-st">' + steps.toLocaleString() + ' / 10,000 steps</div></div><div class="gi-pct">82%</div></div>'
    + '<div class="goal-item"><div class="gi-ic" style="background:#FEF9E7">🥗</div><div class="gi-inf"><div class="gi-nm">Vegetable servings</div><div class="pb" style="margin:4px 0"><div class="pbf" style="width:60%;background:#F5A623"></div></div><div class="gi-st">3 / 5 servings today</div></div><div class="gi-pct" style="color:#D97706">60%</div></div>'
    + '<div class="goal-item"><div class="gi-ic" style="background:#EFF6FF">💧</div><div class="gi-inf"><div class="gi-nm">Hydration</div><div class="pb" style="margin:4px 0"><div class="pbf" style="width:' + Math.round(WATER_CUPS/8*100) + '%;background:#74C0E8"></div></div><div class="gi-st">' + (WATER_CUPS*0.25).toFixed(1) + ' / ' + Math.round(U.weight*0.033*10)/10 + 'L</div></div><div class="gi-pct" style="color:#1A6A8A">' + Math.round(WATER_CUPS/8*100) + '%</div></div>'
    + '<div class="goal-item" style="margin-bottom:0"><div class="gi-ic" style="background:#FEE2E2">😴</div><div class="gi-inf"><div class="gi-nm">Sleep quality</div><div class="pb" style="margin:4px 0"><div class="pbf" style="width:78%;background:#F87171"></div></div><div class="gi-st">6.2 / 8 hours · Fair</div></div><div class="gi-pct" style="color:#DC2626">78%</div></div>'
    + '</div></div>'

    + '<div class="g3">'
    // budget
    + '<div class="card"><div class="ct">Budget today</div>'
    + '<div class="budget-wheel"><canvas class="bw-canvas" id="budChart" width="140" height="140"></canvas><div class="bw-center"><div class="bw-n">৳' + spent + '</div><div class="bw-l">of ৳' + U.budget + '</div></div></div>'
    + '<div class="bud-row"><span class="bud-lbl">Breakfast</span><span class="bud-v" style="color:var(--g)">৳' + Math.round(U.budget*0.17) + '</span></div>'
    + '<div class="bud-row"><span class="bud-lbl">Lunch</span><span class="bud-v" style="color:#D97706">৳' + Math.round(U.budget*0.28) + '</span></div>'
    + '<div class="bud-row"><span class="bud-lbl">Snack</span><span class="bud-v" style="color:var(--g)">৳' + Math.round(U.budget*0.11) + '</span></div>'
    + '<div class="bud-row"><span class="bud-lbl">Dinner (planned)</span><span class="bud-v" style="color:var(--mut)">৳' + Math.round(U.budget*0.2) + '</span></div>'
    + '<div class="bud-row"><span class="bud-lbl" style="font-weight:700">Remaining</span><span class="bud-v" style="color:var(--g);font-size:15px">৳' + (U.budget-spent) + '</span></div>'
    + '</div>'
    // streak
    + '<div class="card"><div class="ct">Daily streak 🔥</div>'
    + '<div class="streak-fire">🔥</div><div class="streak-n">' + STREAK + '</div><div class="streak-l">day streak · Keep it going!</div>'
    + '<div class="streak-days">'
    + ['S','M','T','W','T','F','S'].map((d,i) => '<div class="sd ' + (i < STREAK-1 ? 'done' : i === STREAK-1 ? 'today' : 'miss') + '">' + d + '</div>').join('')
    + '</div>'
    + '<div class="water-cups" style="margin-top:14px"><div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">💧 Tap to log water</div><div style="display:flex;gap:6px;flex-wrap:wrap">'
    + Array.from({length:8},(_,i) => '<div class="wcup' + (i < WATER_CUPS ? ' filled' : '') + '" onclick="logWater(' + i + ')">💧</div>').join('')
    + '</div></div>'
    + '</div>'
    // prediction
    + '<div class="card"><div class="ct">7-day AI prediction</div><div style="position:relative;height:140px"><canvas id="predChart"></canvas></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">'
    + '<div style="background:var(--gp);border-radius:10px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.1rem;font-weight:900;color:var(--g)">' + (U.goal==='lose'?Math.round((U.weight-0.4)*10)/10:U.goal==='gain'?Math.round((U.weight+0.6)*10)/10:U.weight) + 'kg</div><div style="font-size:10px;color:var(--mut)">Projected weight</div></div>'
    + '<div style="background:#EFF6FF;border-radius:10px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.1rem;font-weight:900;color:#1D4ED8">+8%</div><div style="font-size:10px;color:var(--mut)">Energy trend</div></div>'
    + '<div style="background:#FFFBEB;border-radius:10px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.1rem;font-weight:900;color:#D97706">' + tc + '</div><div style="font-size:10px;color:var(--mut)">Avg daily kcal</div></div>'
    + '<div style="background:#FEF2F2;border-radius:10px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.1rem;font-weight:900;color:#DC2626">6.5hr</div><div style="font-size:10px;color:var(--mut)">Predicted sleep</div></div>'
    + '</div></div>'
    + '</div>';

  setTimeout(() => initDashCharts(tc), 50);
}

function logWater(i) {
  WATER_CUPS = (WATER_CUPS === i+1) ? i : i+1;
  goDash();
}

function initDashCharts(tc) {
  Object.values(CHARTS).forEach(c => { try { c.destroy(); } catch(e){} });
  CHARTS = {};
  var m = calcMacros(tc);
  var mr = document.getElementById('macRing');
  if (mr) CHARTS.mac = new Chart(mr.getContext('2d'), {type:'doughnut',data:{datasets:[{data:[m.c,m.p,m.f],backgroundColor:['#1A6B3C','#4CAF78','#F5A623'],borderWidth:0,hoverOffset:3}]},options:{cutout:'72%',plugins:{legend:{display:false},tooltip:{enabled:false}},responsive:false}});
  var wc = document.getElementById('weekChart');
  if (wc) CHARTS.wk = new Chart(wc.getContext('2d'),{type:'bar',data:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],datasets:[{data:[tc-40,tc-120,tc+80,tc-60,FOOD_LOG.reduce((s,f)=>s+f.cal,0),0,0],backgroundColor:['#4CAF78','#4CAF78','#4CAF78','#4CAF78','#1A6B3C','#E0E8E0','#E0E8E0'],borderRadius:7,barPercentage:.65}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:11}}},y:{grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{size:10}}}}}});
  var bc = document.getElementById('budChart');
  var pct = Math.round((U.budget*0.71)/U.budget*100);
  if (bc) CHARTS.bud = new Chart(bc.getContext('2d'),{type:'doughnut',data:{datasets:[{data:[pct,100-pct],backgroundColor:['#1A6B3C','#E0E8E0'],borderWidth:0}]},options:{cutout:'68%',rotation:-90,circumference:180,plugins:{legend:{display:false},tooltip:{enabled:false}},responsive:false}});
  var pc = document.getElementById('predChart');
  if (pc) CHARTS.pred = new Chart(pc.getContext('2d'),{type:'line',data:{labels:['Today','Sat','Sun','Mon','Tue','Wed','Thu'],datasets:[{data:[tc,tc-60,tc+90,tc-30,tc+50,tc-20,tc+10],borderColor:'#1A6B3C',backgroundColor:'rgba(26,107,60,.07)',fill:true,tension:.4,pointBackgroundColor:'#1A6B3C',pointRadius:3,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{size:10}}}}}});
}

// ─── MEALS ───
function renderMeals() {
  var tc = calcTarget(calcTDEE());
  var days = [
    {day:'Today — Friday, May 1', cals:tc, meals:[
      {t:'Breakfast',n:'Oats + banana + chia seeds',e:'🥣',kcal:Math.round(tc*.25),carb:'48g',prot:'12g',fat:'7g',cost:Math.round(U.budget*.17)},
      {t:'Lunch',n:'Lentil dal + brown rice + spinach',e:'🍛',kcal:Math.round(tc*.35),carb:'72g',prot:'22g',fat:'6g',cost:Math.round(U.budget*.28)},
      {t:'Snack',n:'Mixed nuts & dates',e:'🥜',kcal:Math.round(tc*.1),carb:'18g',prot:'6g',fat:'12g',cost:Math.round(U.budget*.1)},
      {t:'Dinner',n:'Grilled chicken khichuri',e:'🍲',kcal:Math.round(tc*.3),carb:'65g',prot:'38g',fat:'11g',cost:Math.round(U.budget*.2)},
    ]},
    {day:'Saturday, May 2', cals:Math.round(tc*.97), meals:[
      {t:'Breakfast',n:'Egg paratha + green tea',e:'🫓',kcal:Math.round(tc*.24),carb:'45g',prot:'18g',fat:'14g',cost:Math.round(U.budget*.15)},
      {t:'Lunch',n:'Fish curry + brown rice + salad',e:'🐟',kcal:Math.round(tc*.35),carb:'68g',prot:'28g',fat:'10g',cost:Math.round(U.budget*.25)},
      {t:'Snack',n:'Greek yogurt + honey',e:'🥛',kcal:Math.round(tc*.09),carb:'20g',prot:'8g',fat:'3g',cost:Math.round(U.budget*.09)},
      {t:'Dinner',n:'Veg stir-fry + whole wheat roti',e:'🥦',kcal:Math.round(tc*.29),carb:'52g',prot:'14g',fat:'9g',cost:Math.round(U.budget*.18)},
    ]},
    {day:'Sunday, May 3', cals:Math.round(tc*1.02), meals:[
      {t:'Breakfast',n:'Semolina upma + boiled eggs',e:'🍳',kcal:Math.round(tc*.25),carb:'50g',prot:'20g',fat:'10g',cost:Math.round(U.budget*.16)},
      {t:'Lunch',n:'Chicken biryani (light) + raita',e:'🍚',kcal:Math.round(tc*.36),carb:'88g',prot:'32g',fat:'16g',cost:Math.round(U.budget*.3)},
      {t:'Snack',n:'Fruit salad + seed mix',e:'🍉',kcal:Math.round(tc*.09),carb:'24g',prot:'4g',fat:'5g',cost:Math.round(U.budget*.08)},
      {t:'Dinner',n:'Mixed dal + vegetable curry + roti',e:'🍜',kcal:Math.round(tc*.3),carb:'70g',prot:'18g',fat:'7g',cost:Math.round(U.budget*.19)},
    ]}
  ];

  // Shopping list
  var shopping = [
    {n:'Oats (500g)',qty:'1 pack',price:Math.round(U.budget*.08),cat:'🌾 Grains'},
    {n:'Brown rice (1kg)',qty:'1 bag',price:Math.round(U.budget*.1),cat:'🌾 Grains'},
    {n:'Chicken breast',qty:'500g',price:Math.round(U.budget*.2),cat:'🥩 Protein'},
    {n:'Lentils (masoor dal)',qty:'500g',price:Math.round(U.budget*.07),cat:'🫘 Legumes'},
    {n:'Spinach',qty:'1 bunch',price:Math.round(U.budget*.04),cat:'🥬 Vegetables'},
    {n:'Eggs',qty:'12 pcs',price:Math.round(U.budget*.1),cat:'🥚 Protein'},
    {n:'Banana',qty:'6 pcs',price:Math.round(U.budget*.05),cat:'🍌 Fruits'},
    {n:'Mixed nuts (100g)',qty:'1 pack',price:Math.round(U.budget*.08),cat:'🥜 Snacks'},
    {n:'Fish (rohu/katla)',qty:'500g',price:Math.round(U.budget*.15),cat:'🐟 Protein'},
  ];

  document.getElementById('mealContent').innerHTML =
    '<div class="page-hdr">'
    + '<div><div class="page-title">Weekly Meal Plan</div><div class="page-sub">Personalized for ' + goalLbl() + ' · ৳' + U.budget + '/day · AI-powered</div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button class="action-btn" onclick="regenMeals()">✨ Regenerate AI plan</button>'
    + '<button class="sec-btn" onclick="">🛒 Shopping list</button>'
    + '</div></div>'
    + '<div class="notif-bar notif-blue">💡 Based on your activity, tonight\'s dinner has been upgraded with extra +' + Math.round(U.weight*.15) + 'g protein to support recovery.</div>'
    + days.map(day =>
      '<div class="meal-section"><div class="meal-day-hdr"><div class="meal-day-t">' + day.day + '</div><div class="meal-day-meta">Target: ' + day.cals + ' kcal · ৳' + U.budget + '</div></div>'
      + '<div class="meals-row">'
      + day.meals.map(ml => '<div class="mc"><div class="mc-type">' + ml.t + '</div><span class="mc-em">' + ml.e + '</span><div class="mc-nm">' + ml.n + '</div><div class="mpills"><span class="mp mp-c">' + ml.carb + ' C</span><span class="mp mp-p">' + ml.prot + ' P</span><span class="mp mp-f">' + ml.fat + ' F</span></div><div class="mc-cost">৳' + ml.cost + ' · ' + ml.kcal + ' kcal</div></div>').join('')
      + '</div></div>'
    ).join('')
    + '<div class="card" style="margin-top:18px"><div class="ct">🛒 Weekly shopping list <span class="ct-badge">~৳' + Math.round(U.budget*0.9) + ' total</span></div>'
    + shopping.map((s,i) => '<div class="shop-item"><div class="shop-cb" id="cb'+i+'" onclick="togShop('+i+')"></div><span class="shop-nm" id="snm'+i+'">'+s.cat+' '+s.n+'</span><span class="shop-qty">'+s.qty+'</span><span class="shop-price">৳'+s.price+'</span></div>').join('')
    + '</div>';
}

function togShop(i) {
  var cb = document.getElementById('cb'+i);
  var nm = document.getElementById('snm'+i);
  cb.classList.toggle('checked');
  if (cb.classList.contains('checked')) { cb.textContent = '✓'; nm.classList.add('done'); }
  else { cb.textContent = ''; nm.classList.remove('done'); }
}

function regenMeals() {
  document.getElementById('mealContent').innerHTML = '<div style="text-align:center;padding:4rem;color:var(--mut)"><div style="font-size:3rem;margin-bottom:12px">✨</div><div style="font-size:16px;font-weight:600">Regenerating meal plan with AI...</div><div style="font-size:13px;margin-top:6px">Analyzing your activity, goals, and budget...</div></div>';
  setTimeout(() => renderMeals(), 1200);
}

// ─── FOOD LOG ───
function renderLog() {
  var tc = calcTarget(calcTDEE());
  var eaten = FOOD_LOG.reduce((s, f) => s + f.cal, 0);
  var remaining = tc - eaten;
  document.getElementById('logContent').innerHTML =
    '<div class="page-hdr"><div><div class="page-title">📝 Food Log</div><div class="page-sub">Track every meal — accurate logging = accurate results</div></div></div>'
    + '<div class="g2" style="margin-bottom:16px">'
    + '<div class="card">'
    + '<div class="ct">Quick add food</div>'
    + '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:10px">'
    + '<input class="fi" id="fNm" placeholder="Food name (e.g. Rice + dal)" style="font-size:13px">'
    + '<input class="fi" id="fCal" type="number" placeholder="kcal" style="font-size:13px">'
    + '<button class="action-btn" style="justify-content:center" onclick="addFood()">+ Add</button>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--mut);margin-bottom:14px">Quick add:</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">'
    + [['🥣 Oats',320],['🍚 Rice+dal',480],['🐟 Fish curry',380],['🥚 Boiled egg',78],['🍌 Banana',89],['🥜 Nuts (30g)',180],['🥛 Milk 250ml',150],['🧃 Fruit juice',120]].map(q => '<button onclick="quickAdd(\'' + q[0] + '\',' + q[1] + ')" style="background:var(--gp);border:1px solid var(--bdr2);border-radius:20px;padding:5px 11px;font-size:12px;cursor:pointer;color:var(--g);font-weight:500;font-family:\'Outfit\',sans-serif;transition:.15s" onmouseover="this.style.background=\'var(--g)\';this.style.color=\'#fff\'" onmouseout="this.style.background=\'var(--gp)\';this.style.color=\'var(--g)\'">' + q[0] + ' · ' + q[1] + 'kcal</button>').join('')
    + '</div>'
    + '<div class="ct" style="margin-bottom:10px">Today\'s log</div>'
    + '<div id="foodLogList">' + renderFoodList() + '</div>'
    + '</div>'
    + '<div class="card">'
    + '<div class="ct">Calorie balance</div>'
    + '<div style="text-align:center;margin-bottom:16px">'
    + '<div class="ring-c" style="margin:0 auto;width:130px;height:130px"><canvas id="calRing" width="130" height="130"></canvas><div class="ring-mid"><div class="ring-n">' + remaining + '</div><div class="ring-u">kcal left</div></div></div>'
    + '</div>'
    + '<div class="bud-row"><span class="bud-lbl">Daily target</span><span class="bud-v">' + tc + ' kcal</span></div>'
    + '<div class="bud-row"><span class="bud-lbl">Eaten</span><span class="bud-v" style="color:var(--g)">' + eaten + ' kcal</span></div>'
    + '<div class="bud-row"><span class="bud-lbl">Remaining</span><span class="bud-v" style="color:' + (remaining < 0 ? 'var(--co)' : 'var(--g)') + '">' + remaining + ' kcal</span></div>'
    + '<div class="bud-row" style="border-top:none"><span class="bud-lbl">Burned (est.)</span><span class="bud-v" style="color:#1D4ED8">' + Math.round(calcTDEE()*.28) + ' kcal</span></div>'
    + '<div style="background:var(--gp);border-radius:10px;padding:10px 12px;font-size:12.5px;color:#1A4A2A;margin-top:10px;line-height:1.6">🎯 You\'ve consumed <strong>' + Math.round(eaten/tc*100) + '%</strong> of your goal. ' + (eaten/tc > 0.9 ? 'On track! Keep maintaining.' : 'Still some room — make dinner count!') + '</div>'
    + '</div></div>';

  setTimeout(() => {
    var tc2 = calcTarget(calcTDEE());
    var eaten2 = FOOD_LOG.reduce((s, f) => s + f.cal, 0);
    var cr = document.getElementById('calRing');
    if (cr) new Chart(cr.getContext('2d'), {type:'doughnut',data:{datasets:[{data:[eaten2, Math.max(0,tc2-eaten2)],backgroundColor:['#1A6B3C','#E0E8E0'],borderWidth:0}]},options:{cutout:'72%',plugins:{legend:{display:false},tooltip:{enabled:false}},responsive:false}});
  }, 50);
}

function renderFoodList() {
  if (!FOOD_LOG.length) return '<div style="text-align:center;padding:2rem;color:var(--mut);font-size:13px">No foods logged yet. Add your first meal above!</div>';
  return FOOD_LOG.map((f, i) =>
    '<div class="food-log-item"><span class="fl-em">' + f.em + '</span><div class="fl-info"><div class="fl-nm">' + f.nm + '</div><div class="fl-time">' + f.time + ' · ' + f.type + '</div></div><span class="fl-cal">' + f.cal + ' kcal</span><button class="fl-del" onclick="delFood(' + i + ')">🗑</button></div>'
  ).join('');
}

async function addFood() {
  var nm = document.getElementById('fNm').value.trim();
  var cal = parseInt(document.getElementById('fCal').value);

  if (!nm || !cal) {
    alert("Please enter food name and calories");
    return;
  }

  try {
    const data = await api("add_food", {
      emoji: "🍽️",
      food_name: nm,
      calories: cal,
      meal_type: "Custom"
    });

    applyBackendData(data);
    renderLog();

    alert("Food saved to database!");

  } catch (err) {
    alert("Food save failed: " + err.message);
  }
}

function quickAdd(nm, cal) {
  var em = nm.split(' ')[0];
  var name = nm.split(' ').slice(1).join(' ').replace(/·.*/, '').trim();
  FOOD_LOG.push({em, nm:name, cal, time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), type:'Quick add'});
  renderLog();
}

function delFood(i) { FOOD_LOG.splice(i, 1); renderLog(); }

// ─── AI COACH ───
var aiIdx = 0;
var aiReplies = [
  "Based on your current data, I recommend increasing leafy greens intake. Spinach and kale are iron-rich and anti-inflammatory — perfect for your recovery profile.",
  "Your sleep score is 6.2 hours tonight — below optimal. I suggest magnesium-rich foods: spinach, dark chocolate, and pumpkin seeds. Also avoid screens 1 hour before bed.",
  "Great job hitting your protein today! With your " + (function(){return 0;})() + " goal, timing matters. Eat protein every 3–4 hours for optimal muscle protein synthesis.",
  "Your wearable shows elevated resting heart rate today. This might indicate under-recovery. I'd recommend a lighter meal today — maybe lentil soup instead of the heavier biryani.",
  "Based on your budget and macros, tomorrow's most efficient meal is: dal + rice + egg (৳85, ~480 kcal, 28g protein). Want me to add it to your meal plan?",
  "Hydration alert! You're behind on water today. With your body weight, you need " + Math.round(70*0.033*10)/10 + "L daily. Dehydration reduces metabolism by up to 3%.",
];

function renderAI() {
  var tc = calcTarget(calcTDEE()); var m = calcMacros(tc);
  aiReplies[2] = "Great job hitting your protein today! With your " + goalLbl() + " goal, timing matters. Eat " + Math.round(m.p/4) + "g protein every 3-4 hours for optimal muscle protein synthesis.";
  aiReplies[5] = "Hydration alert! You're behind on water today. With your body weight, you need " + Math.round(U.weight*0.033*10)/10 + "L daily. Dehydration reduces metabolism by up to 3%.";

  document.getElementById('aiContent').innerHTML =
    '<div class="page-hdr"><div><div class="page-title">🤖 AI Nutrition Coach</div><div class="page-sub">Powered by real-time wearable data + nutrition science + your personal profile</div></div></div>'
    + '<div class="g2" style="align-items:start">'
    + '<div>'
    + '<div class="ins-card" style="background:#F0FDF4;border-color:#BBF7D0"><div class="ins-hd"><div class="ins-ic" style="background:var(--g);color:#fff">🏆</div><div class="ins-t">Protein timing opportunity</div></div><div class="ins-body">Your workout ended 45 min ago — this is the <strong>peak anabolic window</strong>. Consuming ' + Math.round(m.p*0.25) + 'g protein in the next 15 min maximizes muscle protein synthesis. Your planned chicken dinner is perfect!</div><button class="ins-btn" style="background:var(--g);color:#fff" onclick="goLog()">Log meal now →</button></div>'
    + '<div class="ins-card" style="background:#FFFBEB;border-color:#FDE68A"><div class="ins-hd"><div class="ins-ic" style="background:#D97706;color:#fff">😴</div><div class="ins-t">Sleep recovery alert</div></div><div class="ins-body">You slept 6.2 hours — below the 7–9 hr target. <strong>Low sleep raises cortisol by 37%</strong> and increases high-carb cravings. Today, prioritize: spinach, banana, pumpkin seeds (all magnesium-rich). Avoid caffeine after 2 PM.</div><button class="ins-btn" style="background:#D97706;color:#fff">See sleep-optimized meals →</button></div>'
    + '<div class="ins-card" style="background:#EFF6FF;border-color:#BFDBFE"><div class="ins-hd"><div class="ins-ic" style="background:#1D4ED8;color:#fff">💧</div><div class="ins-t">Hydration deficit detected</div></div><div class="ins-body">You need <strong>' + Math.round(U.weight*0.033*10)/10 + 'L</strong> of water daily for your weight. Currently at ' + (WATER_CUPS*0.25).toFixed(1) + 'L. With today\'s activity and heat, dehydration impairs performance by up to 10%. Drink a glass every 30 min.</div><button class="ins-btn" style="background:#1D4ED8;color:#fff" onclick="goDash()">Set water reminders →</button></div>'
    + '<div class="ins-card" style="background:#FEF2F2;border-color:#FECACA"><div class="ins-hd"><div class="ins-ic" style="background:#DC2626;color:#fff">⚠️</div><div class="ins-t">Micronutrient gap</div></div><div class="ins-body">Your last 3 days show low <strong>iron and Vitamin D</strong> intake. Add: liver (weekly), fortified milk, egg yolk, and 15 min of sunlight daily. Iron deficiency causes fatigue and reduces fat-burning efficiency.</div><button class="ins-btn" style="background:#DC2626;color:#fff">See iron-rich meal ideas →</button></div>'
    + '</div>'
    + '<div>'
    + '<div class="chat-wrap" style="margin-bottom:16px"><div class="chat-hd"><div class="chat-av">🤖</div><div><div class="chat-t">BitBite AI Coach</div><div style="font-size:11px;opacity:.7"><span class="pdot"></span>Online · Health data synced</div></div></div>'
    + '<div class="chat-body" id="chatBody"><div class="msg msg-ai">Hi <strong>' + U.name.split(' ')[0] + '</strong>! I\'ve analyzed your profile, wearable data, and food log. Your goal is <strong>' + goalLbl() + '</strong>. You\'re currently at ' + Math.round(FOOD_LOG.reduce((s,f)=>s+f.cal,0)/calcTarget(calcTDEE())*100) + '% of today\'s calorie target. What would you like help with?</div></div>'
    + '<div class="chat-inp"><input class="chat-in" id="chatIn" placeholder="Ask about nutrition, meal timing, recovery..." onkeydown="if(event.key===\'Enter\')sendMsg()"><button class="chat-send" onclick="sendMsg()">Send</button></div></div>'

    + '<div class="card"><div class="ct">Weekly nutrition score</div><div style="position:relative;height:150px"><canvas id="nutChart"></canvas></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">'
    + '<div style="background:var(--gp);border-radius:9px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.3rem;font-weight:900;color:var(--g)">87</div><div style="font-size:10px;color:var(--mut)">Avg nutrition score</div></div>'
    + '<div style="background:#FEF9E7;border-radius:9px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.3rem;font-weight:900;color:#D97706">' + STREAK + '</div><div style="font-size:10px;color:var(--mut)">Day logging streak</div></div>'
    + '</div></div>'
    + '</div></div>';

  setTimeout(() => {
    var nc = document.getElementById('nutChart');
    if (nc) new Chart(nc.getContext('2d'), {type:'radar',data:{labels:['Protein','Carbs','Fat','Fiber','Hydration','Micronutrients'],datasets:[{data:[88,76,90,62,68,74],backgroundColor:'rgba(26,107,60,.12)',borderColor:'#1A6B3C',borderWidth:2,pointBackgroundColor:'#1A6B3C',pointRadius:3},{data:[100,100,100,100,100,100],backgroundColor:'transparent',borderColor:'#E0E8E0',borderWidth:1,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{r:{min:0,max:100,ticks:{display:false},grid:{color:'rgba(0,0,0,.05)'},pointLabels:{font:{size:11}}}}}});
  }, 50);
}

function sendMsg() {
  var inp = document.getElementById('chatIn');
  var body = document.getElementById('chatBody');
  var txt = inp.value.trim(); if (!txt) return;
  var um = document.createElement('div'); um.className = 'msg msg-u'; um.textContent = txt;
  body.appendChild(um); inp.value = ''; body.scrollTop = body.scrollHeight;
  var typing = document.createElement('div'); typing.className = 'typing'; typing.innerHTML = '<span></span><span></span><span></span>';
  body.appendChild(typing); body.scrollTop = body.scrollHeight;
  setTimeout(() => {
    body.removeChild(typing);
    var am = document.createElement('div'); am.className = 'msg msg-ai';
    am.innerHTML = aiReplies[aiIdx % aiReplies.length]; aiIdx++;
    body.appendChild(am); body.scrollTop = body.scrollHeight;
  }, 1200);
}

// ─── PROGRESS ───
function renderProgress() {
  var tc = calcTarget(calcTDEE());
  document.getElementById('progressContent').innerHTML =
    '<div class="page-hdr"><div><div class="page-title">📈 Progress Tracker</div><div class="page-sub">Your transformation journey — updated daily</div></div>'
    + '<button class="action-btn" onclick="addWeightEntry()">+ Log weight</button></div>'

    + '<div class="g2">'
    + '<div class="card"><div class="ct">Weight history <span class="ct-badge">kg</span></div>'
    + '<div style="position:relative;height:180px"><canvas id="wtChart"></canvas></div>'
    + '<div class="wt-input-row" style="margin-top:12px"><input class="wt-in" id="wtIn" type="number" step="0.1" placeholder="Enter today\'s weight (kg)"><button class="wt-btn" onclick="logWeight()">Log</button></div>'
    + '<div class="wt-log">' + WEIGHT_LOG.slice().reverse().map((w,i,a) => {
        var prev = a[i+1];
        var diff = prev ? Math.round((w.w - prev.w)*10)/10 : 0;
        var color = diff < 0 ? (U.goal==='lose'?'var(--g)':'var(--co)') : diff > 0 ? (U.goal==='gain'||U.goal==='muscle'?'var(--g)':'var(--co)') : 'var(--mut)';
        return '<div class="wt-row"><span>' + w.date + '</span><span style="font-weight:700">' + w.w + ' kg</span><span class="wt-change" style="color:' + color + '">' + (diff > 0 ? '+' : '') + (diff !== 0 ? diff + 'kg' : '—') + '</span></div>';
      }).join('') + '</div></div>'

    + '<div class="card"><div class="ct">Body composition trend</div>'
    + '<div style="position:relative;height:180px"><canvas id="compChart"></canvas></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">'
    + '<div style="background:var(--gp);border-radius:10px;padding:12px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.3rem;font-weight:900;color:var(--g)">' + Math.round((1-U.bodyFat/100)*U.weight*10)/10 + ' kg</div><div style="font-size:11px;color:var(--mut)">Lean mass estimate</div></div>'
    + '<div style="background:#FEE2E2;border-radius:10px;padding:12px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.3rem;font-weight:900;color:#DC2626">' + Math.round(U.bodyFat/100*U.weight*10)/10 + ' kg</div><div style="font-size:11px;color:var(--mut)">Fat mass estimate</div></div>'
    + '</div></div>'
    + '</div>'

    + '<div class="g3">'
    + '<div class="card"><div class="ct">Achievements</div>'
    + '<div class="ach-grid">'
    + [['🔥','7-day Streak',false],['🏆','10k Steps',false],['💧','Hydration Pro',false],['🥗','Veggie Week',false],['🧘','Mindful Eater',true],['⚡','Power Week',true],['🎯','Goal Setter',false],['📊','Data Driven',false],['💪','Protein King',U.goal!=='muscle']].map(a => '<div class="ach ' + (a[2]?'locked':'') + '" style="background:' + (a[2]?'var(--bg)':'var(--gp)') + ';border-radius:11px"><span class="ach-em">' + a[0] + '</span><div class="ach-lbl" style="color:' + (a[2]?'var(--mut)':'var(--g)') + '">' + a[1] + '</div></div>').join('')
    + '</div></div>'

    + '<div class="card" style="grid-column:span 2"><div class="ct">30-day calorie trend</div>'
    + '<div style="position:relative;height:180px"><canvas id="trend30Chart"></canvas></div>'
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">'
    + '<div style="background:var(--gp);border-radius:9px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.2rem;font-weight:900;color:var(--g)">' + tc + '</div><div style="font-size:10px;color:var(--mut)">Avg daily kcal</div></div>'
    + '<div style="background:#EFF6FF;border-radius:9px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.2rem;font-weight:900;color:#1D4ED8">92%</div><div style="font-size:10px;color:var(--mut)">Goal adherence</div></div>'
    + '<div style="background:#FFFBEB;border-radius:9px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.2rem;font-weight:900;color:#D97706">' + STREAK + '</div><div style="font-size:10px;color:var(--mut)">Day streak</div></div>'
    + '<div style="background:#F0FDF4;border-radius:9px;padding:10px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.2rem;font-weight:900;color:var(--g)">87</div><div style="font-size:10px;color:var(--mut)">Avg health score</div></div>'
    + '</div></div>'
    + '</div>';

  setTimeout(() => {
    var startW = U.weight + (U.goal==='lose'?2.5:U.goal==='gain'?-2.5:0);
    var wtData = Array.from({length: WEIGHT_LOG.length + 6}, (_, i) => {
      var delta = U.goal==='lose' ? -0.4 : U.goal==='gain' ? 0.5 : 0;
      return Math.round((startW + delta*i)*10)/10;
    });
    var wc = document.getElementById('wtChart');
    if (wc) new Chart(wc.getContext('2d'), {type:'line',data:{labels:Array.from({length:wtData.length},(_,i)=>'W'+(i+1)),datasets:[{data:wtData,borderColor:'#1A6B3C',backgroundColor:'rgba(26,107,60,.08)',fill:true,tension:.4,pointBackgroundColor:'#1A6B3C',pointRadius:4,borderWidth:2.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{size:10}}}}}});

    var cc = document.getElementById('compChart');
    if (cc) new Chart(cc.getContext('2d'), {type:'bar',data:{labels:['Jan','Feb','Mar','Apr','May'],datasets:[{label:'Fat',data:[24,23,22,21,U.bodyFat],backgroundColor:'rgba(232,82,58,.6)',borderRadius:5},{label:'Muscle',data:[76,77,78,79,100-U.bodyFat],backgroundColor:'rgba(26,107,60,.7)',borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}},y:{stacked:true,display:false}}}});

    var tc2 = calcTarget(calcTDEE());
    var days30 = Array.from({length:30},(_,i) => tc2 + Math.round(Math.sin(i*.4)*100 + Math.random()*60 - 30));
    var t3 = document.getElementById('trend30Chart');
    if (t3) new Chart(t3.getContext('2d'), {type:'line',data:{labels:Array.from({length:30},(_,i)=>i+1+''),datasets:[{data:days30,borderColor:'#1A6B3C',backgroundColor:'rgba(26,107,60,.06)',fill:true,tension:.3,pointRadius:0,borderWidth:2},{data:Array(30).fill(tc2),borderColor:'rgba(245,166,35,.6)',borderDash:[5,4],borderWidth:1.5,pointRadius:0,fill:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{size:10}}}}}});
  }, 80);
}

async function logWeight() {
  var val = parseFloat(document.getElementById('wtIn').value);

  if (!val || val < 20 || val > 300) {
    alert("Please enter a valid weight");
    return;
  }

  try {
    const data = await api("add_weight", {
      weight: val,
      note: "Logged from frontend"
    });

    applyBackendData(data);
    renderProgress();

    alert("Weight saved to database!");

  } catch (err) {
    alert("Weight save failed: " + err.message);
  }
}

// ─── PROFILE ───
function renderProf() {
  var bmi = calcBMI(); var cat = bmiCat(bmi);
  var tc = calcTarget(calcTDEE()); var m = calcMacros(tc);
  document.getElementById('profContent').innerHTML =
    '<div class="prof-hero">'
    + '<div class="prof-av">' + (U.name||'U').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase() + '</div>'
    + '<div class="prof-info"><h2>' + U.name + '</h2><p>Member since ' + (U.joinDate||'May 2026') + ' · ' + goalLbl() + '</p>'
    + '<div><span class="pb2">🎯 ' + goalLbl() + '</span>'
    + (U.dietPref.length ? '<span class="pb2">🥗 ' + U.dietPref[0] + '</span>' : '')
    + (U.wearable !== 'none' ? '<span class="pb2">⌚ ' + U.wearable + '</span>' : '')
    + '<span class="pb2">⚡ ' + ({sedentary:'Sedentary',light:'Lightly active',moderate:'Moderately active',very:'Very active'}[U.activityLevel]||'Active') + '</span>'
    + '</div></div></div>'

    + '<div class="g3" style="margin-bottom:14px">'
    + '<div class="card"><div class="ct">Body metrics</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    + '<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.4rem;font-weight:900;color:var(--g)">' + U.weight + '</div><div style="font-size:11px;color:var(--mut)">Weight (kg)</div></div>'
    + '<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.4rem;font-weight:900;color:var(--g)">' + U.height + '</div><div style="font-size:11px;color:var(--mut)">Height (cm)</div></div>'
    + '<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.4rem;font-weight:900;color:' + cat.c + '">' + bmi + '</div><div style="font-size:11px;color:var(--mut)">BMI · ' + cat.lbl + '</div></div>'
    + '<div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center"><div style="font-family:\'Playfair Display\',serif;font-size:1.4rem;font-weight:900;color:var(--g)">' + U.bodyFat + '%</div><div style="font-size:11px;color:var(--mut)">Body fat est.</div></div>'
    + '</div>'
    + '<div style="margin-top:10px;background:var(--gp);border-radius:9px;padding:10px 12px;font-size:12px;color:#1A4A2A">TDEE: <strong>' + calcTDEE() + ' kcal</strong> · Target: <strong>' + tc + ' kcal</strong> · Protein: <strong>' + m.p + 'g/day</strong></div>'
    + '</div>'
    + '<div class="card"><div class="ct">Nutrition plan</div>'
    + '<div class="macro-r" style="flex-direction:column;gap:9px">'
    + '<div class="pb-row"><div class="pb-hd"><span>Protein</span><span style="font-weight:700">' + m.p + 'g</span></div><div class="pb"><div class="pbf" style="width:' + Math.round(m.p*4/tc*100) + '%;background:#4CAF78"></div></div></div>'
    + '<div class="pb-row"><div class="pb-hd"><span>Carbohydrates</span><span style="font-weight:700">' + m.c + 'g</span></div><div class="pb"><div class="pbf" style="width:' + Math.round(m.c*4/tc*100) + '%;background:#1A6B3C"></div></div></div>'
    + '<div class="pb-row" style="margin-bottom:0"><div class="pb-hd"><span>Fat</span><span style="font-weight:700">' + m.f + 'g</span></div><div class="pb"><div class="pbf" style="width:' + Math.round(m.f*9/tc*100) + '%;background:#F5A623"></div></div></div>'
    + '</div>'
    + '<div style="background:var(--gp);border-radius:9px;padding:10px 12px;font-size:12px;color:#1A4A2A;margin-top:10px">Water: <strong>' + Math.round(U.weight*0.033*10)/10 + 'L/day</strong> · Fiber: <strong>25–35g/day</strong></div>'
    + '</div>'
    + '<div class="card"><div class="ct">Achievements</div>'
    + '<div class="ach-grid">'
    + [['🔥','7-day Streak',false],['🏆','10k Steps',false],['💧','Hydration Pro',false],['🥗','Veggie Week',false],['🧘','Mindful Eater',true],['⚡','Power Week',true]].map(a => '<div class="ach ' + (a[2]?'locked':'') + '" style="background:' + (a[2]?'var(--bg)':'var(--gp)') + ';border-radius:11px"><span class="ach-em">' + a[0] + '</span><div class="ach-lbl" style="color:' + (a[2]?'var(--mut)':'var(--g)') + '">' + a[1] + '</div></div>').join('')
    + '</div></div></div>'

    + '<div class="sett-grp"><div style="padding:14px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--mut);border-bottom:1px solid var(--bdr)">Account Settings</div>'
    + '<div class="sett-row"><div><div class="sett-lbl">Email address</div><div class="sett-sub">' + (U.email || SESSION || 'Not set') + '</div></div><button style="background:var(--gp);color:var(--g);border:none;border-radius:7px;padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer">Change</button></div>'
    + '<div class="sett-row"><div><div class="sett-lbl">Daily calorie goal</div><div class="sett-sub">' + tc + ' kcal · ' + goalLbl() + '</div></div><button style="background:var(--bg);border:1px solid var(--bdr2);border-radius:7px;padding:7px 13px;font-size:12px;cursor:pointer">Edit</button></div>'
    + '<div class="sett-row"><div><div class="sett-lbl">Daily food budget</div><div class="sett-sub">৳' + U.budget + ' per day</div></div><button style="background:var(--bg);border:1px solid var(--bdr2);border-radius:7px;padding:7px 13px;font-size:12px;cursor:pointer">Edit</button></div>'
    + '<div class="sett-row"><div><div class="sett-lbl">Wearable device</div><div class="sett-sub">' + (U.wearable!=='none'?U.wearable+' · Connected':'No device connected') + '</div></div><button style="background:var(--bg);border:1px solid var(--bdr2);border-radius:7px;padding:7px 13px;font-size:12px;cursor:pointer">Change</button></div>'
    + '</div>'
    + '<div class="sett-grp"><div style="padding:14px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--mut);border-bottom:1px solid var(--bdr)">Notifications & Privacy</div>'
    + '<div class="sett-row"><div><div class="sett-lbl">Meal reminders</div><div class="sett-sub">Smart reminders based on your activity data</div></div><div class="tog" onclick="this.classList.toggle(\'off\')"></div></div>'
    + '<div class="sett-row"><div><div class="sett-lbl">AI health insights</div><div class="sett-sub">Proactive personalized recommendations</div></div><div class="tog" onclick="this.classList.toggle(\'off\')"></div></div>'
    + '<div class="sett-row"><div><div class="sett-lbl">Budget alerts</div><div class="sett-sub">Notify when 80% of daily budget is used</div></div><div class="tog off" onclick="this.classList.toggle(\'off\')"></div></div>'
    + '<div class="sett-row"><div><div class="sett-lbl">Weekly report email</div><div class="sett-sub">Summary of your nutrition and progress</div></div><div class="tog" onclick="this.classList.toggle(\'off\')"></div></div>'
    + '</div>'
    + '<div class="sett-grp"><div class="sett-row" style="cursor:pointer" onclick="logout()"><div><div class="sett-lbl" style="color:#DC2626">Sign out of BitBite</div><div class="sett-sub">You\'ll need your email and password to sign back in</div></div><span style="color:#DC2626;font-size:20px">→</span></div></div>';
}
// ─── MYSQL BACKEND PATCH ───

function setSession(email) {
  SESSION = email;

  if (!U.dietPref) U.dietPref = [];
  if (!U.healthCond) U.healthCond = [];

  document.getElementById('guestBtns').style.display = 'none';
  document.getElementById('uMenu').style.display = 'block';
  document.getElementById('navTabs').style.display = 'flex';

  var av = document.getElementById('avBtn');
  av.textContent = (U.name || 'U').substring(0, 2).toUpperCase();

  document.getElementById('menuName').textContent = (U.name || 'User') + ' · BitBite';
}

function applyBackendData(data) {
  if (data.user) {
    SESSION = data.user.email;
    U = data.user;

    U.height = parseFloat(U.height || 170);
    U.weight = parseFloat(U.weight || 70);
    U.targetWeight = parseFloat(U.targetWeight || 65);
    U.bodyFat = parseFloat(U.bodyFat || 22);
    U.age = parseInt(U.age || 22);
    U.budget = parseFloat(U.budget || 500);

    if (!Array.isArray(U.dietPref)) U.dietPref = [];
    if (!Array.isArray(U.healthCond)) U.healthCond = [];
  }

  FOOD_LOG = (data.food_logs || []).map(f => ({
    id: f.id,
    em: f.em || "🍽️",
    nm: f.nm || f.food_name || "Food",
    cal: parseInt(f.cal || f.calories || 0),
    time: f.time || "",
    type: f.type || f.meal_type || "Custom"
  }));

  WEIGHT_LOG = (data.weight_logs || []).map(w => ({
    id: w.id,
    date: w.date || "Today",
    w: parseFloat(w.w || w.weight || 0),
    note: w.note || ""
  }));

  WATER_CUPS = parseFloat(data.water_cups || 0);

  setSession(SESSION);
}

async function doSignup() {
  var first = document.getElementById('sFirst').value.trim();
  var last = document.getElementById('sLast').value.trim();
  var email = document.getElementById('sEmail').value.trim().toLowerCase();
  var pass = document.getElementById('sPass').value;
  var errBox = document.getElementById('signupErr');

  errBox.classList.remove('show');

  if (!first) {
    errBox.textContent = "❌ First name is required.";
    errBox.classList.add('show');
    return;
  }

  if (!email || !email.includes('@')) {
    errBox.textContent = "❌ Please enter a valid email address.";
    errBox.classList.add('show');
    return;
  }

  if (pass.length < 8) {
    errBox.textContent = "❌ Password must be at least 8 characters.";
    errBox.classList.add('show');
    return;
  }

  try {
    const data = await api("signup", {
      firstName: first,
      lastName: last,
      email: email,
      password: pass
    });

    applyBackendData(data);
    OB_STEP = 0;
    show('ob');
    renderOb();

  } catch (err) {
    errBox.textContent = "❌ " + err.message;
    errBox.classList.add('show');
  }
}

async function doLogin() {
  var email = document.getElementById('lEmail').value.trim().toLowerCase();
  var pass = document.getElementById('lPass').value;
  var errBox = document.getElementById('loginErr');

  errBox.classList.remove('show');

  if (!email || !pass) {
    errBox.textContent = "❌ Please enter email and password.";
    errBox.classList.add('show');
    return;
  }

  try {
    const data = await api("login", {
      email: email,
      password: pass
    });

    applyBackendData(data);
    goDash();

  } catch (err) {
    errBox.textContent = "❌ " + err.message;
    errBox.classList.add('show');
  }
}

async function logout() {
  try {
    await api("logout");
  } catch (err) {}

  SESSION = null;
  U = {};
  CHARTS = {};
  FOOD_LOG = [];
  WEIGHT_LOG = [];
  WATER_CUPS = 0;

  document.getElementById('guestBtns').style.display = 'flex';
  document.getElementById('uMenu').style.display = 'none';
  document.getElementById('navTabs').style.display = 'none';
  document.getElementById('avMenu').classList.remove('show');

  show('login');
}

async function finishOb() {
  try {
    const data = await api("save_profile", U);
    applyBackendData(data);

    show('result');
    renderResult();

  } catch (err) {
    alert("Profile save failed: " + err.message);
  }
}

async function addFood() {
  var nm = document.getElementById('fNm').value.trim();
  var cal = parseInt(document.getElementById('fCal').value);

  if (!nm || !cal) {
    alert("Please enter food name and calories");
    return;
  }

  try {
    const data = await api("add_food", {
      emoji: "🍽️",
      food_name: nm,
      calories: cal,
      meal_type: "Custom"
    });

    applyBackendData(data);
    renderLog();

    alert("Food saved to database!");

  } catch (err) {
    alert("Food save failed: " + err.message);
  }
}

async function quickAdd(nm, cal) {
  var em = nm.split(' ')[0];
  var name = nm.split(' ').slice(1).join(' ').replace(/·.*/, '').trim();

  try {
    const data = await api("add_food", {
      emoji: em,
      food_name: name,
      calories: cal,
      meal_type: "Quick add"
    });

    applyBackendData(data);
    renderLog();

  } catch (err) {
    alert("Quick add failed: " + err.message);
  }
}

async function delFood(i) {
  var food = FOOD_LOG[i];

  if (!food || !food.id) {
    alert("This food item has no database ID.");
    return;
  }

  try {
    const data = await api("delete_food", {
      id: food.id
    });

    applyBackendData(data);
    renderLog();

  } catch (err) {
    alert("Delete failed: " + err.message);
  }
}

async function logWeight() {
  var val = parseFloat(document.getElementById('wtIn').value);

  if (!val || val < 20 || val > 300) {
    alert("Please enter a valid weight");
    return;
  }

  try {
    const data = await api("add_weight", {
      weight: val,
      note: "Logged from frontend"
    });

    applyBackendData(data);
    renderProgress();

    alert("Weight saved to database!");

  } catch (err) {
    alert("Weight save failed: " + err.message);
  }
}

async function logWater(i) {
  WATER_CUPS = (WATER_CUPS === i + 1) ? i : i + 1;

  try {
    const data = await api("set_water", {
      cups: WATER_CUPS
    });

    applyBackendData(data);
    goDash();

  } catch (err) {
    alert("Water save failed: " + err.message);
  }
}

async function setWaterCup(i) {
  WATER_CUPS = (WATER_CUPS === i + 1) ? i : i + 1;

  try {
    const data = await api("set_water", {
      cups: WATER_CUPS
    });

    applyBackendData(data);
    renderWater();

  } catch (err) {
    alert("Water save failed: " + err.message);
  }
}

async function quickWater(i) {
  if (i === 0) WATER_CUPS = Math.min(12, WATER_CUPS + 1);
  else if (i === 1) WATER_CUPS = Math.min(12, WATER_CUPS + 0.5);
  else if (i === 2) WATER_CUPS = Math.min(12, WATER_CUPS + 2);
  else WATER_CUPS = 0;

  try {
    const data = await api("set_water", {
      cups: WATER_CUPS
    });

    applyBackendData(data);
    renderWater();

  } catch (err) {
    alert("Water save failed: " + err.message);
  }
}

function addWeightEntry() {
  goProgress();
  setTimeout(function () {
    var input = document.getElementById('wtIn');
    if (input) input.focus();
  }, 100);
}

loadSession();
