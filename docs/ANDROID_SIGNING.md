# Nexora Android release signing

La keystore release non è nel repository e non deve essere copiata su servizi esterni senza
autorizzazione. Il percorso locale previsto è:

`C:\Users\Roi23\.nexora\signing\nexora-release-v2.jks`

La password della keystore e quella dell’alias sono secret dell’owner. Non devono comparire in Git,
log, fixture, screenshot o documentazione. La perdita della keystore impedisce gli aggiornamenti
della stessa applicazione Android perché la nuova build non sarebbe firmata con l’identità attesa.

## Generazione locale

Eseguire in una console interattiva, scegliendo password robuste e conservandole in un password
manager. Il comando non contiene password:

```powershell
$signingDir = 'C:\Users\Roi23\.nexora\signing'
New-Item -ItemType Directory -Force -Path $signingDir | Out-Null
keytool -genkeypair -v `
  -keystore "$signingDir\nexora-release-v2.jks" `
  -alias nexora-release `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000 `
  -storetype JKS
```

Quando richiesto, inserire password della keystore, password della chiave e i dati del certificato
Nexora. Non usare `C:\Users\Roi23\.android\debug.keystore`.

## Configurazione locale della build

Dopo `tauri android init --ci`, creare solo localmente
`apps/web/src-tauri/gen/android/app/keystore.properties` con:

```properties
storeFile=C:/Users/Roi23/.nexora/signing/nexora-release-v2.jks
storePassword=<secret locale>
keyAlias=nexora-release
keyPassword=<secret locale>
```

Poi eseguire `pnpm android:configure-signing`. Lo script è idempotente e applica la configurazione
al progetto Gradle generato; il file e la keystore sono esclusi da Git.

Per evitare password nei file locali, si può lasciare `storePassword` e `keyPassword` fuori da
`keystore.properties` e passarle al processo Gradle tramite variabili di processo alimentate dal
password manager. Non usare `SecureString` direttamente come valore di una variabile d’ambiente:
Gradle deve ricevere il valore solo nel processo di build e il valore non deve essere salvato o
stampato.

## Backup obbligatorio

Conservare almeno due copie cifrate della keystore e delle password in luoghi separati e controllati
dall’owner. Non usare servizi esterni da questa procedura senza autorizzazione esplicita. Prima di
distribuire l’APK verificare alias, validità e fingerprint SHA-256 con `keytool`, poi usare
`apksigner verify --verbose`.

## GitHub Actions

Il job `android-arm64-signed` viene eseguito solo quando la repository variable
`NEXORA_ANDROID_SIGNING_ENABLED` è esattamente `true`. Se la variable è `true` e manca un secret,
il job fallisce senza fallback verso un APK unsigned.

Il workflow usa questi secret repository/environment, senza valori nel codice:

- `ANDROID_KEY_BASE64`: keystore JKS codificata Base64;
- `ANDROID_KEY_ALIAS`: `nexora-release`;
- `ANDROID_KEY_PASSWORD`: password dell’alias;
- `ANDROID_STORE_PASSWORD`: password della keystore.

Il runner ricrea temporaneamente la keystore con permessi `0700`, verifica alias e password con
`keytool`, crea `keystore.properties` senza password, passa le password solo all’ambiente Gradle,
esegue la build e rimuove tutto alla fine del job. Il file temporaneo non viene caricato come
artifact e i secret non vengono stampati.

La build deve produrre esattamente un APK release firmato. Il percorso generato atteso è:

`apps/web/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`

Il job copia il risultato verificato nel nome stabile
`nexora-android-arm64-release-signed.apk`, controlla `zipalign` e poi esegue:

```bash
apksigner verify --verbose --print-certs nexora-android-arm64-release-signed.apk
```

L’artifact finale si chiama `nexora-android-arm64-signed` e contiene solo quell’APK firmato.

## Base64 del keystore per GitHub

Su Windows PowerShell, senza stampare il contenuto:

```powershell
$keyPath = 'C:\Users\Roi23\.nexora\signing\nexora-release-v2.jks'
[Convert]::ToBase64String([IO.File]::ReadAllBytes($keyPath)) |
  Set-Content -NoNewline -Encoding ascii .\nexora-release.base64
```

Su Linux/macOS, senza usare `base64` con output verboso:

```bash
base64 -w 0 "$HOME/.nexora/signing/nexora-release-v2.jks" > nexora-release.base64
```

Su sistemi BSD/macOS dove `-w` non è disponibile:

```bash
base64 "$HOME/.nexora/signing/nexora-release-v2.jks" | tr -d '\n' > nexora-release.base64
```

Inserire il contenuto del file nel secret `ANDROID_KEY_BASE64` tramite GitHub senza aggiungerlo a
Git o stamparlo nella shell. Eliminare il file Base64 dopo la configurazione, se non serve più.

La stessa keystore deve essere riutilizzata per gli aggiornamenti: cambiare certificato impedisce
ad Android di aggiornare installazioni esistenti e richiede una nuova identità applicativa.
