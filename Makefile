.PHONY: build install clean format

install:
	npm ci

compile:
	npx tsc --noEmit

clean:
	rm -rf node_modules build artifacts

format:
	npx prettier --write .

#---------
## Building

dev:
	NODE_ENV=development npx vite build --mode development --watch

# Chrome 是默认构建目标（vite.config.ts 中未设置 VITE_TARGET_BROWSER 时）
build-chrome:
	npm run build
	mkdir -p artifacts && cd build && zip -FS ../artifacts/chrome.zip -r *

build-firefox:
	VITE_TARGET_BROWSER=firefox npx vite build
	mkdir -p artifacts && cd build && zip -FS ../artifacts/firefox.zip -r *
