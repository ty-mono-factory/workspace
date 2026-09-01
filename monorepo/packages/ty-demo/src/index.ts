import { join } from 'node:path'
import { createRequire } from 'module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const nativePath = join(fileURLToPath(new URL('.', import.meta.url)), '../../build/Release/ty_demo.node')

interface TyDemoNativeBinding {
    getWholeSentence(name?: string): string
}

const nativeBinding = require(nativePath) as TyDemoNativeBinding

export interface TyDemo {
    getWholeSentence(name?: string): string
}

export const tyDemo: TyDemo = {
    getWholeSentence: (name = 'chenty') => nativeBinding.getWholeSentence(name)
}
