# Zapisnik promjena (razvoj)

Grana `main` = ono što trenutno radi na Netlifyju (zadnja objava: c38547b, 18.10.2026.).
Sve novo ide na granu `razvoj`, a u `main` se spaja odjednom kad Romano kaže „objavi" (jedna objava = 15 Netlify kredita).

Testna verzija (lažni podaci, ne dira pravu bazu): `python3 test/build_test.py <izlaz>` složi kopiju iz `public/index.html`
sa `test/shim-test.js` umjesto `public/shim.js`, pa se objavi kao privatni Artifact.

## Dogovoreno, još nije napravljeno
1. Datum povratka obavezan pri izdavanju, odvojen od broja dana za cijenu; pamti zadnji datum za isti izlet; kašnjenje se broji tek od tog datuma; datum na PDF popisu; mogućnost naknadne izmjene u povijesti; bez ograničenja od 60 dana za tečaj i eko.
2. Povrat: zatvorene kartice (ime, izlet, broj komada, rok, oznake KASNI / neplaćeno); klik otvara sve; „Vrati sve" samo na otvorenoj kartici; poredak: kasne, pa rok, pa ime; polje za traženje; otvorena kartica ostaje otvorena pri osvježavanju. Povijest se ne mijenja.
3. Inventar: kartica „Dodaj opremu" zatvorena, otvara se klikom, zatvara nakon dodavanja, ostaje otvorena dok se upisuje.
4. Glitchevi koje Romano još opisuje.

## Ideje (kasnije)
- Plan: pregled „5/12 dobilo opremu" s kvačicama; izbor između više slobodnih komada iste veličine; komplet za tečaj.
- Poruka za kasne (tekst za WhatsApp); isplati li se komad; podsjetnik za sigurnosnu kopiju; povijest promjena.
- Javna stranica „Moja oprema" (grana moja-oprema-qr), samostalni upis uz potvrdu.

## Napravljeno na grani razvoj
(još ništa osim alata za testnu verziju)
