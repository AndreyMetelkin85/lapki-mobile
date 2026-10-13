# Разработка Android приложения Лапки

## Настройка Windows

Нужны Node.js 22.13+, JDK 17 и Android Studio с SDK Platform 36, Platform Tools и Android Emulator. Настройте `JAVA_HOME`, `ANDROID_HOME` и PATH для `platform-tools`. Запустите эмулятор Android 16 / API 36 и общий Docker Compose магазина.

Из папки мобильного проекта:

```powershell
npm ci
npm run android
```

Команда генерирует Android-проект из `app.json`, устанавливает `com.lapki.training` и запускает Metro. Для последующих изменений TypeScript достаточно `npm start`, если debug-приложение уже установлено. Сгенерированные `android` и `ios` не редактируются вручную и не коммитятся; нативные настройки меняются через `app.json` и плагины.

Перед работой с API Expo сверяйте документацию [SDK 57](https://docs.expo.dev/versions/v57.0.0/). [Настройка среды Android](https://docs.expo.dev/get-started/set-up-your-environment/?buildEnv=local&device=simulated&mode=development-build&platform=android).

## Сборка автономного APK

С установленным Android SDK: `npm run android:release`. Без Android SDK на Windows, через Docker Desktop с Linux-контейнерами:

```powershell
npm run build:apk:docker
```

Результат — `artifacts/lapki-android.apk`, по умолчанию для x86_64. Для ARM-телефона соберите другой APK:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -Architecture arm64-v8a
adb install -r artifacts/lapki-android.apk
```

APK включает JavaScript и работает без Metro. Подпись учебная; для публикации в магазине приложений нужен собственный release-ключ. Первая Docker-сборка скачивает JDK, SDK, NDK и Gradle.

Образ доставки собирается **после публикации APK**, а не вместо него:

```powershell
docker build -f docker/Dockerfile.distribution -t andymentor/lapki-mobile:latest .
```

Он загружает закреплённый APK из GitHub Release и проверяет SHA-256. Android SDK и приватные ключи в runtime-образ не входят. Перед новым выпуском согласуйте версию, URL и контрольную сумму в Dockerfile доставки.

## Подключение

Эмулятор по умолчанию использует `http://10.0.2.2:8080/api/v3`. API можно сменить в «Аккаунт → Подключение»; сохранённая настройка имеет приоритет над `EXPO_PUBLIC_API_BASE_URL` из `.env.example` при сборке.

Для физического телефона с ARM-сборкой по USB:

```powershell
adb reverse tcp:8080 tcp:8080
```

В приложении укажите `http://127.0.0.1:8080/api/v3`. Для Wi-Fi нужны LAN-адрес компьютера, публикация порта и разрешение firewall. Docker-имя `backend` и адрес эмулятора обычному телефону не подходят. HTTP разрешён только для учебного локального запуска; JWT-ключ сервера и пароль БД клиенту не передаются.

## Структура и данные

Маршруты Expo Router — `src/app`; компоненты, модели и бизнес-правила находятся вне каталога маршрутов. `tests` содержит unit-проверки, `scripts` — сборку и экспорт ресурсов, `docker` — сборку APK и его доставку, `assets/branding` — логотип и значки.

Мобильная витрина показывает опубликованные заполненные карточки с фотографиями и обязательными характеристиками. Старые записи с пустыми полями и фиктивными `photoUrls` не показываются. Отсутствие остатка само по себе карточку не скрывает.

JWT хранится в SecureStore; refresh-токена нет, после истечения нужно войти снова. Гостевая корзина и безопасные метаданные незавершённых операций хранятся в AsyncStorage отдельно для серверов и пользователей. Ключи оформления и оплаты сохраняются для безопасных повторов; реквизиты карт и пароли не сохраняются и не логируются.

## Проверки и ресурсы

```powershell
npm run typecheck
npm run lint
npm test
npm run bundle:android
```

Unit-тесты проверяют карточки каталога, деньги, валидацию, объединение корзин, восстановление оформления/оплаты и доставку APK. К рабочей БД они не обращаются. Установка и покупательский сценарий на эмуляторе проверяются вручную; мобильной UI-автоматизации пока нет.

У Expo SDK 57 остаются предупреждения `npm audit`, включая инструменты сборки. `audit fix --force` предлагает несовместимые версии и автоматически не применяется.

Утверждённые изображения находятся в `assets/branding`; происхождение записано в `generation.json`. Экспорт адаптивного слоя: `npm run branding:export` с проверкой SHA-256 исходника. Изменение значка и нативной заставки требует новой сборки APK, а не только перезапуска Metro.
