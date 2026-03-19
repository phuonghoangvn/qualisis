import { NextResponse } from 'next/server'
const pdf = require('pdf-parse/lib/pdf-parse.js')
import mammoth from 'mammoth'

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        let text = ''

        const fileName = file.name.toLowerCase()

        if (fileName.endsWith('.pdf')) {
            const data = await pdf(buffer)
            text = data.text
        } else if (fileName.endsWith('.docx')) {
            const result = await mammoth.extractRawText({ buffer })
            text = result.value
        } else {
            // fallback to reading as text (txt, csv, md, vtt)
            text = buffer.toString('utf-8')
            
            // Basic sanity check for null characters if it's supposed to be raw text
            // Replace null bytes because Postgres TEXT cannot contain them
            text = text.replace(/\0/g, '')
        }

        // Clean up common bad characters for database compatibility
        text = text.replace(/\0/g, '')

        return NextResponse.json({ text, fileName: file.name })
    } catch (e: any) {
        console.error('File parsing error:', e)
        return NextResponse.json({ error: e.message || 'Failed to extract text from file' }, { status: 500 })
    }
}
