import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://wvgohdrjbitwdbpbzdxf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2Z29oZHJqYml0d2RicGJ6ZHhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzA0NjQsImV4cCI6MjEwMjQ0NjQ2NH0.1mEAnwA_z5yj91QqaTwmNvFUwQ9Hb0XPOU9lfW4SvS0";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let user = null, posts = [], profiles = new Map(), votes = new Map(), sort = "new";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
// Supabase Auth uses the user's real email address.

function toast(text) {
  $("toast").textContent = text;
  $("toast").style.display = "block";
  setTimeout(() => $("toast").style.display = "none", 2800);
}
function openModal(html) { $("modalContent").innerHTML = html; $("modal").classList.remove("hidden"); }
function closeModal() { $("modal").classList.add("hidden"); }
$("close").onclick = closeModal;

function authUI() {
  $("authArea").innerHTML = user
    ? `<div class="auth"><span>@${esc(user.user_metadata?.username || profiles.get(user.id)?.username || "user")}</span><button id="logout">Выйти</button></div>`
    : `<div class="auth"><button id="login">Войти</button><button id="signup" class="primary">Регистрация</button></div>`;
  if ($("login")) $("login").onclick = () => authForm("login");
  if ($("signup")) $("signup").onclick = () => authForm("signup");
  if ($("logout")) $("logout").onclick = async () => { await db.auth.signOut(); toast("Вы вышли"); };
}

function authForm(mode) {
  const isSignup = mode === "signup";
  openModal(`<h2>${isSignup ? "Регистрация" : "Вход в Neodit"}</h2>
  <form id="authForm">
    <div class="field"><label>Email</label><input id="email" type="email" autocomplete="${isSignup ? "email" : "username"}" placeholder="you@example.com" required></div>
    ${isSignup ? `<div class="field"><label>Юзернейм</label><input id="username" autocomplete="nickname" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+"></div>` : ""}
    <div class="field"><label>Пароль</label><input id="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" required minlength="6"></div>
    <div id="authError" class="error"></div>
    <button class="primary full">${isSignup ? "Создать аккаунт" : "Войти"}</button>
  </form>`);
  $("authForm").onsubmit = async e => {
    e.preventDefault();
    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;
    if (!email) {
      $("authError").textContent = "Введите Email.";
      return;
    }

    let result;
    if (isSignup) {
      const username = $("username").value.trim();
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
        $("authError").textContent = "Юзернейм: 3–24 символа, латиница, цифры и _.";
        return;
      }
      result = await db.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });
    } else {
      result = await db.auth.signInWithPassword({ email, password });
    }

    if (result.error) {
      $("authError").textContent = result.error.message;
      return;
    }

    if (isSignup && !result.data.session) {
      $("authError").textContent = "Аккаунт создан. Проверьте почту и подтвердите Email, либо отключите Confirm email в Supabase → Authentication → Providers → Email.";
      return;
    }

    user = result.data.user;
    if (isSignup) {
      const username = $("username").value.trim();

      const profileResult = await db
        .from("profiles")
        .upsert(
          { id: user.id, username: username },
          { onConflict: "id" }
        );

      if (profileResult.error) {
        $("authError").textContent =
          "Аккаунт создан, но профиль не сохранился: " +
          profileResult.error.message;
        return;
      }
    }

    await loadData();
    authUI();
    closeModal();
    toast(isSignup ? "Аккаунт создан!" : "Вы вошли!");
  };
}

async function loadData() {
  const [pr, po] = await Promise.all([
    db.from("profiles").select("id,username"),
    db.from("posts").select("id,author_id,community,title,body,score,created_at").order("created_at", { ascending: false })
  ]);
  if (pr.error) { toast("Ошибка profiles: " + pr.error.message); return; }
  if (po.error) {
    $("posts").innerHTML = `<div class="card">Ошибка posts: ${esc(po.error.message)}</div>`;
    return;
  }
  profiles = new Map((pr.data || []).map(p => [p.id, p]));
  posts = po.data || [];
  if (user) {
    const vr = await db.from("votes").select("post_id,value").eq("user_id", user.id);
    if (!vr.error) votes = new Map((vr.data || []).map(v => [v.post_id, v.value]));
  }
  render();
}

function render() {
  let list = [...posts];
  const q = ($("search").value || "").toLowerCase();
  if (q) list = list.filter(p => `${p.title} ${p.body} ${p.community}`.toLowerCase().includes(q));
  if (sort === "top") list.sort((a,b) => (b.score || 0) - (a.score || 0));
  if (sort === "old") list.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

  $("posts").innerHTML = list.length ? list.map(p => {
    const name = profiles.get(p.author_id)?.username || "user";
    const myVote = votes.get(p.id) || 0;
    return `<article class="post">
      <div class="votes">
        <button class="vote ${myVote===1?"chosen":""}" onclick="vote(${p.id},1)">▲</button>
        <div class="score">${p.score || 0}</div>
        <button class="vote ${myVote===-1?"chosen":""}" onclick="vote(${p.id},-1)">▼</button>
      </div>
      <div class="body">
        <div class="meta">r/${esc(p.community)} · @${esc(name)} · ${new Date(p.created_at).toLocaleString("ru-RU")}</div>
        <h2>${esc(p.title)}</h2><p>${esc(p.body)}</p>
        <div class="actions"><button class="link" onclick="comments(${p.id})">💬 Комментарии</button></div>
      </div>
    </article>`;
  }).join("") : `<div class="card"><h3>Постов пока нет</h3><p>Создай первый пост.</p></div>`;
}

$("search").oninput = render;
document.querySelectorAll(".sort").forEach(btn => btn.onclick = () => {
  sort = btn.dataset.sort;
  document.querySelectorAll(".sort").forEach(b => b.classList.toggle("active", b === btn));
  render();
});

$("createBtn").onclick = () => {
  if (!user) return authForm("login");
  openModal(`<h2>Новый пост</h2><form id="postForm">
    <div class="field"><label>Сообщество</label><input id="community" value="general" maxlength="30"></div>
    <div class="field"><label>Заголовок</label><input id="title" required maxlength="200"></div>
    <div class="field"><label>Текст</label><textarea id="body" required maxlength="20000"></textarea></div>
    <button class="primary full">Опубликовать</button></form>`);
  $("postForm").onsubmit = async e => {
    e.preventDefault();
    const r = await db.from("posts").insert({
      author_id: user.id,
      community: $("community").value.trim() || "general",
      title: $("title").value.trim(),
      body: $("body").value.trim()
    });
    if (r.error) toast(r.error.message);
    else { closeModal(); await loadData(); toast("Пост опубликован"); }
  };
};

window.vote = async (postId, value) => {
  if (!user) return authForm("login");
  const old = votes.get(postId) || 0;
  if (old === value) {
    const r = await db.from("votes").delete().eq("user_id", user.id).eq("post_id", postId);
    if (r.error) return toast(r.error.message);
    votes.delete(postId);
  } else {
    const r = await db.from("votes").upsert({ user_id:user.id, post_id:postId, value }, { onConflict:"user_id,post_id" });
    if (r.error) return toast(r.error.message);
    votes.set(postId, value);
  }
  const count = [...votes.entries()].filter(([id]) => id === postId).length;
  const oldPost = posts.find(p => p.id === postId);
  if (oldPost) {
    // Recalculate score from database so it stays correct for all users.
    const vr = await db.from("votes").select("value").eq("post_id", postId);
    if (!vr.error) {
      oldPost.score = (vr.data || []).reduce((s,v) => s + v.value, 0);
      await db.from("posts").update({ score: oldPost.score }).eq("id", postId);
    }
  }
  render();
};

window.comments = async postId => {
  const r = await db.from("comments").select("id,post_id,author_id,content,created_at").eq("post_id", postId).order("created_at");
  if (r.error) return toast(r.error.message);
  openModal(`<h2>Комментарии</h2>
    <div id="commentList">${(r.data || []).map(c => `<div class="card"><b>@${esc(profiles.get(c.author_id)?.username || "user")}</b><p>${esc(c.content)}</p></div>`).join("") || "<p>Комментариев пока нет.</p>"}</div>
    ${user ? `<form id="commentForm"><div class="field"><textarea id="commentText" required placeholder="Комментарий..."></textarea></div><button class="primary">Отправить</button></form>` : "<p>Войдите, чтобы комментировать.</p>"}`);
  if (user) $("commentForm").onsubmit = async e => {
    e.preventDefault();
    const x = await db.from("comments").insert({ post_id:postId, author_id:user.id, content:$("commentText").value.trim() });
    if (x.error) toast(x.error.message); else window.comments(postId);
  };
};

(async () => {
  const s = await db.auth.getSession();
  user = s.data.session?.user || null;
  authUI();
  await loadData();
  db.auth.onAuthStateChange((_event, session) => { user = session?.user || null; authUI(); loadData(); });
})();
