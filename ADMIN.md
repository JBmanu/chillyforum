# Chillyforum: admin

Appunti sulle funzioni riservate agli admin. Le idee in fondo sono **da decidere**: nessuna è ancora nell'app.

## Cosa può fare un admin oggi

Gli admin in `ADMIN_EMAILS` (`wrangler.jsonc`) sono sempre admin. Gli altri si nominano dalla scheda della persona, con "Può gestire le persone".

| Azione | Membro | Admin |
|---|---|---|
| Aggiungere film, segnarli come visti, modificarli | sì | sì |
| Votare e scrivere la propria nota | sì | sì |
| Reagire con emoji ai voti degli altri | sì | sì |
| Eliminare un film | solo quelli che ha aggiunto | tutti |
| Aggiungere, modificare (nome ed email), rimuovere persone | no | sì |
| Nominare altri admin | no | sì |
| Modificare o cancellare il voto di un altro | no | no |
| Rimuovere o declassare se stesso | no | no |

Attenzione: **rimuovere una persona cancella anche tutti i suoi voti** e non si può annullare.

## Idee da decidere

Stato: ☐ da decidere · ✅ da fare · ❌ scartata

1. ☐ **Sospendi persona.** Perde l'accesso ma i suoi voti restano. Oggi "Rimuovi" cancella anche i voti. (Consigliata)
2. ☐ **Aggiungere più persone insieme.** Si incollano più email in una volta, una per riga. (Consigliata)
3. ☐ **Esportare i dati.** Un file con film, voti e note, come copia di sicurezza.
4. ☐ **Moderare le note.** L'admin cancella una nota inopportuna senza toccare il voto.
5. ☐ **Unire due film doppi.** Si tengono i voti di entrambi.
6. ☐ **Film della serata.** L'admin sceglie il prossimo film tra i "da vedere" e compare in cima alla home.
7. ☐ **Limitare la modifica dei film.** Solo chi li ha aggiunti e gli admin; oggi possono modificarli tutti.
8. ☐ **Email Gmail tolleranti.** `mario.rossi@gmail.com` e `mariorossi@gmail.com` sono la stessa casella per Google, ma per l'app sono diverse: ignorare punti e `+alias` evita accessi respinti.

## Problemi di accesso: promemoria

- **"Non sei ancora nel gruppo":** l'email con cui entra non è quella salvata in Persone. Confrontale.
- **Cloudflare dice che il login è riservato ai membri dell'account:** nell'applicazione Access del Worker (Zero Trust → Access → Applications) il metodo di accesso deve essere **One-time PIN**, non il login di Cloudflare.
