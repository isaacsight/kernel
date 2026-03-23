// kbot Build Targets — Platform definitions, detection, and toolchain configs
//
// Every hardware target kbot can build for.
// Each target defines: required tools, Docker image (for sandbox),
// build commands, and how to detect if the current project supports it.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
export const BUILD_TARGETS = {
    // ── Mobile ──
    ios: {
        id: 'ios',
        name: 'iOS',
        category: 'mobile',
        arch: ['arm64'],
        dockerImage: null, // Requires macOS + Xcode
        requiredTools: ['xcodebuild', 'xcrun', 'swift'],
        detectFiles: ['*.xcodeproj', '*.xcworkspace', 'ios/', 'Podfile', 'Package.swift'],
        initCommands: [
            'swift package init --type executable --name $PROJECT_NAME',
        ],
        buildCommands: [
            'xcodebuild -scheme $SCHEME -sdk iphoneos -configuration Release build',
            'swift build -c release',
        ],
        runCommands: [
            'xcrun simctl boot "iPhone 15"',
            'xcrun simctl install booted $APP_PATH',
            'xcrun simctl launch booted $BUNDLE_ID',
        ],
        packageCommands: [
            'xcodebuild -exportArchive -archivePath $ARCHIVE -exportPath $EXPORT -exportOptionsPlist ExportOptions.plist',
        ],
        description: 'iOS apps — Swift/ObjC, Xcode, App Store',
    },
    android: {
        id: 'android',
        name: 'Android',
        category: 'mobile',
        arch: ['arm64', 'armv7', 'x86_64'],
        dockerImage: 'thyrlian/android-sdk:latest',
        requiredTools: ['gradle', 'adb'],
        detectFiles: ['build.gradle', 'build.gradle.kts', 'android/', 'AndroidManifest.xml', 'settings.gradle'],
        initCommands: [
            'mkdir -p app/src/main/java/com/$ORG/$PROJECT_NAME',
            'mkdir -p app/src/main/res/layout',
        ],
        buildCommands: [
            './gradlew assembleRelease',
            './gradlew assembleDebug',
        ],
        runCommands: [
            'adb install -r app/build/outputs/apk/debug/app-debug.apk',
            'adb shell am start -n $PACKAGE/$ACTIVITY',
        ],
        packageCommands: [
            './gradlew bundleRelease',
            'jarsigner -keystore $KEYSTORE app/build/outputs/bundle/release/app-release.aab $KEY_ALIAS',
        ],
        description: 'Android apps — Kotlin/Java, Gradle, Play Store',
    },
    'react-native': {
        id: 'react-native',
        name: 'React Native',
        category: 'mobile',
        arch: ['arm64', 'x86_64'],
        dockerImage: null,
        requiredTools: ['npx', 'node'],
        detectFiles: ['react-native.config.js', 'metro.config.js', 'app.json'],
        initCommands: [
            'npx react-native init $PROJECT_NAME',
        ],
        buildCommands: [
            'npx react-native build-android --mode=release',
            'npx react-native build-ios --mode=Release',
        ],
        runCommands: [
            'npx react-native run-android',
            'npx react-native run-ios',
        ],
        packageCommands: [
            'cd android && ./gradlew bundleRelease',
            'cd ios && xcodebuild archive -workspace $PROJECT.xcworkspace -scheme $PROJECT',
        ],
        description: 'React Native — cross-platform iOS + Android from JS/TS',
    },
    flutter: {
        id: 'flutter',
        name: 'Flutter',
        category: 'mobile',
        arch: ['arm64', 'x86_64'],
        dockerImage: 'cirrusci/flutter:latest',
        requiredTools: ['flutter', 'dart'],
        detectFiles: ['pubspec.yaml', 'lib/main.dart', '.dart_tool/'],
        initCommands: [
            'flutter create $PROJECT_NAME',
        ],
        buildCommands: [
            'flutter build apk --release',
            'flutter build ios --release',
            'flutter build web',
        ],
        runCommands: [
            'flutter run',
            'flutter run -d chrome',
        ],
        packageCommands: [
            'flutter build appbundle',
            'flutter build ipa',
        ],
        description: 'Flutter — Dart-based cross-platform (iOS, Android, Web, Desktop)',
    },
    // ── Desktop ──
    electron: {
        id: 'electron',
        name: 'Electron',
        category: 'desktop',
        arch: ['x86_64', 'arm64'],
        dockerImage: 'electronuserland/builder:wine',
        requiredTools: ['node', 'npx'],
        detectFiles: ['electron.js', 'electron/', 'main.js', 'electron-builder.yml'],
        initCommands: [
            'npm init -y',
            'npm install electron electron-builder --save-dev',
        ],
        buildCommands: [
            'npx electron-builder --mac',
            'npx electron-builder --win',
            'npx electron-builder --linux',
        ],
        runCommands: [
            'npx electron .',
        ],
        packageCommands: [
            'npx electron-builder --mac --win --linux --publish never',
        ],
        description: 'Electron — web tech → desktop app (macOS, Windows, Linux)',
    },
    tauri: {
        id: 'tauri',
        name: 'Tauri',
        category: 'desktop',
        arch: ['x86_64', 'arm64'],
        dockerImage: null,
        requiredTools: ['cargo', 'rustc', 'node'],
        detectFiles: ['src-tauri/', 'tauri.conf.json'],
        initCommands: [
            'npm create tauri-app@latest $PROJECT_NAME',
        ],
        buildCommands: [
            'npx tauri build',
            'npx tauri build --target universal-apple-darwin',
        ],
        runCommands: [
            'npx tauri dev',
        ],
        packageCommands: [
            'npx tauri build --bundles dmg,msi,deb,appimage',
        ],
        description: 'Tauri — Rust backend + web frontend → tiny desktop app',
    },
    macos: {
        id: 'macos',
        name: 'macOS Native',
        category: 'desktop',
        arch: ['arm64', 'x86_64'],
        dockerImage: null,
        requiredTools: ['swift', 'xcodebuild'],
        detectFiles: ['*.xcodeproj', 'Package.swift', 'Sources/'],
        initCommands: [
            'swift package init --type executable --name $PROJECT_NAME',
        ],
        buildCommands: [
            'swift build -c release',
            'xcodebuild -scheme $SCHEME -configuration Release build',
        ],
        runCommands: [
            'swift run',
            '.build/release/$PROJECT_NAME',
        ],
        packageCommands: [
            'productbuild --component $APP /Applications $PROJECT_NAME.pkg',
        ],
        description: 'macOS native — Swift/SwiftUI, notarized for distribution',
    },
    windows: {
        id: 'windows',
        name: 'Windows',
        category: 'desktop',
        arch: ['x86_64', 'arm64'],
        dockerImage: null,
        requiredTools: [],
        detectFiles: ['*.sln', '*.csproj', '*.vcxproj'],
        initCommands: [
            'dotnet new console -n $PROJECT_NAME',
        ],
        buildCommands: [
            'dotnet build -c Release',
            'dotnet publish -c Release -r win-x64 --self-contained',
        ],
        runCommands: [
            'dotnet run',
        ],
        packageCommands: [
            'dotnet publish -c Release -r win-x64 -p:PublishSingleFile=true --self-contained',
        ],
        description: 'Windows native — .NET/C#, WinUI, MSIX packaging',
    },
    linux: {
        id: 'linux',
        name: 'Linux',
        category: 'desktop',
        arch: ['x86_64', 'arm64', 'armv7'],
        dockerImage: 'ubuntu:24.04',
        requiredTools: ['gcc', 'make'],
        detectFiles: ['Makefile', 'CMakeLists.txt', 'meson.build', 'configure'],
        initCommands: [
            'mkdir -p src && touch src/main.c Makefile',
        ],
        buildCommands: [
            'make release',
            'cmake --build build --config Release',
        ],
        runCommands: [
            './build/$PROJECT_NAME',
        ],
        packageCommands: [
            'dpkg-deb --build $DEB_DIR',
            'rpmbuild -ba $SPEC_FILE',
            'makepkg -si',
        ],
        description: 'Linux native — C/C++/Rust, deb/rpm/AUR packaging',
    },
    // ── Embedded ──
    'raspberry-pi': {
        id: 'raspberry-pi',
        name: 'Raspberry Pi',
        category: 'embedded',
        arch: ['arm64', 'armv7'],
        dockerImage: 'arm64v8/debian:bookworm',
        requiredTools: [],
        detectFiles: [],
        initCommands: [
            'mkdir -p src',
        ],
        buildCommands: [
            'docker run --rm --platform linux/arm64 -v $(pwd):/app -w /app arm64v8/debian:bookworm bash -c "apt-get update && apt-get install -y gcc && gcc src/main.c -o build/app"',
            'cross-env GOOS=linux GOARCH=arm64 go build -o build/app',
        ],
        runCommands: [
            'scp build/app pi@$RPI_HOST:/home/pi/',
            'ssh pi@$RPI_HOST ./app',
        ],
        packageCommands: [],
        description: 'Raspberry Pi — ARM64/ARMv7 cross-compilation',
    },
    arduino: {
        id: 'arduino',
        name: 'Arduino',
        category: 'embedded',
        arch: ['avr', 'arm'],
        dockerImage: 'arduino/arduino-cli:latest',
        requiredTools: ['arduino-cli'],
        detectFiles: ['*.ino', 'sketch.yaml', 'arduino.yaml'],
        initCommands: [
            'arduino-cli sketch new $PROJECT_NAME',
            'arduino-cli core install arduino:avr',
        ],
        buildCommands: [
            'arduino-cli compile --fqbn $BOARD_FQBN .',
        ],
        runCommands: [
            'arduino-cli upload -p $PORT --fqbn $BOARD_FQBN .',
            'arduino-cli monitor -p $PORT',
        ],
        packageCommands: [],
        description: 'Arduino — AVR/ARM microcontrollers, sensors, IoT',
    },
    esp32: {
        id: 'esp32',
        name: 'ESP32',
        category: 'embedded',
        arch: ['xtensa', 'riscv'],
        dockerImage: 'espressif/idf:v5.2',
        requiredTools: ['idf.py'],
        detectFiles: ['sdkconfig', 'main/CMakeLists.txt', 'CMakeLists.txt'],
        initCommands: [
            'idf.py create-project $PROJECT_NAME',
        ],
        buildCommands: [
            'idf.py build',
        ],
        runCommands: [
            'idf.py flash -p $PORT',
            'idf.py monitor -p $PORT',
        ],
        packageCommands: [],
        description: 'ESP32 — WiFi/BLE IoT microcontroller (ESP-IDF)',
    },
    // ── Web ──
    pwa: {
        id: 'pwa',
        name: 'PWA',
        category: 'web',
        arch: ['wasm32'],
        dockerImage: 'node:22-slim',
        requiredTools: ['node', 'npx'],
        detectFiles: ['vite.config.ts', 'vite.config.js', 'next.config.js', 'webpack.config.js', 'package.json'],
        initCommands: [
            'npm create vite@latest $PROJECT_NAME -- --template react-ts',
        ],
        buildCommands: [
            'npm run build',
        ],
        runCommands: [
            'npm run dev',
            'npm run preview',
        ],
        packageCommands: [
            'npm run build && npx serve dist',
        ],
        description: 'Progressive Web App — works offline, installable',
    },
    // ── WASM ──
    wasm: {
        id: 'wasm',
        name: 'WebAssembly',
        category: 'wasm',
        arch: ['wasm32'],
        dockerImage: 'emscripten/emsdk:latest',
        requiredTools: [],
        detectFiles: ['Cargo.toml', '*.c', '*.cpp', '*.rs'],
        initCommands: [
            'cargo init --name $PROJECT_NAME',
            'cargo add wasm-bindgen',
        ],
        buildCommands: [
            'wasm-pack build --target web',
            'emcc src/main.c -o build/app.wasm -s WASM=1',
        ],
        runCommands: [
            'python3 -m http.server 8080',
        ],
        packageCommands: [
            'wasm-pack build --target bundler',
            'wasm-opt -O3 build/app.wasm -o build/app.opt.wasm',
        ],
        description: 'WebAssembly — near-native performance in browsers and edge',
    },
    // ── Server ──
    docker: {
        id: 'docker',
        name: 'Docker Container',
        category: 'server',
        arch: ['x86_64', 'arm64'],
        dockerImage: null,
        requiredTools: ['docker'],
        detectFiles: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml'],
        initCommands: [
            'touch Dockerfile docker-compose.yml',
        ],
        buildCommands: [
            'docker build -t $IMAGE_NAME .',
            'docker buildx build --platform linux/amd64,linux/arm64 -t $IMAGE_NAME .',
        ],
        runCommands: [
            'docker run --rm -it $IMAGE_NAME',
            'docker compose up',
        ],
        packageCommands: [
            'docker push $REGISTRY/$IMAGE_NAME',
        ],
        description: 'Docker — containerized deployment, multi-arch builds',
    },
    kubernetes: {
        id: 'kubernetes',
        name: 'Kubernetes',
        category: 'server',
        arch: ['x86_64', 'arm64'],
        dockerImage: null,
        requiredTools: ['kubectl', 'helm'],
        detectFiles: ['k8s/', 'kubernetes/', 'helm/', 'Chart.yaml', 'kustomization.yaml'],
        initCommands: [
            'mkdir -p k8s',
            'helm create $PROJECT_NAME',
        ],
        buildCommands: [
            'kubectl apply -f k8s/',
            'helm install $RELEASE_NAME ./helm/$PROJECT_NAME',
        ],
        runCommands: [
            'kubectl port-forward svc/$SERVICE 8080:80',
            'kubectl logs -f deployment/$DEPLOYMENT',
        ],
        packageCommands: [
            'helm package ./helm/$PROJECT_NAME',
        ],
        description: 'Kubernetes — orchestrated container deployment',
    },
    'cloud-function': {
        id: 'cloud-function',
        name: 'Cloud Functions',
        category: 'server',
        arch: ['x86_64'],
        dockerImage: 'node:22-slim',
        requiredTools: ['node'],
        detectFiles: ['serverless.yml', 'netlify.toml', 'vercel.json', 'supabase/functions/', 'functions/'],
        initCommands: [
            'npx serverless create --template aws-nodejs-typescript',
        ],
        buildCommands: [
            'npx serverless package',
            'npx supabase functions deploy $FUNCTION_NAME',
        ],
        runCommands: [
            'npx serverless offline',
            'npx supabase functions serve',
        ],
        packageCommands: [
            'npx serverless deploy',
        ],
        description: 'Serverless — AWS Lambda, Supabase Edge, Vercel, Netlify',
    },
};
// ── Detection ──
/** Check if a CLI tool is available */
export function isToolAvailable(tool) {
    try {
        execSync(`which ${tool}`, { stdio: 'ignore', timeout: 3000 });
        return true;
    }
    catch {
        return false;
    }
}
/** Detect which build targets the current project supports */
export function detectProjectTargets(cwd = process.cwd()) {
    const detected = [];
    for (const target of Object.values(BUILD_TARGETS)) {
        for (const pattern of target.detectFiles) {
            if (pattern.includes('*')) {
                // Glob pattern — check with shell
                try {
                    const result = execSync(`ls ${join(cwd, pattern)} 2>/dev/null`, {
                        encoding: 'utf-8', timeout: 3000,
                    }).trim();
                    if (result) {
                        detected.push(target);
                        break;
                    }
                }
                catch { /* no match */ }
            }
            else {
                // Direct file/dir check
                if (existsSync(join(cwd, pattern))) {
                    detected.push(target);
                    break;
                }
            }
        }
    }
    return detected;
}
/** Check which required tools are missing for a target */
export function getMissingTools(target) {
    return target.requiredTools.filter(t => !isToolAvailable(t));
}
/** Get all targets in a category */
export function getTargetsByCategory(category) {
    return Object.values(BUILD_TARGETS).filter(t => t.category === category);
}
/** Format target info for display */
export function formatTargetInfo(target) {
    const missing = getMissingTools(target);
    const status = missing.length === 0 ? '✓ ready' : `✗ missing: ${missing.join(', ')}`;
    const archStr = target.arch.join(', ');
    return [
        `${target.name} (${target.id})`,
        `  Category:  ${target.category}`,
        `  Arch:      ${archStr}`,
        `  Docker:    ${target.dockerImage || 'requires local tools'}`,
        `  Status:    ${status}`,
        `  ${target.description}`,
    ].join('\n');
}
/** Format a compact target list */
export function formatTargetList(targets) {
    const categories = new Map();
    for (const t of targets) {
        if (!categories.has(t.category))
            categories.set(t.category, []);
        categories.get(t.category).push(t);
    }
    const lines = [];
    for (const [category, categoryTargets] of categories) {
        lines.push(`  ${category.toUpperCase()}`);
        for (const t of categoryTargets) {
            const missing = getMissingTools(t);
            const icon = missing.length === 0 ? '✓' : '○';
            lines.push(`    ${icon} ${t.id.padEnd(16)} ${t.name.padEnd(20)} ${t.arch.join(', ')}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=build-targets.js.map