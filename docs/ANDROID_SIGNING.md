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

## Configurazione della build

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

## Backup obbligatorio

Conservare almeno due copie cifrate della keystore e delle password in luoghi separati e controllati
dall’owner. Non usare servizi esterni da questa procedura senza autorizzazione esplicita. Prima di
distribuire l’APK verificare alias, validità e fingerprint SHA-256 con `keytool`, poi usare
`apksigner verify --verbose`.

## GitHub Actions

Il workflow usa questi secret repository/environment, senza valori nel codice:

- `ANDROID_KEY_BASE64`: keystore JKS codificata Base64;
- `ANDROID_KEY_ALIAS`: `nexora-release`;
- `ANDROID_KEY_PASSWORD`: password dell’alias;
- `ANDROID_STORE_PASSWORD`: password della keystore.

Il runner ricrea temporaneamente la keystore e `keystore.properties`, esegue la build e li rimuove
alla fine del job.
