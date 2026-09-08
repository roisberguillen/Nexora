import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const gradleFile = path.join(
  repositoryRoot,
  "apps",
  "web",
  "src-tauri",
  "gen",
  "android",
  "app",
  "build.gradle.kts",
);

const marker = "// Nexora release signing configuration";
const signingBlock = `
${marker}
val nexoraSigningProperties = Properties().apply {
    val signingFile = file("keystore.properties")
    if (!signingFile.exists()) {
        throw GradleException("Missing apps/web/src-tauri/gen/android/app/keystore.properties for release signing")
    }
    signingFile.inputStream().use { load(it) }
}
val nexoraStorePassword = System.getenv("NEXORA_ANDROID_STORE_PASSWORD")
    ?: nexoraSigningProperties.getProperty("storePassword")
val nexoraKeyPassword = System.getenv("NEXORA_ANDROID_KEY_PASSWORD")
    ?: nexoraSigningProperties.getProperty("keyPassword")
`;
const signingConfigBlock = `
    signingConfigs {
        create("nexoraRelease") {
            storeFile = file(nexoraSigningProperties.getProperty("storeFile"))
            storePassword = nexoraStorePassword
            keyAlias = nexoraSigningProperties.getProperty("keyAlias")
            keyPassword = nexoraKeyPassword
        }
    }
`;

let gradle = await readFile(gradleFile, "utf8");
if (!gradle.includes("import java.util.Properties")) {
  gradle = `import java.util.Properties\n${gradle}`;
}

if (!gradle.includes(marker)) {
  const androidBlock = "android {";
  const androidIndex = gradle.indexOf(androidBlock);
  if (androidIndex < 0) throw new Error("Tauri Android Gradle file has no android block");
  gradle = `${gradle.slice(0, androidIndex)}${signingBlock}\n${gradle.slice(androidIndex)}`;
}

if (!gradle.includes("val nexoraStorePassword")) {
  gradle = gradle.replace(
    "    signingFile.inputStream().use { load(it) }\n}",
    '    signingFile.inputStream().use { load(it) }\n}\nval nexoraStorePassword = System.getenv("NEXORA_ANDROID_STORE_PASSWORD")\n    ?: nexoraSigningProperties.getProperty("storePassword")\nval nexoraKeyPassword = System.getenv("NEXORA_ANDROID_KEY_PASSWORD")\n    ?: nexoraSigningProperties.getProperty("keyPassword")',
  );
}

gradle = gradle
  .replace(
    'storePassword = nexoraSigningProperties.getProperty("storePassword")',
    "storePassword = nexoraStorePassword",
  )
  .replace(
    'keyPassword = nexoraSigningProperties.getProperty("keyPassword")',
    "keyPassword = nexoraKeyPassword",
  );

const androidOpenIndex = gradle.indexOf("android {") + "android {".length;
if (!gradle.slice(androidOpenIndex, androidOpenIndex + 500).includes('create("nexoraRelease")')) {
  gradle = `${gradle.slice(0, androidOpenIndex)}${signingConfigBlock}${gradle.slice(androidOpenIndex)}`;
}

const releaseMarker = 'getByName("release") {';
const releaseIndex = gradle.indexOf(releaseMarker);
if (releaseIndex < 0) throw new Error("Tauri Android Gradle file has no release build type");
const releaseBodyIndex = releaseIndex + releaseMarker.length;
if (!gradle.slice(releaseBodyIndex, releaseBodyIndex + 200).includes("signingConfig")) {
  gradle = `${gradle.slice(0, releaseBodyIndex)}\n            signingConfig = signingConfigs.getByName("nexoraRelease")${gradle.slice(releaseBodyIndex)}`;
}

await writeFile(gradleFile, gradle, "utf8");
process.stdout.write(
  "Android release signing configuration applied to generated Gradle project.\n",
);
