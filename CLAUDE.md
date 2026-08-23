# Cum se lucrează la aplicația asta

## Regula de căpătâi

**Structurată cât mai simplu, ușor de folosit de oricine.** Aplicația e ținută în mână de
un om care organizează concursuri de pescuit, la baltă, în picioare, cu telefonul într-o
mână și cântarul în cealaltă. Uneori i-o dă altcuiva să cântărească. Cine o deschide
prima oară trebuie să se descurce fără să întrebe pe nimeni.

Din regula asta ies toate celelalte:

- **Un ecran, un lucru.** Dacă un ecran începe să aibă de toate, se strânge — nu se adaugă
  încă un buton lângă celelalte.
- **Butoanele spun ce fac.** „Arată cheia", nu „Vezi". „Fă-mi unul", nu „Cod nou".
  „Locul 3 = 3 puncte", nu „Locuri simple". Dacă numele are nevoie de explicație ca să se
  înțeleagă, numele e greșit.
- **Un singur buton scos în față pe ecran** (`btn-primary`). Restul, `btn-ghost`. Dacă sunt
  două albastre, niciunul nu mai e cel important.
- **Ce se folosește rar, se strânge**, nu se șterge: `.pliant` cu `plianteaza(id)`.
  Setările au trei rânduri strânse (server, setat o dată, când ceva nu merge) — 9 carduri
  pe ecran din 19.
- **Nu se adaugă fără să se scoată.** Înainte de a pune ceva nou pe un ecran, întrebarea e
  ce iese, sau unde se strânge.
- **Numele lui, nu ale mele.** Numele butoanelor se schimbă doar când le alege el.

## Cum se livrează

- **Câte o schimbare pe rând.** A spus de mai multe ori „m-am amețit" și „e prea
  complicat" când au venit multe deodată. Mai bine trei PR-uri mici, în trei zile, decât
  unul mare.
- **Se așteaptă „fă merge".** Nimic nu ajunge pe telefonul lui fără vorba lui.
- **Nu se șterge nimic de pe server.** Arhivele rămân — a cerut-o explicit.
- Duminica are concurs. Nu se umblă la aplicație sâmbătă seara fără motiv serios.

## Ce trebuie știut despre fișiere

- `index.html` are **CRLF**; celelalte (`sezon.html`, `concursuri.html`, `sw.js`, `qr.js`)
  au LF. Editările pe o singură linie nu strică nimic; cele pe mai multe linii, atenție.
- **`sw.js`: `CACHE` se urcă la fiecare livrare** (`concurs-pescuit-vNN`). Altfel telefonul
  rămâne cu varianta veche.
- Worker-ul Cloudflare (`worker/index.js`) **nu e legat de repo** — se pune de mână.
- Arhivele din `arhiva/` sunt publice: fără `pinHash`, fără `lock`.

## Verificare, înainte de orice livrare

1. `node test-toate.js` — suitele rulează cod **adevărat**, scos din fișierele livrate
   (`test-helpers.js`). Zero picate.
2. **Probă în browser**, pe ecran de 412px, pe fișierele livrate: Playwright cu Chromium
   din `/opt/pw-browsers/`. Scrierile spre serverul adevărat se opresc din `ctx.route`.
3. Ce nu se poate dovedi, nu se livrează. (`<details>` nu se închide în Chromium-ul de
   aici — de-aia pliantele au `hidden` pus de mână.)
