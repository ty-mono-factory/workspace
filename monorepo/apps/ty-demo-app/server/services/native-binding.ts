import { tyDemo } from '@monorepo/ty-demo'

export function getWholeSentence(name?: string): string {
    const result = tyDemo.getWholeSentence(name)
    return result
}
