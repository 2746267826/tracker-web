import browser from 'webextension-polyfill'
import {
  getBaseUrl,
  getBrowserName,
  getWebUrl,
  setBaseUrl,
  setBrowserName,
  setWebUrl,
} from '../storage'
import { detectBrowser } from '../background/helpers'
import config from '../config'

let optionsReady = false

async function reloadExtension(): Promise<void> {
  browser.runtime.reload()

  // Close the settings popup on Chromium based browsers
  if (detectBrowser() !== 'firefox') {
    window.close()
  }
}

async function saveOptions(e: SubmitEvent): Promise<void> {
  e.preventDefault()
  if (!optionsReady) return

  const baseUrlInput = document.querySelector<HTMLInputElement>('#baseUrl')
  if (!baseUrlInput?.reportValidity()) return

  const webUrlInput = document.querySelector<HTMLInputElement>('#webUrl')
  if (webUrlInput && !webUrlInput.reportValidity()) return

  const browserSelect = document.querySelector<HTMLSelectElement>('#browser')
  const customBrowserInput =
    document.querySelector<HTMLInputElement>('#customBrowser')
  if (!browserSelect) return

  let selectedBrowser = browserSelect.value
  if (selectedBrowser === 'other' && customBrowserInput?.value) {
    selectedBrowser = customBrowserInput.value.toLowerCase()
  }
  if (selectedBrowser === '' && customBrowserInput?.value) {
    selectedBrowser = customBrowserInput.value.toLowerCase()
  }

  const form = e.target as HTMLFormElement
  const button = form.querySelector<HTMLButtonElement>('button')
  if (!button) return

  const hint = document.querySelector<HTMLElement>('#save-hint')
  button.textContent = '保存中…'

  try {
    await setBaseUrl(baseUrlInput.value.trim() || config.daemon.defaultBaseUrl)
    if (webUrlInput) {
      const webUrl = webUrlInput.value.trim()
      if (webUrl) {
        await setWebUrl(webUrl)
      } else {
        await browser.storage.local.remove('webUrl')
      }
    }
    if (selectedBrowser) {
      await setBrowserName(selectedBrowser)
    } else {
      await browser.storage.local.remove('browserName')
    }
    await appendSavedLog()
    await reloadExtension()
    button.textContent = '保存'
    if (hint) hint.textContent = '已保存'
  } catch (error) {
    console.error('Failed to save options:', error)
    button.textContent = '保存失败'
    if (hint) hint.textContent = String(error)
  }
}

async function appendSavedLog() {
  const { appendLog } = await import('../storage')
  await appendLog('info', '设置已更新，扩展重新加载')
}

function toggleCustomBrowserInput(): void {
  const browserSelect = document.querySelector<HTMLSelectElement>('#browser')
  const customInput = document.querySelector<HTMLInputElement>('#customBrowser')

  if (browserSelect && customInput) {
    const isOther = browserSelect.value === 'other'
    customInput.style.display = isOther ? 'block' : 'none'
    customInput.required = isOther
  }
}

async function restoreOptions(): Promise<void> {
  const baseUrl = await getBaseUrl()
  const baseUrlInput = document.querySelector<HTMLInputElement>('#baseUrl')
  if (baseUrlInput) {
    baseUrlInput.value = baseUrl ?? config.daemon.defaultBaseUrl
  }

  const webUrl = await getWebUrl()
  const webUrlInput = document.querySelector<HTMLInputElement>('#webUrl')
  if (webUrlInput && webUrl) {
    webUrlInput.value = webUrl
  }

  const browserName = await getBrowserName()
  const browserSelect = document.querySelector<HTMLSelectElement>('#browser')
  const customInput = document.querySelector<HTMLInputElement>('#customBrowser')

  if (browserSelect && customInput) {
    if (!browserName) {
      browserSelect.value = ''
      customInput.style.display = 'none'
      customInput.required = false
    } else {
      const standardBrowsers = Array.from(browserSelect.options).map(
        (opt) => opt.value,
      )
      if (!standardBrowsers.includes(browserName)) {
        browserSelect.value = 'other'
        customInput.style.display = 'block'
        customInput.value = browserName
        customInput.required = true
      } else {
        browserSelect.value = browserName
        customInput.style.display = 'none'
        customInput.required = false
      }
    }
  }
}

async function initializeOptions(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  )
  if (button) button.disabled = true

  try {
    await restoreOptions()
    optionsReady = true
    if (button) button.disabled = false
  } catch (error) {
    console.error('Failed to initialize options:', error)
    if (button) {
      button.textContent = '加载设置失败'
      button.classList.add('error')
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void initializeOptions()
  toggleCustomBrowserInput()
})

document
  .querySelector('#browser')
  ?.addEventListener('change', toggleCustomBrowserInput)
const form = document.querySelector('form')
if (form) {
  form.addEventListener('submit', (e: Event) => {
    e.preventDefault()
    saveOptions(e as SubmitEvent)
  })
}
