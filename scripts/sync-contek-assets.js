import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootDir = path.resolve(__dirname, '..')
const assetsDir = path.resolve(rootDir, 'src/assets')
const publicDir = path.resolve(rootDir, 'public')

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

// 1. Símbolo Contek (c-da-contek-23a2f.png)
const symbolCandidates = [
  path.join(assetsDir, 'c-da-contek-23a2f.png'),
  path.join(assetsDir, 'contek-symbol.png'),
  path.join(publicDir, 'contek-symbol.png'),
]
const symbolSrc = symbolCandidates.find((p) => fs.existsSync(p))
const symbolPublic = path.join(publicDir, 'contek-symbol.png')
const symbolAsset = path.join(assetsDir, 'contek-symbol.png')

if (symbolSrc) {
  try {
    fs.copyFileSync(symbolSrc, symbolPublic)
    fs.copyFileSync(symbolSrc, symbolAsset)
    console.log(
      '[sync-contek-assets] contek-symbol.png copiado com sucesso para public/ e src/assets/',
    )
  } catch (err) {
    console.error('[sync-contek-assets] Falha ao copiar contek-symbol:', err)
  }
}

// 2. Logo Horizontal Contek (logo-contek-correto-25856.png)
const fullLogoCandidates = [
  path.join(assetsDir, 'logo-contek-correto-25856.png'),
  path.join(assetsDir, 'contek-logo-full.png'),
  path.join(publicDir, 'contek-logo-full.png'),
]
const fullLogoSrc = fullLogoCandidates.find((p) => fs.existsSync(p))
const fullLogoPublic = path.join(publicDir, 'contek-logo-full.png')
const fullLogoAsset = path.join(assetsDir, 'contek-logo-full.png')

if (fullLogoSrc) {
  try {
    fs.copyFileSync(fullLogoSrc, fullLogoPublic)
    fs.copyFileSync(fullLogoSrc, fullLogoAsset)
    console.log(
      '[sync-contek-assets] contek-logo-full.png copiado com sucesso para public/ e src/assets/',
    )
  } catch (err) {
    console.error('[sync-contek-assets] Falha ao copiar contek-logo-full:', err)
  }
}
