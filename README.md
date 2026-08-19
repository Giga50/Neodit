# Neodit

Готовый фронтенд для Supabase.

## Что исправлено
- Регистрация теперь использует **настоящий Email**, а не `username@neodit.local`.
- Регистрация: Email + юзернейм + пароль.
- Вход: Email + пароль.
- Оставлены таблицы `profiles`, `posts`, `comments`, `votes`.

## Supabase
1. Если таблицы удалены — запусти `supabase.sql` целиком в SQL Editor.
2. В **Authentication → Providers → Email**:
   - если хочешь вход сразу после регистрации — отключи **Confirm email**;
   - если оставишь включённым — пользователь должен подтвердить письмо.
3. В `app.js` уже указан публичный Supabase URL и anon key. **service_role/secret key в браузер не добавляй.**

## GitHub Pages
Загрузи `index.html`, `style.css`, `app.js` и `logo.svg` в репозиторий и включи GitHub Pages.
