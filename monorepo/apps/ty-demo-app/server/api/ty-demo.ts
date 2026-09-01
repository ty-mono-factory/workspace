import { getWholeSentence } from '../services/native-binding.js'

export default defineEventHandler(async () => {
    try {
        const data = getWholeSentence('chenty-apps')
        return `${data}`
    } catch (error) {
        console.error('Error details:', error)
        return {
            success: false,
            data: error instanceof Error ? error.message : 'Unknown error',
        }
    }
})
