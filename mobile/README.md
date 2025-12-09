# Mobile App Template

This is a separate mobile application template designed to convert your website into an Android and iOS app using [Capacitor](https://capacitorjs.com/).

## Project Structure
- `src/`: React Native (Web) source code (Vite + React + TypeScript).
- `android/`: Native Android project.
- `ios/`: Native iOS project.
- `capacitor.config.ts`: Capacitor configuration.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Develop in Browser:**
    ```bash
    npm run dev
    ```

3.  **Sync to Native:**
    After making changes, build the web assets and sync to native folders:
    ```bash
    npm run build
    npx cap sync
    ```

4.  **Run on Device/Simulator:**
    - **Android:** `npx cap open android` (Requires Android Studio)
    - **iOS:** `npx cap open ios` (Requires Xcode)

## Deployment
- Update `capacitor.config.ts` with your App ID and Name.
- Use Android Studio / Xcode to build release binaries.
