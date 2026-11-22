# Geometria BrickCAD

Rozmery sú v milimetroch a platia pre režim **Referenčné** so silou zovretia 0 mm. Profily používajú reprezentatívne dielce a parametricky z nich odvodzujú vlastné tvary. Rozmery výliskov sa môžu líšiť podľa variantu a formy.

Identifikátory referenčných kociek sa dajú dohľadať v katalógu Brickipedia. V tabuľkách sú použité rozmerové výkresy a merania uvedené pri jednotlivých profiloch. [Klasická kocka 3001](https://brickipedia.fandom.com/wiki/Part_3001) · [Detská kocka 3437](https://brickipedia.fandom.com/wiki/Part_3437)

## Klasická a Technická kocka

| Prvok | Rozmer v BrickCAD |
| --- | ---: |
| Rozstup studov a výška platničky | 8 / 3,2 |
| Telo 4 × 2, tri platničky | 31,8 × 15,8 × 9,6 |
| Platnička 4 × 2 s plnými studmi | 31,8 × 15,8 × 5,0 vrátane studov |
| Medzera medzi dielcami vedľa seba v mriežke | 0,2 |
| Obvodová stena a strop | 1,2 / 1,0 |
| Horný stud a jeho výška | Ø 4,8 × 1,8 |
| Odľahčenie plného studu zo spodnej strany | Ø 2,6 × 1,7 |
| Spodná rúrka | Ø 6,51 zvonka, Ø 4,8 zvnútra |
| Spodný kolík v úzkom pôdoryse | Ø 3,2 |
| Rebro v stene | šírka 0,6, presah 0,2 |
| Stredová priečka obdĺžnika 4 × 2 | hrúbka 0,8, výška do 6,3 pod stropom |
| Okrúhly priechodný otvor | Ø 4,9, os 5,8 nad dnom |
| Osadenie okrúhleho otvoru | Ø 6,2, hĺbka 0,8 na každej strane |

Stredová priečka necháva pri otvorenom dne voľný priestor pre protiľahlé study. Vo vlastnom pôdoryse vznikajú stenové rebrá na odkrytých hranách buniek a rúrky v stredoch súvislých blokov 2 × 2. Výrezy rúrok končia v dutine aj pod šikmým stropom. Voliteľný kónický nábeh a spodné skosenie 0,3 mm sú úpravy pre FDM. [Výkres klasickej kocky od Christopha Bartnecka](https://www.bartneck.de/wp-content/uploads/2019/04/lego-2x4-brick-dimensions-measurements-3001.pdf) · [LDraw 3001](https://library.ldraw.org/parts/3436) · [Merania otvorov od Roberta Cailliaua](https://www.cailliau.org/Alphabetical/L/Lego/Dimensions/More%20Dimensions/%20More%20Dimensions-en.html)

Priložená schéma používa jednotku 1,6 mm. Päť jednotiek dáva rozstup 8 mm, šesť výšku tela 9,6 mm a 0,75 jednotky stenu 1,2 mm. Pre detailný profil 4 × 2 má prednosť kótovaný výkres konkrétnej kocky. Všeobecná ilustrácia menších dielcov uvádza zaokrúhlené rozmery a zachytáva tri odlišné spodky. Kocka 1 × 1 má otvorenú dutinu, kocka 1 × 2 pridáva plný kolík a kocka 2 × 2 dutú rúrku. Tieto tri prípady kontrolujú aj CAD testy.

Výkres BrickGun používa LDraw jednotky. Pri nominálnom prepočte 0,4 mm na jednotku zodpovedá 20 LDU rozstupu 8 mm, 8 LDU hrúbke platničky 3,2 mm a 24 LDU výške kocky 9,6 mm. Klasické telo 4 × 2 zaberá v mriežke modulárny priestor 32 × 16 mm. Jeho menší vonkajší obrys 31,8 × 15,8 mm necháva medzeru 0,2 mm medzi dielcami. Pri osi priechodného otvoru v kocke používa BrickCAD nameraných 5,8 mm. Schéma BrickGun ju umiestňuje 14 LDU od spodku, čo zodpovedá 5,6 mm. [Rozmerové výkresy BrickGun](https://www.brickgun.com/Free_Stuff/Dimension_Guides.html) · [Meranie priechodného otvoru](https://www.cailliau.org/Alphabetical/L/Lego/Dimensions/More%20Dimensions/%20More%20Dimensions-en.html)

## Technický nosník

Nosník má zaoblené konce s polomerom 3,7 mm, šírku 7,4 mm a hrúbku 8 mm v osi otvorov. Dĺžka je `8 × (počet modulov − 1) + 7,4 mm`. Okrúhle otvory majú rozstup 8 mm, priemer 4,9 mm a obojstranné osadenie Ø 6,2 mm do hĺbky 0,9 mm. Užívateľský krížový otvor pre osku používa menovitý obal Ø 4,8 mm a ramená široké 1,8 mm. [Opis nosníkov od výrobcu](https://assets.education.lego.com/v3/assets/blt293eea581807678a/blt7e77d0d32b023517/6a6c690534c91d10a06e961f/fll-challenge-BIOGLOW-text-based-bi-12.pdf?locale=en-us) · [LDraw 32316](https://library.ldraw.org/parts/list?tableSearch=32316.dat) · [Merania nosníkov od Roberta Cailliaua](https://www.cailliau.org/Alphabetical/L/Lego/Dimensions/More%20Dimensions/%20More%20Dimensions-en.html)

V sekcii **Prepojenia → Zarovnanie pri 90°** je tabuľka pre zvolenú dĺžku nosníka. Po zosúladení otvoru č. 1 vychádza ďalšia spoločná výška po dvoch rozstupoch otvorov alebo po piatich platničkách. Oboje je 16 mm. Prvých päť otvorov má spoločné polohy č. 1, 3 a 5 vo výškach 0, 16 a 32 mm od prvej osi. [Schéma 90° zostáv BrickGun](https://www.brickgun.com/Free_Stuff/downloads/BrickGun_LEGO_Dimension_Guides_8.5x11_v1.0.pdf)

## Detská

| Prvok | Rozmer v BrickCAD |
| --- | ---: |
| Rozstup a krok výšky | 16 / 6,4 |
| Telo 2 × 2, tri platničky | 31,68 × 31,68 × 19,2 |
| Obvodová stena a strop | 1,52 / 1,6 |
| Horný dutý stud | Ø 9,38 zvonka, Ø 5,8 zvnútra, výška 4,4 |
| Voliteľný stud pre spodnú rúrku klasického dielca | vnútorný Ø 6,6 |
| Voliteľné spodné vybrania pre klasické study | Ø 4,9 × 2,0, rozstup 8 |
| Spodná rúrka | Ø približne 13,25 zvonka, Ø 10,69 zvnútra, zapustenie 1,6 |
| Rebro v stene | šírka 1,2, presah 1,6, zapustenie 0,4 |

Vonkajší rozmer, stena a priemery predvoleného studu a rúrky vychádzajú z merania fyzickej kocky 2 × 2. Výška studu, strop, rebrá a zapustenie sú odvodené z otvoreného CAD modelu. Vonkajší priemer spodnej rúrky je geometricky odvodený z dotyku štyroch susedných studov. [Merania fyzickej kocky](https://zenn.dev/noricha/articles/duplo-compatible-brick) · [LDraw 3437](https://library.ldraw.org/parts/6083) · [LDraw 3437, vnútorná geometria](https://library.ldraw.org/library/official/parts/s/3437s01.dat)

Patent opisuje spojenie dutého studu väčšieho dielca s rúrkou menšieho a znázorňuje vybrania v spodných rúrkach aj vo vnútorných stenách. BrickCAD používa otvor Ø 6,6 mm odvodený od rúrky Ø 6,51 mm a spodné vybrania odvodené od klasického studu Ø 4,8 × 1,8 mm. Rozmery v ponuke reprodukcie označujú rozmery papierového výtlačku. [Francúzsky patent FR1599102A](https://patents.google.com/patent/FR1599102A/fr) · [Opis spojenia v patentovej rodine](https://patents.google.com/patent/US3597875A/en) · [Reprodukcia z odkazu](https://www.lego.com/en-de/product/french-patent-lego-duplo-brick-1968-5005998)

Digitálna kontrola overuje geometriu a exporty. Na overenie vôle spoja treba vytlačiť vzorku z cieľového materiálu a skúsiť ju s fyzickými dielcami.

## Návrhy ďalších vylepšení

1. **Kalibračná sada** s krátkymi vzorkami pre horné study, spodné rúrky a priechodné otvory. Ukladala by samostatné korekcie pre tlačiareň a materiál.
2. **Kontrola tlačiteľnosti v reze** by označila tenké steny, dlhé mosty a oddelené časti pôdorysu pred exportom.
3. **Ďalšie tvary nosníkov** by pridali tenký a zalomený nosník a voľbu okrúhleho alebo krížového otvoru v každom module zvlášť.
4. **Predvoľby z katalógu** by skrátili vytváranie kociek a platničiek s bežnými pôdorysmi, napríklad 1 × 2, 2 × 2, 2 × 4 alebo 2 × 8.
