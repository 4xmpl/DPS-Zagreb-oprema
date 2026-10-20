# Zapisnik promjena (razvoj)

Grana `main` = ono što trenutno radi na Netlifyju (zadnja objava: c38547b, 18.10.2026.).
Sve novo ide na granu `razvoj`, a u `main` se spaja odjednom kad Romano kaže „objavi" (jedna objava = 15 Netlify kredita).

Testna verzija (lažni podaci, ne dira pravu bazu): `python3 test/build_test.py <izlaz>` složi kopiju iz `public/index.html`
sa `test/shim-test.js` umjesto `public/shim.js`, pa se objavi kao privatni Artifact.

## Dogovoreno, još nije napravljeno
1. (ostalo od točke "Datum povratka": nema ograničenja od 60 dana za tečaj/eko; stupac "Vraća do" u CSV-u povijesti.)
2. Povrat: zatvorene kartice (ime, izlet, broj komada, rok, oznake KASNI / neplaćeno); klik otvara sve; „Vrati sve" samo na otvorenoj kartici; poredak: kasne, pa rok, pa ime; polje za traženje; otvorena kartica ostaje otvorena pri osvježavanju. Povijest se ne mijenja.
3. Inventar: kartica „Dodaj opremu" zatvorena, otvara se klikom, zatvara nakon dodavanja, ostaje otvorena dok se upisuje.
4. Glitchevi koje Romano još opisuje.

## Ideje (kasnije)
- Plan: pregled „5/12 dobilo opremu" s kvačicama; izbor između više slobodnih komada iste veličine; komplet za tečaj.
- Poruka za kasne (tekst za WhatsApp); isplati li se komad; podsjetnik za sigurnosnu kopiju; povijest promjena.
- Javna stranica „Moja oprema" (grana moja-oprema-qr), samostalni upis uz potvrdu.

## Napravljeno na grani razvoj
- 20.10.2026. Alati za testnu verziju (`test/`), lažna baza, učitavanje sigurnosne kopije (podaci se ne commitaju).
- 20.10.2026. **Datum povratka** (`public/index.html`): novo polje `due` (yyyy-mm-dd) pri izdavanju, obavezno, ne smije biti u prošlosti; sprema se na komad (`items`), olovo (`lead`) i zapis (`log`); `dueInfo` koristi `due` ako postoji, inače stari izračun (izdavanje + dani), pa stari zapisi rade kao prije; kašnjenje se broji od dana nakon roka; za isti izlet se prijedlog roka pamti iz zadnjeg izdavanja; rok se briše pri povratu; uređuje se u Povijesti; "vratiti do" na PDF-u po osobi i po izletu; popis za povrat već prikazuje rok. Cijena i dalje ide samo po broju dana.
- 20.10.2026. **Potvrda (toast)** na dnu ekrana, 5 s, klik zatvara, kratka vibracija: nakon izdavanja ("Posuđeno: ime · N komada · vraća do …"), nakon povrata ("Vraćeno: ime · N stavki · naplatiti/šteta") i nakon dodavanja opreme u inventar i rezervnih dijelova. Staro tekstualno obavještenje na vrhu ostaje.
- 20.10.2026. **Povrat sa zatvorenim karticama**: kartica osobe prikazuje ime, broj komada, najraniji rok, KASNI N d i neplaćeno; klik otvara sve kao prije (uključujući "Vrati sve", samo na otvorenoj); poredak: najviše kasni, pa rok, pa ime; polje "Traži osobu…"; otvorena kartica ostaje otvorena pri osvježavanju, a automatski se otvara kad su označeni komadi ili šteta. Povijest nepromijenjena.
- 20.10.2026. **Inventar**: kartica "Dodaj opremu" zatvorena, otvara se klikom, zatvara se nakon uspješnog dodavanja.

- Test verzija: PDF/CSV preuzimanje radi preko `downloads` mogućnosti Artifacta (test/shim-test.js; potvrda pri spremanju). Prava aplikacija se ne mijenja.
